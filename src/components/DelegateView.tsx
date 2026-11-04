import { useEffect, useState } from 'react';
import { SCENARIOS } from '../scenarios';
import type { Config, Correction, Scenario } from '../types';
import type { SessionRecord } from './OwnView';
import { Avatar, Card } from './ui';

export function DelegateView({
  config,
  corrections,
  sessions,
  onStart,
}: {
  config: Config;
  corrections: Correction[];
  sessions: SessionRecord[];
  onStart: (scenario: Scenario, task: string, clar: Record<string, string>) => void;
}) {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const [task, setTask] = useState(scenario.prompt);
  const [clar, setClar] = useState<Record<string, string>>({});
  const f = config.features;

  useEffect(() => {
    setTask(scenario.prompt);
    setClar({});
  }, [scenarioId]); // eslint-disable-line react-hooks/exhaustive-deps

  const past = sessions.filter((s) => s.scenarioId === scenarioId);
  const stored = corrections.filter((c) => c.scenarioId === scenarioId);
  const unanswered = f.clarifyingQuestions && scenario.clarifications.some((c) => !clar[c.id]);

  return (
    <div className="grid-2">
      <div className="stack">
        <Card title="1 · What do you want to delegate?">
          <div className="scenario-tabs">
            {SCENARIOS.map((s) => (
              <button key={s.id} className={`scenario-tab ${s.id === scenarioId ? 'active' : ''}`} onClick={() => setScenarioId(s.id)}>
                <strong>{s.title}</strong>
                <span>{s.domain}</span>
              </button>
            ))}
          </div>
          <label className="field">
            <span>Task for the agent team</span>
            <textarea rows={4} value={task} onChange={(e) => setTask(e.target.value)} placeholder="Describe the task…" />
          </label>
          {f.starterPrompts && (
            <div className="starter">
              <span className="muted small">Starter prompts</span>
              {scenario.starterPrompts.map((p) => (
                <button key={p} className="chip-btn" onClick={() => setTask(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </Card>

        {f.clarifyingQuestions && (
          <Card title="Before I plan — a few questions" extra={<span className="muted small">Orchestrator</span>}>
            {scenario.clarifications.map((c) => (
              <div key={c.id} className="clar">
                <div>{c.question}</div>
                <div className="chip-row">
                  {c.options.map((o) => (
                    <button key={o} className={`chip-btn ${clar[c.id] === o ? 'selected' : ''}`} onClick={() => setClar((prev) => ({ ...prev, [c.id]: o }))}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        )}

        <div className="cta-row">
          <button className="btn primary big" disabled={!task.trim() || unanswered} onClick={() => onStart(scenario, task.trim(), clar)}>
            Delegate to agent team →
          </button>
          {unanswered && <span className="muted small">Answer the clarification questions first.</span>}
        </div>
      </div>

      <div className="stack">
        <Card title="The team" extra={<span className="muted small">{scenario.agents.length} agents</span>}>
          <ul className="team">
            {scenario.agents.map((a) => (
              <li key={a.id}>
                <Avatar agent={a} size={34} />
                <div>
                  <strong>{a.name}</strong>
                  <div className="muted small">
                    {a.role}
                    {f.agentProfiles && <> · {a.expertise}</>}
                  </div>
                </div>
                {f.modelSwitch && <span className="tag">{a.model} model</span>}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Track record" extra={<span className="muted small">Trust builds on testing</span>}>
          {past.length === 0 ? (
            <p className="muted small">No previous runs of this workflow yet. “I trust the system when I’ve tested it” — P15.</p>
          ) : (
            <ul className="facts">
              <li>
                <strong>{past.length}</strong> previous run{past.length > 1 ? 's' : ''}
              </li>
              <li>
                <strong>{past.reduce((n, s) => n + s.issuesFound, 0)}</strong> issues found by you or the verifier
              </li>
              <li>
                <strong>{past.reduce((n, s) => n + s.interventions, 0)}</strong> interventions in total
              </li>
            </ul>
          )}
          {f.corrections && stored.length > 0 && (
            <div className="memory-note">
              <strong>{stored.length} stored correction{stored.length > 1 ? 's' : ''}</strong> will be applied to this run:
              <ul>
                {stored.map((c) => (
                  <li key={c.id}>{c.note}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
