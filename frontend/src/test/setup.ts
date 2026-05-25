import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement scrollIntoView; components that auto-scroll
// (e.g. ChatInterface) would otherwise crash on mount.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// RTL doesn't auto-cleanup with Vitest's globals API. Unmount after each
// test so DOM state and localStorage don't leak across cases.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
