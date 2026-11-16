/** ESLint rules for the DSH host and browser entry points. */
import js from '@eslint/js';

/** Minimal Node global names, spelled out so this file needs no `globals` package. */
const nodeGlobals = {
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  cancelAnimationFrame: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  global: 'readonly',
  globalThis: 'readonly',
  process: 'readonly',
  queueMicrotask: 'readonly',
  requestAnimationFrame: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly',
};

/** Browser globals used by `client.js`, which never runs in Node. */
const browserGlobals = {
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  cancelAnimationFrame: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  localStorage: 'readonly',
  navigator: 'readonly',
  queueMicrotask: 'readonly',
  requestAnimationFrame: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly',
  TextDecoder: 'readonly',
  TextEncoder: 'readonly',
  window: 'readonly',
};

export default [
  {
    ignores: ['data/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: nodeGlobals,
    },
  },
  {
    // The browser half is a plain script loaded by the Harness web loader.
    files: ['client.js'],
    languageOptions: {
      globals: { ...nodeGlobals, ...browserGlobals },
    },
  },
];
