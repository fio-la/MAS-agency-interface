import type {
  AgencyDim,
  Config,
  DesignElement,
  FeatureDef,
  FeatureId,
  Need,
  Phase,
} from './types';

// Every agency-support module, grounded in the paper's codebook (Table 2) and
// the participant quotes / literature that motivated it.
export const FEATURES: FeatureDef[] = [
  // ---- D8 Workflow visibility (11/20) ----
  {
    id: 'flowchart',
    label: 'Workflow flowchart',
    description: 'Live flow chart of agents, steps and hand-offs.',
    design: 'D8',
    dims: ['trust', 'control'],
    phase: 'execute',
    source: 'P1',
    quote: 'maybe in a flow chart or something like that would help',
  },
  {
    id: 'timeline',
    label: 'Activity timeline',
    description: 'Status of each agent per step over time, to see where an agent started breaking down.',
    design: 'D8',
    dims: ['evaluation', 'trust'],
    phase: 'execute',
    source: 'P14',
    quote: 'showing the status of each agent per step',
  },
  {
    id: 'auditTrail',
    label: 'Audit trail',
    description: 'Persistent, exportable record of every agent and human action.',
    design: 'D8',
    dims: ['trust', 'evaluation'],
    phase: 'execute',
    source: 'P15',
    quote: 'every action would have an audit trail',
  },
  {
    id: 'animation',
    label: 'Agent animation',
    description: 'Animated hand-offs and pulsing active agents.',
    design: 'D8',
    dims: ['trust'],
    phase: 'execute',
    source: 'P4',
  },
  {
    id: 'messages',
    label: 'Inter-agent messages',
    description: 'Expose orchestration: what agents tell each other.',
    design: 'D8',
    dims: ['trust', 'evaluation'],
    phase: 'execute',
    source: 'P19; Zhang et al. (ConvoMap)',
    quote: "it's a black box … especially orchestration agents",
  },
  {
    id: 'rationale',
    label: 'Input & reasoning per step',
    description: 'For every step: what the agent received and why it produced its output.',
    design: 'D8',
    dims: ['evaluation', 'trust'],
    phase: 'evaluate',
    source: 'P1, P7; Ye et al. (Deep Cognition)',
    quote: 'understand not only what an agent produced, but why',
  },
  {
    id: 'agentProfiles',
    label: 'Agent avatars & expertise',
    description: 'Each agent has an avatar, role and stated expertise.',
    design: 'D8',
    dims: ['trust'],
    phase: 'delegate',
    source: 'Rapp et al. (avatars for explainable MAS)',
  },
  {
    id: 'actionPreview',
    label: 'Preview before side effects',
    description: 'Actions that change the world (publishing, posting, deploying) are previewed first.',
    design: 'D8',
    dims: ['control', 'trust'],
    phase: 'execute',
    source: 'P8; Balaskas et al.',
    quote: 'preview before actually deducting',
  },
  // ---- D7 Human in the loop (8/20) ----
  {
    id: 'checkpoints',
    label: 'Approval checkpoints',
    description: 'Pause for your approval at key steps or every step (see granularity).',
    design: 'D7',
    dims: ['control', 'ownership'],
    phase: 'execute',
    source: 'P3',
    quote: 'after every step, my input is needed so that I get to verify every step',
  },
  {
    id: 'redirect',
    label: 'Mid-run redirect',
    description: 'Pause and steer agents while they are working, not only before or after.',
    design: 'D7',
    dims: ['control', 'ownership'],
    phase: 'execute',
    source: 'P16',
    quote: "it's going in a way we don't want it to go, so we can redirect it",
  },
  {
    id: 'editOutputs',
    label: 'Edit intermediate outputs',
    description: 'Rewrite an agent’s output before downstream agents use it.',
    design: 'D7',
    dims: ['ownership', 'control'],
    phase: 'execute',
    source: 'Joshi & Vogel (involvement → ownership)',
  },
  {
    id: 'corrections',
    label: 'Corrections memory',
    description: 'Issues you mark are stored and applied to future runs as a reusable signal.',
    design: 'D7',
    dims: ['control', 'trust'],
    phase: 'own',
    source: 'P1',
    quote: 'whichever went wrong, we need to mark it … multiple iterations',
  },
  // ---- D6 Reliability safeguards (7/20) ----
  {
    id: 'confidence',
    label: 'Confidence scores',
    description: 'Every step reports how confident the agent is.',
    design: 'D6',
    dims: ['trust', 'evaluation'],
    phase: 'evaluate',
    source: 'P5, P15',
    quote: "if the system isn't confident enough, it should just say that",
  },
  {
    id: 'uncertaintyPause',
    label: 'Pause on low confidence',
    description: 'When confidence falls below your threshold, the system stops and asks.',
    design: 'D6',
    dims: ['control', 'trust'],
    phase: 'execute',
    source: 'P15',
  },
  {
    id: 'verifier',
    label: 'Verification tool',
    description: 'Ask an independent verifier agent to fact-check any step.',
    design: 'D6',
    dims: ['evaluation', 'trust'],
    phase: 'evaluate',
    source: 'P6',
    quote: 'tool for verification',
  },
  // ---- D5 Software design approaches (7/20) ----
  {
    id: 'trails',
    label: 'Stigmergic trails',
    description:
      'Agents leave success / danger trails on hand-offs so downstream agents double-check risky inputs and errors do not cascade.',
    design: 'D5',
    dims: ['trust'],
    phase: 'execute',
    source: 'P16',
    quote: 'how ants behave … they leave a trail',
  },
  // ---- D4 Guidance support (4/20) ----
  {
    id: 'starterPrompts',
    label: 'Starter prompts',
    description: 'Ready-made task prompts to get going.',
    design: 'D4',
    dims: ['control'],
    phase: 'delegate',
    source: 'P8',
    quote: 'a couple of prompts already there',
  },
  {
    id: 'clarifyingQuestions',
    label: 'Clarification questions',
    description: 'The orchestrator asks what you mean before it plans.',
    design: 'D4',
    dims: ['control', 'ownership'],
    phase: 'delegate',
    source: 'P11',
  },
  // ---- D3 Resource controls (4/20) ----
  {
    id: 'costMeter',
    label: 'Token budget & cost meter',
    description: 'Watch spend live and stop at a budget.',
    design: 'D3',
    dims: ['control'],
    phase: 'execute',
    source: 'P1',
    quote: 'token detection',
  },
  {
    id: 'modelSwitch',
    label: 'Per-agent model choice',
    description: 'Swap an agent to a smaller, cheaper model (with lower confidence).',
    design: 'D3',
    dims: ['control'],
    phase: 'execute',
    source: 'P1',
    quote: 'where you can use a smaller model',
  },
  {
    id: 'killAgent',
    label: 'Remove agents',
    description: 'Remove a redundant agent from the run to save time and compute.',
    design: 'D3',
    dims: ['control'],
    phase: 'execute',
    source: 'P16',
    quote: 'the orchestrator [can] kill that agent',
  },
  // ---- D2 Gamification (1/20) ----
  {
    id: 'quiz',
    label: 'Run quiz',
    description: 'A short quiz about what happened in the run.',
    design: 'D2',
    dims: ['evaluation'],
    phase: 'own',
    source: 'P18',
    quote: 'a little quiz',
  },
  // ---- D1 Summaries (1/20) ----
  {
    id: 'summary',
    label: 'Outcome summary',
    description: 'High-level summary of the result and how it was reached.',
    design: 'D1',
    dims: ['evaluation', 'trust'],
    phase: 'evaluate',
    source: 'P7',
    quote: 'summaries',
  },
  // ---- Literature-derived ----
  {
    id: 'contributionLedger',
    label: 'Contribution ledger',
    description: 'Shows what you contributed versus the agents: inputs, edits, redirects, approvals.',
    design: 'L',
    dims: ['ownership'],
    phase: 'own',
    source: 'Xu et al.; Draxler et al. (ownership)',
    quote: "without my input, I think they're just dead tools",
  },
];

