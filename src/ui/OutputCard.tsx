/**
 * The result: spelled text, the receipt for the last commit, and the edit controls.
 *
 * A receipt is not decoration — without it, a letter that appears "by itself" a second after
 * you relaxed is indistinguishable from a bug. Naming what was added, how confident it was and
 * how long it was held makes every commit traceable, including the ones you did not intend.
 */
import type { RecognitionState } from '../pipeline/engine';
import type { EditAction } from './useRecognition';

const pct = (value: number) => `${Math.round(value * 100)}%`;

export interface OutputCardProps {
  state: RecognitionState;
  onEdit: (action: EditAction) => void;
}

export function OutputCard({ state, onEdit }: OutputCardProps) {
  const { text, receipt, history } = state;
  const letters = history.filter((entry) => entry.kind === 'letter').length;

  return (
    <section className="card-dark" aria-label="Translated text" data-testid="output">
      <div className="card-head">
        <span className="card-title">Text</span>
        <span className="output-meta" style={{ margin: 0 }}>
          {history.length} commit{history.length === 1 ? '' : 's'} · {letters} letter
          {letters === 1 ? '' : 's'}
        </span>
      </div>

      {receipt ? (
        <div className="receipt" data-testid="receipt">
          <span aria-hidden="true">{receipt.kind === 'backspace' ? '⌫' : receipt.kind === 'space' ? '␣' : '✓'}</span>
          <span>
            Added <strong>{receipt.kind === 'letter' ? receipt.value : receipt.kind}</strong>
            {receipt.kind === 'letter'
              ? ` · ${pct(receipt.confidence)} confident · held ${(receipt.heldMs / 1000).toFixed(1)}s`
              : ''}
          </span>
        </div>
      ) : null}

      <p className="output-text" data-testid="output-text">
        {text ? (
          <>
            {text}
            <span className="caret" aria-hidden="true" />
          </>
        ) : (
          <span className="output-empty">
            Nothing yet. Open your hand to the camera, form a letter and hold it for a moment.
          </span>
        )}
      </p>

      <div className="output-controls">
        <button type="button" className="btn btn-on-dark" onClick={() => onEdit('space')}>
          Space
        </button>
        <button type="button" className="btn btn-utility" onClick={() => onEdit('backspace')}>
          Backspace
        </button>
        <button
          type="button"
          className="btn btn-utility"
          onClick={() => onEdit('undo')}
          disabled={history.length === 0}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn btn-utility"
          onClick={() => onEdit('clear')}
          disabled={text.length === 0 && history.length === 0}
        >
          Clear
        </button>
      </div>

      <p className="output-meta">
        <span>Space adds a space · Backspace deletes</span>
        <span>·</span>
        <span>Keyboard: Space, Backspace, Esc</span>
      </p>
    </section>
  );
}
