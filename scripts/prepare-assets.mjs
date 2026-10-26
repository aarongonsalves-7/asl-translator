/**
 * Vendors the MediaPipe runtime and model into public/ so the app runs fully offline
 * with no third-party CDN at runtime.
 *
 *   - public/wasm/*                    copied from @mediapipe/tasks-vision/wasm
 *   - public/models/hand_landmarker.task   downloaded once (only if missing)
 *
 * Re-run with: npm run assets
 */
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WASM_SRC = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const WASM_DEST = join(root, 'public', 'wasm');
const MODEL_DEST = join(root, 'public', 'models', 'hand_landmarker.task');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyWasm() {
  if (!(await exists(WASM_SRC))) {
    throw new Error(
      `MediaPipe wasm folder not found at ${WASM_SRC}. Run "npm install" first.`,
    );
  }
  await mkdir(WASM_DEST, { recursive: true });
  await cp(WASM_SRC, WASM_DEST, { recursive: true });
  console.log(`copied wasm runtime -> public/wasm`);
}

async function downloadModel() {
  if (await exists(MODEL_DEST)) {
    console.log('hand_landmarker.task already vendored, skipping download');
    return;
  }
  await mkdir(dirname(MODEL_DEST), { recursive: true });
  console.log(`downloading ${MODEL_URL}`);
  const res = await fetch(MODEL_URL);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download model: HTTP ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(MODEL_DEST));
  const { size } = await stat(MODEL_DEST);
  console.log(`vendored model -> public/models/hand_landmarker.task (${(size / 1e6).toFixed(1)} MB)`);
}

writeFile; // keep the unused import warning-free intent explicit
await copyWasm();
await downloadModel();
