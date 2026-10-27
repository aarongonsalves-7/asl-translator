/**
 * Where hand frames come from.
 *
 * The recogniser does not care whether a frame came from a webcam or from the synthetic hand
 * model, which is what makes the demo mode honest: it replays real landmark trajectories
 * through the *same* engine, smoothing, holds and commits, so what you see in the demo is
 * exactly what the pipeline does with your hand. It also means the whole app can be tested
 * without a camera.
 */
import type { HandFrame } from './landmarks';
import { Camera, type CameraFailure } from './camera';
import { simulateLetter, simulateSequence, type PoseOptions } from '../sim/handModel';
import type { TrackerLoadProgress } from './tracker';

export type SourceKind = 'live' | 'demo';

export interface FrameSource {
  readonly kind: SourceKind;
  /** Short human label, shown next to the video. */
  readonly label: string;
  /** Frame height / width, used to undo MediaPipe's per-axis normalisation. */
  readonly aspect: number;
  start(): Promise<void>;
  stop(): void;
  /** The hand at this instant, or null when no hand is visible. */
  sample(nowMs: number): HandFrame | null;
}

/**
 * Webcam + MediaPipe.
 *
 * The tracker is imported dynamically so the demo route never downloads the 8 MB model, and so
 * tests (which have no WASM) never touch it.
 */
export class LiveSource implements FrameSource {
  readonly kind = 'live' as const;
  readonly label = 'Live camera';

  private readonly camera: Camera;
  private tracker: Awaited<ReturnType<typeof import('./tracker').HandTracker.create>> | null = null;
  private starting: Promise<void> | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onProgress: (progress: TrackerLoadProgress) => void = () => {},
  ) {
    this.camera = new Camera(video);
  }

  get aspect(): number {
    return this.camera.aspect;
  }

  start(): Promise<void> {
    this.starting ??= (async () => {
      await this.camera.start({ width: 1280, height: 720 });
      const { HandTracker } = await import('./tracker');
      this.tracker ??= await HandTracker.create({ numHands: 1 }, this.onProgress);
    })().catch((error) => {
      // Let a retry start cleanly instead of handing back the same rejected promise.
      this.starting = null;
      throw error;
    });
    return this.starting;
  }

  sample(nowMs: number): HandFrame | null {
    if (!this.tracker) return null;
    return this.tracker.detect(this.video, nowMs);
  }

  stop(): void {
    this.tracker?.close();
    this.tracker = null;
    this.starting = null;
    this.camera.stop();
  }

  /** The typed reason the camera failed, when it did. */
  get failure(): CameraFailure | null {
    return this.camera.failure;
  }
}

interface DemoBeat {
  frames: Array<HandFrame | null>;
}

const DEMO_FRAME_MS = 33;
/** Long enough that the default 600 ms hold always completes with room to spare. */
const DEMO_HOLD_MS = 1150;
/** Longer than the 250 ms absent-reset window, so each letter re-arms the next. */
const DEMO_GAP_MS = 420;

/**
 * A scripted signer, replayed against the frame clock.
 *
 * Each letter is held for ~1.1 s so the hold-to-commit gate completes, with a gap between
 * letters where the hand leaves the frame — which is what re-arms the next letter. J and Z get
 * their real trajectories, so their commits come from the motion matcher, not from a still
 * frame.
 */
export class DemoSource implements FrameSource {
  readonly kind = 'demo' as const;
  readonly label = 'Demo (synthetic hand)';
  readonly aspect: number;

  private plan: DemoBeat[] = [];
  private startedMs: number | null = null;
  private frameId = 0;

  constructor(
    private readonly word = 'HELLO',
    private readonly pose: PoseOptions = {},
  ) {
    this.aspect = pose.aspect ?? 4 / 3;
    this.build();
  }

  get script(): string {
    return this.word;
  }

  private build(): void {
    const holdFrames = Math.max(1, Math.round(DEMO_HOLD_MS / DEMO_FRAME_MS));
    const gapFrames = Math.max(1, Math.round(DEMO_GAP_MS / DEMO_FRAME_MS));
    const letters = [...this.word.toUpperCase()].filter((ch) => /[A-Z ]/.test(ch));

    for (const letter of letters) {
      if (letter === ' ') {
        this.plan.push({ frames: Array<null>(gapFrames * 2).fill(null) });
        continue;
      }
      const isMotion = letter === 'J' || letter === 'Z';
      const frames = simulateSequence(letter, {
        ...this.pose,
        holdFrames,
        traceFrames: isMotion ? 24 : 0,
        jitter: 0.004,
        seed: 11 + letter.charCodeAt(0),
      }).map((frame) => ({ ...frame }));
      this.plan.push({ frames });
      this.plan.push({ frames: Array<null>(gapFrames).fill(null) });
    }
  }

  start(): Promise<void> {
    this.startedMs = null;
    return Promise.resolve();
  }

  stop(): void {
    this.startedMs = null;
  }

  sample(nowMs: number): HandFrame | null {
    if (this.plan.length === 0) return null;
    this.startedMs ??= nowMs;
    const index = Math.floor((nowMs - this.startedMs) / DEMO_FRAME_MS);

    let cursor = index;
    for (const beat of this.plan) {
      if (cursor < beat.frames.length) {
        const frame = beat.frames[cursor];
        return frame ? { ...frame, timestampMs: nowMs, frameId: ++this.frameId } : null;
      }
      cursor -= beat.frames.length;
    }
    // Loop so the demo keeps demonstrating instead of freezing on the last letter.
    this.startedMs = nowMs;
    return this.sample(nowMs);
  }
}

/** A still pose, for tests and calibration screenshots. */
export function stillFrame(letter: string, nowMs = 0): HandFrame {
  return simulateLetter(letter, { timestampMs: nowMs });
}
