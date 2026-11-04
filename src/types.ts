// Core types for the configurable MAS agency interface.

/** The four agency dimensions examined in the paper. */
export type AgencyDim = 'trust' | 'control' | 'evaluation' | 'ownership';

/**
 * Delegation lifecycle (Sec. 2.2 / 5.1): trust governs delegation, control governs
 * execution, critical evaluation governs assessment, ownership is retrospective.
 */
export type Phase = 'delegate' | 'execute' | 'evaluate' | 'own';

/** Design elements from the codebook (Table 2 / Fig. 3). */
export type DesignElement = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8' | 'L';

/** User needs (Sec. 4.6 / Fig. 2). */
export type Need =
  | 'control'
  | 'understanding'
  | 'transparency'
  | 'visibility'
  | 'reliability'
  | 'oversight'
  | 'technical';

export type FeatureId =
  // D8 workflow visibility
  | 'flowchart'
  | 'timeline'
  | 'auditTrail'
  | 'animation'
  | 'messages'
  | 'rationale'
  | 'agentProfiles'
  | 'actionPreview'
  // D7 human in the loop
  | 'checkpoints'
  | 'redirect'
  | 'editOutputs'
  | 'corrections'
  // D6 reliability safeguards
  | 'confidence'
  | 'uncertaintyPause'
  | 'verifier'
  // D5 software design approaches
  | 'trails'
  // D4 guidance
  | 'starterPrompts'
  | 'clarifyingQuestions'
  // D3 resource controls
  | 'costMeter'
  | 'modelSwitch'
  | 'killAgent'
  // D2 gamification
  | 'quiz'
  // D1 summaries
  | 'summary'
  // literature-derived (ownership)
  | 'contributionLedger';

export interface FeatureDef {
  id: FeatureId;
  label: string;
  description: string;
  design: DesignElement;
  dims: AgencyDim[];
  phase: Phase;
  /** Participant evidence or literature source. */
  source: string;
  quote?: string;
}

export type Transparency = 'outcome' | 'process';
export type ApprovalMode = 'final' | 'checkpoints' | 'every';

export interface Config {
  features: Record<FeatureId, boolean>;
  /** Default transparency layer (Sec. 5.5): outcome vs process. */
  transparency: Transparency;
  /** HITL granularity: approve final output only, key checkpoints, or every step. */
  approvalMode: ApprovalMode;
  /** Below this confidence, the system says it is unsure (and may pause). */
  confidenceThreshold: number;
  /** Token budget for resource controls. */
  tokenBudget: number;
  /** Simulation speed multiplier. */
  speed: number;
}

// ---------------------------------------------------------------------------
// Scenario definitions (simulated MAS)
// ---------------------------------------------------------------------------

export type ModelSize = 'large' | 'small';

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  expertise: string;
  color: string;
  initials: string;
  model: ModelSize;
}

export interface StepDef {
  id: string;
  agentId: string;
  title: string;
  dependsOn: string[];
  /** Duration in ticks. */
  duration: number;
  tokens: number;
  /** What the agent received. */
  input: string;
  /** Why the agent did what it did (process transparency). */
  rationale: string;
  /** Output text; `{{flaw}}` is replaced by flaw.text or flaw.fixed. */
  output: string;
  /** Base confidence 0..1 when running on a large model. */
  confidence: number;
  /** Key checkpoint for the "checkpoints" approval mode. */
  checkpoint?: boolean;
  /** Action with external side effects: previewed before it takes effect. */
  sideEffect?: { label: string; preview: string };
  /** A planted mistake / hallucination, discoverable through verification. */
  flaw?: { text: string; fixed: string; note: string };
  /** Messages sent to downstream agents on completion. */
  messages?: { to: string; text: string }[];
}

export interface Clarification {
  id: string;
  question: string;
  options: string[];
}

export interface Scenario {
  id: string;
  title: string;
  domain: string;
  /** Default task prompt. */
  prompt: string;
  starterPrompts: string[];
  clarifications: Clarification[];
  agents: AgentDef[];
  steps: StepDef[];
  /** Outcome-level summary of the final deliverable. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

export type StepStatus =
  | 'pending'
  | 'running'
  | 'awaiting_approval'
  | 'awaiting_preview'
  | 'done'
  | 'skipped';

export interface StepState {
  status: StepStatus;
  progress: number;
  output: string;
  confidence: number;
  startedAt?: number;
  endedAt?: number;
  attempts: number;
  redirectNotes: string[];
  editedByUser: boolean;
  approvedByUser: boolean;
  verified?: 'pass' | 'issue';
  userIssue?: string;
  /** Whether the planted flaw has been fixed, and by what. */
  flawFixed: boolean;
  fixSource?: 'memory' | 'human';
  /** Why the step is waiting, if awaiting approval. */
  gateReason?: 'checkpoint' | 'every' | 'low-confidence';
  /** Sensed a danger trail from an upstream step (stigmergy). */
  dangerSensed?: boolean;
}

export type Actor = 'human' | 'agent' | 'system';

export type LogKind =
  | 'plan'
  | 'start'
  | 'complete'
  | 'message'
  | 'gate'
  | 'approve'
  | 'reject'
  | 'edit'
  | 'redirect'
  | 'kill'
  | 'model'
  | 'pause'
  | 'resume'
  | 'preview'
  | 'budget'
  | 'uncertain'
  | 'verify'
  | 'issue'
  | 'trail'
  | 'final';

export interface LogEntry {
  id: number;
  tick: number;
  time: string;
  kind: LogKind;
  actor: Actor;
  agentId?: string;
  stepId?: string;
  to?: string;
  text: string;
}

export interface AgentRuntime {
  killed: boolean;
  model: ModelSize;
}

export type RunStatus = 'idle' | 'running' | 'paused' | 'awaiting' | 'completed' | 'stopped';

export interface Correction {
  id: string;
  scenarioId: string;
  stepId: string;
  note: string;
  createdAt: string;
}

export interface RunState {
  scenarioId: string;
  task: string;
  clarAnswers: Record<string, string>;
  status: RunStatus;
  tick: number;
  steps: Record<string, StepState>;
  agents: Record<string, AgentRuntime>;
  tokensUsed: number;
  cost: number;
  budget: number;
  budgetHit: boolean;
  log: LogEntry[];
  finalApproved: boolean;
  appliedCorrections: Correction[];
}

export interface Ratings {
  ownership: number; // M1: 0 = Me ... 100 = AI
  evaluation: number; // M2
  control1: number; // M3: 0 = Me ... 100 = AI
  control2: number; // M4
  tias1: number; // M5 (1-7)
  tias2: number; // M6
  tias3: number; // M7
}
