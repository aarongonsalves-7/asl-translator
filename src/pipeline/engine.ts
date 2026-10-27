/**
 * The recognition engine.
 *
 * One narrow interface — `feed()` in, `RecognitionState` out — over a lot of behaviour:
 * score smoothing, readability gating, hold-to-commit, one-letter-per-hold de-duplication,
 * gesture detection, J/Z trajectory tracing, and the stage the UI narrates.
 *
 * Confidence is reported as the *constraint-match score* (how well the hand satisfies that
 * letter's rules), not as a softmax probability: a normalised probability gets diluted by
 * however many letters happen to be near-misses, so it understates a clean match and would
 * make the app refuse to commit a hand it clearly recognised.
 *
 * All timing comes from the frame's own timestamp rather than the wall clock, so the pipeline
 * can be replayed deterministically in tests and in demo mode.
 */
import { classify, type MotionSuggestion } from '../classify/classifier';
import { describeFinger, describeThumb, extractFeatures, type HandFeatures } from '../classify/features';
import { canonicalize, LM, type CanonicalHand, type HandFrame } from '../vision/landmarks';
import { DEFAULT_CONFIG, type PipelineConfig } from './config';
import { MIN_PATH_LENGTH, matchTrace, tracePointFromTip, type PathPoint } from './motion';
import { isCameraStage, stageCopy, type StageContext, type StageId, type StageView, type UnreadableReason } from './stages';

export type CommitKind = 'letter' | 'space' | 'backspace';

export interface CommitReceipt {
  id: number;
  kind: CommitKind;
  value: string;
  /** Constraint-match score of the committed letter, 0..1. */
  confidence: number;
  heldMs: number;
  atMs: number;
}

export interface QualityReport {
  /** Palm length as a fraction of frame height. */
  handSize: number;
  /** Mean landmark movement per frame, in palm lengths. */
  motion: number;
  facing: CanonicalHand['facing'];
  rotationDeg: number;
  unreadable: UnreadableReason | null;
}

export interface Candidate {
  letter: string;
  /** Smoothed constraint-match score, 0..1. */
  confidence: number;
}

export interface TraceState {
  kind: 'j' | 'z' | null;
  progress: number;
  reason: string | null;
  path: PathPoint[];
  bestDistance: number | null;
}

export interface HoldState {
  progress: number;
  heldMs: number;
  candidate: string | null;
  resetReason: string | null;
}

export interface RecognitionState {
  stage: StageView;
  /** Everything committed so far, as text. */
  text: string;
  history: CommitReceipt[];
  receipt: CommitReceipt | null;
  handPresent: boolean;
  quality: QualityReport | null;
  fingers: Array<{ name: string; state: string }>;
  thumbState: string | null;
  ranked: Candidate[];
  leader: { letter: string; confidence: number; margin: number } | null;
  /** Constraints the leading letter missed — the actionable part of the explanation. */
  failing: Array<{ label: string; value: number }>;
  hint: string | null;
  motionSuggestion: { letter: string; instruction: string } | null;
  trace: TraceState;
  hold: HoldState;
  cooldownMs: number;
  gesture: CommitKind | null;
  fps: number;
  config: PipelineConfig;
  /** Set when the tracker itself is reporting something (permission, model loading). */
  cameraStage: StageId;
}

export interface FeedInput {
  hand: HandFrame | null;
  /** videoWidth / videoHeight, needed to undo MediaPipe's per-axis normalisation. */
  aspect: number;
  nowMs: number;
}

const MAX_TRACE_MS = 2600;
const TRACE_MIN_POINT_GAP = 0.03;
const TRACE_SHAPE_GRACE_MS = 220;
const REARM_FRAMES = 5;

const emptyTrace = (): TraceState => ({ kind: null, progress: 0, reason: null, path: [], bestDistance: null });
const emptyHold = (): HoldState => ({ progress: 0, heldMs: 0, candidate: null, resetReason: null });

interface Analysis {
  features: HandFeatures;
  leader: Candidate | null;
  runnerUp: Candidate | null;
  margin: number;
  ranking: Candidate[];
  hint: string | null;
  motion: MotionSuggestion | null;
  failing: Array<{ label: string; value: number }>;
}

