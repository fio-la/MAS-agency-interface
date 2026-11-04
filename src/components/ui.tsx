import type { ReactNode } from 'react';
import { DIM_META } from '../features';
import type { AgencyDim, AgentDef, StepStatus } from '../types';

export function Avatar({ agent, size = 28, dim = false }: { agent: AgentDef; size?: number; dim?: boolean }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: agent.color, fontSize: size * 0.38, opacity: dim ? 0.35 : 1 }}
      title={`${agent.name} — ${agent.role}`}
    >
      {agent.initials}
    </span>
  );
}

export function Confidence({ value, threshold }: { value: number; threshold: number }) {
  const pct = Math.round(value * 100);
  const low = value < threshold;
  return (
    <span className={`conf ${low ? 'conf-low' : value >= 0.85 ? 'conf-high' : 'conf-mid'}`} title="Agent-reported confidence">
      <span className="conf-bar">
        <span style={{ width: `${pct}%` }} />
      </span>
      {pct}%{low && ' · unsure'}
    </span>
  );
}

export function DimChips({ dims }: { dims: AgencyDim[] }) {
  return (
    <span className="dims">
      {dims.map((d) => (
        <span key={d} className={`dim dim-${d}`} title={DIM_META[d].label}>
          {DIM_META[d].label}
        </span>
      ))}
    </span>
  );
}

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: 'Queued',
  running: 'Working',
  awaiting_approval: 'Needs you',
  awaiting_preview: 'Preview',
  done: 'Done',
  skipped: 'Skipped',
};

export function StatusPill({ status }: { status: StepStatus }) {
  return <span className={`pill st-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Card({ title, extra, children, className = '' }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || extra) && (
        <header className="card-head">
          <h3>{title}</h3>
          {extra}
        </header>
      )}
      {children}
    </section>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
