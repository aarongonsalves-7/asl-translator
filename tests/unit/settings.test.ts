import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, CONFIG_LIMITS } from '../../src/pipeline/config';
import { clearConfig, loadConfig, sanitizeConfig, saveConfig, SETTINGS_KEY } from '../../src/ui/settings';

/** Minimal in-memory Storage, so the tests describe the contract rather than a jsdom quirk. */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => data.delete(key),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  } as Storage;
}

describe('sanitizeConfig', () => {
  it('keeps known keys and drops everything else', () => {
    const result = sanitizeConfig({ holdMs: 800, somethingElse: 1, __proto__: { polluted: true } });
    expect(result.holdMs).toBe(800);
    expect('somethingElse' in result).toBe(false);
  });

  it('clamps values into the documented range instead of trusting storage', () => {
    const result = sanitizeConfig({ holdMs: 99_999, minConfidence: -3, minMargin: 0 });
    expect(result.holdMs).toBe(CONFIG_LIMITS.holdMs.max);
    expect(result.minConfidence).toBe(CONFIG_LIMITS.minConfidence.min);
    expect(result.minMargin).toBe(CONFIG_LIMITS.minMargin.min);
  });

  it('ignores the wrong types and non-finite numbers', () => {
    const result = sanitizeConfig({ holdMs: '700', minConfidence: Number.NaN, gesturesEnabled: 'yes' });
    expect(result.holdMs).toBeUndefined();
    expect(result.minConfidence).toBeUndefined();
    expect(result.gesturesEnabled).toBeUndefined();
  });
});

describe('loadConfig / saveConfig', () => {
  it('returns the shipped defaults when nothing is stored', () => {
    expect(loadConfig(memoryStorage())).toEqual(DEFAULT_CONFIG);
  });

  it('falls back to defaults when the stored value is corrupt', () => {
    expect(loadConfig(memoryStorage({ [SETTINGS_KEY]: '{not json' }))).toEqual(DEFAULT_CONFIG);
  });

  it('round-trips a saved config and fills in keys that were never stored', () => {
    const storage = memoryStorage();
    saveConfig({ ...DEFAULT_CONFIG, holdMs: 900 }, storage);

    const loaded = loadConfig(storage);
    expect(loaded.holdMs).toBe(900);
    expect(loaded.minConfidence).toBe(DEFAULT_CONFIG.minConfidence);
  });

  it('clears back to defaults', () => {
    const storage = memoryStorage();
    saveConfig({ ...DEFAULT_CONFIG, holdMs: 900 }, storage);
    clearConfig(storage);
    expect(loadConfig(storage)).toEqual(DEFAULT_CONFIG);
  });

  it('survives storage that throws (private mode)', () => {
    const hostile = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    expect(loadConfig(hostile)).toEqual(DEFAULT_CONFIG);
    expect(() => saveConfig(DEFAULT_CONFIG, hostile)).not.toThrow();
  });
});
