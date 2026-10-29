import { describe, expect, it } from 'vitest';
import { buildLocalHand, shapeFor, simulateLetter, simulateSequence } from '../../src/sim/handModel';
import { LETTER_ORDER } from '../../src/classify/letters';
import { HAND_CONNECTIONS } from '../../src/vision/overlay';
const distance = (a: {x:number;y:number;z:number}, b: {x:number;y:number;z:number}) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
describe('hand geometry (technical checks, not signer validation)', () => {
  it('keeps finger and thumb bone lengths constant across all 26 shapes', () => {
    const base = buildLocalHand(shapeFor('A'));
    const bones = HAND_CONNECTIONS.filter(([a,b]) => a > 0 && b === a+1 && ![5,9,13,17].includes(b));
    for (const letter of LETTER_ORDER) {
      const points = buildLocalHand(shapeFor(letter));
      expect(points).toHaveLength(21);
      expect(points.every(p => Object.values(p).every(Number.isFinite))).toBe(true);
      const right = simulateLetter(letter).landmarks;
      const left = simulateLetter(letter, { handedness: 'left' }).landmarks;
      right.forEach((p, i) => {
        expect(p.x + left[i]!.x).toBeCloseTo(1, 8);
        expect(p.y).toBeCloseTo(left[i]!.y, 8);
      });
      for (const [a,b] of bones) expect(distance(points[a]!,points[b]!)).toBeCloseTo(distance(base[a]!,base[b]!),8);
    }
  });
  it('closes the opposed tips for D, F and O without stretching bones', () => {
    for (const [letter, tip] of [['D',12],['F',8],['O',8]] as const) {
      const points = buildLocalHand(shapeFor(letter));
      expect(distance(points[4]!,points[tip]!)).toBeLessThan(0.06);
    }
  });
  it('keeps motion continuous at the hold and mirrors the complete trajectory', () => {
    for (const letter of ['J','Z']) {
      const right = simulateSequence(letter,{traceFrames:40,holdFrames:2});
      const left = simulateSequence(letter,{traceFrames:40,holdFrames:2,handedness:'left'});
      expect(right[40]!.landmarks).toEqual(right[39]!.landmarks);
      for (let i=0;i<right.length;i++) for(let j=0;j<21;j++) {
        expect(left[i]!.landmarks[j]!.x + right[i]!.landmarks[j]!.x).toBeCloseTo(1,8);
        expect(left[i]!.landmarks[j]!.y).toBeCloseTo(right[i]!.landmarks[j]!.y,8);
      }
    }
  });
  it('does not animate static letters or emit NaN for a single motion frame', () => {
    expect(simulateSequence('B',{traceFrames:10,holdFrames:2})).toHaveLength(2);
    expect(simulateSequence('J',{traceFrames:1})[0]!.landmarks.every(p=>Object.values(p).every(Number.isFinite))).toBe(true);
  });
  it('allows inspection rotation overrides',()=> {
    expect(simulateLetter('G',{rollDeg:0}).landmarks).not.toEqual(simulateLetter('G').landmarks);
  });
});
