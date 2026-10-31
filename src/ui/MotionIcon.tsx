import type { CSSProperties } from 'react';

export type IconName = 'hand' | 'scan' | 'text' | 'camera' | 'play' | 'stop' | 'copy' | 'check' | 'space' | 'backspace' | 'undo' | 'clear' | 'arrow';

/** Shared outline language; labels stay on the surrounding control. */
export function MotionIcon({ name, className = '', style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return <svg className={`motion-icon icon-${name} ${className}`} style={style} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'hand' && <><path d="M10 17V8a2 2 0 0 1 4 0v7-10a2 2 0 0 1 4 0v10-8a2 2 0 0 1 4 0v10-6a2 2 0 0 1 4 0v10c0 6-3.5 9-9 9-4 0-6-2-8-5l-5-7a2 2 0 0 1 3-2l5 5"/><path className="gesture-echo" d="M3 9a10 10 0 0 1 3-5M28 3a12 12 0 0 1 2 5"/></>}
    {name === 'scan' && <><path d="M4 11V6a2 2 0 0 1 2-2h5m10 0h5a2 2 0 0 1 2 2v5m0 10v5a2 2 0 0 1-2 2h-5m-10 0H6a2 2 0 0 1-2-2v-5"/><path opacity=".45" d="m10 20 6-10 6 10H10l6 4 6-4"/><g className="tracking-points" fill="currentColor" stroke="none"><circle cx="16" cy="10" r="2"/><circle cx="10" cy="20" r="2"/><circle cx="22" cy="20" r="2"/><circle cx="16" cy="24" r="2"/></g></>}
    {name === 'text' && <><path d="M5 7h22M16 7v19m-5 0h10"/><path className="text-spark" d="M25 18v8m-4-4h8"/></>}
    {name === 'camera' && <><path d="m10 8 2-3h8l2 3h5a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z"/><circle cx="16" cy="17" r="6"/></>}
    {name === 'play' && <path d="m11 6 15 10-15 10Z"/>}
    {name === 'stop' && <rect x="7" y="7" width="18" height="18" rx="3"/>}
    {name === 'copy' && <><rect x="11" y="11" width="16" height="18" rx="3"/><path d="M21 7V5a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v14a2 2 0 0 0 2 2h2"/></>}
    {name === 'check' && <path d="m7 16 6 6L26 9"/>}
    {name === 'space' && <path d="M5 13v8h22v-8M16 5v11m-4-4 4 4 4-4"/>}
    {name === 'backspace' && <><path d="m12 7-9 9 9 9h16V7Z"/><path d="m16 12 8 8m0-8-8 8"/></>}
    {name === 'undo' && <><path d="M9 9h11a9 9 0 0 1 0 18h-6"/><path d="m12 3-6 6 6 6"/></>}
    {name === 'clear' && <><path d="M5 8h22M12 8V4h8v4M8 8l2 20h12l2-20M14 13v10m4-10v10"/></>}
    {name === 'arrow' && <path d="M5 16h22m-8-8 8 8-8 8"/>}
  </svg>;
}
