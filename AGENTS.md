# AGENTS.md

## Commands

- Use `npm`; keep `package-lock.json` in sync with `package.json`.
- Install dependencies with `npm ci --ignore-scripts`. This package must never require install-time compilation or downloads.
- After cloning, run `npm run enable-git-hooks` once to use the versioned hooks in `.githooks/`.
- Before completing a change, run:
  - `npm run lint`
  - `npm run test:types`
  - `npm test`
- After changing `upstream/`, run `npm run verify:upstream`.
- After changing the bridge, build scripts, Emscripten version, or committed distribution, run `npm run verify:dist`. This requires the pinned Emscripten SDK; install it with `npm run setup-emsdk`.
- Before release-related work, run `npm run verify:package` and inspect `npm pack --dry-run --json`.
- Build tooling is supported on Linux. Consumers on macOS and Windows use the committed `dist/` files and must not need a compiler or Emscripten.

## Architecture and compatibility

- The package is Node-only, ESM-only, and targets Node.js `>=22.22.1`. Do not add browser or CommonJS entry points.
- Support JPEG input only. Do not restore PNG handling or `--nomemlimit`.
- Keep the public API asynchronous and preserve Worker Thread isolation: each encoding operation gets a fresh Worker and WebAssembly instance, and the Worker must exit before the operation settles.
- Do not add an internal concurrency queue. Callers own concurrency control.
- Keep the WebAssembly module filesystem-free. File, stdin, and stdout handling belongs in `cli.js`.
- Preserve the public limits and defaults unless an explicit product decision changes them: quality `84–110` (default `95`), memory limit `100–3500` MiB (default `3500`), and input size at most 128 MiB.
- Preserve the stable error-code contract in `lib/errors.js`; error messages and causes are not stable API.
- Keep package subpaths closed. `lib/` and `dist/` are implementation details, even though they are included in the tarball.

## Upstream and generated files

- Treat `upstream/guetzli/` as an immutable, byte-preserving snapshot of Google Guetzli v1.0.1. Do not reformat, patch, or normalize it. Put integration code in `src/`, `lib/`, or `scripts/`.
- If changing the upstream revision is explicitly required, update `UPSTREAM.md`, `upstream/guetzli.sha256`, parity baselines, notices, and the pinned native-reference evidence together.
- `dist/guetzli.mjs` and `dist/guetzli.wasm` are generated but committed. Never edit them manually; rebuild with `npm run build:wasm` and verify reproducibility.
- Do not add build, install, postinstall, prepare, or prepack lifecycle hooks. `npm pack` must work offline without Emscripten, Python, or a C++ compiler.
- Preserve third-party license headers and update `THIRD_PARTY_NOTICES.md` when distributed runtime code or tooling attribution changes.

## Testing

- Test through public seams: `encode()`, the CLI process, native/WebAssembly parity, and an installed npm tarball.
- Run Node tests serially with `node --test --test-concurrency=1`; Guetzli is CPU- and memory-intensive. A focused test command may select files, but do not increase test concurrency.
- Ordinary tests must use committed JPEG fixtures and must not require Python, Pillow, Emscripten, or the native reference.
- Treat `test/fixtures/floating-point-boundary-444.jpg` as immutable. Its quality-95 result is the only accepted equivalent-parity exception.
- Any new native/WebAssembly byte mismatch is a release blocker. Investigate and document it; never loosen parity using a generic perceptual threshold.
- Keep large images out of the ordinary test suite. Generate them locally with `scripts/generate-benchmark-fixtures.py` for manual performance and stress checks.

## Boundaries

- Do not modify Optimizt from this repository.
- Do not publish to npm. CI may create a verified tarball artifact, but publishing requires a separate human decision.
- Do not commit local benchmark inputs, `.cache/`, SDK installations, or generated native executables.
