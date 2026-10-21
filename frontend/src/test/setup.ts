import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';

// #105 React reports broken hook rules only as a console error; make them fail the test.
const HOOK_ERRORS = /change in the order of Hooks|Rendered (more|fewer) hooks|Invalid hook call/;
let hookErrors: string[] = [];
beforeEach(() => {
  hookErrors = [];
  const original = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(' ');
    if (HOOK_ERRORS.test(text)) hookErrors.push(text.slice(0, 200));
    original(...args);
  });
});

afterEach(() => {
  cleanup();
  vi.mocked(console.error).mockRestore?.();
  expect(hookErrors, 'React hook-rule violations').toEqual([]);
});
