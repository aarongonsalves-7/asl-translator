/**
 * End-to-end-ish tests for the Translate page, in jsdom.
 *
 * The clock is driven by hand: requestAnimationFrame and the wall clock are replaced so the
 * demo replays in a few milliseconds of test time while the pipeline sees a realistic 30 fps
 * timeline. That is the same path a real signer takes — frame source → engine → stage → DOM —
 * only the frames are synthetic.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslateApp } from '../../src/ui/TranslateApp';

let clock = 0;
let frames: FrameRequestCallback[] = [];

function pump(totalMs: number, onStep?: (ms: number) => void, step = 33): void {
  act(() => {
    for (let elapsed = 0; elapsed < totalMs; elapsed += step) {
      clock += step;
      const queued = frames.splice(0, frames.length);
      for (const callback of queued) callback(clock);
      onStep?.(clock);
    }
  });
}

function stubCamera(getUserMedia: (() => Promise<MediaStream>) | null): void {
  if (!getUserMedia) {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    return;
  }
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
}

beforeEach(() => {
  clock = 0;
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Translate page', () => {
  it('says the camera is off before anything is started', () => {
    render(<TranslateApp />);

    expect(screen.getByTestId('stage-headline')).toHaveTextContent('Camera off');
    expect(screen.getByTestId('output-text')).toHaveTextContent('Your first letter starts here.');
    expect(screen.getByRole('button', { name: 'Turn on camera' })).toBeEnabled();
  });

  it('replays the demo through the real pipeline and adds the spelled letters', async () => {
    render(<TranslateApp />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try the demo' }));
    });

    // The demo starts with the hand out of frame, before the first letter arrives.
    expect(screen.getByTestId('stage-headline')).toHaveTextContent('no hand in view');

    // Each letter is held ~1.15 s with a ~0.4 s gap, and commits ~0.66 s in.
    pump(800);
    expect(screen.getByTestId('output-text').textContent).toContain('H');

    pump(1600);
    expect(screen.getByTestId('output-text').textContent).toContain('HE');

    pump(5000);
    expect(screen.getByTestId('output-text').textContent).toContain('HELLO');
  });

  it('narrates the stages the user actually passes through', async () => {
    render(<TranslateApp />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try the demo' }));
    });

    // Query between chunks, not inside act(): React commits state when act() exits, so
    // reading the DOM mid-pump would only ever see the previous frame.
    const headlines = new Set<string>();
    for (let step = 0; step < 20; step++) {
      pump(300);
      headlines.add(screen.getByTestId('stage-headline').textContent ?? '');
    }

    // The three states that matter: no hand, a letter forming, and a letter added.
    expect([...headlines].some((text) => text.includes('no hand in view'))).toBe(true);
    expect([...headlines].some((text) => text.startsWith('Hold steady'))).toBe(true);
    expect([...headlines].some((text) => text.startsWith('Added'))).toBe(true);
  });

  it('backspace removes the last committed letter', async () => {
    render(<TranslateApp />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try the demo' }));
    });

    pump(3400);
    const withTwo = screen.getByTestId('output-text').textContent ?? '';
    expect(withTwo).toContain('HE');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    });
    expect(screen.getByTestId('output-text').textContent).toContain('H');
    expect(screen.getByTestId('output-text').textContent).not.toContain('HE');
  });

  it('explains a denied camera instead of showing a generic failure', async () => {
    stubCamera(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    render(<TranslateApp />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Turn on camera' }));
    });

    expect(screen.getByTestId('stage-headline')).toHaveTextContent('Camera blocked');
    expect(screen.getByTestId('stage-action')).toHaveTextContent('permissions');
    expect(screen.getByRole('button', { name: 'Try camera again' })).toBeEnabled();
  });

  it('explains a missing camera device', async () => {
    stubCamera(() => Promise.reject(new DOMException('no camera', 'NotFoundError')));
    render(<TranslateApp />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Turn on camera' }));
    });

    expect(screen.getByTestId('stage-headline')).toHaveTextContent('No camera found');
    expect(screen.getByTestId('stage-action')).toHaveTextContent('demo');
  });

  it('explains a page that has no camera API at all', async () => {
    stubCamera(null);
    render(<TranslateApp />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Turn on camera' }));
    });

    expect(screen.getByTestId('stage-headline')).toHaveTextContent('secure connection');
  });

  it('shows what it sees for the held hand', async () => {
    render(<TranslateApp />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try the demo' }));
    });

    // Mid-hold, before the commit: H is index + middle straight, ring and pinky curled.
    pump(400);
    expect(screen.getByTestId('finger-index')).toHaveTextContent('straight');
    expect(screen.getByTestId('finger-middle')).toHaveTextContent('straight');
    expect(screen.getByTestId('finger-pinky')).toHaveTextContent('curled');
    expect(screen.getAllByTestId('candidate')).toHaveLength(3);
  });
});
