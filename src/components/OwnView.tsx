import { useMemo, useState } from 'react';
import { FEATURES } from '../features';
import { download } from '../storage';
import type { Config, Correction, FeatureId, Ratings, RunState, Scenario } from '../types';
import { Card } from './ui';

export interface SessionRecord {
  id: string;
  date: string;
  scenarioId: string;
  features: FeatureId[];
  transparency: Config['transparency'];
  approvalMode: Config['approvalMode'];
  ratings: Ratings;
  interventions: number;
  issuesFound: number;
  quizScore: number | null;
}

interface Props {
  scenario: Scenario;
  run: RunState;
  config: Config;
  corrections: Correction[];
  setCorrections: (c: Correction[]) => void;
  sessions: SessionRecord[];
  onSaveSession: (s: SessionRecord) => void;
  onNewRun: () => void;
}

// Paper sample means (Sec. 4.1) for comparison.
const PAPER = { ownership: 57.05, evaluation: 82.6, control1: 54.1, control2: 69.6, tias1: 5.0, tias2: 5.05, tias3: 4.6 };

export function OwnView({ scenario, run, config, corrections, setCorrections, sessions, onSaveSession, onNewRun }: Props) {
  const f = config.features;
  const human = run.log.filter((l) => l.actor === 'human');
  const count = (k: string) => human.filter((l) => l.kind === k).length;
  const interventions = human.filter((l) => !['plan', 'final', 'pause', 'resume'].includes(l.kind)).length;
  const issuesFound = scenario.steps.filter((s) => run.steps[s.id]?.verified === 'issue' || run.steps[s.id]?.userIssue).length;
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [ratings, setRatings] = useState<Ratings>({ ownership: 50, evaluation: 50, control1: 50, control2: 50, tias1: 4, tias2: 4, tias3: 4 });

  return (
    <div className="grid-2">
      <div className="stack">
        {f.contributionLedger && <Ledger scenario={scenario} run={run} count={count} />}
        {f.quiz && <Quiz scenario={scenario} run={run} onScore={setQuizScore} />}
        {f.corrections && (
          <Card title="Corrections memory" extra={<span className="muted small">Applied to future runs</span>}>
            {corrections.length === 0 ? (
              <p className="muted small">Issues you mark during evaluation are stored here and fed into the next run of the same workflow.</p>
            ) : (
              <ul className="corrections">
                {corrections.map((c) => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.scenarioId}</strong> · {c.stepId}: {c.note}
                      <div className="muted small">{new Date(c.createdAt).toLocaleString()}</div>
                    </div>
                    <button className="icon-btn" aria-label="Forget correction" onClick={() => setCorrections(corrections.filter((x) => x.id !== c.id))}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        <div className="row">
          <button className="btn primary" onClick={onNewRun}>
            Start a new run
          </button>
        </div>
      </div>

      <div className="stack">
        <Card title="Reflect on this run" extra={<span className="muted small">Agency questionnaire (App. A.2)</span>}>
          <Slider
            label="Who wrote the output?"
            left="Me"
            right="AI"
            value={ratings.ownership}
            onChange={(v) => setRatings({ ...ratings, ownership: v })}
            paper={PAPER.ownership}
          />
          <Slider
            label="I evaluated the quality of decisions and outputs."
            left="Strongly disagree"
            right="Strongly agree"
            value={ratings.evaluation}
            onChange={(v) => setRatings({ ...ratings, evaluation: v })}
            paper={PAPER.evaluation}
          />
          <Slider
            label="Who was in control over the content of the output?"
            left="Me"
            right="AI"
            value={ratings.control1}
            onChange={(v) => setRatings({ ...ratings, control1: v })}
            paper={PAPER.control1}
          />
          <Slider
            label="The multi-agent system was leading, and I checked and approved."
            left="Strongly disagree"
            right="Strongly agree"
            value={ratings.control2}
            onChange={(v) => setRatings({ ...ratings, control2: v })}
            paper={PAPER.control2}
          />
          {(
            [
              ['tias1', 'I am confident in the AI system.'],
              ['tias2', 'The AI system is reliable.'],
              ['tias3', 'I can trust the AI system.'],
            ] as const
          ).map(([k, label]) => (
            <Likert key={k} label={label} value={ratings[k]} onChange={(v) => setRatings({ ...ratings, [k]: v })} paper={PAPER[k]} />
          ))}
          <p className="muted small">Grey markers show the mean of the 20 interview participants.</p>
          <div className="row wrap">
            <button
              className="btn primary"
              disabled={saved}
              onClick={() => {
                onSaveSession({
                  id: crypto.randomUUID(),
                  date: new Date().toISOString(),
                  scenarioId: scenario.id,
                  features: FEATURES.filter((x) => config.features[x.id]).map((x) => x.id),
                  transparency: config.transparency,
                  approvalMode: config.approvalMode,
                  ratings,
                  interventions,
                  issuesFound,
                  quizScore,
                });
                setSaved(true);
              }}
            >
              {saved ? '✓ Saved' : 'Save reflection'}
            </button>
            <button
              className="btn"
              onClick={() =>
                download(
                  `mas-session-${scenario.id}-${Date.now()}.json`,
                  JSON.stringify({ scenario: scenario.id, task: run.task, config, ratings, quizScore, log: run.log, steps: run.steps }, null, 2),
                )
              }
            >
              Export session (JSON)
            </button>
            {sessions.length > 0 && (
              <button className="btn ghost" onClick={() => download('mas-sessions.json', JSON.stringify(sessions, null, 2))}>
                Export all {sessions.length} saved
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Ledger({ scenario, run, count }: { scenario: Scenario; run: RunState; count: (k: string) => number }) {
  const words = run.task.split(/\s+/).filter(Boolean).length;
  const rows: [string, number, number][] = [
    ['Task description', 1, 1 + words / 15],
    ['Clarifications answered', Object.keys(run.clarAnswers).length, 1],
    ['Approvals', count('approve'), 1],
    ['Steps sent back with feedback', count('reject'), 2],
    ['Redirects mid-run', count('redirect'), 2],
    ['Outputs edited', count('edit'), 3],
    ['Issues marked', count('issue'), 1.5],
    ['Agents removed / models switched', count('kill') + count('model'), 0.5],
  ];
  const humanScore = rows.reduce((n, [, c, w]) => n + c * w, 0);
  const agentSteps = scenario.steps.filter((s) => run.steps[s.id]?.status === 'done').length;
  const agentScore = agentSteps * 2.5;
  const share = Math.round((humanScore / (humanScore + agentScore || 1)) * 100);
  return (
    <Card title="Contribution ledger" extra={<span className="muted small">Ownership</span>}>
      <div className="share">
        <div className="share-bar">
          <span className="me" style={{ width: `${share}%` }}>
            You {share}%
          </span>
          <span className="ai" style={{ width: `${100 - share}%` }}>
            Agents {100 - share}%
          </span>
        </div>
        <p className="muted small">A rough indicator of involvement — not a verdict. “Without my input, I think they’re just dead tools” — P3.</p>
      </div>
      <ul className="ledger">
        {rows
          .filter(([, c]) => c > 0)
          .map(([label, c]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>{c}</strong>
            </li>
          ))}
        <li className="agent-row">
          <span>Steps completed by agents</span>
          <strong>{agentSteps}</strong>
        </li>
      </ul>
    </Card>
  );
}

function Slider({ label, left, right, value, onChange, paper }: { label: string; left: string; right: string; value: number; onChange: (v: number) => void; paper: number }) {
  return (
    <div className="q">
      <div className="q-label">
        {label} <span className="muted small">{value}</span>
      </div>
      <div className="q-slider">
        <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
        <span className="paper-mark" style={{ left: `${paper}%` }} title={`Study mean ${paper}`} />
      </div>
      <div className="q-ends small muted">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function Likert({ label, value, onChange, paper }: { label: string; value: number; onChange: (v: number) => void; paper: number }) {
  return (
    <div className="q">
      <div className="q-label">
        {label} <span className="muted small">(study mean {paper.toFixed(2)})</span>
      </div>
      <div className="likert" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} className={value === n ? 'active' : ''} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="q-ends small muted">
        <span>Not at all</span>
        <span>Extremely</span>
      </div>
    </div>
  );
}

function Quiz({ scenario, run, onScore }: { scenario: Scenario; run: RunState; onScore: (n: number) => void }) {
  const questions = useMemo(() => {
    const done = scenario.steps.filter((s) => run.steps[s.id]?.status === 'done');
    const qs: { q: string; options: string[]; answer: string }[] = [];
    if (done.length) {
      const pick = done[run.tick % done.length];
      const agent = scenario.agents.find((a) => a.id === pick.agentId)!.name;
      const others = scenario.agents.map((a) => a.name).filter((n) => n !== agent).slice(0, 3);
      qs.push({ q: `Which agent did “${pick.title}”?`, options: rotate([agent, ...others], run.tick), answer: agent });
      const lowest = done.reduce((a, b) => (run.steps[a.id].confidence <= run.steps[b.id].confidence ? a : b));
      const opts = [lowest.title, ...done.filter((d) => d.id !== lowest.id).slice(0, 3).map((d) => d.title)];
      qs.push({ q: 'Which step had the lowest confidence?', options: rotate(opts, run.tick + 1), answer: lowest.title });
    }
    const side = scenario.steps.find((s) => s.sideEffect);
    if (side) {
      const st = run.steps[side.id];
      const ans = st?.status === 'done' ? 'Yes, it was executed' : 'No, it did not happen';
      qs.push({ q: `Did “${side.sideEffect!.label}” happen?`, options: ['Yes, it was executed', 'No, it did not happen'], answer: ans });
    }
    return qs;
  }, [scenario, run]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const finished = Object.keys(answers).length === questions.length;
  const score = questions.filter((q, i) => answers[i] === q.answer).length;

  return (
    <Card title="Quick quiz" extra={<span className="muted small">How well do you know this run?</span>}>
      {questions.map((q, i) => (
        <div key={i} className="quiz-q">
          <div>{q.q}</div>
          <div className="chip-row">
            {q.options.map((o) => {
              const chosen = answers[i] === o;
              const reveal = answers[i] !== undefined;
              return (
                <button
                  key={o}
                  disabled={reveal}
                  className={`chip-btn ${reveal && o === q.answer ? 'correct' : ''} ${chosen && o !== q.answer ? 'wrong' : ''}`}
                  onClick={() => {
                    const next = { ...answers, [i]: o };
                    setAnswers(next);
                    if (Object.keys(next).length === questions.length) onScore(questions.filter((qq, j) => next[j] === qq.answer).length);
                  }}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {finished && (
        <p className="strong">
          {score} / {questions.length} correct
        </p>
      )}
    </Card>
  );
}

function rotate<T>(arr: T[], n: number): T[] {
  const k = n % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}
