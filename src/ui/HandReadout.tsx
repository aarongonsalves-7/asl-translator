/**
 * "What I see" — the raw read of the hand, before any letter is chosen.
 *
 * This panel exists because a wrong letter is impossible to argue with unless you can see the
 * observations it was derived from. If the engine thinks the index finger is curled when it is
 * straight, that is visible here, and it points at the real problem (lighting, distance,
 * occlusion) instead of at the classifier.
 */
import type { RecognitionState } from '../pipeline/engine';

const FINGER_LABEL: Record<string, string> = {
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
};

export interface HandReadoutProps {
  state: RecognitionState;
}

export function HandReadout({ state }: HandReadoutProps) {
  const { quality, fingers, thumbState, motionSuggestion, stage } = state;

  if (!quality) {
    return (
      <section className="panel" aria-label="What I see">
        <div className="panel-head">
          <h3 className="panel-title">What I see</h3>
        </div>
        <p className="empty-note">
          Nothing yet. The tracker reports what it finds here — fingers, thumb position, how
          large the hand is and whether it is moving too fast to read.
        </p>
      </section>
    );
  }

  const sizePct = Math.round(quality.handSize * 100);

  return (
    <section className="panel" aria-label="What I see">
      <div className="panel-head">
        <h3 className="panel-title">What I see</h3>
        <span className="panel-note">{state.fps > 0 ? `${Math.round(state.fps)} fps` : ''}</span>
      </div>

      <div className="readout-grid">
        {fingers.map((finger) => (
          <div className="readout-item" key={finger.name}>
            <div className="readout-label">{FINGER_LABEL[finger.name] ?? finger.name}</div>
            <div className="readout-value" data-testid={`finger-${finger.name}`}>
              {finger.state}
            </div>
          </div>
        ))}
        <div className="readout-item">
          <div className="readout-label">Thumb</div>
          <div className="readout-value" data-testid="thumb">
            {thumbState ?? '—'}
          </div>
        </div>
      </div>

      <p className="readout-foot">
        <span>Palm {sizePct}% of frame</span>
        <span>·</span>
        <span>{quality.facing.replace(/-/g, ' ')}</span>
        <span>·</span>
        <span>{Math.round(quality.motion * 100)}% motion</span>
        <span>·</span>
        <span>{Math.round(quality.rotationDeg)}° roll</span>
      </p>

      {motionSuggestion && stage.id !== 'unsure' ? (
        <p className="hint" data-testid="motion-hint">
          {motionSuggestion.letter} is a motion letter: {motionSuggestion.instruction}
        </p>
      ) : null}
    </section>
  );
}
