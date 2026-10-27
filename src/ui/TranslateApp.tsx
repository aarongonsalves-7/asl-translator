/**
 * The Translate page.
 *
 * Ordering is deliberate: camera first, then the stage banner directly beneath it, then the
 * text, then the explanation. The stage banner is the only element that is allowed to be loud,
 * because it is the only one that tells the user what to do next.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
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

  const onFrame = useCallback((frame: Parameters<typeof drawHand>[1]) => {
    drawHand(canvasRef.current, frame);
  }, []);

  const api = useRecognition(initialConfig, onFrame);
  const { state, mode, error, loading, aspect } = api;

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
    <div className="translate">
      <div className="translate-main">
        <div className="card" style={{ padding: 'var(--space-sm)' }}>
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

          <div className="row" style={{ padding: 'var(--space-sm) var(--space-xxs) 0' }}>
            {mode === 'live' || mode === 'demo' ? (
              <button type="button" className="btn btn-quiet" onClick={api.stop}>
                Stop {mode === 'demo' ? 'demo' : 'camera'}
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-primary" onClick={startCamera} disabled={mode === 'starting'}>
                  {mode === 'starting' ? 'Starting…' : error ? 'Try camera again' : 'Turn on camera'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => void api.startDemo(DEMO_WORD)}>
                  Try the demo
                </button>
              </>
            )}
            {mode === 'live' ? (
              <span className="empty-note">Nothing leaves this device — inference runs here.</span>
            ) : null}
          </div>
        </div>

        <StageBanner state={state} />
      </div>

      <aside className="translate-side">
        <OutputCard state={state} onEdit={api.edit} />
        <Candidates state={state} />
        <HandReadout state={state} />
      </aside>
    </div>
  );
}

export default TranslateApp;
