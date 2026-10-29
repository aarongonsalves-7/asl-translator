# ASL alphabet reference and asset audit

Research date: 2026-10-29. These are implementation targets, not linguistic certification. No reference media, dataset, or third-party hand model was imported.

## Sources and review targets

[ASL University / Bill Vicars alphabet chart](https://www.lifeprint.com/asl101/fingerspelling/abc.htm) supplies the complete photographic reference. Compact inspection checklist derived from that chart:

| Letter | Distinguishing feature |
| --- | --- |
| A | Fist; thumb alongside index |
| B | Four straight, adjacent fingers; thumb across palm |
| C | Curved fingers and thumb, open gap |
| D | Index up; remaining fingertips meet thumb |
| E | Bent fingers above bent thumb |
| F | Index–thumb circle; three fingers up |
| G | Index and thumb extend horizontally |
| H | Index and middle adjacent, horizontal |
| I | Pinky up, other fingers folded |
| J | I handshape with movement |
| K | Index/middle up; thumb at middle base |
| L | Index and thumb extended |
| M | Thumb beneath three fingers |
| N | Thumb beneath two fingers |
| O | Rounded fingertips meet thumb |
| P | K directed downward |
| Q | G directed downward |
| R | Index and middle cross |
| S | Fist; thumb across fingers |
| T | Thumb between index and middle |
| U | Index and middle up, adjacent |
| V | Index and middle up, separated |
| W | Index/middle/ring up |
| X | Hooked index |
| Y | Thumb and pinky extended |
| Z | Extended index with movement |

[HandSpeak's alphabet lesson](https://www.handspeak.com/topic/408/) independently highlights thumb distinctions in A/S and M/N/T, the upward/downward K/P distinction, and naturally varying G orientation. It labels some views as the signer's perspective: do not interpret every reference image as a front-facing photograph.

[HandSpeak's J entry](https://www.handspeak.com/word/2469/) describes an upright pinky on the dominant right fist, traveling downward and curving left. The coordinate convention matters: its directional wording must not be applied blindly as screen coordinates. [Signing Time's J lesson](https://signingtime.com/blogs/dictionary/j) explicitly reverses the swoop for left-handed production.

[ASL University fingerspelling lesson](https://www.lifeprint.com/asl101/fingerspelling/fingerspelling_lesson_01.htm) specifies the dominant hand and describes forearm rotation for natural J, rather than exaggerated wrist twisting. Its discussion allows comfortable oblique orientations for P/Q rather than demanding extreme downward wrist bending. [Signing Savvy's comparison lesson](https://www.signingsavvy.com/article/449/signs-that-are-close-but-not-the-same-alphabet) distinguishes the moving pinky of J from the index tracing Z, and R crossing from U contact. [ASL University's signing notes](https://www.lifeprint.com/asl101/topics/signingnotes.htm) recommends a closed E with fingertips at the thumb, while documenting contextual variants.

Engineering consequence (inference): author one dominant-hand convention, mirror the entire hand and trajectory together for the other hand, and document audience versus signer view. A camera rotation must not substitute for the actual G/H/P/Q orientation. Test J/Z fingertip trajectories, not merely changing pose values. Bone lengths, joint limits, contact placement and mesh quality are technical checks; whether the resulting sign is accepted and recognizable remains a linguistic review.

## Dataset / asset decision

| Candidate | Verified terms and content | Decision |
| --- | --- | --- |
| [Sign Language MNIST, original data card](https://www.kaggle.com/datamunge/sign-language-mnist/home) | CC0; 28×28 grayscale classification images; excludes J/Z because they move. | No import. No 3D joint rotations, depth, skinning or motion ground truth. |
| [grassknoted ASL Alphabet](https://www.kaggle.com/datasets/grassknoted/asl-alphabet) | Original card was inaccessible to text retrieval. License not independently verified here. | No import; do not rely on secondary catalog license claims or use image labels as 3D poses. |
| [FreiHAND, dataset owner](https://lmb.informatik.uni-freiburg.de/resources/datasets/FreihandDataset.en.html) | 21 3D keypoints, camera intrinsics and shape annotations; research only; commercial use prohibited. | No import. Generic hand poses, not certified ASL alphabet sequences. Retargeting and coordinate conversion would still be necessary. |
| [MANO, owner license](https://mano.is.tue.mpg.de/license.html) | Noncommercial research/education/artistic use; redistribution restricted; separate commercial licensing. | No import. A hand shape model alone does not supply ASL articulation or motion; incompatible as an unrestricted bundled web asset. |

All references were consulted as references; linking is not a claim that their images or videos carry a redistribution license. A qualified ASL signer should inspect all 26 rendered letters, especially contact-heavy E/M/N/T/O/F/D, crossed R, downward P/Q, and both handed J/Z trajectories, at slow and normal playback speed.

## Implementation audit and review limits

The repository renders 21 landmarks as a canvas skeleton; it has no mesh, skin weights, articulated wrist, or forearm. There is therefore no mesh deformation to repair or validate. Orthographic projection is intentional. The inspection angle is a camera inspection control, not a claim about the sign's preferred palm orientation.

- A: retained side thumb/fist; B: removed unnecessary fan; C: retained open curve; D: solved thumb/middle contact; E: retained folded fingers and low thumb, contact needs signer review; F: increased index curve and solved thumb/index contact.
- G: made thumb approximately parallel; H: tucked thumb across curled fingers; I: retained extended pinky; J: retained I shape and down/hook path, mirrored trajectory and removed reset jump; K: retained spread pair and raised thumb; L: moved thumb closer to perpendicular.
- M/N: retained three/two-finger thumb coverage approximations; O: solved thumb/index contact, adjusted recognizer's O/T distinction; P: retained downward K; Q: parallel thumb as in G; R: normalized crossing direction to preserve lengths and added depth separation.
- S/T: retained distinct thumb locations; U/V: retained adjacent/spread pair; W: solved thumb toward pinky (reach remains approximate); X: retained open MCP and hooked distal joints; Y: retained thumb/pinky; Z: retained three-stroke path, mirrored trajectory and removed reset jump.

Technical regressions check all 26 for finite coordinates and invariant bone lengths; D/F/O contact gaps under 0.06 palm lengths; full J/Z trajectory mirroring and endpoint continuity; static letters never receiving a Z trace; single-frame trajectories avoiding division by zero; inspection override behavior. Existing synthetic classifier and pipeline checks remain in place. These are engineering checks, not an independent linguistic dataset or human evaluation. The current landmark classifier's broad contact tolerance is not evidence of skin contact.

Remaining review: all 26 need fluent signer acceptance. In particular E/M/N/T coverage, W reach, R clearance with actual finger thickness, natural forearm rotation in J, and G/H/K/P/Q palm orientation and obliqueness remain approximations. J/Z currently translate a rigid hand along the required trace; they do not model the forearm. No collision-free skin or natural joint range guarantee can be made from an unskinned skeleton. Do not present this preview as a validated teaching avatar.

Validation run (2026-10-29): 45 unit/integration tests passed; `npm run typecheck` passed with zero diagnostics; `npm run build` passed (includes Astro check); all 12 Playwright checks passed, and the alphabet browser regression passed again after final layout/mirroring changes. Screenshot reviewed at `test-results/alphabet-preview.png` (generated/ignored artifact). jsdom reports its existing canvas getContext limitation; the real browser suite covers rendering. No qualified signer review was performed.

## Follow-up: K/U recognition and navigation (2026-10-29)

The recognizer now measures finger fan directions relative to each finger's MCP, rather than treating wrist-to-tip directions as finger axes. Middle/ring and ring/pinky spread now read their own pairs. Pointing direction follows the actual most-extended finger (including pinky for I/J). Crossed R is not penalized as if crossing were an outward fan. K accepts raised-thumb evidence when the extended pair is foreshortened, and U excludes the opposed raised thumb. This is based on the existing ASL University/HandSpeak references above; thresholds remain engineering heuristics rather than measurements fitted to a linguistic dataset.

The current [MediaPipe Hand Landmarker Tasks documentation](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker) explicitly says handedness labels refer to the subject's hands on raw input; mirrored input reverses them. Removed the adapter's legacy Hands label swap. The application feeds raw video to inference and mirrors video and overlay only with CSS. Unknown labels are rejected rather than invented. Switching signing hands clears unfinished holds/traces and smoothing.

New regressions cover narrow/forward-angled K at multiple yaw angles with noise, both ranking and actual commits, for both hands; commits for all 24 static letters with both hands; J/Z motion commits with both hands; independently varied finger-pair spreads; pinky pointing; switching hands mid-hold; and the tracker adapter preserving both raw subject labels with CSS mirroring. Browser checks cover icon navigation accessible names, active markers, keyboard navigation, and matching video/overlay transforms. No real signer video dataset or human acceptance evaluation has been added, so real-camera lighting, occlusion, depth noise, and signer variation remain unquantified.

Follow-up validation: 54 unit/integration tests passed; Astro check reported zero errors/warnings/hints; production build passed. All 14 browser tests passed; the three alphabet/navigation/mirroring browser checks passed again against the final build. Screenshot inspection confirmed icons and active markers in main and bottom navigation. These checks use synthetic poses and a fake camera device, not human signer acceptance testing.

## Follow-up: webcam confusion reports E/M, M/N/space, T/A, S, I/U latency, X

Root technical correction: canonical palm depth had inverted MediaPipe's near-camera z direction, while the simulator used the same incompatible convention. Corrected canonical depth sign and width-based z scale, and updated synthetic projection to emit negative near-camera z. Existing self-generated pose checks alone could not expose the shared convention error. New independently authored raw-coordinate tests assert exposed-thumb depth for both hands across 1:1, 4:3 and 16:9 aspect ratios. Source: [MediaPipe Web result coordinate documentation](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

Command gesture detection now requires an open thumb IP joint, lateral clearance and fingertip separation; a vertical tucked thumb is insufficient. J/Z tracing must span at least 0.3 palm lengths before it can suppress a static letter hold or display a tracing stage; a few jitter points no longer delay I. X tests an open MCP and a bent PIP or DIP, and an index base more open than the other fingers, instead of incorrectly demanding an open PIP. U/K evidence now includes proximal index/middle direction in 3D: a raised thumb alone cannot turn a parallel pair into K. U also requires a straight pair, preserving the C distinction. Hold duration and the confidence thresholds are unchanged.

[ASL University's handshape discussion](https://www.lifeprint.com/asl101/pages-layout/handshapes.htm) documents variation and relaxed M/N/T articulation; these hand-tuned rules still do not establish accuracy across real signers. The UI provides a local JSON download of the last 60 tracked frames with the intended letter, configuration and observed result (no images, no upload). This allows the actual reported webcam failures to be replayed; no such user sample has been reviewed yet. Interpret these changes as technical fixes with unverified live-camera improvement, not proof that every reported misclassification has been eliminated.

Validation after these corrections: all 60 unit/integration tests and all 14 browser tests passed; production build and Astro check passed with zero errors, warnings or hints. The live local server returned HTTP 200. Webcam tests use a fake camera feed, and the new depth test is an independent coordinate fixture, not a recorded signer. No claim of corrected performance on the user's specific webcam examples is made without retesting or reviewing exported samples.
