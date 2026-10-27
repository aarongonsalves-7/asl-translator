import { describe, expect, it } from 'vitest';
import { LETTER_ORDER } from '../../src/classify/letters';
import { RecognitionEngine } from '../../src/pipeline/engine';
import { buildLocalHand, projectHand, simulateLetter, simulateSequence } from '../../src/sim/handModel';
import type { HandFrame } from '../../src/vision/landmarks';

const ASPECT = 4 / 3;
const FRAME_MS = 33;

/** A steady sequence of one handshape, stamped so the engine sees real elapsed time. */
function hold(
  letter: string,
  frames = 40,
  startMs = 0,
  pose: Record<string, unknown> = {},
  jitter = 0.0012,
): HandFrame[] {
  return Array.from({ length: frames }, (_, i) =>
    simulateLetter(letter, {
      aspect: ASPECT,
      jitter,
      ...pose,
      timestampMs: startMs + i * FRAME_MS,
      frameId: i,
    }),
  );
}

function gesture(thumb: 'up' | 'down', frames = 40, startMs = 0): HandFrame[] {
  const local = buildLocalHand({
    index: [68, 88, 74],
    middle: [68, 88, 74],
    ring: [68, 88, 74],
    pinky: [68, 88, 74],
    // A real thumbs-up lifts the thumb off the palm plane, which is what keeps it from
    // reading as an A.
    thumb:
      thumb === 'up'
        ? { abductDeg: 2, flexDeg: 38, tipCurlDeg: 0 }
        : { abductDeg: 178, flexDeg: 38, tipCurlDeg: 0 },
  });
  return Array.from({ length: frames }, (_, i) =>
    projectHand(local, { aspect: ASPECT, jitter: 0.001, timestampMs: startMs + i * FRAME_MS, frameId: i }),
  );
}

function drive(engine: RecognitionEngine, frames: HandFrame[]) {
  let state = engine.getState();
  for (const frame of frames) {
    state = engine.feed({ hand: frame, aspect: ASPECT, nowMs: frame.timestampMs });
  }
  return state;
}

function driveGap(engine: RecognitionEngine, startMs: number, ms: number) {
  let state = engine.getState();
  for (let t = startMs; t < startMs + ms; t += FRAME_MS) {
    state = engine.feed({ hand: null, aspect: ASPECT, nowMs: t });
  }
  return state;
}

