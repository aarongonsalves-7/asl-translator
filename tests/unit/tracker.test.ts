import { beforeEach, describe, expect, it, vi } from 'vitest';
import { simulateLetter } from '../../src/sim/handModel';
import { canonicalize } from '../../src/vision/landmarks';
import { extractFeatures } from '../../src/classify/features';
import { classify } from '../../src/classify/classifier';
const mock = vi.hoisted(()=>({detect:vi.fn(),close:vi.fn()}));
vi.mock('@mediapipe/tasks-vision',()=>({FilesetResolver:{forVisionTasks:vi.fn().mockResolvedValue({})},HandLandmarker:{createFromOptions:vi.fn().mockResolvedValue({detectForVideo:mock.detect,close:mock.close})}}));
import { HandTracker } from '../../src/vision/tracker';
describe('raw webcam Tasks adapter',()=> {
  beforeEach(()=>mock.detect.mockReset());
  it.each(['left','right'] as const)('preserves %s subject handedness and raw coordinates',async handedness=> {
    const fixture=simulateLetter('K',{handedness});
    mock.detect.mockReturnValue({landmarks:[fixture.landmarks],handedness:[[{categoryName:handedness==='left'?'Left':'Right',score:0.98}]]});
    const tracker=await HandTracker.create();
    const video=document.createElement('video');
    Object.defineProperties(video,{readyState:{value:2},videoWidth:{value:640}});
    video.style.transform='scaleX(-1)'; // Display styling must never alter inference.
    const frame=tracker.detect(video,123)!;
    expect(frame.handedness).toBe(handedness);
    expect(frame.landmarks).toEqual(fixture.landmarks);
    expect(canonicalize(frame,4/3).facing).toBe('toward-camera');
    expect(classify(extractFeatures(canonicalize(frame,4/3))).letter).toBe('K');
    tracker.close();
  });
  it('does not invent a hand label when the tracker supplies none',async()=> {
    mock.detect.mockReturnValue({landmarks:[simulateLetter('K').landmarks],handedness:[]});
    const tracker=await HandTracker.create();const video=document.createElement('video');
    Object.defineProperties(video,{readyState:{value:2},videoWidth:{value:640}});
    expect(tracker.detect(video,123)).toBeNull();tracker.close();
  });
});
