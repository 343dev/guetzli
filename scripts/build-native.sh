#!/usr/bin/env bash
set -euo pipefail

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly UPSTREAM="$ROOT/upstream/guetzli"
readonly OUTPUT_DIR="${NATIVE_OUTPUT_DIR:-$ROOT/.cache/native-reference}"
readonly CXX="${CXX:-g++}"
readonly EXPECTED_VERSION='14.2.0'

actual_version="$($CXX -dumpfullversion -dumpversion)"
if [[ "$actual_version" != "$EXPECTED_VERSION" ]]; then
  printf 'Expected GCC %s, got %s from %s\n' \
    "$EXPECTED_VERSION" "$actual_version" "$CXX" >&2
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

"$CXX" \
  -O3 \
  -std=c++11 \
  -Wall \
  -Wextra \
  -Werror \
  -I"$UPSTREAM" \
  -I"$UPSTREAM/third_party/butteraugli" \
  -c "$ROOT/scripts/native-reference.cc" \
  -o "$OUTPUT_DIR/native-reference.o"

"$CXX" \
  -O3 \
  -std=c++11 \
  -I"$UPSTREAM" \
  -I"$UPSTREAM/third_party/butteraugli" \
  "$OUTPUT_DIR/native-reference.o" \
  "${sources[@]}" \
  -o "$OUTPUT_DIR/guetzli-native-reference"

printf 'Built %s\n' "$OUTPUT_DIR/guetzli-native-reference"
