import { SCENARIO_BY_ID } from './scenarios';
import type {
  Actor,
  Config,
  Correction,
  LogEntry,
  LogKind,
  ModelSize,
  RunState,
  Scenario,
  StepDef,
  StepState,
} from './types';

// A deterministic, simulated multi-agent runtime. Agents execute a DAG of steps;
// the human can pause, approve, reject, redirect, edit, remove agents, swap models,
// verify, and preview side effects. All of it is recorded in an audit log.

export type Action =
  | {
      type: 'START';
      scenario: Scenario;
      config: Config;
      task: string;
      clarAnswers: Record<string, string>;
      corrections: Correction[];
    }
  | { type: 'TICK'; config: Config }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }
  | { type: 'RESET' }
  | { type: 'APPROVE'; stepId: string; config: Config }
  | { type: 'REJECT'; stepId: string; note: string }
  | { type: 'PREVIEW_APPROVE'; stepId: string }
  | { type: 'PREVIEW_SKIP'; stepId: string; config: Config }
  | { type: 'REDIRECT'; agentId: string; text: string }
  | { type: 'KILL'; agentId: string; config: Config }
  | { type: 'SET_MODEL'; agentId: string; model: ModelSize }
  | { type: 'VERIFY'; stepId: string }
  | { type: 'MARK_ISSUE'; stepId: string; note: string }
  | { type: 'EDIT_OUTPUT'; stepId: string; text: string }
  | { type: 'RAISE_BUDGET'; extra: number }
  | { type: 'APPROVE_FINAL' };

const RATE: Record<ModelSize, number> = { large: 0.012, small: 0.002 }; // $ per 1k tokens
const TOKEN_FACTOR: Record<ModelSize, number> = { large: 1, small: 0.6 };

export const EMPTY_RUN: RunState = {
  scenarioId: '',
  task: '',
  clarAnswers: {},
  status: 'idle',
  tick: 0,
  steps: {},
  agents: {},
  tokensUsed: 0,
  cost: 0,
  budget: 0,
  budgetHit: false,
  log: [],
  finalApproved: false,
  appliedCorrections: [],
};

function scenarioOf(s: RunState): Scenario {
  return SCENARIO_BY_ID[s.scenarioId];
}

function stepDef(s: RunState, id: string): StepDef {
  return scenarioOf(s).steps.find((x) => x.id === id)!;
}

function agentName(s: RunState, id: string): string {
  return scenarioOf(s).agents.find((a) => a.id === id)?.name ?? id;
}

function log(
  s: RunState,
  kind: LogKind,
  actor: Actor,
  text: string,
  extra: Partial<Pick<LogEntry, 'agentId' | 'stepId' | 'to'>> = {},
): RunState {
  const entry: LogEntry = {
    id: s.log.length + 1, // log is append-only within a run, so this is unique
    tick: s.tick,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    kind,
    actor,
    text,
    ...extra,
  };
  return { ...s, log: [...s.log, entry] };
}

function setStep(s: RunState, id: string, patch: Partial<StepState>): RunState {
  return { ...s, steps: { ...s.steps, [id]: { ...s.steps[id], ...patch } } };
}

const resolved = (st: StepState) => st.status === 'done' || st.status === 'skipped';
const awaiting = (st: StepState) => st.status === 'awaiting_approval' || st.status === 'awaiting_preview';

export function confidenceFor(def: StepDef, model: ModelSize, flawFixed: boolean): number {
  let c = def.confidence;
  if (def.flaw && flawFixed) c = Math.max(c, 0.88);
  if (model === 'small') c -= 0.12;
  return Math.max(0.05, Math.min(0.99, c));
}

function durationFor(def: StepDef, model: ModelSize) {
  return model === 'small' ? Math.max(1, Math.ceil(def.duration * 0.7)) : def.duration;
}

export function stepDuration(s: RunState, id: string) {
  const def = stepDef(s, id);
  return durationFor(def, s.agents[def.agentId]?.model ?? 'large');
}

