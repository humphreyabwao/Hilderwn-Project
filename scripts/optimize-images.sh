#!/usr/bin/env bash
# Resize & compress site photos for web (run before deploy).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMG_DIR="$ROOT/assets/images"
BACKUP="$IMG_DIR/_originals-backup"
MAX_EDGE=1920
QUALITY=78
LOGO_MAX=512

mkdir -p "$BACKUP"

shopt -s nullglob
for f in "$IMG_DIR"/*.jpeg "$IMG_DIR"/*.jpg; do
  base="$(basename "$f")"
  if [[ "$base" == logo* ]]; then
    echo "Optimizing logo: $base"
    if [[ ! -f "$BACKUP/$base" ]]; then cp "$f" "$BACKUP/$base"; fi
    sips -Z "$LOGO_MAX" -s format jpeg -s formatOptions 82 "$f" --out "$f" >/dev/null
    continue
  fi

  if [[ ! -f "$BACKUP/$base" ]]; then
    echo "Backing up: $base"
    cp "$f" "$BACKUP/$base"
  fi

  before=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f")
  sips -Z "$MAX_EDGE" -s format jpeg -s formatOptions "$QUALITY" "$f" --out "$f" >/dev/null
  after=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f")
  echo "OK $base: $((before / 1024))KB -> $((after / 1024))KB"
done

echo "Done. Originals saved in $BACKUP"
