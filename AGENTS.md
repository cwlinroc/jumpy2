# AGENTS.md

## Repo Shape
- Single-package VS Code extension. Runtime entrypoint is `src/extension.ts`; the extension manifest loads `out/extension.js` via `package.json.main`.
- Keep jump-mode state in `src/state-machine.ts`. `src/extension.ts` is the wiring layer for commands, VS Code events, decorations, and the state machine.
- Label generation is centered in `src/labelers/words.ts`. It mutates the shared `env.keys` array across all visible editors so labels stay globally unique, and it skips `webview` / `vscode-*` editors on purpose.
- Dynamic letter commands come from `getAllKeys()` / `getKeySet()` in `src/keys.ts`; digit commands `0-9` are registered separately in `activate()` for line-number jumps.

## Verified Commands
- `pnpm run compile` is the canonical full build: `tsc --noEmit` + `eslint` + `node esbuild.js`, and it writes the real runtime bundle to `out/extension.js`.
- `pnpm run watch` is the real dev watch flow. It runs `watch:tsc` plus `watch:esbuild`, and `watch:esbuild` also goes through `node esbuild.js --watch`.
- `pnpm run vscode:prepublish` now goes through `node esbuild.js --production`, so the package step emits the same `out/extension.js` bundle that the manifest loads.
- `pnpm run compile-tests` writes compiled tests to `out/test/**`.
- `.vscode-test.mjs` points the test runner at `out/test/**/*.test.js`.
- `pnpm run test` is the safe end-to-end test command because `pretest` already runs `compile-tests`, `compile`, and `lint` first.
- `pnpm run test-no-compile` still launches `vscode-test`; use it only after the compiled outputs in `out/` and `out/test/` already exist.

## Gotchas
- `pnpm run esbuild`, `pnpm run esbuild-watch`, and `pnpm run vscode:prepublish` are all thin wrappers around `node esbuild.js`, so `out/extension.js` is the only runtime bundle path that should matter.
- `pnpm run deploy` is intentionally disabled.
- `.vscodeignore` excludes `src/**` and `out/test/**`, so packaged VSIX contents must already be in runtime-ready files under `out/`.
- There are no checked-in CI workflows under `.github/workflows`; local pnpm scripts are the source of truth.

## Design Decisions
- `StateModel.status` (in `src/state-machine.ts`) is intentionally kept even though the status bar was removed. Removing it would cascade into refactoring the state machine and all its tests for no functional gain. The field still drives `'Jump Mode!'` / `'No Match!'` / key-entered state tracking internally, and tests assert on it.
- `lodash.debounce`, `lodash.range`, and `moize` have been removed (stale/deprecated). Replacements are all native JS:
  - `lodash.range` → `Array.from({length: N}, ...)` in `src/keys.ts`
  - `moize` → plain `Map` cache with `JSON.stringify` key in `src/keys.ts`
  - `lodash.debounce` (leading-only, no trailing) → inline IIFE throttle in `src/extension.ts`
- `moize` must **not** be re-added as a dependency — it is deprecated upstream in favor of `micro-memoize`, and the memoization need is trivially served by a `Map`.

## Dependency Notes
- pnpm uses a strict (non-hoisted) `node_modules` layout. Any package imported directly in source (including test files) must be declared as a direct dependency in `package.json` — transitive packages are not importable. This is why `mocha` must appear in `devDependencies` even though `@vscode/test-cli` already pulls it in transitively.

## Test Notes
- Most tests in `src/test/suite/` are extension-host integration tests, not pure unit tests. They open fixtures from `src/test/fixtures/`, change zoom/layout, and rely on explicit waits.
- `src/test/suite/largefile.test.ts` is skipped. A green run is useful but not exhaustive.
- If you change `customKeys`, `lineNumberJump`, `optimizeEnd`, visible-editor handling, or jump-mode exit behavior, update both the focused state-machine tests and the affected extension-host tests.