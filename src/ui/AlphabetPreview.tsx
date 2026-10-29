import { useEffect, useMemo, useState } from 'react';
import { LETTER_LIST } from '../classify/letters';
import { simulateLetter, simulateSequence } from '../sim/handModel';
import { HAND_CONNECTIONS } from '../vision/overlay';

export default function AlphabetPreview() {
  const [hand, setHand] = useState<'right' | 'left'>('right');
  const [yaw, setYaw] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState(0);
  const previews = useMemo(() => LETTER_LIST.map(rule => {
    const options = { handedness: hand, yawDeg: yaw, scale: 0.29, cy: 0.64, aspect: 1, cx: 0.5 };
    return rule.motion ? simulateSequence(rule.letter, { ...options, scale: 0.22, cy: 0.48, traceFrames: 45, holdFrames: 20 }) : [simulateLetter(rule.letter, options)];
  }), [hand, yaw]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setPhase(p => (p + 1) % 65), 40);
    return () => window.clearInterval(timer);
  }, [playing]);
  return <div>
    <p>Procedural landmark preview, viewed face-to-face (not a mirror). Blue points mark fingertips. Rotate to inspect depth; these are approximate poses awaiting signer review.</p>
    <div className="alphabet-controls">
      <label>Signing hand <select value={hand} onChange={e => setHand(e.target.value as 'left' | 'right')}><option value="right">Right</option><option value="left">Left</option></select></label>
      <label>Inspection angle <input type="range" min="-80" max="80" value={yaw} onChange={e => setYaw(Number(e.target.value))} /> {yaw}°</label>
      <button type="button" onClick={() => setPlaying(p => !p)}>{playing ? 'Pause movement' : 'Play J and Z'}</button>
      <label>Motion frame <input type="range" min="0" max="64" value={phase} onChange={e => { setPlaying(false); setPhase(Number(e.target.value)); }} /></label>
    </div>
    <div className="alphabet-grid">{LETTER_LIST.map((rule, index) => {
      const motion = rule.motion;
      const frame = previews[index]![motion ? phase : 0]!;
      const points = frame.landmarks;
      const edges = [...HAND_CONNECTIONS].sort(([a,b],[c,d]) => (points[a]!.z + points[b]!.z) - (points[c]!.z + points[d]!.z));
      return <article className="letter-card" key={rule.letter} id={`letter-${rule.letter}`}>
        <h3>{rule.letter}{motion ? ' · motion' : ''}</h3>
        <svg viewBox="0 0 240 240" role="img" aria-label={`${rule.letter}, ${hand} hand landmark preview`} style={{ width: '100%', maxHeight: 260 }}>
          {edges.map(([a,b]) => <line key={`${a}-${b}`} x1={points[a]!.x*240} y1={points[a]!.y*240} x2={points[b]!.x*240} y2={points[b]!.y*240} stroke="currentColor" strokeWidth="4" strokeLinecap="round" />)}
          {points.map((p,i) => <circle key={i} cx={p.x*240} cy={p.y*240} r={i > 0 && i % 4 === 0 ? 4 : 2.5} fill={i > 0 && i % 4 === 0 ? '#1670c5' : 'currentColor'} />)}
        </svg>
        <p>{rule.tip}</p>
      </article>;
    })}</div>
  </div>;
}