function composeOutput(s: RunState, def: StepDef, st: StepState): string {
  const sc = scenarioOf(s);
  let out = def.output.replace('{{flaw}}', def.flaw ? (st.flawFixed ? def.flaw.fixed : def.flaw.text) : '');
  if (def.id === 'plan') {
    const answers = sc.clarifications.filter((c) => s.clarAnswers[c.id]).map((c) => s.clarAnswers[c.id]);
    if (answers.length) out += ` Scope agreed with you: ${answers.join(', ')}.`;
  }
  const missing = def.dependsOn.filter((d) => s.steps[d]?.status === 'skipped');
  if (missing.length) {
    out += ` (Proceeded without input from: ${missing.map((m) => stepDef(s, m).title).join(', ')}.)`;
  }
  if (st.redirectNotes.length) {
    out += ` Adjusted per your direction: “${st.redirectNotes.join('”; “')}”.`;
  }
  return out;
}

/** Recompute run status after an intervention. */
function settle(s: RunState): RunState {
  if (s.status === 'paused' || s.status === 'stopped' || s.status === 'idle') return s;
  const steps = Object.values(s.steps);
  if (steps.some(awaiting)) return { ...s, status: 'awaiting' };
  if (steps.every(resolved)) {
    if (s.status === 'completed') return s;
    return log({ ...s, status: 'completed' }, 'final', 'system', 'All agents finished. Result is ready for your evaluation.');
  }
  return { ...s, status: 'running' };
}

function completeStep(s: RunState, id: string, config: Config): RunState {
  const def = stepDef(s, id);
  const st = s.steps[id];
  const output = composeOutput(s, def, st);
  s = setStep(s, id, { output, progress: durationFor(def, s.agents[def.agentId].model) });
  const conf = st.confidence;
  s = log(s, 'complete', 'agent', `${def.title}: ${output}`, { agentId: def.agentId, stepId: id });

  if (conf < config.confidenceThreshold) {
    s = log(s, 'uncertain', 'agent', `I am not confident about “${def.title}” (${Math.round(conf * 100)}%). Please check it.`, {
      agentId: def.agentId,
      stepId: id,
    });
  }

  const f = config.features;
  let gate: StepState['gateReason'];
  if (f.uncertaintyPause && conf < config.confidenceThreshold) gate = 'low-confidence';
  else if (f.checkpoints && config.approvalMode === 'every') gate = 'every';
  else if (f.checkpoints && config.approvalMode === 'checkpoints' && def.checkpoint) gate = 'checkpoint';

  if (gate) {
    s = setStep(s, id, { status: 'awaiting_approval', gateReason: gate });
    const why =
      gate === 'low-confidence' ? 'confidence below your threshold' : gate === 'every' ? 'you approve every step' : 'key checkpoint';
    s = log(s, 'gate', 'system', `Waiting for your approval of “${def.title}” (${why}).`, { agentId: def.agentId, stepId: id });
    return s;
  }
  return finishStep(s, id);
}

function finishStep(s: RunState, id: string): RunState {
  const def = stepDef(s, id);
  s = setStep(s, id, { status: 'done', endedAt: s.tick, gateReason: undefined });
  if (def.sideEffect) {
    s = log(s, 'preview', 'agent', `Executed: ${def.sideEffect.label}.`, { agentId: def.agentId, stepId: id });
  }
  for (const m of def.messages ?? []) {
    if (s.agents[m.to]?.killed) continue;
    s = log(s, 'message', 'agent', m.text, { agentId: def.agentId, to: m.to, stepId: id });
  }
  return s;
}

