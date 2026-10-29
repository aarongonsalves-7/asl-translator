import { describe, expect, it } from 'vitest';
import { buildLocalHand, projectHand, shapeFor, simulateLetter, simulateSequence } from '../../src/sim/handModel';
import { canonicalize } from '../../src/vision/landmarks';
import { extractFeatures } from '../../src/classify/features';
import { classify } from '../../src/classify/classifier';
import { RecognitionEngine } from '../../src/pipeline/engine';
import { LETTER_ORDER } from '../../src/classify/letters';

describe('recognition handedness and confusable letters', () => {
  it('recognizes narrow and foreshortened K instead of U or V', () => {
    for (const handedness of ['left','right'] as const) for (const spread of [0,4,10,16]) for (const yawDeg of [-20,0,20]) {
      const shape = { ...shapeFor('K'), spread: {index:spread,middle:-spread}, middle: [30,6,5] as const };
      const frame = projectHand(buildLocalHand(shape),{handedness,yawDeg,jitter:0.001});
      const result = classify(extractFeatures(canonicalize(frame,4/3)));
      expect(result.letter, `${handedness}, spread ${spread}, yaw ${yawDeg}`).toBe('K');
      const engine = new RecognitionEngine(); engine.setCameraStage('no-hand');
      for(let i=0;i<40;i++) engine.feed({hand:{...frame,timestampMs:i*33,frameId:i},aspect:4/3,nowMs:i*33});
      expect(engine.getState().text, `K commit: ${handedness}, spread ${spread}, yaw ${yawDeg}: ${JSON.stringify({stage:engine.getState().stage,ranked:result.ranked.slice(0,3).map(r=>({letter:r.letter,score:r.score,fail:r.failing}))})}`).toBe('K');
    }
  });
  it('commits all 24 static letters with either hand', () => {
    for (const handedness of ['left','right'] as const) for (const letter of LETTER_ORDER.filter(l=>!['J','Z'].includes(l))) {
      const engine = new RecognitionEngine();
      engine.setCameraStage('no-hand');
      for(let i=0;i<45;i++) engine.feed({hand:simulateLetter(letter,{handedness,jitter:0.001,timestampMs:i*33}),aspect:4/3,nowMs:i*33});
      expect(engine.getState().text, `${handedness} ${letter}`).toBe(letter);
    }
  });
  it('commits both movement letters with either hand',()=> {
    for (const handedness of ['left','right'] as const) for (const letter of ['J','Z']) {
      const engine = new RecognitionEngine(); engine.setCameraStage('no-hand');
      for(const hand of simulateSequence(letter,{handedness,traceFrames:40,holdFrames:0})) engine.feed({hand,aspect:4/3,nowMs:hand.timestampMs});
      expect(engine.getState().text, `${handedness} ${letter}`).toBe(letter);
    }
  });
  it('reports direction from the extended pinky rather than the curled index',()=> {
    const hand = canonicalize(simulateLetter('I'),4/3);
    expect(Math.abs(extractFeatures(hand).pointDirDeg)).toBeLessThan(10);
  });
  it('measures middle-ring spread independently of index-middle spread',()=> {
    const shape = {...shapeFor('B'),spread:{index:0,middle:0,ring:-30,pinky:-30}};
    const f = extractFeatures(canonicalize(projectHand(buildLocalHand(shape)),4/3));
    expect(f.spread.im).toBeLessThan(0.1);
    expect(f.spread.mr).toBeGreaterThan(0.9);
    const pinkyOnly = {...shapeFor('B'), spread:{index:0,middle:0,ring:0,pinky:-30}};
    const g = extractFeatures(canonicalize(projectHand(buildLocalHand(pinkyOnly)),4/3));
    expect(g.spread.mr).toBeLessThan(0.1);
    expect(g.spread.rp).toBeGreaterThan(0.9);
  });
  it('starts a fresh hold when switching signing hands',()=> {
    const engine = new RecognitionEngine(); engine.setCameraStage('no-hand');
    for(let i=0;i<24;i++) engine.feed({hand:simulateLetter('K',{handedness:i<12?'right':'left',timestampMs:i*33}),aspect:4/3,nowMs:i*33});
    expect(engine.getState().text).toBe('');
  });
});
