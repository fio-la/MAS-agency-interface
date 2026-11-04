import { useEffect, useState, type Dispatch } from 'react';
import { stepDuration, type Action } from '../engine';
import { download } from '../storage';
import type { Config, LogEntry, RunState, Scenario, StepDef } from '../types';
import { Avatar, Card, Confidence, Segmented, StatusPill } from './ui';
import { Timeline, WorkflowGraph } from './Workflow';

interface Props {
  scenario: Scenario;
  run: RunState;
  config: Config;
  setConfig: (c: Config) => void;
  dispatch: Dispatch<Action>;
  onEvaluate: () => void;
}

const STATUS_TEXT: Record<RunState['status'], string> = {
  idle: 'Not started',
  running: 'Agents working',
  paused: 'Paused',
  awaiting: 'Waiting for you',
  completed: 'Finished',
  stopped: 'Stopped',
};

export function ExecuteView({ scenario, run, config, setConfig, dispatch, onEvaluate }: Props) {
  const f = config.features;
  const [selected, setSelected] = useState<string | null>(null);
  const process = config.transparency === 'process';
  const done = Object.values(run.steps).filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const total = scenario.steps.length;
  const waiting = scenario.steps.filter((s) => ['awaiting_approval', 'awaiting_preview'].includes(run.steps[s.id].status));

  return (
    <div className="stack">
      <div className="control-bar">
        <div className={`run-status rs-${run.status}`}>
          <span className="dot" />
          {STATUS_TEXT[run.status]}
          <span className="muted small">
            {done}/{total} steps
          </span>
        </div>
        <div className="controls">
          {run.status === 'paused' && !run.budgetHit ? (
            <button className="btn" onClick={() => dispatch({ type: 'RESUME' })}>
              ▶ Resume
            </button>
          ) : (
            <button className="btn" disabled={!['running', 'awaiting'].includes(run.status)} onClick={() => dispatch({ type: 'PAUSE' })}>
              ❚❚ Pause
            </button>
          )}
          <button
            className="btn ghost"
            disabled={['completed', 'stopped'].includes(run.status)}
            onClick={() => dispatch({ type: 'STOP' })}
          >
            ■ Stop
          </button>
          <label className="speed small">
            Speed
            <select value={config.speed} onChange={(e) => setConfig({ ...config, speed: Number(e.target.value) })}>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>
        <Segmented
          value={config.transparency}
          onChange={(v) => setConfig({ ...config, transparency: v })}
          options={[
            { value: 'outcome', label: 'Outcome view', title: 'Inputs and results only' },
            { value: 'process', label: 'Process view', title: 'What each agent is doing and why' },
          ]}
        />
        {f.costMeter && <CostMeter run={run} />}
      </div>

      {run.budgetHit && (
        <div className="banner warn">
          <span>
            Token budget reached ({run.tokensUsed.toLocaleString()} / {run.budget.toLocaleString()}). The agents are paused.
          </span>
          <button className="btn primary" onClick={() => dispatch({ type: 'RAISE_BUDGET', extra: 20000 })}>
            Add 20k tokens & continue
          </button>
          <button className="btn ghost" onClick={() => dispatch({ type: 'STOP' })}>
            Stop here
          </button>
        </div>
      )}

      {waiting.map((s) => (
        <DecisionCard key={s.id} def={s} scenario={scenario} run={run} config={config} dispatch={dispatch} />
      ))}

      {run.status === 'completed' && (
        <div className="banner ok">
          <span>All agents have finished. Check the result before you release it.</span>
          <button className="btn primary" onClick={onEvaluate}>
            Evaluate result →
          </button>
        </div>
      )}
      {run.status === 'stopped' && (
        <div className="banner">
          <span>Run stopped. You can still review what the agents produced so far.</span>
          <button className="btn" onClick={onEvaluate}>
            Review partial result →
          </button>
        </div>
      )}

      {f.redirect && !['completed', 'stopped'].includes(run.status) && <RedirectBar scenario={scenario} run={run} dispatch={dispatch} />}

      {process ? (
        <div className="grid-exec">
          <div className="stack">
            {f.flowchart && (
              <Card title="Workflow" extra={<span className="muted small">Click a step for details</span>}>
                <WorkflowGraph scenario={scenario} run={run} config={config} selected={selected} onSelect={setSelected} />
              </Card>
            )}
            {f.timeline && (
              <Card title="Activity timeline" extra={<span className="muted small">Dots mark checkpoints, warnings and your interventions</span>}>
                <Timeline scenario={scenario} run={run} config={config} />
              </Card>
            )}
            {!f.flowchart && <StepList scenario={scenario} run={run} config={config} selected={selected} onSelect={setSelected} />}
            {selected && <StepDetail def={scenario.steps.find((s) => s.id === selected)!} scenario={scenario} run={run} config={config} />}
          </div>
          <div className="stack">
            <Roster scenario={scenario} run={run} config={config} dispatch={dispatch} />
            {(f.auditTrail || f.messages) && <Feed scenario={scenario} run={run} config={config} />}
          </div>
        </div>
      ) : (
        <div className="grid-exec">
          <Card title="Progress">
            <div className="big-progress">
              <div style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <p className="muted">
              {run.status === 'completed'
                ? 'The result is ready.'
                : `The agent team is working on your task. ${total - done} step${total - done === 1 ? '' : 's'} to go.`}
            </p>
            <p className="muted small">Switch to the process view at any time to see what each agent is doing and why.</p>
          </Card>
          {(f.killAgent || f.modelSwitch) && <Roster scenario={scenario} run={run} config={config} dispatch={dispatch} />}
        </div>
      )}
    </div>
  );
}

