/** Every knob the user can change in Settings, with the defaults we ship. */
export interface PipelineConfig {
  /** EMA weight for the new frame's scores. Higher = more reactive, more jitter. */
  smoothingAlpha: number;
  /** How long a shape must hold before it is added to the text. */
  holdMs: number;
  /** Frames that must agree with the leader before a hold can complete. */
  minAgreeFrames: number;
  /**
   * Minimum constraint-match score for the leading letter (0..1). This is the interpretable
   * "how well does the hand satisfy that letter's rules" number, not a softmax probability.
   */
  minConfidence: number;
  /** Minimum score gap to the runner-up; below this the frame is "ambiguous" not guessed. */
  minMargin: number;
  /** Dead time after a commit, so one hold adds exactly one letter. */
  cooldownMs: number;
  /** How long the hand may disappear before we re-arm for the next letter. */
  absentResetMs: number;
  /** Mean landmark movement per frame (palm lengths) above which we call it "too fast". */
  maxMotion: number;
  /** Milliseconds a commit receipt stays on screen. */
  receiptMs: number;
  /** Gesture score needed for thumbs-up/down to fire. */
  gestureThreshold: number;
  /**
   * How far a gesture must beat the best-matching letter before it wins. A thumbs-up is
   * geometrically close to A (a fist with the thumb up), so a gesture only fires when no
   * letter actually explains the hand — otherwise a real A would be swallowed as a space.
   */
  gestureMinMargin: number;
  /** Set false to ignore thumbs-up/down entirely and use only the on-screen controls. */
  gesturesEnabled: boolean;
  /** Hands smaller than this fraction of the frame height are too far away. */
  minHandSize: number;
  /** Hands larger than this are too close. */
  maxHandSize: number;
}

export const DEFAULT_CONFIG: PipelineConfig = {
  smoothingAlpha: 0.4,
  holdMs: 600,
  minAgreeFrames: 8,
  minConfidence: 0.62,
  minMargin: 0.1,
  cooldownMs: 800,
  absentResetMs: 250,
  maxMotion: 0.22,
  receiptMs: 1400,
  gestureThreshold: 0.75,
  gestureMinMargin: 0.05,
  gesturesEnabled: true,
  minHandSize: 0.075,
  maxHandSize: 0.5,
};

export const CONFIG_LIMITS = {
  holdMs: { min: 250, max: 1500, step: 50 },
  minConfidence: { min: 0.4, max: 0.95, step: 0.01 },
  minMargin: { min: 0.02, max: 0.4, step: 0.01 },
  smoothingAlpha: { min: 0.15, max: 0.9, step: 0.05 },
  cooldownMs: { min: 200, max: 2000, step: 100 },
} as const;
