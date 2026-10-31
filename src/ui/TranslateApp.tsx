/** Practice workspace and the evidence behind each recognition result. */
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
import { MotionIcon } from './MotionIcon';

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
      if (target?.closest('input, textarea, select, button, a, summary, [role="button"]') || target?.isContentEditable) return;
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
  // This path follows the current recognition attempt, never a saved learning score.
  const pathStep = mode === 'off' || mode === 'starting' ? 0
    : ['added', 'latched', 'cooldown'].includes(state.stage.id) ? 3
    : ['holding', 'tracing'].includes(state.stage.id) ? 2
    : state.handPresent ? 1 : 0;
  const pathLabels = ['Find your hand', 'Read the shape', 'Hold a letter', 'Add to text'];

  return (
    <>
      <section className="tile practice-section" aria-label="Translator">
        <div className="tile-inner">
          <div className="translate">
            <div className="translate-main">
              <div
                className={`viewport${mode === 'live' ? ' viewport-mirrored' : ''}`}
                data-mode={mode}
                ref={boxRef}
                style={{ aspectRatio: mode === 'off' || mode === 'starting' ? '16 / 9' : String(aspect) }}
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
                ) : <span className="viewport-tag"><span className="tag-dot" aria-hidden="true" />{mode === 'starting' ? 'Starting camera' : 'Camera off'}</span>}

                {mode !== 'live' && mode !== 'demo' ? (
                  <div className="viewport-idle">
                    <svg className="idle-glyph" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 13H13v16M58 13h9v16M22 67H13V51M58 67h9V51"/><circle cx="40" cy="40" r="15"/><path d="M33 40h14M40 33v14"/></svg>
                    <h3>{loading ? 'Getting ready.' : error ? 'Let’s try that again.' : 'Ready when you are.'}</h3>
                    <p>
                      {loading
                        ? `Loading the hand tracker — ${Math.round((loading.progress ?? 0) * 100)}%`
                        : error
                          ? error.message
                          : 'Your camera stays off until you turn it on. Or try a demo — no camera needed.'}
                    </p>
                  </div>
                ) : null}

                {showProgress ? (
                  <div className="viewport-progress">
                    <span style={{ transform: `scaleX(${progress})` }} />
                  </div>
                ) : null}
              </div>

              <div className="app-controls">
                {mode === 'live' || mode === 'demo' ? (
                  <button type="button" className="btn btn-ghost" onClick={api.stop}>
                    <MotionIcon name="stop" />
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
                      <MotionIcon name="camera" />
                      {mode === 'starting' ? 'Starting…' : error ? 'Try camera again' : 'Turn on camera'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => void api.startDemo(DEMO_WORD)}>
                      <MotionIcon name="play" />
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
          <ol className="recognition-path" aria-label="Current recognition steps">
            {pathLabels.map((label, index) => <li key={label} data-state={index < pathStep ? 'done' : index === pathStep ? 'current' : 'pending'} aria-current={index === pathStep ? 'step' : undefined}>
              <span className="path-mark" aria-hidden="true">{index < pathStep ? <MotionIcon name="check" /> : index + 1}</span>
              <span>{label}</span>
            </li>)}
          </ol>
        </div>
      </section>

      <section className="tile recognition-details">
        <div className="tile-inner">
          <div className="section-head">
            <h2 className="display-md">Understand each attempt.</h2>
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
