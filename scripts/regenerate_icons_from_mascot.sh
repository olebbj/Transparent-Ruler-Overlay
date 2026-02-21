#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/assets/capybara-box.png"
OUT_DIR="$ROOT_DIR/icons"

if [[ ! -f "$SRC" ]]; then
  echo "Missing source image: $SRC" >&2
  echo "Put your mascot image there and rerun this script." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

for size in 16 32 48 128; do
  sips -s format png -z "$size" "$size" "$SRC" --out "$OUT_DIR/icon${size}.png" >/dev/null
done

echo "Icons regenerated from mascot:"
echo "$OUT_DIR/icon16.png"
echo "$OUT_DIR/icon32.png"
echo "$OUT_DIR/icon48.png"
echo "$OUT_DIR/icon128.png"
