/**
 * The result: spelled text, the receipt for the last commit, and the edit controls.
 *
 * A receipt is not decoration — without it, a letter that appears "by itself" a second after
 * you relaxed is indistinguishable from a bug. Naming what was added, how confident it was and
 * how long it was held makes every commit traceable, including the ones you did not intend.
 */
import { useState } from 'react';
import type { RecognitionState } from '../pipeline/engine';
import type { EditAction } from './useRecognition';
import { MotionIcon } from './MotionIcon';

const pct = (value: number) => `${Math.round(value * 100)}%`;

export interface OutputCardProps {
  state: RecognitionState;
  onEdit: (action: EditAction) => void;
}

export function OutputCard({ state, onEdit }: OutputCardProps) {
  const { text, receipt, history } = state;
  const [copyStatus, setCopyStatus] = useState('');
  const copyText = async () => {
    try { await navigator.clipboard.writeText(text); setCopyStatus('Copied to clipboard.'); }
    catch { setCopyStatus('Could not copy. Select the text and copy it manually.'); }
  };
  const letters = history.filter((entry) => entry.kind === 'letter').length;

  return (
    <section className="transcript" aria-label="Translated text" data-testid="output">
      <div className="transcript-head">
        <h2 className="transcript-label">Your text</h2>
        <span className="transcript-meta">
          {history.length} commit{history.length === 1 ? '' : 's'} · {letters} letter
          {letters === 1 ? '' : 's'}
        </span>
      </div>

      {receipt ? (
        <div className="receipt" data-testid="receipt">
          <MotionIcon name={receipt.kind === 'backspace' ? 'backspace' : receipt.kind === 'space' ? 'space' : 'check'} />
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
            <strong>Your first letter starts here.</strong>
            <small>Open your hand to the camera, form a letter and hold it for a moment.</small>
          </span>
        )}
      </p>

      <div className="output-controls">
        <button type="button" className="btn-link" onClick={copyText} disabled={!text}><MotionIcon name={copyStatus === 'Copied to clipboard.' ? 'check' : 'copy'} />Copy text</button>
        <button type="button" className="btn btn-primary" onClick={() => onEdit('space')}>
          <MotionIcon name="space" />Space
        </button>
        <button type="button" className="btn-link" onClick={() => onEdit('backspace')}>
          <MotionIcon name="backspace" />Backspace
        </button>
        <button type="button" className="btn-link" onClick={() => onEdit('undo')} disabled={history.length === 0}>
          <MotionIcon name="undo" />Undo
        </button>
        <button
          type="button"
          className="btn-link"
          onClick={() => onEdit('clear')}
          disabled={text.length === 0 && history.length === 0}
        >
          <MotionIcon name="clear" />Clear
        </button>
      </div>

      <p className="output-meta">
        <span>Space adds a space · Backspace deletes</span>
        <span>·</span>
        <span>Keyboard: Space, Backspace, Esc</span>
      </p>
      <p className="output-meta" role="status">{copyStatus}</p>
    </section>
  );
}
