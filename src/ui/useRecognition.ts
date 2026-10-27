/**
 * The bridge between a frame source and React.
 *
 * Two rules shape this file:
 *
 * 1. **The engine owns time.** Frames carry their own timestamps, so holds, cooldowns and
 *    traces are all measured against the frame clock. That is what lets the demo replay behave
 *    exactly like the camera, and lets tests drive the pipeline without sleeping.
 * 2. **React does not need every frame.** The loop runs at the display's refresh rate so the
 *    tracker sees every frame, but the component tree is republished at ~30 Hz (and immediately
 *    whenever the stage or the receipt changes). Re-rendering the whole page 60 times a second
 *    would cost more than the inference.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_CONFIG, type PipelineConfig } from '../pipeline/config';
import { RecognitionEngine, type RecognitionState } from '../pipeline/engine';
import type { StageId } from '../pipeline/stages';
import type { CameraFailure } from '../vision/camera';
import type { HandFrame } from '../vision/landmarks';
import { DemoSource, LiveSource, type FrameSource } from '../vision/sources';
import type { TrackerLoadProgress } from '../vision/tracker';

export type RunMode = 'off' | 'starting' | 'live' | 'demo';

export type EditAction = 'space' | 'backspace' | 'clear' | 'undo';

export interface FrameListener {
  (frame: HandFrame | null, nowMs: number): void;
}

export interface RecognitionApi {
  state: RecognitionState;
  mode: RunMode;
  /** Set when the camera could not start, with a typed reason for the UI to explain. */
  error: CameraFailure | null;
  loading: TrackerLoadProgress | null;
  /** Aspect ratio of the active source, so the video box can match it exactly. */
  aspect: number;
  startLive(video: HTMLVideoElement): Promise<void>;
  startDemo(word?: string): Promise<void>;
  stop(): void;
  retry(): Promise<void>;
  edit(action: EditAction): void;
  setConfig(patch: Partial<PipelineConfig>): void;
}

const RENDER_INTERVAL_MS = 40;

export function useRecognition(
  initialConfig: PipelineConfig = DEFAULT_CONFIG,
  onFrame?: FrameListener,
): RecognitionApi {
  const engineRef = useRef<RecognitionEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new RecognitionEngine(initialConfig);
  }
  const engine = engineRef.current;

  const sourceRef = useRef<FrameSource | null>(null);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameListenerRef = useRef<FrameListener | undefined>(onFrame);
  frameListenerRef.current = onFrame;

  const [state, setState] = useState<RecognitionState>(() => engine.getState());
  const [mode, setMode] = useState<RunMode>('off');
  const [error, setError] = useState<CameraFailure | null>(null);
  const [loading, setLoading] = useState<TrackerLoadProgress | null>(null);
  const [aspect, setAspect] = useState(4 / 3);

  const publish = useCallback((next: RecognitionState, nowMs: number, force = false) => {
    const previous = lastPublishedRef.current;
    const changed =
      !previous ||
      previous.stage.id !== next.stage.id ||
      previous.receipt?.id !== next.receipt?.id ||
      previous.text !== next.text;
    lastPublishedRef.current = next;
    if (force || changed || nowMs - lastPublishAtRef.current >= RENDER_INTERVAL_MS) {
      lastPublishAtRef.current = nowMs;
      setState(next);
    }
  }, []);

  const lastPublishedRef = useRef<RecognitionState | null>(null);
  const lastPublishAtRef = useRef(0);

  const cancelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cancelLoop();
    sourceRef.current?.stop();
    sourceRef.current = null;
    videoRef.current = null;
    engine.setCameraStage('camera-off');
    setMode('off');
    setLoading(null);
    publish(engine.getState(), performance.now(), true);
  }, [cancelLoop, engine, publish]);

  const runLoop = useCallback(() => {
    cancelLoop();
    const tick = (nowMs: number) => {
      const source = sourceRef.current;
      if (!source) return;
      const hand = source.sample(nowMs);
      const next = engine.feed({ hand, aspect: source.aspect, nowMs });
      frameListenerRef.current?.(hand, nowMs);
      publish(next, nowMs);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [cancelLoop, engine, publish]);

  const startLive = useCallback(
    async (video: HTMLVideoElement) => {
      cancelLoop();
      sourceRef.current?.stop();
      sourceRef.current = null;
      videoRef.current = video;

      setError(null);
      setMode('starting');
      setLoading({ stage: 'runtime', progress: 0.1 });
      publish(engine.setCameraStage('requesting'), performance.now(), true);

      const source = new LiveSource(video, (progress) => {
        setLoading(progress);
        if (progress.stage !== 'ready') {
          publish(engine.setCameraStage('model-loading', { modelProgress: progress.progress }), performance.now(), true);
        }
      });

      try {
        await source.start();
      } catch (failure) {
        const typed = failure as CameraFailure;
        setError(typed);
        setMode('off');
        setLoading(null);
        publish(engine.setCameraStage(typed.kind ?? 'camera-error', { errorMessage: typed.message }), performance.now(), true);
        return;
      }

      sourceRef.current = source;
      setAspect(source.aspect);
      setLoading(null);
      setMode('live');
      // 'no-hand' is not a camera stage, so from here the engine narrates what it can see.
      publish(engine.setCameraStage('no-hand'), performance.now(), true);
      runLoop();
    },
    [cancelLoop, engine, publish, runLoop],
  );

  const startDemo = useCallback(
    async (word = 'HELLO') => {
      cancelLoop();
      sourceRef.current?.stop();
      const source = new DemoSource(word);
      await source.start();
      sourceRef.current = source;
      setError(null);
      setLoading(null);
      setAspect(source.aspect);
      setMode('demo');
      engine.setConfig({});
      publish(engine.setCameraStage('no-hand'), performance.now(), true);
      runLoop();
    },
    [cancelLoop, engine, publish, runLoop],
  );

  const retry = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    await startLive(video);
  }, [startLive]);

  const edit = useCallback(
    (action: EditAction) => {
      publish(engine.applyEdit(action, performance.now()), performance.now(), true);
    },
    [engine, publish],
  );

  const setConfig = useCallback(
    (patch: Partial<PipelineConfig>) => {
      publish(engine.setConfig(patch), performance.now(), true);
    },
    [engine, publish],
  );

  useEffect(() => {
    return () => {
      cancelLoop();
      sourceRef.current?.stop();
      sourceRef.current = null;
    };
  }, [cancelLoop]);

  return { state, mode, error, loading, aspect, startLive, startDemo, stop, retry, edit, setConfig };
}

export type { StageId };
