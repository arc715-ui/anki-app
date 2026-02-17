#!/usr/bin/env bash
#
# kindle-capture.sh — Kindle window auto-screenshot + page forward
#
# Usage:
#   ./scripts/kindle-capture.sh --pages 50 --output screenshots/zaimu
#   ./scripts/kindle-capture.sh --pages 50 --output screenshots/zaimu --start 10
#
# Prerequisites:
#   - Kindle app open with the first target page visible
#   - Grant Terminal (or iTerm) Accessibility permission in System Settings
#     (Privacy & Security → Accessibility)

set -euo pipefail

# --- Defaults ---
PAGES=10
OUTPUT_DIR="screenshots"
START=1
DELAY=1.0  # seconds between captures

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --pages)  PAGES="$2";      shift 2 ;;
    --output) OUTPUT_DIR="$2"; shift 2 ;;
    --start)  START="$2";      shift 2 ;;
    --delay)  DELAY="$2";      shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--pages N] [--output DIR] [--start N] [--delay SECS]"
      echo ""
      echo "  --pages N     Number of pages to capture (default: 10)"
      echo "  --output DIR  Output directory for screenshots (default: screenshots)"
      echo "  --start N     Starting file number (default: 1)"
      echo "  --delay SECS  Delay between captures in seconds (default: 1.0)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$OUTPUT_DIR"

# --- Activate Kindle ---
echo "Activating Kindle..."
osascript -e 'tell application "Kindle" to activate' 2>/dev/null || \
osascript -e 'tell application "Amazon Kindle" to activate' 2>/dev/null || true
sleep 1

echo "Starting capture: $PAGES pages → $OUTPUT_DIR/ (starting at page_$(printf '%03d' $START).png)"
echo "Press Ctrl+C to stop early."
echo ""

# --- Capture loop ---
for ((i = 0; i < PAGES; i++)); do
  NUM=$((START + i))
  FILENAME=$(printf "page_%03d.png" "$NUM")
  FILEPATH="$OUTPUT_DIR/$FILENAME"

  # Capture full screen silently (Kindle should be frontmost and maximized)
  screencapture -o -x "$FILEPATH"

  echo "  [$((i + 1))/$PAGES] $FILENAME"

  # Page forward (right arrow key)
  if ((i < PAGES - 1)); then
    osascript -e 'tell application "System Events" to key code 124'
    sleep "$DELAY"
  fi
done

echo ""
echo "Done! Captured $PAGES pages to $OUTPUT_DIR/"
ls -lh "$OUTPUT_DIR/" | tail -5
echo "..."
echo "Total files: $(ls "$OUTPUT_DIR/"*.png 2>/dev/null | wc -l | tr -d ' ')"