function CostMeter({ run }: { run: RunState }) {
  const pct = Math.min(100, (run.tokensUsed / run.budget) * 100);
  return (
    <div className="cost" title="Token budget (resource control)">
      <div className="small">
        {run.tokensUsed.toLocaleString()} / {run.budget.toLocaleString()} tokens · ${run.cost.toFixed(2)}
      </div>
      <div className={`cost-bar ${pct > 85 ? 'hot' : ''}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DecisionCard({ def, scenario, run, config, dispatch }: { def: StepDef; scenario: Scenario; run: RunState; config: Config; dispatch: Dispatch<Action> }) {
  const st = run.steps[def.id];
  const agent = scenario.agents.find((a) => a.id === def.agentId)!;
  const f = config.features;
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState(st.output);
  const [editing, setEditing] = useState(false);
  useEffect(() => setDraft(st.output), [st.output]);

  if (st.status === 'awaiting_preview') {
    return (
      <div className="decision preview">
        <div className="decision-head">
          <Avatar agent={agent} />
          <div>
            <strong>Preview before it takes effect</strong>
            <div className="muted small">
              {agent.name} wants to: {def.sideEffect!.label}
            </div>
          </div>
        </div>
        <pre className="preview-box">{def.sideEffect!.preview}</pre>
        <div className="row">
          <button className="btn primary" onClick={() => dispatch({ type: 'PREVIEW_APPROVE', stepId: def.id })}>
            Allow
          </button>
          <button className="btn danger" onClick={() => dispatch({ type: 'PREVIEW_SKIP', stepId: def.id, config })}>
            Block this action
          </button>
        </div>
      </div>
    );
  }

  const reason =
    st.gateReason === 'low-confidence'
      ? `${agent.name} is not confident about this step and asks you to check it.`
      : st.gateReason === 'every'
        ? 'You approve every step.'
        : 'Key checkpoint.';

  return (
    <div className={`decision ${st.gateReason === 'low-confidence' ? 'unsure' : ''}`}>
      <div className="decision-head">
        <Avatar agent={agent} />
        <div>
          <strong>
            {def.title} <span className="muted">· {agent.name}</span>
          </strong>
          <div className="muted small">{reason}</div>
        </div>
        {f.confidence && <Confidence value={st.confidence} threshold={config.confidenceThreshold} />}
      </div>
      {f.rationale && (
        <div className="why small">
          <strong>Why:</strong> {def.rationale}
        </div>
      )}
      {editing ? (
        <textarea className="output-edit" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <p className="output">{st.output}</p>
      )}
      {st.verified === 'issue' && <p className="flag small">⚑ Flagged: {def.flaw?.note}</p>}
      <div className="row wrap">
        {editing ? (
          <button
            className="btn primary"
            onClick={() => {
              dispatch({ type: 'EDIT_OUTPUT', stepId: def.id, text: draft });
              setEditing(false);
            }}
          >
            Save edit
          </button>
        ) : (
          <button className="btn primary" onClick={() => dispatch({ type: 'APPROVE', stepId: def.id, config })}>
            Approve & continue
          </button>
        )}
        {f.editOutputs && !editing && (
          <button className="btn" onClick={() => setEditing(true)}>
            Edit output
          </button>
        )}
        {f.verifier && (
          <button className="btn" onClick={() => dispatch({ type: 'VERIFY', stepId: def.id })} disabled={!!st.verified}>
            {st.verified === 'pass' ? '✓ Verified' : 'Verify'}
          </button>
        )}
        <input className="note" placeholder="What should change?" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          className="btn"
          onClick={() => {
            dispatch({ type: 'REJECT', stepId: def.id, note });
            setNote('');
          }}
        >
          Send back
        </button>
      </div>
    </div>
  );
}

function RedirectBar({ scenario, run, dispatch }: { scenario: Scenario; run: RunState; dispatch: Dispatch<Action> }) {
  const [target, setTarget] = useState('all');
  const [text, setText] = useState('');
  const send = () => {
    dispatch({ type: 'REDIRECT', agentId: target, text });
    setText('');
  };
  return (
    <form
      className="redirect"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <span className="small strong">Redirect</span>
      <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Agent to redirect">
        <option value="all">All agents</option>
        {scenario.agents
          .filter((a) => !run.agents[a.id].killed)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
      </select>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. focus on regions with < 90% coverage" />
      <button className="btn" disabled={!text.trim()}>
        Send
      </button>
    </form>
  );
}

function Roster({ scenario, run, config, dispatch }: { scenario: Scenario; run: RunState; config: Config; dispatch: Dispatch<Action> }) {
  const f = config.features;
  return (
    <Card title="Agents">
      <ul className="roster">
        {scenario.agents.map((a) => {
          const rt = run.agents[a.id];
          const mine = scenario.steps.filter((s) => s.agentId === a.id);
          const current = mine.find((s) => ['running', 'awaiting_approval', 'awaiting_preview'].includes(run.steps[s.id].status));
          const finished = mine.every((s) => ['done', 'skipped'].includes(run.steps[s.id].status));
          const state = rt.killed ? 'removed' : current ? (run.steps[current.id].status === 'running' ? 'working' : 'waiting') : finished ? 'finished' : 'idle';
          return (
            <li key={a.id} className={rt.killed ? 'killed' : ''}>
              <Avatar agent={a} dim={rt.killed} size={30} />
              <div className="roster-main">
                <div>
                  <strong>{a.name}</strong> <span className={`agent-state as-${state}`}>{state}</span>
                </div>
                <div className="muted small">
                  {current ? current.title : a.role}
                  {f.agentProfiles && !current && <> · {a.expertise}</>}
                </div>
              </div>
              {f.modelSwitch && (
                <select
                  value={rt.model}
                  disabled={rt.killed || finished}
                  onChange={(e) => dispatch({ type: 'SET_MODEL', agentId: a.id, model: e.target.value as 'large' | 'small' })}
                  aria-label={`Model for ${a.name}`}
                >
                  <option value="large">large</option>
                  <option value="small">small</option>
                </select>
              )}
              {f.killAgent && (
                <button
                  className="icon-btn"
                  title={`Remove ${a.name} from the run`}
                  disabled={rt.killed || finished || run.status === 'completed'}
                  onClick={() => dispatch({ type: 'KILL', agentId: a.id, config })}
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function StepList({ scenario, run, config, selected, onSelect }: { scenario: Scenario; run: RunState; config: Config; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <Card title="Steps">
      <ul className="steplist">
        {scenario.steps.map((s) => {
          const st = run.steps[s.id];
          const ag = scenario.agents.find((a) => a.id === s.agentId)!;
          return (
            <li key={s.id} className={selected === s.id ? 'selected' : ''} onClick={() => onSelect(s.id)}>
              <Avatar agent={ag} size={22} />
              <span className="grow">{s.title}</span>
              {config.features.confidence && st.status === 'done' && <Confidence value={st.confidence} threshold={config.confidenceThreshold} />}
              <StatusPill status={st.status} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function StepDetail({ def, scenario, run, config }: { def: StepDef; scenario: Scenario; run: RunState; config: Config }) {
  const st = run.steps[def.id];
  const ag = scenario.agents.find((a) => a.id === def.agentId)!;
  const f = config.features;
  return (
    <Card
      title={
        <>
          <Avatar agent={ag} size={22} /> {def.title}
        </>
      }
      extra={<StatusPill status={st.status} />}
    >
      <dl className="detail">
        <dt>Agent</dt>
        <dd>
          {ag.name} — {ag.role} ({run.agents[ag.id].model} model)
        </dd>
        {f.rationale && (
          <>
            <dt>Input</dt>
            <dd>{def.input}</dd>
            <dt>Reasoning</dt>
            <dd>{def.rationale}</dd>
          </>
        )}
        <dt>Output</dt>
        <dd>{st.output || <span className="muted">Not produced yet ({Math.round((st.progress / stepDuration(run, def.id)) * 100)}%)</span>}</dd>
        {f.confidence && st.output && (
          <>
            <dt>Confidence</dt>
            <dd>
              <Confidence value={st.confidence} threshold={config.confidenceThreshold} />
            </dd>
          </>
        )}
        {st.attempts > 0 && (
          <>
            <dt>Attempts</dt>
            <dd>{st.attempts + 1}</dd>
          </>
        )}
      </dl>
    </Card>
  );
}

function Feed({ scenario, run, config }: { scenario: Scenario; run: RunState; config: Config }) {
  const f = config.features;
  const [tab, setTab] = useState<'audit' | 'messages'>(f.auditTrail ? 'audit' : 'messages');
  const [actor, setActor] = useState<'all' | 'human' | 'agent' | 'system'>('all');
  const name = (id?: string) => scenario.agents.find((a) => a.id === id)?.name ?? '';
  let items: LogEntry[] = tab === 'messages' ? run.log.filter((l) => l.kind === 'message') : run.log;
  if (tab === 'audit' && actor !== 'all') items = items.filter((l) => l.actor === actor);
  const tabs = [
    ...(f.auditTrail ? [{ value: 'audit' as const, label: 'Audit trail' }] : []),
    ...(f.messages ? [{ value: 'messages' as const, label: 'Agent messages' }] : []),
  ];

  return (
    <Card
      title={tabs.length > 1 ? <Segmented value={tab} onChange={setTab} options={tabs} /> : tabs[0].label}
      extra={
        tab === 'audit' && (
          <div className="row">
            <select value={actor} onChange={(e) => setActor(e.target.value as typeof actor)} aria-label="Filter by actor">
              <option value="all">Everyone</option>
              <option value="human">You</option>
              <option value="agent">Agents</option>
              <option value="system">System</option>
            </select>
            <button
              className="btn ghost small"
              onClick={() =>
                download(
                  `audit-${run.scenarioId}.csv`,
                  'time,tick,actor,agent,kind,text\n' +
                    run.log.map((l) => [l.time, l.tick, l.actor, name(l.agentId), l.kind, JSON.stringify(l.text)].join(',')).join('\n'),
                  'text/csv',
                )
              }
            >
              Export
            </button>
          </div>
        )
      }
    >
      <ol className="feed">
        {items
          .slice()
          .reverse()
          .map((l) => {
            const ag = scenario.agents.find((a) => a.id === l.agentId);
            return (
              <li key={l.id} className={`fe fe-${l.actor} fk-${l.kind}`}>
                <span className="fe-time">{l.time}</span>
                {l.kind === 'message' ? (
                  <span>
                    <strong style={{ color: ag?.color }}>{ag?.name}</strong> → <strong>{name(l.to)}</strong>: {l.text}
                  </span>
                ) : (
                  <span>
                    <strong>{l.actor === 'human' ? 'You' : l.actor === 'system' ? 'System' : ag?.name}</strong> {l.text}
                  </span>
                )}
              </li>
            );
          })}
        {items.length === 0 && <li className="muted small">Nothing yet.</li>}
      </ol>
    </Card>
  );
}