export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f])) as Record<
  FeatureId,
  FeatureDef
>;

export const DESIGN_ELEMENTS: Record<
  DesignElement,
  { label: string; count: number | null; blurb: string }
> = {
  D8: { label: 'Workflow visibility', count: 11, blurb: 'See what each agent is doing and why.' },
  D7: { label: 'Human in the loop', count: 8, blurb: 'Approve, intervene and correct, also mid-run.' },
  D6: { label: 'Reliability safeguards', count: 7, blurb: 'The system communicates its own uncertainty.' },
  D5: { label: 'Software design approaches', count: 7, blurb: 'Better collaboration between agents.' },
  D4: { label: 'Guidance support', count: 4, blurb: 'Make starting easier.' },
  D3: { label: 'Resource controls', count: 4, blurb: 'Control what agents may access or spend.' },
  D2: { label: 'Gamification', count: 1, blurb: 'Playful engagement with the result.' },
  D1: { label: 'Summaries', count: 1, blurb: 'Outcome-level overview.' },
  L: { label: 'From the literature', count: null, blurb: 'Mechanisms proposed in related work.' },
};

export const DESIGN_ORDER: DesignElement[] = ['D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'L'];

export const DIM_META: Record<AgencyDim, { label: string; short: string }> = {
  trust: { label: 'Trust', short: 'T' },
  control: { label: 'Control', short: 'C' },
  evaluation: { label: 'Critical evaluation', short: 'E' },
  ownership: { label: 'Ownership', short: 'O' },
};

export const PHASES: { id: Phase; label: string; dim: AgencyDim; hint: string }[] = [
  { id: 'delegate', label: 'Delegate', dim: 'trust', hint: 'Decide what to hand over' },
  { id: 'execute', label: 'Execute', dim: 'control', hint: 'Watch and steer the agents' },
  { id: 'evaluate', label: 'Evaluate', dim: 'evaluation', hint: 'Check the result' },
  { id: 'own', label: 'Own & reflect', dim: 'ownership', hint: 'Whose work is it?' },
];

export const NEED_META: Record<Need, { label: string; count: number; quote: string }> = {
  control: { label: 'Control', count: 10, quote: 'you have to approve it before releasing it' },
  understanding: { label: 'Understanding', count: 9, quote: 'why it reached that output' },
  transparency: { label: 'Transparency', count: 8, quote: 'what was the input for each agent' },
  visibility: { label: 'Visibility', count: 7, quote: 'more visibility on the workflow' },
  reliability: { label: 'Reliability', count: 4, quote: 'outputs can sometimes be unpredictable' },
  oversight: { label: 'Oversight', count: 3, quote: 'never … operate completely autonomously' },
  technical: { label: 'Technical improvement', count: 3, quote: 'better collaboration between agents' },
};

/** Which features address which need (used by the needs-based onboarding). */
export const NEED_FEATURES: Record<Need, FeatureId[]> = {
  control: ['checkpoints', 'redirect', 'editOutputs', 'killAgent'],
  understanding: ['rationale', 'summary', 'agentProfiles'],
  transparency: ['auditTrail', 'messages', 'rationale'],
  visibility: ['flowchart', 'timeline', 'animation'],
  reliability: ['confidence', 'verifier', 'uncertaintyPause'],
  oversight: ['checkpoints', 'actionPreview', 'uncertaintyPause'],
  technical: ['trails', 'modelSwitch', 'corrections'],
};

/**
 * Per-participant configurations transcribed from Fig. 2 (needs) and Fig. 3 (design
 * elements). Fig. 3 places D1 at P18 and D2 at P7, while the text attributes the quiz
 * to P18 and summaries to P7; we follow the text.
 */
export const PARTICIPANTS: { id: string; design: DesignElement[]; needs: Need[] }[] = [
  { id: 'P1', design: ['D3', 'D4', 'D5', 'D6', 'D7', 'D8'], needs: ['transparency', 'technical'] },
  { id: 'P2', design: ['D4'], needs: ['oversight'] },
  { id: 'P3', design: ['D6', 'D7'], needs: ['control', 'understanding', 'technical'] },
  { id: 'P4', design: ['D5', 'D8'], needs: ['control', 'understanding', 'visibility'] },
  { id: 'P5', design: ['D5', 'D6', 'D7', 'D8'], needs: ['control', 'transparency', 'reliability', 'oversight', 'technical'] },
  { id: 'P6', design: ['D5'], needs: ['reliability'] },
  { id: 'P7', design: ['D1', 'D8'], needs: ['understanding', 'transparency', 'visibility', 'oversight'] },
  { id: 'P8', design: ['D3', 'D8'], needs: ['control'] },
  { id: 'P9', design: ['D6', 'D7'], needs: ['control', 'understanding'] },
  { id: 'P10', design: ['D7'], needs: ['transparency'] },
  { id: 'P11', design: ['D3', 'D5', 'D7', 'D8'], needs: ['control', 'understanding', 'visibility'] },
  { id: 'P12', design: ['D6'], needs: ['reliability'] },
  { id: 'P13', design: ['D3', 'D8'], needs: ['understanding'] },
  { id: 'P14', design: ['D4', 'D8'], needs: ['understanding', 'transparency', 'visibility'] },
  { id: 'P15', design: ['D5', 'D7', 'D8'], needs: ['control', 'visibility'] },
  { id: 'P16', design: ['D4', 'D6', 'D7'], needs: ['understanding'] },
  { id: 'P17', design: ['D5'], needs: ['reliability'] },
  { id: 'P18', design: ['D2', 'D8'], needs: ['control', 'transparency', 'visibility'] },
  { id: 'P19', design: ['D6'], needs: ['control', 'understanding', 'transparency'] },
  { id: 'P20', design: ['D8'], needs: ['control', 'transparency', 'visibility'] },
];

const ALL_OFF = Object.fromEntries(FEATURES.map((f) => [f.id, false])) as Record<FeatureId, boolean>;

export function featuresFrom(ids: FeatureId[]): Record<FeatureId, boolean> {
  const out = { ...ALL_OFF };
  ids.forEach((id) => (out[id] = true));
  return out;
}

export function featuresForDesign(els: DesignElement[]): FeatureId[] {
  return FEATURES.filter((f) => els.includes(f.design)).map((f) => f.id);
}

export function featuresForNeeds(needs: Need[]): FeatureId[] {
  return Array.from(new Set(needs.flatMap((n) => NEED_FEATURES[n])));
}

export const BASE_CONFIG: Omit<Config, 'features'> = {
  transparency: 'outcome',
  approvalMode: 'final',
  confidenceThreshold: 0.7,
  tokenBudget: 60000,
  speed: 1,
};

export interface Preset {
  id: string;
  label: string;
  description: string;
  build: () => Config;
}

export const PRESETS: Preset[] = [
  {
    id: 'outcome',
    label: 'Outcome only',
    description: 'Input–output legibility is enough: summary + confidence, minimal friction.',
    build: () => ({
      ...BASE_CONFIG,
      transparency: 'outcome',
      features: featuresFrom(['summary', 'confidence', 'starterPrompts']),
    }),
  },
  {
    id: 'process',
    label: 'Process insight',
    description: 'See inside the black box: flowchart, timeline, messages, reasoning, audit trail.',
    build: () => ({
      ...BASE_CONFIG,
      transparency: 'process',
      features: featuresFrom([
        'flowchart', 'timeline', 'auditTrail', 'animation', 'messages', 'rationale',
        'agentProfiles', 'confidence', 'summary',
      ]),
    }),
  },
  {
    id: 'hands-on',
    label: 'Hands-on',
    description: 'Human in the loop at every stage: checkpoints, redirect, previews, corrections.',
    build: () => ({
      ...BASE_CONFIG,
      transparency: 'process',
      approvalMode: 'checkpoints',
      features: featuresFrom([
        'flowchart', 'checkpoints', 'redirect', 'editOutputs', 'corrections', 'actionPreview',
        'confidence', 'uncertaintyPause', 'verifier', 'clarifyingQuestions', 'contributionLedger',
        'rationale', 'auditTrail',
      ]),
    }),
  },
  {
    id: 'resource',
    label: 'Resource-conscious',
    description: 'Keep cost and compute in check: budget, model choice, remove agents.',
    build: () => ({
      ...BASE_CONFIG,
      transparency: 'outcome',
      features: featuresFrom(['costMeter', 'modelSwitch', 'killAgent', 'summary', 'confidence', 'agentProfiles']),
    }),
  },
  {
    id: 'all',
    label: 'Everything',
    description: 'All agency-support modules switched on.',
    build: () => ({
      ...BASE_CONFIG,
      transparency: 'process',
      approvalMode: 'checkpoints',
      features: featuresFrom(FEATURES.map((f) => f.id)),
    }),
  },
];

export const DEFAULT_CONFIG: Config = PRESETS[1].build();

export function configFromParticipant(pid: string): Config {
  const p = PARTICIPANTS.find((x) => x.id === pid);
  if (!p) return DEFAULT_CONFIG;
  const ids = featuresForDesign(p.design);
  const hasHitl = p.design.includes('D7');
  const hasVis = p.design.includes('D8');
  return {
    ...BASE_CONFIG,
    transparency: hasVis ? 'process' : 'outcome',
    approvalMode: hasHitl ? 'checkpoints' : 'final',
    features: featuresFrom(ids),
  };
}