export class RecognitionEngine {
  private config: PipelineConfig;
  private committed = '';
  private history: CommitReceipt[] = [];
  private receipt: CommitReceipt | null = null;
  private receiptSeq = 0;

  /** EMA over the per-letter constraint scores, keyed by letter. */
  private smoothed = new Map<string, number>();
  private lastCanonical: CanonicalHand | null = null;
  private lastHandMs = -Infinity;
  private lastFeedMs = -1;
  private fps = 0;

  private holdStartedMs: number | null = null;
  private heldMs = 0;
  private agreeFrames = 0;
  private holdCandidate: string | null = null;
  private resetReason: string | null = null;

  private armed = true;
  private motionArmed = true;
  /** The candidate currently added and waiting to be released (a letter, 'space' or 'backspace'). */
  private lastCommitted: string | null = null;
  /** The committed candidate the signer is still holding, if any. */
  private latched: string | null = null;
  private cooldownUntilMs = -Infinity;

  private trace: TraceState = emptyTrace();
  private traceStartMs: number | null = null;
  private traceOrigin: PathPoint | null = null;
  private traceScale = 1;
  private traceGateLostMs: number | null = null;

  private cameraStage: StageId = 'camera-off';
  private cameraContext: StageContext = {};
  private latest: RecognitionState;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.latest = this.buildState(stageCopy('camera-off'), null, null, emptyHold(), emptyTrace(), 0, null);
  }

  setConfig(patch: Partial<PipelineConfig>): RecognitionState {
    this.config = { ...this.config, ...patch };
    this.latest = { ...this.latest, config: { ...this.config } };
    return this.latest;
  }

  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  setCameraStage(stage: StageId, context: StageContext = {}): RecognitionState {
    this.cameraStage = stage;
    this.cameraContext = context;

    // The stage *copy* has to be recomputed here, not just stored: the UI reads `stage`, so
    // announcing "denied" without deriving its wording would leave the user looking at
    // "Camera off" while the engine already knew the camera was blocked.
    if (isCameraStage(stage)) {
      this.resetRecognition();
      this.latest = {
        ...this.latest,
        stage: stageCopy(stage, context),
        cameraStage: stage,
        handPresent: false,
        quality: null,
        fingers: [],
        thumbState: null,
        ranked: [],
        leader: null,
        failing: [],
        hint: null,
        motionSuggestion: null,
        trace: emptyTrace(),
        hold: emptyHold(),
        cooldownMs: 0,
        gesture: null,
      };
    } else {
      this.latest = { ...this.latest, stage: stageCopy(stage, context), cameraStage: stage };
    }
    return this.latest;
  }

  getState(): RecognitionState {
    return this.latest;
  }

  /** On-screen and keyboard output controls. */
  applyEdit(action: 'space' | 'backspace' | 'clear' | 'undo', nowMs = this.lastFeedMs): RecognitionState {
    if (action === 'space') {
      this.pushReceipt('space', ' ', 1, 0, nowMs);
    } else if (action === 'clear') {
      this.committed = '';
      this.history = [];
      this.receipt = null;
    } else {
      const last = this.history[this.history.length - 1];
      if (!last) return this.latest;
      if (last.kind === 'letter' || last.kind === 'space') {
        this.committed = this.committed.slice(0, Math.max(0, this.committed.length - last.value.length));
        this.history = this.history.slice(0, -1);
        this.receipt = null;
      }
      this.armed = true;
      this.resetHold(null);
    }
    this.latest = { ...this.latest, text: this.committed, history: [...this.history], receipt: this.receipt };
    return this.latest;
  }

  resetRecognition(): void {
    this.smoothed.clear();
    this.lastCanonical = null;
    this.resetHold(null);
    this.resetTrace(null);
    this.armed = true;
    this.motionArmed = true;
    this.lastCommitted = null;
    this.cooldownUntilMs = -Infinity;
  }

  feed(input: FeedInput): RecognitionState {
    const { hand, aspect, nowMs } = input;

    if (this.lastFeedMs >= 0) {
      const dt = nowMs - this.lastFeedMs;
      if (dt > 0 && dt < 1000) {
        const instant = 1000 / dt;
        this.fps = this.fps === 0 ? instant : this.fps * 0.9 + instant * 0.1;
      }
    }
    this.lastFeedMs = nowMs;

    if (!hand) return this.handleAbsentHand(nowMs);

    this.lastHandMs = nowMs;
    const canonical = canonicalize(hand, aspect, this.lastCanonical);
    this.lastCanonical = canonical;
    const features = extractFeatures(canonical);
    const result = classify(features);

    this.smoothScores(result.ranked);
    const ranking = this.smoothedRanking();
    const leader = ranking[0] ?? null;
    const runnerUp = ranking[1] ?? null;
    const margin = leader && runnerUp ? leader.confidence - runnerUp.confidence : leader ? 1 : 0;

    const quality = this.assessQuality(canonical, aspect);
    const readable = quality.unreadable === null;

    // Thumbs-up is space and thumbs-down is backspace. They only win when no letter explains
    // the hand: a thumbs-up is geometrically close to A, so without this margin a real A
    // would be swallowed as a space. A genuine thumbs-up, where the letters fit poorly,
    // still fires.
    const rawGesture: CommitKind | null =
      features.thumb.thumbsUp >= this.config.gestureThreshold
        ? 'space'
        : features.thumb.thumbsDown >= this.config.gestureThreshold
          ? 'backspace'
          : null;
    const gestureScore =
      rawGesture === 'space' ? features.thumb.thumbsUp : rawGesture === 'backspace' ? features.thumb.thumbsDown : 0;
    const gestureMarginOk =
      !leader || leader.confidence < gestureScore - this.config.gestureMinMargin;
    const gesture: CommitKind | null =
      this.config.gesturesEnabled && rawGesture && gestureMarginOk ? rawGesture : null;

    const confident = leader !== null && leader.confidence >= this.config.minConfidence && margin >= this.config.minMargin;

    const candidate: string | null = readable
      ? gesture ?? (confident ? leader!.letter : null)
      : null;

    this.latched = !this.armed && this.lastCommitted !== null && candidate === this.lastCommitted ? this.lastCommitted : null;

    const cooldownMs = Math.max(0, this.cooldownUntilMs - nowMs);
    const trace = this.advanceTrace(result.motionSuggestion, canonical, nowMs, readable, cooldownMs);
    // While a J or Z is being drawn the hand is necessarily moving through a still handshape
    // (J starts from I, Z from a pointing index), so the letter hold stands down until the
    // trace either lands or breaks.
    const traceActive = trace.kind !== null && trace.path.length > 2;
    const hold = this.advanceHold(
      traceActive ? null : candidate,
      readable,
      quality,
      nowMs,
      cooldownMs,
      leader,
    );

    let receipt = this.receipt;
    if (receipt && nowMs - receipt.atMs > this.config.receiptMs) {
      this.receipt = null;
      receipt = null;
    }

    const analysis: Analysis = {
      features,
      leader,
      runnerUp,
      margin,
      ranking,
      hint: result.hint,
      motion: result.motionSuggestion,
      failing: (result.ranked[0]?.failing ?? []).slice(0, 3).map((c) => ({ label: c.label, value: c.value })),
    };

    const stage = this.deriveStage({
      quality,
      leader,
      runnerUp,
      margin,
      hold,
      cooldownMs,
      trace,
      receipt,
      hint: result.hint,
      motionInstruction: result.motionSuggestion?.instruction ?? null,
    });

    this.latest = this.buildState(stage, quality, analysis, hold, trace, cooldownMs, gesture);
    return this.latest;
  }

  // ---------------------------------------------------------------- internals

  private handleAbsentHand(nowMs: number): RecognitionState {
    const absentFor = nowMs - this.lastHandMs;
    if (absentFor > this.config.absentResetMs) {
      this.smoothed.clear();
      this.lastCanonical = null;
      this.resetHold(this.holdCandidate ? 'hand left the frame' : null);
      this.resetTrace(null);
      // Dropping the hand is one of the two ways to arm the next letter (the other is
      // changing shape), which is what stops one hold from repeating a letter forever.
      this.armed = true;
      this.motionArmed = true;
      this.lastCommitted = null;
      this.latched = null;
    }

    const cooldownMs = Math.max(0, this.cooldownUntilMs - nowMs);
    let receipt = this.receipt;
    if (receipt && nowMs - receipt.atMs > this.config.receiptMs) {
      this.receipt = null;
      receipt = null;
    }

    const stage = this.deriveStage({
      quality: null,
      leader: null,
      runnerUp: null,
      margin: 0,
      hold: emptyHold(),
      cooldownMs,
      trace: emptyTrace(),
      receipt,
      hint: null,
      motionInstruction: null,
    });

    this.latest = this.buildState(stage, null, null, emptyHold(), emptyTrace(), cooldownMs, null);
    return this.latest;
  }

  private smoothScores(ranked: Array<{ letter: string; score: number }>): void {
    for (const scored of ranked) {
      const previous = this.smoothed.get(scored.letter) ?? scored.score;
      this.smoothed.set(
        scored.letter,
        this.config.smoothingAlpha * scored.score + (1 - this.config.smoothingAlpha) * previous,
      );
    }
  }

  private smoothedRanking(): Candidate[] {
    const entries = [...this.smoothed.entries()].map(([letter, confidence]) => ({ letter, confidence }));
    entries.sort((a, b) => b.confidence - a.confidence);
    return entries;
  }

  private assessQuality(hand: CanonicalHand, aspect: number): QualityReport {
    const handSize = hand.palmLength;
    // imagePts are aspect-corrected (x multiplied by width/height), so normalise x back to
    // 0..1 before comparing against the frame edges.
    const xs = hand.imagePts.map((p) => p.x / aspect);
    const ys = hand.imagePts.map((p) => p.y);

    let unreadable: UnreadableReason | null = null;
    if (Math.min(...xs) < 0.01 || Math.max(...xs) > 0.99 || Math.min(...ys) < 0.01 || Math.max(...ys) > 0.99) {
      unreadable = 'out-of-frame';
    } else if (handSize < this.config.minHandSize) {
      unreadable = 'too-far';
    } else if (handSize > this.config.maxHandSize) {
      unreadable = 'too-close';
    } else if (hand.motion > this.config.maxMotion) {
      unreadable = 'moving';
    }

    return { handSize, motion: hand.motion, facing: hand.facing, rotationDeg: hand.rotationDeg, unreadable };
  }

  private advanceHold(
    candidate: string | null,
    readable: boolean,
    quality: QualityReport,
    nowMs: number,
    cooldownMs: number,
    leader: Candidate | null,
  ): HoldState {
    // Re-arm when the candidate moves on to something *other* than what was just added.
    // Comparing candidates (rather than the leading letter) is what stops a held thumbs-up
    // from firing a space over and over: its candidate never stops being "space".
    if (!this.armed && this.lastCommitted && candidate !== null && candidate !== this.lastCommitted) {
      if (this.agreeFrames >= REARM_FRAMES && quality.unreadable === null) this.armed = true;
    }

    if (candidate === null) {
      this.resetHold(
        !readable ? null : leader ? 'shape is ambiguous between letters' : null,
      );
      return emptyHold();
    }

    if (this.holdCandidate !== candidate) {
      this.holdStartedMs = nowMs;
      this.heldMs = 0;
      this.holdCandidate = candidate;
      this.agreeFrames = 1;
      this.resetReason = null;
    } else {
      this.agreeFrames += 1;
      this.heldMs = this.holdStartedMs === null ? 0 : nowMs - this.holdStartedMs;
    }

    if (quality.unreadable === 'moving') {
      this.holdStartedMs = nowMs;
      this.heldMs = 0;
      this.resetReason = 'hand moved';
      return { progress: 0, heldMs: 0, candidate, resetReason: this.resetReason };
    }

    const progress = Math.min(1, this.heldMs / this.config.holdMs);
    const ready =
      this.armed &&
      cooldownMs <= 0 &&
      this.heldMs >= this.config.holdMs &&
      this.agreeFrames >= this.config.minAgreeFrames;

    if (ready) {
      const isGesture = candidate === 'space' || candidate === 'backspace';
      const confidence = isGesture ? 1 : (leader?.confidence ?? this.smoothed.get(candidate) ?? 0);
      this.commit(candidate, confidence, this.heldMs, nowMs);
      this.resetHold(null);
      return emptyHold();
    }

    return { progress, heldMs: this.heldMs, candidate, resetReason: this.resetReason };
  }

  private advanceTrace(
    suggestion: MotionSuggestion | null,
    hand: CanonicalHand,
    nowMs: number,
    readable: boolean,
    cooldownMs: number,
  ): TraceState {
    const gateActive = readable && suggestion !== null && cooldownMs <= 0 && this.armed && this.motionArmed;

    if (!gateActive) {
      // Losing the starting handshape for a moment means the signer has released it, which
      // re-arms the next trace — that is how you sign J then Z without dropping your hand.
      this.traceGateLostMs ??= nowMs;
      if (nowMs - this.traceGateLostMs > TRACE_SHAPE_GRACE_MS) {
        const hadPath = this.trace.path.length > 2;
        this.motionArmed = true;
        this.resetTrace(hadPath ? 'the handshape changed mid-trace' : null);
      }
      return this.trace;
    }
    this.traceGateLostMs = null;

    const kind = suggestion!.letter === 'J' ? 'j' : 'z';
    const tipIndex = kind === 'j' ? LM.PINKY_TIP : LM.INDEX_TIP;
    const tip = hand.imagePts[tipIndex]!;

    if (this.traceStartMs === null || this.trace.kind !== kind) {
      this.traceStartMs = nowMs;
      this.traceOrigin = { x: tip.x, y: tip.y };
      this.traceScale = hand.palmLength || 0.001;
      this.trace = { kind, progress: 0, reason: null, path: [], bestDistance: null };
    }

    const point = tracePointFromTip(
      tip,
      { x: this.traceOrigin!.x, y: this.traceOrigin!.y, z: 0 },
      this.traceScale,
    );
    const last = this.trace.path[this.trace.path.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= TRACE_MIN_POINT_GAP) {
      this.trace.path.push(point);
    }

    const elapsed = nowMs - (this.traceStartMs ?? nowMs);
    let pathLength = 0;
    for (let i = 1; i < this.trace.path.length; i++) {
      pathLength += Math.hypot(
        this.trace.path[i]!.x - this.trace.path[i - 1]!.x,
        this.trace.path[i]!.y - this.trace.path[i - 1]!.y,
      );
    }
    const progress = Math.min(1, pathLength / MIN_PATH_LENGTH);

    if (elapsed > MAX_TRACE_MS && pathLength < MIN_PATH_LENGTH) {
      this.resetTrace('the trace took too long — start again');
      return this.trace;
    }

    if (pathLength >= MIN_PATH_LENGTH) {
      const match = matchTrace(this.trace.path);
      if (match) {
        const path = [...this.trace.path];
        const distance = match.distance;
        this.commit(match.letter, Math.max(0, 1 - distance), elapsed, nowMs);
        this.resetTrace(null);
        return { kind, progress: 1, reason: null, path, bestDistance: distance };
      }
      if (elapsed > MAX_TRACE_MS) {
        this.resetTrace('that did not look like the letter — try again');
        return this.trace;
      }
    }

    this.trace = {
      kind,
      progress,
      reason: null,
      path: this.trace.path,
      bestDistance: matchTrace(this.trace.path)?.distance ?? null,
    };
    return this.trace;
  }

  private resetTrace(reason: string | null): void {
    this.trace = { kind: null, progress: 0, reason, path: [], bestDistance: null };
    this.traceStartMs = null;
    this.traceOrigin = null;
    this.traceGateLostMs = null;
  }

  private resetHold(reason: string | null): void {
    this.holdStartedMs = null;
    this.heldMs = 0;
    this.agreeFrames = 0;
    this.holdCandidate = null;
    this.resetReason = reason;
  }

  private commit(value: string, confidence: number, heldMs: number, nowMs: number): void {
    const kind: CommitKind = value === 'space' ? 'space' : value === 'backspace' ? 'backspace' : 'letter';
    if (kind === 'backspace') {
      this.applyEdit('backspace', nowMs);
    } else {
      // "space" is an instruction, not output: the text gets an actual space character.
      this.pushReceipt(kind, kind === 'space' ? ' ' : value, confidence, heldMs, nowMs);
    }

    this.armed = false;
    // A motion letter shares its still handshape with another letter (J with I, Z with a
    // pointing index), so re-arming by "the shape changed" would be meaningless — the gate
    // has to break instead, which motionArmed waits for.
    this.motionArmed = kind === 'letter' ? false : this.motionArmed;
    this.lastCommitted = value;
    this.cooldownUntilMs = nowMs + this.config.cooldownMs;
    this.agreeFrames = 0;
  }

  private pushReceipt(kind: CommitKind, value: string, confidence: number, heldMs: number, nowMs: number): void {
    const receipt: CommitReceipt = {
      id: ++this.receiptSeq,
      kind,
      value,
      confidence,
      heldMs,
      atMs: nowMs,
    };
    this.history.push(receipt);
    this.committed += value;
    this.receipt = receipt;
  }

  private deriveStage(input: {
    quality: QualityReport | null;
    leader: Candidate | null;
    runnerUp: Candidate | null;
    margin: number;
    hold: HoldState;
    cooldownMs: number;
    trace: TraceState;
    receipt: CommitReceipt | null;
    hint: string | null;
    motionInstruction: string | null;
  }): StageView {
    if (isCameraStage(this.cameraStage)) return stageCopy(this.cameraStage, this.cameraContext);

    const { quality, leader, runnerUp, margin, hold, cooldownMs, trace, receipt } = input;

    if (!quality) return stageCopy('no-hand');

    if (receipt) {
      return stageCopy('added', {
        letter: receipt.kind === 'letter' ? receipt.value : receipt.kind,
        probability: receipt.confidence,
        heldMs: receipt.heldMs,
      });
    }

    if (cooldownMs > 0) return stageCopy('cooldown', { cooldownMs });
    if (quality.unreadable) return stageCopy('unreadable', { unreadableReason: quality.unreadable });

    if (trace.kind) {
      return stageCopy('tracing', {
        traceKind: trace.kind,
        progress: trace.progress,
        traceReason: trace.reason,
      });
    }

    // Still holding the shape that was just added: say so, rather than showing a hold bar that
    // is full but will never fire.
    if (this.latched) return stageCopy('latched', { letter: this.latched });

    const confident =
      leader !== null && leader.confidence >= this.config.minConfidence && margin >= this.config.minMargin;

    if (confident && hold.candidate) {
      return stageCopy('holding', {
        letter: hold.candidate,
        probability: leader!.confidence,
        holdMs: this.config.holdMs,
        heldMs: hold.heldMs,
        resetReason: hold.resetReason,
      });
    }

    return stageCopy('unsure', {
      letter: leader?.letter,
      probability: leader?.confidence,
      runnerUpLetter: runnerUp?.letter,
      runnerUpProbability: runnerUp?.confidence,
      hint: input.hint,
      motionInstruction: input.motionInstruction,
    });
  }

  private buildState(
    stage: StageView,
    quality: QualityReport | null,
    analysis: Analysis | null,
    hold: HoldState,
    trace: TraceState,
    cooldownMs: number,
    gesture: CommitKind | null,
  ): RecognitionState {
    return {
      stage,
      text: this.committed,
      history: [...this.history],
      receipt: this.receipt,
      handPresent: analysis !== null,
      quality,
      fingers: analysis ? analysis.features.fingers.map((f) => ({ name: f.name, state: describeFinger(f) })) : [],
      thumbState: analysis ? describeThumb(analysis.features.thumb) : null,
      ranked: (analysis?.ranking ?? []).slice(0, 3),
      leader: analysis?.leader
        ? { letter: analysis.leader.letter, confidence: analysis.leader.confidence, margin: analysis.margin }
        : null,
      failing: analysis?.failing ?? [],
      hint: analysis?.hint ?? null,
      motionSuggestion: analysis?.motion
        ? { letter: analysis.motion.letter, instruction: analysis.motion.instruction }
        : null,
      trace,
      hold,
      cooldownMs,
      gesture,
      fps: this.fps,
      config: { ...this.config },
      cameraStage: this.cameraStage,
    };
  }
}
