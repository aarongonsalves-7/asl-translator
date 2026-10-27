/**
 * Top three candidates, plus *why* the leader is the leader.
 *
 * Showing the ranked list is what makes the classifier legible: the user can see the engine
 * hesitating between M and N, instead of watching a single letter flicker. The constraint rows
 * below go one level deeper and name the exact rule that failed, which is the coaching the
 * stage banner then turns into an action.
 */
import type { RecognitionState } from '../pipeline/engine';

const pct = (value: number) => `${Math.round(value * 100)}%`;

export interface CandidatesProps {
  state: RecognitionState;
}

export function Candidates({ state }: CandidatesProps) {
  const { ranked, leader, failing, hint, motionSuggestion, config, handPresent } = state;

  return (
    <section className="panel" aria-label="Candidates">
      <div className="panel-head">
        <h3 className="panel-title">Candidates</h3>
        <span className="panel-note">{leader ? `margin ${pct(leader.margin)}` : '—'}</span>
      </div>

      {ranked.length === 0 ? (
        <p className="empty-note">
          {handPresent ? 'Scoring the handshape…' : 'No hand to score yet.'}
        </p>
      ) : (
        <div className="candidates">
          {ranked.map((candidate, index) => (
            <div
              className="candidate"
              key={candidate.letter}
              data-leader={index === 0}
              data-testid="candidate"
            >
              <span className="candidate-letter">{candidate.letter}</span>
              <span className="candidate-bar">
                <span style={{ width: pct(candidate.confidence) }} />
              </span>
              <span className="candidate-score">{pct(candidate.confidence)}</span>
            </div>
          ))}
        </div>
      )}

      {failing.length > 0 ? (
        <div className="why-list" aria-label="Failing constraints">
          {failing.map((constraint) => (
            <div className="why-row" key={constraint.label}>
              <span>{constraint.label}</span>
              <span className="why-bar" aria-hidden="true">
                <span style={{ width: pct(constraint.value) }} />
              </span>
              <span className="why-value">{pct(constraint.value)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {hint ? (
        <p className="hint" data-testid="hint">
          {hint}
        </p>
      ) : null}

      {motionSuggestion && state.stage.id !== 'unsure' ? (
        <p className="hint">{motionSuggestion.instruction}</p>
      ) : null}

      <p className="readout-foot">
        <span>Commit at {pct(config.minConfidence)} confidence</span>
        <span>·</span>
        <span>{pct(config.minMargin)} margin</span>
        <span>·</span>
        <span>{(config.holdMs / 1000).toFixed(1)}s hold</span>
      </p>
    </section>
  );
}
