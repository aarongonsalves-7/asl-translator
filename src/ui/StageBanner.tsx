/**
 * The single place the app tells the user what is happening.
 *
 * Every variant answers three questions in the same order: what the recogniser can see, why
 * that is (or is not) a letter yet, and the one action that moves it forward. The action is
 * part of the stage copy itself, so a new stage cannot be added without deciding what the user
 * should do about it.
 */
import type { RecognitionState } from '../pipeline/engine';

export interface StageBannerProps {
  state: RecognitionState;
}

export function StageBanner({ state }: StageBannerProps) {
  const { stage, hold, trace } = state;
  const progress =
    stage.id === 'holding'
      ? hold.progress
      : stage.id === 'tracing'
        ? trace.progress
        : stage.id === 'cooldown'
          ? 1 - Math.min(1, state.cooldownMs / Math.max(1, state.config.cooldownMs))
          : 0;
  const showMeter = stage.id === 'holding' || stage.id === 'tracing' || stage.id === 'cooldown';

  return (
    <section className="stage" data-tone={stage.tone} aria-live="polite" data-stage={stage.id}>
      <h2 className="stage-headline" data-testid="stage-headline">
        <span className="stage-dot" aria-hidden="true" />
        {stage.headline}
      </h2>
      <p className="stage-detail" data-testid="stage-detail">
        {stage.detail}
      </p>
      {stage.action ? (
        <p className="stage-action" data-testid="stage-action">
          {stage.action}
        </p>
      ) : null}
      {showMeter ? (
        <div
          className="meter"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label={stage.id === 'cooldown' ? 'Cooldown' : 'Hold progress'}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      ) : null}
    </section>
  );
}
