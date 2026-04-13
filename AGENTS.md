# AGENTS.md

## Repo Shape
- Single-package VS Code extension. Runtime entrypoint is `src/extension.ts`; the extension manifest loads `out/extension.js` via `package.json.main`.
- Keep jump-mode state in `src/state-machine.ts`. `src/extension.ts` is the wiring layer for commands, VS Code events, decorations, and the state machine.
- Label generation is centered in `src/labelers/words.ts`. It mutates the shared `env.keys` array across all visible editors so labels stay globally unique, and it skips `webview` / `vscode-*` editors on purpose.
- Dynamic letter commands come from `getAllKeys()` / `getKeySet()` in `src/keys.ts`; digit commands `0-9` are registered separately in `activate()` for line-number jumps.

## Verified Commands
- `npm run compile` is the canonical full build: `tsc --noEmit` + `eslint` + `node esbuild.js`, and it writes the real runtime bundle to `out/extension.js`.
- `npm run watch` is the real dev watch flow. It runs `watch:tsc` plus `watch:esbuild`, and `watch:esbuild` also goes through `node esbuild.js --watch`.
- `npm run compile-tests` writes compiled tests to `out/test/**`.
- `.vscode-test.mjs` points the test runner at `out/test/**/*.test.js`.
- `npm run test` is the safe end-to-end test command because `pretest` already runs `compile-tests`, `compile`, and `lint` first.
- `npm run test-no-compile` still launches `vscode-test`; use it only after the compiled outputs in `out/` and `out/test/` already exist.

## Gotchas
- `npm run esbuild`, `npm run esbuild-watch`, and `npm run vscode:prepublish` still use `esbuild-base` with `--outfile=out/main.js`. That does not match `package.json.main` (`out/extension.js`). Prefer `npm run compile` / `node esbuild.js` unless you are fixing this script split.
- `npm run deploy` is intentionally disabled.
- `.vscodeignore` excludes `src/**` and `out/test/**`, so packaged VSIX contents must already be in runtime-ready files under `out/`.
- There are no checked-in CI workflows under `.github/workflows`; local npm scripts are the source of truth.

## Test Notes
- Most tests in `src/test/suite/` are extension-host integration tests, not pure unit tests. They open fixtures from `src/test/fixtures/`, change zoom/layout, and rely on explicit waits.
- `src/test/suite/largefile.test.ts` is skipped. `src/test/suite/status.test.ts` is unfinished. A green run is useful but not exhaustive.
- If you change `customKeys`, `lineNumberJump`, `optimizeEnd`, visible-editor handling, or jump-mode exit behavior, update both the focused state-machine tests and the affected extension-host tests.