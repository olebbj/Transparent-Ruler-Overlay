#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(node -p "require('$ROOT_DIR/manifest.json').version")"
OUT_FILE="$DIST_DIR/transparent-ruler-overlay-v${VERSION}.zip"

mkdir -p "$DIST_DIR"
rm -f "$OUT_FILE"

(
  cd "$ROOT_DIR"
  zip -r "$OUT_FILE" \
    manifest.json \
    background.js \
    contentScript.js \
    popup.html \
    popup.css \
    popup.js \
    assets \
    icons \
    README.md \
    PRIVACY_POLICY.md \
    STORE_LISTING.md
)

echo "Built extension package:"
echo "$OUT_FILE"
