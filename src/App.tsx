import { useEffect, useReducer, useRef, useState } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { DelegateView } from './components/DelegateView';
import { EvaluateView } from './components/EvaluateView';
import { ExecuteView } from './components/ExecuteView';
import { OwnView, type SessionRecord } from './components/OwnView';
import { EMPTY_RUN, reducer } from './engine';
import { DEFAULT_CONFIG, DIM_META, FEATURES, PHASES } from './features';
import { SCENARIO_BY_ID } from './scenarios';
import { usePersistent, usePersistentList } from './storage';
import type { Config, Correction, Phase } from './types';

export default function App() {
  const [config, setConfigRaw] = usePersistent<Config>('mas.config', DEFAULT_CONFIG);
  // Merge features so newly added modules get a value.
  const cfg: Config = { ...config, features: { ...DEFAULT_CONFIG.features, ...config.features } };
  const setConfig = (c: Config) => setConfigRaw(c);
  const [corrections, setCorrections] = usePersistentList<Correction>('mas.corrections');
  const [sessions, setSessions] = usePersistentList<SessionRecord>('mas.sessions');
  const [run, dispatch] = useReducer(reducer, EMPTY_RUN);
  const [phase, setPhase] = useState<Phase>('delegate');
  const [configOpen, setConfigOpen] = useState(false);
  const scenario = run.scenarioId ? SCENARIO_BY_ID[run.scenarioId] : null;

  // Simulation clock.
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  useEffect(() => {
    if (run.status !== 'running') return;
    const t = setInterval(() => dispatch({ type: 'TICK', config: cfgRef.current }), 650 / cfg.speed);
    return () => clearInterval(t);
  }, [run.status, cfg.speed]);

  const enabled = FEATURES.filter((f) => cfg.features[f.id]).length;
  const reachable = (p: Phase) => p === 'delegate' || !!scenario;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◎
          </span>
          <div>
            <strong>MAS Agency Interface</strong>
            <span className="muted small">configurable agency support for multi-agent AI</span>
          </div>
        </div>
        <nav className="lifecycle" aria-label="Delegation lifecycle">
          {PHASES.map((p, i) => (
            <button
              key={p.id}
              className={`phase ${phase === p.id ? 'active' : ''}`}
              disabled={!reachable(p.id)}
              onClick={() => setPhase(p.id)}
              title={p.hint}
            >
              <span className="phase-num">{i + 1}</span>
              <span>
                {p.label}
                <small className={`dim-text dim-${p.dim}`}>{DIM_META[p.dim].label}</small>
              </span>
            </button>
          ))}
        </nav>
        <button className="btn config-btn" onClick={() => setConfigOpen(true)}>
          ⚙ Agency support <span className="badge">{enabled}</span>
        </button>
      </header>

      <main className="main">
        {phase === 'delegate' && (
          <DelegateView
            config={cfg}
            corrections={corrections}
            sessions={sessions}
            onStart={(sc, task, clar) => {
              dispatch({ type: 'START', scenario: sc, config: cfg, task, clarAnswers: clar, corrections });
              setPhase('execute');
            }}
          />
        )}
        {phase === 'execute' && scenario && (
          <ExecuteView scenario={scenario} run={run} config={cfg} setConfig={setConfig} dispatch={dispatch} onEvaluate={() => setPhase('evaluate')} />
        )}
        {phase === 'evaluate' && scenario && (
          <EvaluateView
            scenario={scenario}
            run={run}
            config={cfg}
            setConfig={setConfig}
            dispatch={dispatch}
            onOwn={() => setPhase('own')}
            onMarkIssue={(stepId, note) => {
              dispatch({ type: 'MARK_ISSUE', stepId, note });
              if (cfg.features.corrections) {
                setCorrections((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), scenarioId: scenario.id, stepId, note, createdAt: new Date().toISOString() },
                ]);
              }
            }}
          />
        )}
        {phase === 'own' && scenario && (
          <OwnView
            scenario={scenario}
            run={run}
            config={cfg}
            corrections={corrections}
            setCorrections={setCorrections}
            sessions={sessions}
            onSaveSession={(s) => setSessions((prev) => [...prev, s])}
            onNewRun={() => {
              dispatch({ type: 'RESET' });
              setPhase('delegate');
            }}
          />
        )}
      </main>

      {configOpen && <ConfigPanel config={cfg} setConfig={setConfig} onClose={() => setConfigOpen(false)} />}
    </div>
  );
}
