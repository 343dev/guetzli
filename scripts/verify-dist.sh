#!/usr/bin/env bash
set -euo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

WASM_OUTPUT_DIR="$TEMP_DIR" "$ROOT/scripts/build-wasm.sh"

for artifact in guetzli.mjs guetzli.wasm; do
  if ! cmp -s "$ROOT/dist/$artifact" "$TEMP_DIR/$artifact"; then
    printf 'Committed dist/%s differs from a canonical rebuild.\n' \
      "$artifact" >&2
    exit 1
  fi
done

if grep -aF "$ROOT" "$ROOT/dist/guetzli.mjs" "$ROOT/dist/guetzli.wasm" >/dev/null; then
  printf 'Generated distribution contains the repository absolute path.\n' >&2
  exit 1
fi

(
  cd /tmp
  node --input-type=module <<EOF
import createModule from '${ROOT}/dist/guetzli.mjs';
const module = await createModule();
if (typeof module._guetzli_encode !== 'function') {
  throw new Error('Emscripten loader did not resolve guetzli.wasm through import.meta.url');
}
EOF
)

printf 'Verified committed WebAssembly distribution.\n'
