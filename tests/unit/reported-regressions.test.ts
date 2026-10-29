import { describe, expect, it } from 'vitest';
import { canonicalize, type HandFrame } from '../../src/vision/landmarks';
import { extractFeatures } from '../../src/classify/features';
import { RecognitionEngine } from '../../src/pipeline/engine';
import { buildLocalHand, projectHand, shapeFor, simulateLetter } from '../../src/sim/handModel';

// Written directly in MediaPipe image coordinates, independently of the simulator:
// wrist depth=0, negative z nearer camera, and x/z normalized by image width.
function frontalPalm(handedness:'left'|'right', aspect:number):HandFrame {
  const points = Array.from({length:21},()=>({x:0.5,y:0.5,z:0}));
  points[0]={x:0.5,y:0.8,z:0};points[5]={x:0.4,y:0.5,z:0};
  points[9]={x:0.5,y:0.48,z:0};points[17]={x:0.65,y:0.55,z:0};
  points[4]={x:0.45,y:0.6,z:-0.1/aspect};
  if(handedness==='left') points.forEach(p=>{p.x=1-p.x;});
  return {landmarks:points,handedness,handednessScore:1,timestampMs:0,frameId:0};
}
describe('reported recognition regressions',()=> {
  it('preserves near-camera thumb depth for both hands and wide webcam aspect ratios',()=> {
    for(const handedness of ['left','right'] as const) for(const aspect of [1,4/3,16/9]) {
      const f=extractFeatures(canonicalize(frontalPalm(handedness,aspect),aspect));
      expect(f.thumb.lift).toBeGreaterThan(0.5);
      expect(f.hand.pts[4]!.z).toBeLessThan(0);
    }
  });
  it('commits I on time despite small fingertip jitter rather than waiting for a J trace',()=> {
    for(const handedness of ['left','right'] as const) {
      const e=new RecognitionEngine();e.setCameraStage('no-hand');
      for(let i=0;i<24;i++) {
        const frame=simulateLetter('I',{handedness,timestampMs:i*33});
        // 0.08 palm lengths of excursion creates many distinct points, but no J.
        frame.landmarks[20]!.x+=(i%2===0?-1:1)*0.008;
        e.feed({hand:frame,aspect:4/3,nowMs:i*33});
      }
      expect(e.getState().text).toBe('I');
    }
  });
  it('recognizes a PIP-hooked X even when the DIP is nearly straight',()=> {
    for(const handedness of ['left','right'] as const) {
      const shape={...shapeFor('X'),index:[12,75,12] as const};
      const e=new RecognitionEngine();e.setCameraStage('no-hand');
      for(let i=0;i<35;i++)e.feed({hand:projectHand(buildLocalHand(shape),{handedness,timestampMs:i*33}),aspect:4/3,nowMs:i*33});
      expect(e.getState().text).toBe('X');
    }
  });
  it('commits a steady U within one second with small tracking noise',()=> {
    for(const handedness of ['left','right'] as const) {
      const e=new RecognitionEngine();e.setCameraStage('no-hand');
      for(let i=0;i<30;i++)e.feed({hand:simulateLetter('U',{handedness,jitter:0.002,seed:i+17,timestampMs:i*33}),aspect:4/3,nowMs:i*33});
      expect(e.getState().text).toBe('U');
    }
  });
  it('does not turn a parallel U pair into K solely because the thumb appears high',()=> {
    for(const handedness of ['left','right'] as const) {
      const shape={...shapeFor('U'),thumb:shapeFor('K').thumb};
      const e=new RecognitionEngine();e.setCameraStage('no-hand');
      for(let i=0;i<35;i++)e.feed({hand:projectHand(buildLocalHand(shape),{handedness,timestampMs:i*33}),aspect:4/3,nowMs:i*33});
      expect(e.getState().text).toBe('U');
    }
  });
  it('does not call tucked M/N thumbs command gestures at different orientations',()=> {
    for(const letter of ['M','N','E','T','S'])for(const handedness of ['left','right'] as const)for(const yawDeg of [-15,0,15]) {
      const e=new RecognitionEngine();e.setCameraStage('no-hand');
      for(let i=0;i<35;i++)e.feed({hand:simulateLetter(letter,{handedness,yawDeg,timestampMs:i*33}),aspect:4/3,nowMs:i*33});
      expect(e.getState().history.some(r=>r.kind==='space'),`${letter} ${handedness} ${yawDeg}`).toBe(false);
    }
  });
});
