/**
 * The Translate page body: two full-bleed tiles.
 *
 * The dark tile is the product — camera edge-to-edge with no frame, the stage banner beneath it,
 * and the transcript beside it. The white tile below is the explanation. Splitting them this way
 * follows the design spec's rule that the surface change, not a border, is the section divider.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LETTER_ORDER } from '../classify/letters';
import type { HandFrame } from '../vision/landmarks';
import { loadConfig } from './settings';
import { useRecognition } from './useRecognition';
import { StageBanner } from './StageBanner';
import { Candidates } from './Candidates';
import { HandReadout } from './HandReadout';
import { OutputCard } from './OutputCard';
import { drawHand } from '../vision/overlay';

const DEMO_WORD = 'HELLO';

export function TranslateApp() {
  const initialConfig = useMemo(() => loadConfig(), []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const samplesRef = useRef<HandFrame[]>([]);
  const [expectedLetter, setExpectedLetter] = useState('E');
  const [sampleMessage, setSampleMessage] = useState('');

  const onFrame = useCallback((frame: Parameters<typeof drawHand>[1]) => {
    drawHand(canvasRef.current, frame);
    if (frame) {
      samplesRef.current.push(frame);
      if (samplesRef.current.length > 60) samplesRef.current.shift();
    }
  }, []);

  const api = useRecognition(initialConfig, onFrame);
  const { state, mode, error, loading, aspect } = api;
  const saveSample = () => {
    if (!samplesRef.current.length) { setSampleMessage('No tracked hand yet. Hold the letter in view first.'); return; }
    const blob = new Blob([JSON.stringify({ version: 1, expectedLetter, aspect, config: state.config, frames: samplesRef.current, observedText: state.text, candidates: state.ranked }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `asl-${expectedLetter}-sample.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSampleMessage('Saved locally. The file contains hand tracking points, not camera images.');
  };
  useEffect(() => { samplesRef.current = []; setSampleMessage(''); }, [mode]);

  // Keep the overlay's backing store in step with its CSS box, at device pixel density, so the
  // skeleton lines do not look soft on retina displays.
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;

    const resize = () => {
      const rect = box.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    return () => observer.disconnect();
  }, [mode]);

  // Keyboard output controls. Backspace and Space are the two keys a spell-checker habit
  // reaches for; Esc stops the camera. Ignored while typing in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Backspace') {
        event.preventDefault();
        api.edit('backspace');
      } else if (event.key === ' ') {
        event.preventDefault();
        api.edit('space');
      } else if (event.key === 'Escape' && mode !== 'off') {
        event.preventDefault();
        api.stop();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [api, mode]);

  const startCamera = () => {
    const video = videoRef.current;
    if (video) void api.startLive(video);
  };

  const progress =
    state.stage.id === 'holding'
      ? state.hold.progress
      : state.stage.id === 'tracing'
        ? state.trace.progress
        : 0;

  const showProgress = state.stage.id === 'holding' || state.stage.id === 'tracing';

  return (
    <>
      <section className="tile tile-dark" aria-label="Translator">
        <div className="tile-inner">
          <div className="translate">
            <div className="translate-main">
              <div
                className={`viewport${mode === 'live' ? ' viewport-mirrored' : ''}`}
                ref={boxRef}
                style={{ aspectRatio: String(aspect) }}
              >
                <video ref={videoRef} className="viewport-video" playsInline muted aria-label="Camera preview" />
                <canvas ref={canvasRef} className="viewport-canvas" aria-hidden="true" />

                {mode === 'live' ? (
                  <span className="viewport-tag live">
                    <span className="tag-dot" aria-hidden="true" />
                    Live
                  </span>
                ) : mode === 'demo' ? (
                  <span className="viewport-tag">
                    <span className="tag-dot" style={{ background: '#ffd60a' }} aria-hidden="true" />
                    Demo · spelling {DEMO_WORD}
                  </span>
                ) : null}

                {mode !== 'live' ? (
                  <div className="viewport-idle">
                    <span className="idle-glyph" aria-hidden="true">
                      ✋
                    </span>
                    <p>
                      {loading
                        ? `Loading the hand tracker — ${Math.round((loading.progress ?? 0) * 100)}%`
                        : error
                          ? error.message
                          : 'Camera is off. Turn it on to translate your hand, or watch the demo first — it needs no camera at all.'}
                    </p>
                  </div>
                ) : null}

                {showProgress ? (
                  <div className="viewport-progress">
                    <span style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                ) : null}
              </div>

              <div className="app-controls">
                {mode === 'live' || mode === 'demo' ? (
                  <button type="button" className="btn btn-ghost" onClick={api.stop}>
                    Stop {mode === 'demo' ? 'demo' : 'camera'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={startCamera}
                      disabled={mode === 'starting'}
                    >
                      {mode === 'starting' ? 'Starting…' : error ? 'Try camera again' : 'Turn on camera'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => void api.startDemo(DEMO_WORD)}>
                      Try the demo
                    </button>
                  </>
                )}
                <span className="caption">Runs here, in this browser.</span>
              </div>

              <StageBanner state={state} />
            </div>

            <aside className="translate-side">
              <OutputCard state={state} onEdit={api.edit} />
            </aside>
          </div>
        </div>
      </section>

      <section className="tile tile-white">
        <div className="tile-inner">
          <div className="section-head">
            <h2 className="display-md">Why it reads what it reads.</h2>
            <p className="section-note">
              The runner-up, the failing rules, and the raw hand — every frame.
            </p>
          </div>
          <div className="explain-grid">
            <Candidates state={state} />
            <HandReadout state={state} />
          </div>
          {mode === 'live' ? <details className="recognition-sample">
            <summary>Save a recognition mistake for review</summary>
            <p>Hold the intended letter steady, then save the recent tracking points. No camera images are saved or uploaded.</p>
            <label>Intended letter <select value={expectedLetter} onChange={e => setExpectedLetter(e.target.value)}>{LETTER_ORDER.map(letter => <option key={letter}>{letter}</option>)}</select></label>
            <button type="button" className="btn btn-ghost" onClick={saveSample}>Save recognition sample</button>
            <p role="status">{sampleMessage}</p>
          </details> : null}
        </div>
      </section>
    </>
  );
}

export default TranslateApp;
