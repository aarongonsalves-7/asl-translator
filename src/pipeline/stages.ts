/**
 * The stage machine's user-facing half.
 *
 * This is the part the competition gets wrong. "Camera On", "Ready" and "Raise your hand" all
 * describe the *camera*; none of them says what the recogniser can currently see, whether the
 * hand it found is readable, whether a letter is forming, or why nothing has been added yet.
 * Every stage below states a different fact and names the single action that moves it forward.
 */
export type StageId =
  // Camera lifecycle
  | 'camera-off'
  | 'requesting'
  | 'denied'
  | 'no-device'
  | 'in-use'
  | 'insecure'
  | 'camera-error'
  | 'model-loading'
  // Recognition
  | 'no-hand'
  | 'unreadable'
  | 'unsure'
  | 'tracing'
  | 'holding'
  | 'added'
  | 'latched'
  | 'cooldown';

export type StageTone = 'idle' | 'waiting' | 'good' | 'attention' | 'error';

export interface StageView {
  id: StageId;
  tone: StageTone;
  headline: string;
  detail: string;
  /** The one thing the user should do next, when there is something to do. */
  action?: string;
}

export type UnreadableReason = 'too-far' | 'too-close' | 'out-of-frame' | 'moving';

export interface StageContext {
  /** Progress 0..1 through the current hold, or the trace. */
  progress?: number;
  letter?: string;
  probability?: number;
  runnerUpLetter?: string;
  runnerUpProbability?: number;
  hint?: string | null;
  holdMs?: number;
  heldMs?: number;
  modelProgress?: number;
  unreadableReason?: UnreadableReason;
  resetReason?: string | null;
  cooldownMs?: number;
  traceKind?: 'j' | 'z' | null;
  traceReason?: string | null;
  motionInstruction?: string | null;
  errorMessage?: string | null;
}

const pct = (value?: number): string => `${Math.round((value ?? 0) * 100)}%`;
const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

export function stageCopy(id: StageId, ctx: StageContext = {}): StageView {
  switch (id) {
    case 'camera-off':
      return {
        id,
        tone: 'idle',
        headline: 'Camera off',
        detail: 'Nothing is being detected. You can try the demo first — it needs no camera.',
        action: 'Turn on camera',
      };
    case 'requesting':
      return {
        id,
        tone: 'waiting',
        headline: 'Waiting for permission',
        detail: 'Your browser is asking whether this site may use the camera.',
        action: 'Choose Allow in the prompt (check the address bar if you missed it)',
      };
    case 'denied':
      return {
        id,
        tone: 'error',
        headline: 'Camera blocked',
        detail: 'The browser is blocking camera access, so no hand can be seen.',
        action: "Re-allow the camera in this site's permissions, then try again",
      };
    case 'no-device':
      return {
        id,
        tone: 'error',
        headline: 'No camera found',
        detail: 'This device did not report a camera, so there is nothing to watch.',
        action: 'Connect a camera, or switch to the demo',
      };
    case 'in-use':
      return {
        id,
        tone: 'error',
        headline: 'Camera is busy',
        detail: 'Another app or tab is already using the camera.',
        action: 'Close the other app or tab, then try again',
      };
    case 'insecure':
      return {
        id,
        tone: 'error',
        headline: 'Camera needs a secure connection',
        detail: 'Browsers only allow camera access over https:// or on localhost.',
        action: 'Open the site over https:// (or localhost during development)',
      };
    case 'camera-error':
      return {
        id,
        tone: 'error',
        headline: 'Camera could not start',
        detail: ctx.errorMessage ?? 'The browser refused to start the video stream.',
        action: 'Try again, or switch to the demo',
      };
    case 'model-loading':
      return {
        id,
        tone: 'waiting',
        headline: 'Loading the hand tracker',
        detail: `One-time load, ${pct(ctx.modelProgress)} done. Everything runs on your device — no video leaves it.`,
      };
    case 'no-hand':
      return {
        id,
        tone: 'waiting',
        headline: 'Camera on — no hand in view',
        detail: 'The camera is live and the tracker is running, but it cannot see a hand.',
        action: 'Raise your hand into the frame',
      };
    case 'unreadable': {
      const reasons: Record<UnreadableReason, { headline: string; detail: string; action: string }> = {
        'too-far': {
          headline: 'Hand is small in frame',
          detail: 'A hand was found, but too far away to read the finger positions.',
          action: 'Move your hand closer to the camera',
        },
        'too-close': {
          headline: 'Hand fills the frame',
          detail: 'A hand was found, but it is cropping at the edges.',
          action: 'Move your hand back a little',
        },
        'out-of-frame': {
          headline: 'Part of your hand is outside the frame',
          detail: 'Every fingertip has to be visible to tell letters apart.',
          action: 'Centre your hand in the frame',
        },
        moving: {
          headline: 'Hand is moving too fast to read',
          detail: 'Fast movement blurs the finger positions, so no letter is being formed.',
          action: 'Hold the shape still',
        },
      };
      const reason = ctx.unreadableReason ?? 'out-of-frame';
      return { id, tone: 'attention', ...reasons[reason] };
    }
    case 'unsure': {
      const closest =
        ctx.letter && ctx.probability !== undefined
          ? `Closest match: ${ctx.letter} ${pct(ctx.probability)}${
              ctx.runnerUpLetter ? ` · ${ctx.runnerUpLetter} ${pct(ctx.runnerUpProbability)}` : ''
            }.`
          : 'No letter is close enough to name yet.';
      return {
        id,
        tone: 'attention',
        headline: 'Hand in view — not confident yet',
        detail: [closest, ctx.hint].filter(Boolean).join(' '),
        action: ctx.motionInstruction ?? ctx.hint ?? 'Adjust the handshape and hold it',
      };
    }
    case 'tracing':
      return {
        id,
        tone: 'waiting',
        headline: `Tracing ${(ctx.traceKind ?? 'j').toUpperCase()}`,
        detail: ctx.traceReason
          ? ctx.traceReason
          : `Keep drawing the letter — ${pct(ctx.progress)} of the way there.`,
        action: ctx.traceReason ? 'Start the trace again' : 'Keep moving',
      };
    case 'holding':
      return {
        id,
        tone: 'good',
        headline: `Hold steady — ${ctx.letter ?? ''}`,
        detail: `${pct(ctx.probability)} confident. ${seconds(
          Math.max(0, (ctx.holdMs ?? 0) - (ctx.heldMs ?? 0)),
        )} to go.`,
        action: ctx.resetReason ? `Reset: ${ctx.resetReason}. Hold it again.` : undefined,
      };
    case 'added':
      return {
        id,
        tone: 'good',
        headline: `Added ${ctx.letter ?? ''}`,
        detail: `${pct(ctx.probability)} confident after holding ${seconds(ctx.heldMs ?? 0)}.`,
      };
    case 'latched':
      return {
        id,
        tone: 'idle',
        headline: `${ctx.letter ?? 'This'} is already added`,
        detail: 'One hold adds one letter. Drop your hand or change shape to add another.',
        action: 'Release, or move to the next letter',
      };
    case 'cooldown':
      return {
        id,
        tone: 'idle',
        headline: `Next letter in ${seconds(ctx.cooldownMs ?? 0)}`,
        detail: 'One hold adds one letter. Change shape, or drop your hand, to add another.',
      };
  }
}

export const CAMERA_STAGES: StageId[] = [
  'camera-off',
  'requesting',
  'denied',
  'no-device',
  'in-use',
  'insecure',
  'camera-error',
  'model-loading',
];

export function isCameraStage(id: StageId): boolean {
  return CAMERA_STAGES.includes(id);
}
