/**
 * Thin wrapper around MediaPipe's HandLandmarker.
 *
 * The wasm runtime and the model are both vendored into `public/` by
 * `scripts/prepare-assets.mjs`, so nothing is fetched from a CDN at runtime: the app keeps
 * working offline, and there is no third-party dependency in the request path.
 *
 * Hand Landmarker Tasks labels refer to the subject's hands on raw input.
 * CSS mirrors only the display; it must not swap labels or inference coordinates.
 * https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
 */
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { LM, type HandFrame, type Vec3 } from './landmarks';

const WASM_PATH = '/wasm';
const MODEL_PATH = '/models/hand_landmarker.task';

export interface TrackerOptions {
  numHands?: number;
  minHandDetectionConfidence?: number;
  minHandPresenceConfidence?: number;
  minTrackingConfidence?: number;
  /** 'GPU' falls back to 'CPU' automatically on hardware that refuses it. */
  delegate?: 'GPU' | 'CPU';
  wasmPath?: string;
  modelPath?: string;
}

export interface TrackerLoadProgress {
  stage: 'runtime' | 'model' | 'ready';
  progress: number;
}

export class HandTracker {
  private frameId = 0;

  private constructor(private readonly landmarker: HandLandmarker) {}

  static async create(
    options: TrackerOptions = {},
    onProgress: (progress: TrackerLoadProgress) => void = () => {},
  ): Promise<HandTracker> {
    onProgress({ stage: 'runtime', progress: 0.15 });
    const vision = await FilesetResolver.forVisionTasks(options.wasmPath ?? WASM_PATH);
    onProgress({ stage: 'model', progress: 0.55 });

    const build = async (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: options.modelPath ?? MODEL_PATH,
          delegate,
        },
        runningMode: 'VIDEO',
        numHands: options.numHands ?? 1,
        minHandDetectionConfidence: options.minHandDetectionConfidence ?? 0.5,
        minHandPresenceConfidence: options.minHandPresenceConfidence ?? 0.5,
        minTrackingConfidence: options.minTrackingConfidence ?? 0.5,
      });

    let landmarker: HandLandmarker;
    try {
      landmarker = await build(options.delegate ?? 'GPU');
    } catch {
      // Older GPUs (and headless browsers) reject the GPU delegate; CPU is a correctness-
      // identical fallback, just slower.
      landmarker = await build('CPU');
    }
    onProgress({ stage: 'ready', progress: 1 });
    return new HandTracker(landmarker);
  }

  /** Detect one hand in a video frame. Returns null when no hand is visible. */
  detect(video: HTMLVideoElement, nowMs: number): HandFrame | null {
    if (video.readyState < 2 || !video.videoWidth) return null;

    const result = this.landmarker.detectForVideo(video, nowMs);
    const landmarks = result.landmarks?.[0];
    if (!landmarks || landmarks.length < 21) return null;

    const mediapipeLabel = result.handedness?.[0]?.[0]?.categoryName;
    if (mediapipeLabel !== 'Left' && mediapipeLabel !== 'Right') return null;
    const handednessScore = result.handedness?.[0]?.[0]?.score ?? 0;
    const handedness = mediapipeLabel === 'Left' ? 'left' : 'right';

    const toVec = (point: { x: number; y: number; z: number }): Vec3 => ({
      x: point.x,
      y: point.y,
      z: point.z,
    });

    const world = result.worldLandmarks?.[0];

    return {
      landmarks: landmarks.map(toVec),
      world: world ? world.map(toVec) : undefined,
      handedness,
      handednessScore,
      timestampMs: nowMs,
      frameId: ++this.frameId,
    };
  }

  close(): void {
    this.landmarker.close();
  }
}

export { LM };
