/**
 * Settings persistence.
 *
 * Calibration is per-person and per-desk, so it has to survive a reload — but it is also
 * device-local by design: nothing about how you sign is sent anywhere, so there is no server
 * to sync it to. The stored object is validated on read, because a hand-edited or stale entry
 * must never silently push a nonsense threshold into the recogniser.
 */
import { CONFIG_LIMITS, DEFAULT_CONFIG, type PipelineConfig } from '../pipeline/config';

export const SETTINGS_KEY = 'asl-translator.settings.v1';

type Limits = typeof CONFIG_LIMITS;
type LimitedKey = keyof Limits;

const NUMERIC_KEYS: Array<keyof PipelineConfig> = [
  'smoothingAlpha',
  'holdMs',
  'minAgreeFrames',
  'minConfidence',
  'minMargin',
  'cooldownMs',
  'absentResetMs',
  'maxMotion',
  'receiptMs',
  'gestureThreshold',
  'gestureMinMargin',
  'minHandSize',
  'maxHandSize',
];

const BOOLEAN_KEYS: Array<keyof PipelineConfig> = ['gesturesEnabled'];

function clampToLimit(key: LimitedKey, value: number): number {
  const limit = CONFIG_LIMITS[key];
  return Math.min(limit.max, Math.max(limit.min, value));
}

/** Copy only known keys, of the right type, inside the documented range. */
export function sanitizeConfig(input: unknown): Partial<PipelineConfig> {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  // A plain record first: indexing a Partial<PipelineConfig> by a union key widens every
  // assignment to `never`, so the typed shape is only applied on the way out.
  const out: Record<string, number | boolean> = {};

  for (const key of NUMERIC_KEYS) {
    const value = raw[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[key] = key in CONFIG_LIMITS ? clampToLimit(key as LimitedKey, value) : value;
  }
  for (const key of BOOLEAN_KEYS) {
    const value = raw[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  return out as Partial<PipelineConfig>;
}

export function loadConfig(storage: Storage | undefined = safeStorage()): PipelineConfig {
  if (!storage) return { ...DEFAULT_CONFIG };
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...sanitizeConfig(JSON.parse(raw)) };
  } catch {
    // Corrupt JSON, or storage disabled in private mode: defaults are always usable.
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: PipelineConfig, storage: Storage | undefined = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(config));
  } catch {
    // Quota or privacy mode; the app keeps working with the in-memory config.
  }
}

export function clearConfig(storage: Storage | undefined = safeStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(SETTINGS_KEY);
  } catch {
    // ignore
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
