import { useState } from 'react';
import {
  BASE_CONFIG,
  DESIGN_ELEMENTS,
  DESIGN_ORDER,
  FEATURES,
  NEED_META,
  PARTICIPANTS,
  PHASES,
  PRESETS,
  configFromParticipant,
  featuresForNeeds,
  featuresFrom,
} from '../features';
import type { ApprovalMode, Config, Need, Transparency } from '../types';
import { DimChips, Segmented, Toggle } from './ui';

type Tab = 'presets' | 'needs' | 'modules';

export function ConfigPanel({ config, setConfig, onClose }: { config: Config; setConfig: (c: Config) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('presets');
  const [needs, setNeeds] = useState<Need[]>([]);
  const enabled = FEATURES.filter((f) => config.features[f.id]).length;

  const set = (patch: Partial<Config>) => setConfig({ ...config, ...patch });

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Agency support configuration">
        <header className="drawer-head">
          <div>
            <h2>Agency support</h2>
            <p className="muted">
              Needs differ per person — only two of twenty participants asked for the same set of features. Set this up for{' '}
              <em>you</em>. {enabled} of {FEATURES.length} modules on.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'presets', label: 'Presets' },
            { value: 'needs', label: 'From your needs' },
            { value: 'modules', label: 'All modules' },
          ]}
        />

        {tab === 'presets' && (
          <div className="drawer-body">
            <h4>Starting points</h4>
            <div className="preset-grid">
              {PRESETS.map((p) => (
                <button key={p.id} className="preset" onClick={() => {
                    setConfig(p.build());
                    setTab('modules');
                  }}>
                  <strong>{p.label}</strong>
                  <span>{p.description}</span>
                </button>
              ))}
            </div>
            <h4>Start from a study participant</h4>
            <p className="muted small">
              The design elements each interview participant asked for (Fig. 3). Pick one to see how different their configurations are.
            </p>
            <div className="participant-grid">
              {PARTICIPANTS.map((p) => (
                <button
                  key={p.id}
                  className="participant"
                  onClick={() => {
                    setConfig(configFromParticipant(p.id));
                    setTab('modules');
                  }}
                  title={`Needs: ${p.needs.map((n) => NEED_META[n].label).join(', ')}`}
                >
                  <strong>{p.id}</strong>
                  <span className="pmatrix">
                    {DESIGN_ORDER.filter((d) => d !== 'L').map((d) => (
                      <i key={d} className={p.design.includes(d) ? 'on' : ''} title={`${d} ${DESIGN_ELEMENTS[d].label}`} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'needs' && (
          <div className="drawer-body">
            <h4>What do you need to feel in charge?</h4>
            <p className="muted small">Pick any that apply. Several participants first said they needed nothing, then named needs later.</p>
            <div className="need-list">
              {(Object.keys(NEED_META) as Need[]).map((n) => (
                <label key={n} className={`need ${needs.includes(n) ? 'on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={needs.includes(n)}
                    onChange={(e) => setNeeds(e.target.checked ? [...needs, n] : needs.filter((x) => x !== n))}
                  />
                  <span>
                    <strong>{NEED_META[n].label}</strong>
                    <small>
                      “{NEED_META[n].quote}” · {NEED_META[n].count}/20
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <button
              className="btn primary"
              disabled={!needs.length}
              onClick={() => {
                const ids = featuresForNeeds(needs);
                setConfig({
                  ...BASE_CONFIG,
                  transparency: needs.some((n) => ['transparency', 'visibility', 'understanding'].includes(n)) ? 'process' : 'outcome',
                  approvalMode: needs.includes('oversight') ? 'every' : needs.includes('control') ? 'checkpoints' : 'final',
                  features: featuresFrom(ids),
                });
                setTab('modules');
              }}
            >
              Build my configuration
            </button>
          </div>
        )}

        {tab === 'modules' && (
          <div className="drawer-body">
            <div className="settings-grid">
              <label>
                Default transparency
                <Segmented<Transparency>
                  value={config.transparency}
                  onChange={(v) => set({ transparency: v })}
                  options={[
                    { value: 'outcome', label: 'Outcome', title: 'Input and output only' },
                    { value: 'process', label: 'Process', title: 'What each agent did and why' },
                  ]}
                />
              </label>
              <label>
                Approval granularity
                <Segmented<ApprovalMode>
                  value={config.approvalMode}
                  onChange={(v) => set({ approvalMode: v })}
                  options={[
                    { value: 'final', label: 'Final only' },
                    { value: 'checkpoints', label: 'Checkpoints' },
                    { value: 'every', label: 'Every step' },
                  ]}
                />
              </label>
              <label>
                Confidence threshold: <strong>{Math.round(config.confidenceThreshold * 100)}%</strong>
                <input
                  type="range"
                  min={0.4}
                  max={0.95}
                  step={0.05}
                  value={config.confidenceThreshold}
                  onChange={(e) => set({ confidenceThreshold: Number(e.target.value) })}
                />
              </label>
              <label>
                Token budget: <strong>{config.tokenBudget.toLocaleString()}</strong>
                <input
                  type="range"
                  min={10000}
                  max={80000}
                  step={5000}
                  value={config.tokenBudget}
                  onChange={(e) => set({ tokenBudget: Number(e.target.value) })}
                />
              </label>
            </div>

            {DESIGN_ORDER.map((d) => {
              const feats = FEATURES.filter((f) => f.design === d);
              const meta = DESIGN_ELEMENTS[d];
              return (
                <div key={d} className="feature-group">
                  <div className="feature-group-head">
                    <span className="de-tag">{d === 'L' ? 'Lit.' : d}</span>
                    <strong>{meta.label}</strong>
                    {meta.count !== null && <span className="muted small">{meta.count}/20 participants</span>}
                  </div>
                  {feats.map((f) => (
                    <div key={f.id} className="feature-row">
                      <div className="feature-text">
                        <div className="feature-title">
                          {f.label}
                          <span className="phase-tag">{PHASES.find((p) => p.id === f.phase)!.label}</span>
                        </div>
                        <div className="muted small">{f.description}</div>
                        {f.quote && (
                          <div className="quote small">
                            “{f.quote}” — {f.source}
                          </div>
                        )}
                        {!f.quote && <div className="quote small">{f.source}</div>}
                        <DimChips dims={f.dims} />
                      </div>
                      <Toggle
                        label={f.label}
                        checked={config.features[f.id]}
                        onChange={(v) => set({ features: { ...config.features, [f.id]: v } })}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
