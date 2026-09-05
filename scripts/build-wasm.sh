#!/usr/bin/env bash
set -euo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly UPSTREAM="$ROOT/upstream/guetzli"
readonly OUTPUT_DIR="${WASM_OUTPUT_DIR:-$ROOT/dist}"
readonly EXPECTED_VERSION='6.0.9'
readonly SDK_DIR="${EMSDK:-$ROOT/.cache/emsdk}"
readonly EMXX="$SDK_DIR/upstream/emscripten/em++"

if [[ ! -x "$EMXX" ]]; then
  printf 'Emscripten is not installed at %s. Run npm run setup-emsdk.\n' \
    "$SDK_DIR" >&2
  exit 1
fi

actual_version="$($EMXX --version | head -n 1)"
if [[ "$actual_version" != *" $EXPECTED_VERSION "* ]]; then
  printf 'Expected Emscripten %s, got: %s\n' \
    "$EXPECTED_VERSION" "$actual_version" >&2
  exit 1
fi

mapfile -d '' sources < <(
  find "$UPSTREAM/guetzli" "$UPSTREAM/third_party/butteraugli" \
    -type f -name '*.cc' \
    ! -name 'guetzli.cc' \
    ! -name 'butteraugli_main.cc' \
    -print0 | sort -z
)

mkdir -p "$OUTPUT_DIR"

# Compile the integration code separately so new warnings fail the build while
# warning-only issues in the unmodified 2017 upstream snapshot remain visible.
"$EMXX" \
  -O3 \
  -DNDEBUG \
  -std=c++11 \
  -Wall \
  -Wextra \
  -Werror \
  -I"$UPSTREAM" \
  -I"$UPSTREAM/third_party/butteraugli" \
  -c "$ROOT/src/wasm/bridge.cc" \
  -o "$OUTPUT_DIR/bridge.o"

objects=("$OUTPUT_DIR/bridge.o")
for source in "${sources[@]}"; do
  relative="${source#"$UPSTREAM/"}"
  object="$OUTPUT_DIR/upstream/${relative%.cc}.o"
  mkdir -p "$(dirname "$object")"
  "$EMXX" \
    -O3 \
    -DNDEBUG \
    -std=c++11 \
    -I"$UPSTREAM" \
    -I"$UPSTREAM/third_party/butteraugli" \
    -c "$source" \
    -o "$object"
  objects+=("$object")
done

"$EMXX" \
  -O3 \
  -DNDEBUG \
  -std=c++11 \
  "${objects[@]}" \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=1 \
  -sENVIRONMENT=node \
  -sALLOW_MEMORY_GROWTH=1 \
  -sMAXIMUM_MEMORY=4GB \
  -sFILESYSTEM=0 \
  -sINCOMING_MODULE_JS_API=print,printErr \
  -sEXPORTED_FUNCTIONS=_malloc,_free,_guetzli_encode,_guetzli_output_data,_guetzli_output_size,_guetzli_error_message,_guetzli_debug_output,_guetzli_reset \
  -sEXPORTED_RUNTIME_METHODS=HEAPU8,UTF8ToString \
  -o "$OUTPUT_DIR/guetzli.mjs"

rm -f "$OUTPUT_DIR/bridge.o"
rm -rf "$OUTPUT_DIR/upstream"

printf 'Built %s and %s\n' \
  "$OUTPUT_DIR/guetzli.mjs" "$OUTPUT_DIR/guetzli.wasm"