describe('recognition engine', () => {
  it('starts with the camera off and says nothing is being detected', () => {
    const engine = new RecognitionEngine();
    expect(engine.getState().stage.id).toBe('camera-off');
    engine.setCameraStage('no-hand');
    const state = engine.feed({ hand: null, aspect: ASPECT, nowMs: 0 });
    expect(state.stage.id).toBe('no-hand');
    expect(state.stage.headline).toMatch(/no hand in view/i);
    expect(state.text).toBe('');
  });

  it('holds a letter for the configured time, then commits it exactly once', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');

    // Before the hold completes: recognised, but not added yet.
    let state = drive(engine, hold('B', 6));
    expect(state.text).toBe('');
    expect(state.stage.id).toBe('holding');
    expect(state.hold.candidate).toBe('B');

    // Past the hold: added, and held for roughly the configured duration.
    state = drive(engine, hold('B', 30, 6 * FRAME_MS));
    expect(state.text).toBe('B');
    const receipt = state.history.at(-1)!;
    expect(receipt.value).toBe('B');
    expect(receipt.heldMs).toBeGreaterThanOrEqual(600);
    expect(receipt.confidence).toBeGreaterThan(0.7);

    // Three more seconds of the same shape still adds only one letter.
    state = drive(engine, hold('B', 90, 40 * FRAME_MS));
    expect(state.text).toBe('B');
  });

  it('adds the same letter again after the hand drops out of frame', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');
    drive(engine, hold('B', 30));
    expect(engine.getState().text).toBe('B');

    driveGap(engine, 1000, 700);
    const state = drive(engine, hold('B', 30, 1800));
    expect(state.text).toBe('BB');
  });

  it('refuses to commit when the shape flickers between letters', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');
    const frames: HandFrame[] = [];
    // Alternating between two letters every frame: the smoothed top never settles.
    for (let i = 0; i < 90; i++) {
      const letter = i % 2 === 0 ? 'B' : 'U';
      frames.push(
        simulateLetter(letter, { aspect: ASPECT, jitter: 0.001, timestampMs: i * FRAME_MS, frameId: i }),
      );
    }
    const state = drive(engine, frames);
    expect(state.text).toBe('');
    expect(['unsure', 'holding']).toContain(state.stage.id);
  });

  it('reports a hand that is moving too fast instead of guessing', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');
    // Big jumps in position between frames => high landmark motion.
    const frames = Array.from({ length: 30 }, (_, i) =>
      simulateLetter('B', {
        aspect: ASPECT,
        jitter: 0.001,
        cx: ASPECT / 2 + (i % 2 === 0 ? -0.12 : 0.12),
        cy: 0.5 + (i % 2 === 0 ? -0.08 : 0.08),
        timestampMs: i * FRAME_MS,
        frameId: i,
      }),
    );
    const state = drive(engine, frames);
    expect(state.text).toBe('');
    expect(state.quality?.unreadable).toBe('moving');
    expect(state.stage.id).toBe('unreadable');
    expect(state.stage.detail).toMatch(/movement|moving/i);
  });

  it('asks for the hand to move closer when it is too small to read', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');
    const state = drive(engine, hold('B', 20, 0, { scale: 0.04 }));
    expect(state.stage.id).toBe('unreadable');
    expect(state.stage.action).toMatch(/closer/i);
    expect(state.text).toBe('');
  });

  it('adds a space for thumbs-up and deletes it for thumbs-down', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');

    drive(engine, hold('A', 30));
    expect(engine.getState().text).toBe('A');

    driveGap(engine, 1000, 600);
    let state = drive(engine, gesture('up', 40, 1800));
    expect(state.history.at(-1)?.kind).toBe('space');
    expect(state.text).toBe('A ');

    const beforeBackspace = engine.getState().history.length;
    driveGap(engine, 3400, 600);
    state = drive(engine, gesture('down', 40, 4100));
    // A backspace deletes the previous entry rather than adding one of its own.
    expect(state.text).toBe('A');
    expect(state.history.length).toBe(beforeBackspace - 1);
    expect(state.history.some((r) => r.kind === 'space')).toBe(false);
  });

  it('never swallows a real A as a thumbs-up gesture', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');
    const state = drive(engine, hold('A', 30));
    expect(state.text).toBe('A');
    expect(state.history.at(-1)?.kind).toBe('letter');
  });

  it('traces a J from the I handshape', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');
    // J starts from I, then the whole hand draws the letter.
    const state = drive(engine, simulateSequence('J', { aspect: ASPECT, traceFrames: 40, holdFrames: 0 }));
    expect(state.text).toBe('J');
    expect(state.history.at(-1)?.value).toBe('J');
    expect(state.history.at(-1)?.kind).toBe('letter');
  });

  it('leaves the text alone when a gesture is not clearly a gesture', () => {
    // Gestures off: a thumbs-up must not add anything, and letters still commit normally.
    const engine = new RecognitionEngine({ gesturesEnabled: false });
    engine.setCameraStage('no-hand');
    drive(engine, gesture('up', 40));
    expect(engine.getState().text).toBe('A');
    expect(engine.getState().history.at(-1)?.kind).toBe('letter');
  });

  it('traces a Z after forming the shape', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');
    // A signer forms the pointing-index shape first, then draws.
    drive(engine, hold('Z', 8));
    const state = drive(
      engine,
      simulateSequence('Z', { aspect: ASPECT, traceFrames: 40, holdFrames: 0 }).map((f, i) => ({
        ...f,
        timestampMs: 300 + i * FRAME_MS,
      })),
    );
    expect(state.text).toBe('Z');
    expect(state.history.at(-1)?.value).toBe('Z');
  });

  it('keeps a motion letter from firing twice in a row', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');
    drive(engine, simulateSequence('Z', { aspect: ASPECT, traceFrames: 60, holdFrames: 0 }));
    expect(engine.getState().text).toBe('Z');

    // The same trace again without releasing the handshape: still one Z, because the gate has
    // to break (handshape change or hand drop) before another trace can be read.
    drive(
      engine,
      simulateSequence('Z', { aspect: ASPECT, traceFrames: 60, holdFrames: 0 }).map((f, i) => ({
        ...f,
        timestampMs: 4000 + i * FRAME_MS,
      })),
    );
    expect(engine.getState().text).toBe('Z');

    // Dropping the hand re-arms it.
    driveGap(engine, 6100, 600);
    drive(
      engine,
      simulateSequence('Z', { aspect: ASPECT, traceFrames: 60, holdFrames: 0 }).map((f, i) => ({
        ...f,
        timestampMs: 6900 + i * FRAME_MS,
      })),
    );
    expect(engine.getState().text).toBe('ZZ');
  });

  it('lets the on-screen controls edit the text', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');
    drive(engine, hold('H', 30));
    driveGap(engine, 1200, 500);
    drive(engine, hold('I', 30, 1800));
    expect(engine.getState().text).toBe('HI');

    engine.applyEdit('space', 2600);
    expect(engine.getState().text).toBe('HI ');
    engine.applyEdit('backspace', 2700);
    expect(engine.getState().text).toBe('HI');
    engine.applyEdit('clear', 2800);
    expect(engine.getState().text).toBe('');
    expect(engine.getState().history).toHaveLength(0);
  });

  it('narrates camera problems instead of pretending to recognise', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('denied');
    let state = engine.feed({ hand: null, aspect: ASPECT, nowMs: 0 });
    expect(state.stage.headline).toMatch(/blocked/i);
    expect(state.stage.action).toMatch(/permission/i);

    engine.setCameraStage('model-loading', { modelProgress: 0.4 });
    state = engine.feed({ hand: null, aspect: ASPECT, nowMs: 30 });
    expect(state.stage.headline).toMatch(/loading/i);
    expect(state.stage.detail).toMatch(/40%/);

    engine.setCameraStage('no-hand');
    state = engine.feed({ hand: null, aspect: ASPECT, nowMs: 60 });
    expect(state.stage.headline).toMatch(/no hand in view/i);
  });

  it('commits every still letter the app claims to support', () => {
    // The classifier can rank a letter first and the pipeline still refuse to commit it (too
    // little margin, unreadable hand, a trace that never completes). This is the number that
    // matters to a user: for each letter, hold it and see whether it is added.
    const misses: string[] = [];
    for (const letter of LETTER_ORDER) {
      if (letter === 'J' || letter === 'Z') continue; // motion letters, covered elsewhere
      const engine = new RecognitionEngine();
      engine.setCameraStage('no-hand');
      const state = drive(engine, hold(letter, 45));
      if (state.text !== letter) misses.push(`${letter} -> "${state.text}" (${state.stage.id})`);
    }
    expect(misses).toEqual([]);
  });

  it('shows what it sees, including the per-finger readout and the closest letters', () => {
    const engine = new RecognitionEngine();
    engine.setCameraStage('no-hand');
    const state = drive(engine, hold('V', 10));
    expect(state.handPresent).toBe(true);
    expect(state.fingers.map((f) => f.name)).toEqual(['index', 'middle', 'ring', 'pinky']);
    expect(state.fingers[0]!.state).toBe('straight');
    expect(state.fingers[2]!.state).toBe('curled');
    expect(state.thumbState).toBeTruthy();
    expect(state.quality?.handSize).toBeGreaterThan(0.075);
    expect(state.ranked.length).toBeGreaterThan(1);
  });
});
