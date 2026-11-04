import { levels, stepDuration } from '../engine';
import type { Config, RunState, Scenario } from '../types';

const NW = 168;
const NH = 66;
const GX = 210;
const GY = 86;

/** Flow chart of steps and hand-offs (P1), with optional animation (P4) and trails (P16). */
export function WorkflowGraph({
  scenario,
  run,
  config,
  selected,
  onSelect,
}: {
  scenario: Scenario;
  run: RunState;
  config: Config;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const lv = levels(scenario);
  const cols: string[][] = [];
  scenario.steps.forEach((s) => (cols[lv[s.id]] ??= []).push(s.id));
  const maxRows = Math.max(...cols.map((c) => c.length));
  const height = maxRows * GY + 10;
  const pos: Record<string, { x: number; y: number }> = {};
  cols.forEach((ids, c) => {
    const offset = ((maxRows - ids.length) * GY) / 2;
    ids.forEach((id, r) => (pos[id] = { x: 10 + c * GX, y: 10 + offset + r * GY }));
  });
  const width = cols.length * GX - (GX - NW) + 20;
  const f = config.features;
  const agent = (id: string) => scenario.agents.find((a) => a.id === id)!;

  return (
    <div className="graph-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="graph" role="img" aria-label="Workflow flowchart">
        {scenario.steps.flatMap((s) =>
          s.dependsOn.map((d) => {
            const a = pos[d];
            const b = pos[s.id];
            const x1 = a.x + NW;
            const y1 = a.y + NH / 2;
            const x2 = b.x;
            const y2 = b.y + NH / 2;
            const mx = (x1 + x2) / 2;
            const src = run.steps[d];
            const active = run.steps[s.id].status === 'running' && f.animation;
            let trail = '';
            if (f.trails && src.status === 'done') {
              trail = src.confidence < config.confidenceThreshold || src.verified === 'issue' ? 'trail-danger' : 'trail-ok';
            }
            const flowed = src.status === 'done' || src.status === 'skipped';
            return (
              <path
                key={`${d}-${s.id}`}
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                className={`edge ${flowed ? 'flowed' : ''} ${active ? 'active' : ''} ${trail} ${src.status === 'skipped' ? 'skipped' : ''}`}
              />
            );
          }),
        )}
        {scenario.steps.map((s) => {
          const st = run.steps[s.id];
          const p = pos[s.id];
          const ag = agent(s.agentId);
          const dur = stepDuration(run, s.id);
          const prog = st.status === 'done' ? 1 : st.status === 'running' ? st.progress / dur : 0;
          const pulsing = f.animation && st.status === 'running';
          return (
            <g
              key={s.id}
              transform={`translate(${p.x},${p.y})`}
              className={`node st-${st.status} ${selected === s.id ? 'selected' : ''}`}
              onClick={() => onSelect(s.id)}
              tabIndex={0}
              role="button"
              aria-label={`${s.title}, ${ag.name}, ${st.status}`}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(s.id)}
            >
              <rect width={NW} height={NH} rx={10} className="node-box" />
              <circle cx={20} cy={22} r={12} fill={ag.color} className={pulsing ? 'pulse' : ''} opacity={run.agents[s.agentId].killed ? 0.3 : 1} />
              <text x={20} y={26} textAnchor="middle" className="node-initials">
                {ag.initials}
              </text>
              <text x={40} y={19} className="node-agent">
                {ag.name}
              </text>
              <text x={40} y={34} className="node-title">
                {s.title.length > 20 ? s.title.slice(0, 19) + '…' : s.title}
              </text>
              {f.confidence && st.status === 'done' && (
                <text x={NW - 10} y={56} textAnchor="end" className={`node-conf ${st.confidence < config.confidenceThreshold ? 'low' : ''}`}>
                  {Math.round(st.confidence * 100)}%
                </text>
              )}
              {st.verified === 'issue' && (
                <text x={NW - 10} y={19} textAnchor="end" className="node-flag">
                  ⚑
                </text>
              )}
              {s.sideEffect && (
                <text x={NW - 10} y={st.verified === 'issue' ? 34 : 19} textAnchor="end" className="node-side" aria-label="side effect">
                  ⚡
                </text>
              )}
              <text x={12} y={56} className="node-status">
                {statusText(st.status)}
              </text>
              <rect x={0} y={NH - 4} width={NW * prog} height={4} rx={2} className="node-prog" />
            </g>
          );
        })}
      </svg>
      {f.trails && (
        <div className="legend small">
          <span className="lg lg-ok" /> success trail <span className="lg lg-danger" /> danger trail — downstream agents re-check inputs
        </div>
      )}
    </div>
  );
}

function statusText(s: string) {
  return (
    {
      pending: 'queued',
      running: 'working…',
      awaiting_approval: 'waiting for you',
      awaiting_preview: 'preview pending',
      done: 'done',
      skipped: 'skipped',
    } as Record<string, string>
  )[s];
}

/** Per-agent activity timeline (P14): where did an agent start breaking down? */
export function Timeline({ scenario, run, config }: { scenario: Scenario; run: RunState; config: Config }) {
  const total = Math.max(run.tick + 2, 24);
  const rowH = 26;
  const labelW = 120;
  const W = 640;
  const scale = (W - labelW - 10) / total;
  const evts = run.log.filter((l) => ['gate', 'reject', 'redirect', 'issue', 'verify', 'trail', 'uncertain'].includes(l.kind) && l.agentId);
  return (
    <div className="graph-wrap">
      <svg viewBox={`0 0 ${W} ${scenario.agents.length * rowH + 22}`} className="timeline" role="img" aria-label="Activity timeline">
        {scenario.agents.map((a, i) => (
          <g key={a.id} transform={`translate(0,${i * rowH})`}>
            <text x={0} y={17} className="tl-label">
              {a.name}
            </text>
            <line x1={labelW} x2={W - 10} y1={13} y2={13} className="tl-track" />
            {scenario.steps
              .filter((s) => s.agentId === a.id)
              .map((s) => {
                const st = run.steps[s.id];
                if (st.startedAt === undefined) return null;
                const end = st.endedAt ?? run.tick;
                const low = st.status === 'done' && st.confidence < config.confidenceThreshold;
                return (
                  <rect
                    key={s.id}
                    x={labelW + st.startedAt * scale}
                    y={5}
                    width={Math.max(4, (end - st.startedAt) * scale)}
                    height={16}
                    rx={4}
                    fill={a.color}
                    className={`tl-bar st-${st.status} ${low ? 'low' : ''}`}
                  >
                    <title>{`${s.title} (${st.status})`}</title>
                  </rect>
                );
              })}
            {run.agents[a.id]?.killed && (
              <text x={W - 12} y={17} textAnchor="end" className="tl-removed">
                removed
              </text>
            )}
          </g>
        ))}
        {evts.map((e) => {
          const i = scenario.agents.findIndex((a) => a.id === e.agentId);
          if (i < 0) return null;
          return (
            <circle key={e.id} cx={labelW + e.tick * scale} cy={i * rowH + 13} r={3.5} className={`tl-evt ev-${e.kind}`}>
              <title>{e.text}</title>
            </circle>
          );
        })}
        <line x1={labelW + run.tick * scale} x2={labelW + run.tick * scale} y1={0} y2={scenario.agents.length * rowH} className="tl-now" />
        <text x={labelW} y={scenario.agents.length * rowH + 16} className="tl-axis">
          t = 0
        </text>
        <text x={W - 10} y={scenario.agents.length * rowH + 16} textAnchor="end" className="tl-axis">
          t = {run.tick}
        </text>
      </svg>
    </div>
  );
}
