/**
 * Camera lifecycle and, more importantly, a *specific reason* every time it fails.
 *
 * "Camera On / Ready" tells the user nothing when the camera does not start. Browsers fail
 * getUserMedia in several genuinely different ways — permission denied, no device, in use by
 * another tab, or a non-secure origin — and each one needs different words and a different
 * action from the user.
 */
import type { StageId } from '../pipeline/stages';

export type CameraFailureKind = Extract<StageId, 'denied' | 'no-device' | 'in-use' | 'insecure' | 'camera-error'>;

export interface CameraFailure {
  kind: CameraFailureKind;
  message: string;
}

export interface CameraStartOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
}

/** Cameras are only exposed in a secure context: https:// or localhost. */
export function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  const { protocol, hostname } = window.location;
  return protocol === 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
}

export function hasMediaDevices(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export function classifyCameraFailure(error: unknown): CameraFailure {
  if (!isSecureContext() || !hasMediaDevices()) {
    return {
      kind: 'insecure',
      message:
        'This page is not running in a secure context, so the browser will not expose a camera.',
    };
  }
  const name = (error as { name?: string } | null)?.name ?? '';
  const message = (error as { message?: string } | null)?.message ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { kind: 'denied', message: 'Camera permission was denied for this site.' };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { kind: 'no-device', message: 'No camera matched the request.' };
    case 'NotReadableError':
    case 'AbortError':
      return {
        kind: 'in-use',
        message: 'The camera is already in use by another application or tab.',
      };
    default:
      return { kind: 'camera-error', message: message || 'The camera could not be started.' };
  }
}

export class Camera {
  private stream: MediaStream | null = null;
  private failReason: CameraFailure | null = null;

  constructor(private readonly video: HTMLVideoElement) {}

  get isLive(): boolean {
    return !!this.stream && this.video.readyState >= 2;
  }

  get failure(): CameraFailure | null {
    return this.failReason;
  }

  get audioTracks(): number {
    return 0;
  }

  /** Aspect ratio of the actual video, which MediaPipe's normalised coords need. */
  get aspect(): number {
    const width = this.video.videoWidth || 640;
    const height = this.video.videoHeight || 480;
    return width / height;
  }

  async start(options: CameraStartOptions = {}): Promise<void> {
    if (!isSecureContext() || !hasMediaDevices()) {
      this.failReason = classifyCameraFailure(null);
      throw this.failReason;
    }

    this.stop();
    this.failReason = null;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: options.facingMode ?? 'user',
          width: { ideal: options.width ?? 640 },
          height: { ideal: options.height ?? 480 },
        },
        audio: false,
      });
    } catch (error) {
      this.failReason = classifyCameraFailure(error);
      throw this.failReason;
    }

    this.video.srcObject = this.stream;
    // iOS refuses to play an inline video without these, and Safari needs the awaited promise.
    this.video.setAttribute('playsinline', 'true');
    this.video.muted = true;
    try {
      await this.video.play();
    } catch {
      // Autoplay can be refused; the frames may still arrive once the user interacts.
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video.srcObject) this.video.srcObject = null;
  }
}