function startStep(s: RunState, id: string, config: Config): RunState {
  const def = stepDef(s, id);
  if (def.sideEffect && config.features.actionPreview) {
    s = setStep(s, id, { status: 'awaiting_preview' });
    return log(s, 'gate', 'system', `Preview before it takes effect: ${def.sideEffect.label}.`, { agentId: def.agentId, stepId: id });
  }
  s = setStep(s, id, { status: 'running', progress: 0, startedAt: s.tick });
  s = log(s, 'start', 'agent', `Started “${def.title}”.`, { agentId: def.agentId, stepId: id });

  // Stigmergic trails (P16): a downstream agent senses a danger trail left by a
  // low-confidence upstream step and double-checks its input before using it.
  if (config.features.trails) {
    for (const up of def.dependsOn) {
      const ust = s.steps[up];
      const udef = stepDef(s, up);
      const danger = ust.status === 'done' && (ust.confidence < config.confidenceThreshold || ust.verified === 'issue');
      if (!danger) continue;
      s = setStep(s, id, { dangerSensed: true });
      const flawed = udef.flaw && !ust.flawFixed && !ust.editedByUser;
      s = log(
        s,
        'trail',
        'agent',
        flawed
          ? `Sensed a danger trail from “${udef.title}” and re-checked it: ${udef.flaw!.note}`
          : `Sensed a danger trail from “${udef.title}”, re-checked the input and found no problem.`,
        { agentId: def.agentId, stepId: up },
      );
      if (flawed) s = setStep(s, up, { verified: 'issue' });
    }
  }
  return s;
}

function newStepState(def: StepDef, model: ModelSize, flawFixed: boolean): StepState {
  return {
    status: 'pending',
    progress: 0,
    output: '',
    confidence: confidenceFor(def, model, flawFixed),
    attempts: 0,
    redirectNotes: [],
    editedByUser: false,
    approvedByUser: false,
    flawFixed,
    fixSource: flawFixed ? 'memory' : undefined,
  };
}

