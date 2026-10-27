/**
 * Calibration.
 *
 * These five numbers are the whole difference between "it commits too early for me" and "it
 * never commits". They are exposed rather than hidden because hand size, camera angle and
 * signing speed vary enough between people that no default is right for everyone. Everything is
 * stored on this device only.
 */
import { useCallback, useMemo, useState } from 'react';
import { CONFIG_LIMITS, DEFAULT_CONFIG, type PipelineConfig } from '../pipeline/config';
import { clearConfig, loadConfig, saveConfig } from './settings';

interface SliderSpec {
  key: keyof typeof CONFIG_LIMITS;
  label: string;
  help: string;
  format: (value: number) => string;
}

const SLIDERS: SliderSpec[] = [
  {
    key: 'holdMs',
    label: 'Hold time',
    help: 'How long a handshape must stay steady before it is added. Raise it if letters appear while you are still forming them; lower it if holding feels like waiting.',
    format: (value) => `${(value / 1000).toFixed(2)} s`,
  },
  {
    key: 'minConfidence',
    label: 'Confidence needed',
    help: 'How closely the hand must match a letter before it can be committed. Lowering this adds more letters, including wrong ones.',
    format: (value) => `${Math.round(value * 100)}%`,
  },
  {
    key: 'minMargin',
    label: 'Lead over the runner-up',
    help: 'How far ahead the best letter must be from the second best. This is the main guard against A/O/E style confusions.',
    format: (value) => `${Math.round(value * 100)}%`,
  },
  {
    key: 'smoothingAlpha',
    label: 'Response speed',
    help: 'How much each new frame counts. Higher reacts faster and jitters more; lower is steadier and slower to notice a change.',
    format: (value) => value.toFixed(2),
  },
  {
    key: 'cooldownMs',
    label: 'Gap between letters',
    help: 'Dead time after a letter is added, so one hold can never produce two letters.',
    format: (value) => `${(value / 1000).toFixed(1)} s`,
  },
];

export function SettingsApp() {
  const [config, setConfig] = useState<PipelineConfig>(() => loadConfig());
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const update = useCallback((patch: Partial<PipelineConfig>) => {
    setConfig((previous) => {
      const next = { ...previous, ...patch };
      saveConfig(next);
      return next;
    });
    setSavedAt(new Date().toLocaleTimeString());
  }, []);

  const reset = useCallback(() => {
    clearConfig();
    setConfig({ ...DEFAULT_CONFIG });
    setSavedAt(new Date().toLocaleTimeString());
  }, []);

  const changed = useMemo(
    () =>
      (Object.keys(DEFAULT_CONFIG) as Array<keyof PipelineConfig>).filter(
        (key) => config[key] !== DEFAULT_CONFIG[key],
      ),
    [config],
  );

  return (
    <div className="settings">
      <section className="card">
        <div className="card-head">
          <span className="card-title">Recognition</span>
          <span className="empty-note">{changed.length === 0 ? 'Defaults' : `${changed.length} changed`}</span>
        </div>

        <div className="stack">
          {SLIDERS.map((slider) => {
            const limit = CONFIG_LIMITS[slider.key];
            const value = config[slider.key];
            const inputId = `setting-${slider.key}`;
            return (
              <div className="setting" key={slider.key}>
                <div className="setting-row">
                  <label className="setting-label" htmlFor={inputId}>
                    {slider.label}
                  </label>
                  <span className="setting-value" data-testid={`value-${slider.key}`}>
                    {slider.format(value)}
                  </span>
                </div>
                <input
                  id={inputId}
                  type="range"
                  min={limit.min}
                  max={limit.max}
                  step={limit.step}
                  value={value}
                  onChange={(event) => update({ [slider.key]: Number(event.target.value) })}
                />
                <p className="setting-help">{slider.help}</p>
              </div>
            );
          })}

          <div className="setting">
            <div className="switch-row">
              <div>
                <div className="setting-label">Thumb gestures</div>
                <p className="setting-help">
                  A thumbs-up adds a space and a thumbs-down deletes a letter. They only fire when
                  no letter fits the hand, so signing A still works.
                </p>
              </div>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={config.gesturesEnabled}
                  aria-label="Thumb gestures"
                  onChange={(event) => update({ gesturesEnabled: event.target.checked })}
                />
                <span className="switch-track" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button type="button" className="btn btn-quiet" onClick={reset}>
            Reset to defaults
          </button>
          <a className="btn btn-primary" href="/">
            Back to translate
          </a>
        </div>
        <p className="settings-note" aria-live="polite">
          Saved on this device only{savedAt ? ` · ${savedAt}` : ''}
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <span className="card-title">What is not adjustable</span>
        </div>
        <p className="setting-help">
          Letters are matched against fixed geometric rules — finger extension, spread, thumb
          position and fingertip contact — so the thresholds above change how decisive the app is,
          not what a letter means. J and Z only commit after their motion path is recognised, and
          that path cannot be tuned away.
        </p>
      </section>
    </div>
  );
}

export default SettingsApp;
