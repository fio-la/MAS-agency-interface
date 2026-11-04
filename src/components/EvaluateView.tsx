import { useState, type Dispatch } from 'react';
import type { Action } from '../engine';
import type { Config, RunState, Scenario, StepDef } from '../types';
import { Avatar, Card, Confidence, Segmented, StatusPill } from './ui';

interface Props {
  scenario: Scenario;
  run: RunState;
  config: Config;
  setConfig: (c: Config) => void;
  dispatch: Dispatch<Action>;
  onMarkIssue: (stepId: string, note: string) => void;
  onOwn: () => void;
}

export function EvaluateView({ scenario, run, config, setConfig, dispatch, onMarkIssue, onOwn }: Props) {
  const f = config.features;
  const process = config.transparency === 'process';
  const sinks = scenario.steps.filter((s) => !scenario.steps.some((o) => o.dependsOn.includes(s.id)));
  // Outcome view: the deliverable-producing steps; process view: every step.
  const shown = process ? scenario.steps : scenario.steps.filter((s) => sinks.includes(s) || s.checkpoint);
  const lowConf = scenario.steps.filter((s) => run.steps[s.id].status === 'done' && run.steps[s.id].confidence < config.confidenceThreshold);
  const flagged = scenario.steps.filter((s) => run.steps[s.id].verified === 'issue' || run.steps[s.id].userIssue);
  const humanActs = run.log.filter((l) => l.actor === 'human').length;
  const skipped = scenario.steps.filter((s) => run.steps[s.id].status === 'skipped');
  // Side effects that ran without a preview already took effect during the run.
  const alreadyExecuted = scenario.steps.filter((s) => s.sideEffect && run.steps[s.id].status === 'done' && !run.steps[s.id].approvedByUser);

  return (
    <div className="stack">
      <div className="control-bar">
        <div className="muted">
          Check the result against your intent. Nearly every participant critically evaluated outputs — here are the tools for it.
        </div>
        <Segmented
          value={config.transparency}
          onChange={(v) => setConfig({ ...config, transparency: v })}
          options={[
            { value: 'outcome', label: 'Outcome view' },
            { value: 'process', label: 'Process view' },
          ]}
        />
      </div>

      {f.summary && (
        <Card title="Summary" className="summary">
          <p>{scenario.summary}</p>
          <ul className="facts">
            <li>
              <strong>{scenario.steps.length - skipped.length}</strong> of {scenario.steps.length} steps completed
              {skipped.length > 0 && <> ({skipped.map((s) => s.title).join(', ')} skipped)</>}
            </li>
            {f.confidence && (
              <li>
                <strong>{lowConf.length}</strong> step{lowConf.length === 1 ? '' : 's'} below your {Math.round(config.confidenceThreshold * 100)}%
                confidence threshold{lowConf.length > 0 && <>: {lowConf.map((s) => s.title).join(', ')}</>}
              </li>
            )}
            <li>
              <strong>{flagged.length}</strong> flagged issue{flagged.length === 1 ? '' : 's'}
            </li>
            <li>
              <strong>{humanActs}</strong> of your actions shaped this run
            </li>
            {run.appliedCorrections.length > 0 && (
              <li>
                <strong>{run.appliedCorrections.length}</strong> correction{run.appliedCorrections.length > 1 ? 's' : ''} from past runs applied
              </li>
            )}
          </ul>
        </Card>
      )}

      {shown.map((s) => (
        <Section key={s.id} def={s} scenario={scenario} run={run} config={config} dispatch={dispatch} onMarkIssue={onMarkIssue} />
      ))}
      {!process && (
        <p className="muted small center">
          Showing the deliverable and key checkpoints. Switch to the process view to inspect all {scenario.steps.length} steps.
        </p>
      )}

      <div className="final-bar">
        {run.finalApproved ? (
          <>
            <span className="ok-text">✓ You approved and released this result.</span>
            <button className="btn primary" onClick={onOwn}>
              Reflect on ownership →
            </button>
          </>
        ) : (
          <>
            <span>
              {flagged.length > 0
                ? `${flagged.length} issue${flagged.length > 1 ? 's are' : ' is'} flagged. You can still release, but consider fixing first.`
                : alreadyExecuted.length
                  ? `Note: “${alreadyExecuted.map((s) => s.sideEffect!.label).join('”, “')}” already took effect during the run (previews are off).`
                  : 'Nothing is released until you approve it.'}
            </span>
            <button className="btn primary" disabled={run.status !== 'completed'} onClick={() => dispatch({ type: 'APPROVE_FINAL' })}>
              Approve & release
            </button>
            <button className="btn ghost" onClick={onOwn}>
              Skip to reflection
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  def,
  scenario,
  run,
  config,
  dispatch,
  onMarkIssue,
}: {
  def: StepDef;
  scenario: Scenario;
  run: RunState;
  config: Config;
  dispatch: Dispatch<Action>;
  onMarkIssue: (stepId: string, note: string) => void;
}) {
  const st = run.steps[def.id];
  const ag = scenario.agents.find((a) => a.id === def.agentId)!;
  const f = config.features;
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState('');
  const [marking, setMarking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(st.output);

  return (
    <section className={`card eval ${st.verified === 'issue' || st.userIssue ? 'has-issue' : ''}`}>
      <header className="card-head">
        <h3>
          <Avatar agent={ag} size={24} /> {def.title}
          <span className="muted small"> · {ag.name}</span>
        </h3>
        <div className="row">
          {st.editedByUser && <span className="tag mine">edited by you</span>}
          {st.fixSource === 'memory' && <span className="tag mem">fixed by stored correction</span>}
          {st.fixSource === 'human' && <span className="tag mine">fixed after your feedback</span>}
          {f.confidence && st.status === 'done' && <Confidence value={st.confidence} threshold={config.confidenceThreshold} />}
          <StatusPill status={st.status} />
        </div>
      </header>

      {editing ? (
        <textarea className="output-edit" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <p className="output">{st.output || <span className="muted">No output.</span>}</p>
      )}

      {st.verified === 'issue' && <p className="flag small">⚑ Verifier: {def.flaw?.note}</p>}
      {st.verified === 'pass' && <p className="pass small">✓ Verifier found no problems.</p>}
      {st.userIssue && <p className="flag small">⚑ You marked: {st.userIssue}</p>}

      {f.rationale && open && (
        <dl className="detail">
          <dt>Input</dt>
          <dd>{def.input}</dd>
          <dt>Reasoning</dt>
          <dd>{def.rationale}</dd>
          {st.redirectNotes.length > 0 && (
            <>
              <dt>Your direction</dt>
              <dd>{st.redirectNotes.join('; ')}</dd>
            </>
          )}
        </dl>
      )}

      {st.status === 'done' && (
        <div className="row wrap">
          {f.rationale && (
            <button className="btn ghost small" onClick={() => setOpen(!open)}>
              {open ? 'Hide' : 'Why?'} input & reasoning
            </button>
          )}
          {f.verifier && (
            <button className="btn ghost small" disabled={!!st.verified} onClick={() => dispatch({ type: 'VERIFY', stepId: def.id })}>
              Verify
            </button>
          )}
          {f.editOutputs &&
            (editing ? (
              <button
                className="btn small primary"
                onClick={() => {
                  dispatch({ type: 'EDIT_OUTPUT', stepId: def.id, text: draft });
                  setEditing(false);
                }}
              >
                Save edit
              </button>
            ) : (
              <button
                className="btn ghost small"
                onClick={() => {
                  setDraft(st.output);
                  setEditing(true);
                }}
              >
                Edit
              </button>
            ))}
          {!marking && !st.userIssue && (
            <button className="btn ghost small" onClick={() => setMarking(true)}>
              Mark an issue
            </button>
          )}
          {marking && (
            <form
              className="row grow"
              onSubmit={(e) => {
                e.preventDefault();
                if (!issue.trim()) return;
                onMarkIssue(def.id, issue.trim());
                setMarking(false);
                setIssue('');
              }}
            >
              <input
                className="note grow"
                autoFocus
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder={f.corrections ? 'What went wrong? (saved for future runs)' : 'What went wrong?'}
              />
              <button className="btn small">Save</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