export function reducer(s: RunState, a: Action): RunState {
  switch (a.type) {
    case 'START': {
      const { scenario, config, corrections } = a;
      const relevant = config.features.corrections ? corrections.filter((c) => c.scenarioId === scenario.id) : [];
      const agents = Object.fromEntries(scenario.agents.map((ag) => [ag.id, { killed: false, model: ag.model }]));
      const steps = Object.fromEntries(
        scenario.steps.map((d) => [
          d.id,
          newStepState(d, agents[d.agentId].model, relevant.some((c) => c.stepId === d.id && !!d.flaw)),
        ]),
      );
      let s: RunState = {
        ...EMPTY_RUN,
        scenarioId: scenario.id,
        task: a.task,
        clarAnswers: a.clarAnswers,
        status: 'running',
        steps,
        agents,
        budget: config.tokenBudget,
        appliedCorrections: relevant,
      };
      s = log(s, 'plan', 'human', `Delegated task: “${a.task}”`);
      for (const [qid, ans] of Object.entries(a.clarAnswers)) {
        const q = scenario.clarifications.find((c) => c.id === qid);
        if (q) s = log(s, 'plan', 'human', `Clarified — ${q.question} ${ans}`);
      }
      for (const c of relevant) {
        s = log(s, 'plan', 'system', `Applied stored correction to “${scenario.steps.find((x) => x.id === c.stepId)?.title}”: ${c.note}`, {
          stepId: c.stepId,
        });
      }
      return s;
    }

    case 'TICK': {
      if (s.status !== 'running') return s;
      const config = a.config;
      let n: RunState = { ...s, tick: s.tick + 1 };

      // Advance running steps.
      for (const [id, st] of Object.entries(n.steps)) {
        if (st.status !== 'running') continue;
        const def = stepDef(n, id);
        const model = n.agents[def.agentId].model;
        const dur = durationFor(def, model);
        const tokens = Math.round((def.tokens * TOKEN_FACTOR[model]) / dur);
        n = { ...n, tokensUsed: n.tokensUsed + tokens, cost: n.cost + (tokens / 1000) * RATE[model] };
        n = setStep(n, id, { progress: st.progress + 1 });
        if (st.progress + 1 >= dur) n = completeStep(n, id, config);
      }

      // Start steps whose dependencies are resolved.
      for (const def of scenarioOf(n).steps) {
        const st = n.steps[def.id];
        if (st.status !== 'pending') continue;
        if (!def.dependsOn.every((d) => resolved(n.steps[d]))) continue;
        if (n.agents[def.agentId].killed) {
          n = setStep(n, def.id, { status: 'skipped' });
          continue;
        }
        const busy = scenarioOf(n).steps.some(
          (o) => o.agentId === def.agentId && o.id !== def.id && ['running', 'awaiting_approval', 'awaiting_preview'].includes(n.steps[o.id].status),
        );
        if (!busy) n = startStep(n, def.id, config);
      }

      // Resource control: stop at the token budget.
      if (config.features.costMeter && !n.budgetHit && n.tokensUsed >= n.budget) {
        n = log({ ...n, status: 'paused', budgetHit: true }, 'budget', 'system', `Token budget of ${n.budget.toLocaleString()} reached. Run paused.`);
        return n;
      }
      return settle(n);
    }

    case 'PAUSE':
      if (s.status !== 'running' && s.status !== 'awaiting') return s;
      return log({ ...s, status: 'paused' }, 'pause', 'human', 'Paused the run.');

    case 'RESUME':
      if (s.status !== 'paused') return s;
      return settle(log({ ...s, status: 'running' }, 'resume', 'human', 'Resumed the run.'));

    case 'STOP':
      return log({ ...s, status: 'stopped' }, 'pause', 'human', 'Stopped the run.');

    case 'RESET':
      return EMPTY_RUN;

    case 'APPROVE': {
      const st = s.steps[a.stepId];
      if (st?.status !== 'awaiting_approval') return s;
      let n = setStep(s, a.stepId, { approvedByUser: true });
      n = log(n, 'approve', 'human', `Approved “${stepDef(s, a.stepId).title}”.`, { stepId: a.stepId, agentId: stepDef(s, a.stepId).agentId });
      n = finishStep(n, a.stepId);
      return settle(n);
    }

    case 'REJECT': {
      const st = s.steps[a.stepId];
      if (st?.status !== 'awaiting_approval') return s;
      const def = stepDef(s, a.stepId);
      const fix = !!def.flaw && !st.flawFixed;
      const notes = a.note ? [...st.redirectNotes, a.note] : st.redirectNotes;
      let n = setStep(s, a.stepId, {
        status: 'running',
        progress: 0,
        attempts: st.attempts + 1,
        redirectNotes: notes,
        flawFixed: st.flawFixed || fix,
        fixSource: st.flawFixed ? st.fixSource : fix ? 'human' : undefined,
        confidence: confidenceFor(def, s.agents[def.agentId].model, st.flawFixed || fix),
        gateReason: undefined,
        verified: undefined,
      });
      n = log(n, 'reject', 'human', `Sent “${def.title}” back${a.note ? `: “${a.note}”` : ''}.`, { stepId: a.stepId, agentId: def.agentId });
      return settle(n);
    }

    case 'PREVIEW_APPROVE': {
      const def = stepDef(s, a.stepId);
      let n = setStep(s, a.stepId, { status: 'running', progress: 0, startedAt: s.tick, approvedByUser: true });
      n = log(n, 'approve', 'human', `Approved action after preview: ${def.sideEffect?.label}.`, { stepId: a.stepId, agentId: def.agentId });
      return settle(n);
    }

    case 'PREVIEW_SKIP': {
      const def = stepDef(s, a.stepId);
      let n = setStep(s, a.stepId, { status: 'skipped', output: 'Skipped by you after preview.' });
      n = log(n, 'reject', 'human', `Blocked action after preview: ${def.sideEffect?.label}.`, { stepId: a.stepId, agentId: def.agentId });
      return settle(n);
    }

    case 'REDIRECT': {
      if (!a.text.trim()) return s;
      let n = s;
      const targets = scenarioOf(s).steps.filter(
        (d) => (a.agentId === 'all' || d.agentId === a.agentId) && ['pending', 'running', 'awaiting_preview'].includes(s.steps[d.id].status),
      );
      for (const d of targets) {
        n = setStep(n, d.id, { redirectNotes: [...n.steps[d.id].redirectNotes, a.text] });
      }
      const who = a.agentId === 'all' ? 'all agents' : agentName(s, a.agentId);
      n = log(n, 'redirect', 'human', `Redirected ${who}: “${a.text}” (${targets.length} upcoming step${targets.length === 1 ? '' : 's'} affected).`, {
        agentId: a.agentId === 'all' ? undefined : a.agentId,
      });
      return n;
    }

    case 'KILL': {
      let n: RunState = { ...s, agents: { ...s.agents, [a.agentId]: { ...s.agents[a.agentId], killed: true } } };
      for (const d of scenarioOf(s).steps) {
        if (d.agentId === a.agentId && !resolved(n.steps[d.id])) n = setStep(n, d.id, { status: 'skipped' });
      }
      n = log(n, 'kill', 'human', `Removed ${agentName(s, a.agentId)} from the run.`, { agentId: a.agentId });
      return settle(n);
    }

    case 'SET_MODEL': {
      let n: RunState = { ...s, agents: { ...s.agents, [a.agentId]: { ...s.agents[a.agentId], model: a.model } } };
      for (const d of scenarioOf(s).steps) {
        const st = n.steps[d.id];
        if (d.agentId === a.agentId && (st.status === 'pending' || st.status === 'running')) {
          n = setStep(n, d.id, { confidence: confidenceFor(d, a.model, st.flawFixed) });
        }
      }
      return log(n, 'model', 'human', `Switched ${agentName(s, a.agentId)} to the ${a.model} model.`, { agentId: a.agentId });
    }

    case 'VERIFY': {
      const def = stepDef(s, a.stepId);
      const st = s.steps[a.stepId];
      const issue = !!def.flaw && !st.flawFixed && !st.editedByUser;
      let n = setStep(s, a.stepId, { verified: issue ? 'issue' : 'pass' });
      n = { ...n, tokensUsed: n.tokensUsed + 800, cost: n.cost + 0.8 * RATE.large };
      n = log(
        n,
        'verify',
        'system',
        issue ? `Verifier found a problem in “${def.title}”: ${def.flaw!.note}` : `Verifier checked “${def.title}”: no problems found.`,
        { stepId: a.stepId, agentId: def.agentId },
      );
      return n;
    }

    case 'MARK_ISSUE': {
      const def = stepDef(s, a.stepId);
      const n = setStep(s, a.stepId, { userIssue: a.note });
      return log(n, 'issue', 'human', `Marked an issue in “${def.title}”: ${a.note}`, { stepId: a.stepId, agentId: def.agentId });
    }

    case 'EDIT_OUTPUT': {
      const def = stepDef(s, a.stepId);
      const n = setStep(s, a.stepId, { output: a.text, editedByUser: true, verified: undefined });
      return log(n, 'edit', 'human', `Edited the output of “${def.title}”.`, { stepId: a.stepId, agentId: def.agentId });
    }

    case 'RAISE_BUDGET': {
      const n: RunState = { ...s, budget: s.budget + a.extra, budgetHit: false, status: 'running' };
      return settle(log(n, 'budget', 'human', `Raised the token budget to ${n.budget.toLocaleString()} and resumed.`));
    }

    case 'APPROVE_FINAL':
      return log({ ...s, finalApproved: true }, 'final', 'human', 'Approved and released the final result.');
  }
}

/** Topological levels for laying out the workflow graph. */
export function levels(sc: Scenario): Record<string, number> {
  const lv: Record<string, number> = {};
  const visit = (id: string): number => {
    if (lv[id] !== undefined) return lv[id];
    const d = sc.steps.find((x) => x.id === id)!;
    lv[id] = d.dependsOn.length ? Math.max(...d.dependsOn.map(visit)) + 1 : 0;
    return lv[id];
  };
  sc.steps.forEach((s) => visit(s.id));
  return lv;
}
