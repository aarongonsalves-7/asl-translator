/**
 * Draws the tracked hand over the video.
 *
 * Deliberately imperative and outside React: this runs once per camera frame, and routing 21
 * points through a re-render 30 times a second would cost more than the recognition itself.
 * The canvas lives inside the mirrored container, so the same CSS flip that makes the preview
 * feel like a mirror also flips the skeleton onto the hand you see.
 */
import type { HandFrame } from './landmarks';
import { LM } from './landmarks';

/** MediaPipe's hand topology, as index pairs. */
export const HAND_CONNECTIONS: Array<[number, number]> = [
  // palm
  [LM.WRIST, LM.THUMB_CMC],
  [LM.THUMB_CMC, LM.INDEX_MCP],
  [LM.INDEX_MCP, LM.MIDDLE_MCP],
  [LM.MIDDLE_MCP, LM.RING_MCP],
  [LM.RING_MCP, LM.PINKY_MCP],
  [LM.PINKY_MCP, LM.WRIST],
  // thumb
  [LM.THUMB_CMC, LM.THUMB_MCP],
  [LM.THUMB_MCP, LM.THUMB_IP],
  [LM.THUMB_IP, LM.THUMB_TIP],
  // fingers
  [LM.INDEX_MCP, LM.INDEX_PIP],
  [LM.INDEX_PIP, LM.INDEX_DIP],
  [LM.INDEX_DIP, LM.INDEX_TIP],
  [LM.MIDDLE_MCP, LM.MIDDLE_PIP],
  [LM.MIDDLE_PIP, LM.MIDDLE_DIP],
  [LM.MIDDLE_DIP, LM.MIDDLE_TIP],
  [LM.RING_MCP, LM.RING_PIP],
  [LM.RING_PIP, LM.RING_DIP],
  [LM.RING_DIP, LM.RING_TIP],
  [LM.PINKY_MCP, LM.PINKY_PIP],
  [LM.PINKY_PIP, LM.PINKY_DIP],
  [LM.PINKY_DIP, LM.PINKY_TIP],
];

export interface OverlayPalette {
  line: string;
  joint: string;
  tip: string;
}

export function clearOverlay(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * @param frame  landmarks in normalised image space (x, y in 0..1)
 * @param canvas already sized to its CSS box in device pixels
 */
export function drawHand(
  canvas: HTMLCanvasElement | null,
  frame: HandFrame | null,
  palette: OverlayPalette = { line: 'rgba(41, 151, 255, 0.85)', joint: '#ffffff', tip: '#2997ff' },
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frame) return;

  const scale = Math.min(canvas.width, canvas.height) * 0.0016 + 1.6;
  const px = (index: number) => {
    const point = frame.landmarks[index];
    return point ? { x: point.x * canvas.width, y: point.y * canvas.height } : null;
  };

  ctx.lineWidth = Math.max(2, scale);
  ctx.strokeStyle = palette.line;
  ctx.lineCap = 'round';
  for (const [a, b] of HAND_CONNECTIONS) {
    const from = px(a);
    const to = px(b);
    if (!from || !to) continue;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  const tips = new Set<number>([
    LM.THUMB_TIP,
    LM.INDEX_TIP,
    LM.MIDDLE_TIP,
    LM.RING_TIP,
    LM.PINKY_TIP,
  ]);
  for (let i = 0; i < frame.landmarks.length; i++) {
    const point = px(i);
    if (!point) continue;
    const isTip = tips.has(i);
    ctx.beginPath();
    ctx.arc(point.x, point.y, isTip ? scale * 2.2 : scale * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = isTip ? palette.tip : palette.joint;
    ctx.fill();
  }
}
