#!/usr/bin/env bash
set -euo pipefail

# Clean submission script for Linux/macOS/Git Bash
# Run from repository root via: ./scripts/clean-submission.sh

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

declare -a MATCH_DIRS=(
  "node_modules"
  "build"
  "dist"
  "coverage"
  ".dart_tool"
  ".next"
  ".gradle"
  ".cache"
  ".flutter-plugins"
  ".flutter-plugins-dependencies"
)

echo "Scanning repository for common build artifacts (this may take a moment)..."

TO_DELETE=()

while IFS= read -r -d $'\0' dir; do
  TO_DELETE+=("$dir")
done < <(find . -type d \( $(printf -- "-name '%s' -o " "${MATCH_DIRS[@]}") -false \) -prune -print0 2>/dev/null)

# Find .log files (exclude node_modules to avoid excessive noise)
while IFS= read -r -d $'\0' file; do
  TO_DELETE+=("$file")
done < <(find . -type f -name "*.log" -not -path "./node_modules/*" -print0 2>/dev/null)

# Remove duplicates and sort
IFS=$'\n' read -r -d '' -a TO_DELETE_UNIQ < <(printf "%s\n" "${TO_DELETE[@]}" | awk '!x[$0]++' | sort -u && printf '\0')

if [ ${#TO_DELETE_UNIQ[@]} -eq 0 ]; then
  echo "No build artifacts found to delete. Exiting."
  exit 0
fi

echo "The following items will be deleted (relative to repo root):"
for p in "${TO_DELETE_UNIQ[@]}"; do
  echo " - ${p#./}"
done

read -r -p "Proceed and delete the above items? (y/N) " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted by user. No files were deleted."
  exit 0
fi

# Compute size before deletion (try du -ch total)
TOTAL_SIZE=""
if command -v du >/dev/null 2>&1; then
  # join paths safely for du
  if [ ${#TO_DELETE_UNIQ[@]} -gt 0 ]; then
    TOTAL_SIZE=$(du -ch "${TO_DELETE_UNIQ[@]}" 2>/dev/null | tail -n1 | awk '{print $1}') || TOTAL_SIZE="unknown"
  fi
fi

COUNT=0
for p in "${TO_DELETE_UNIQ[@]}"; do
  if [ -e "$p" ]; then
    rm -rf -- "$p" || true
    COUNT=$((COUNT+1))
  fi
done

echo "Deleted $COUNT items. Freed approximately: ${TOTAL_SIZE:-unknown}."

# Flutter: run flutter clean if flutter exists and flutter project present
if [ -d "flutter_booking_app" ]; then
  if command -v flutter >/dev/null 2>&1; then
    echo "Running 'flutter clean' in flutter_booking_app..."
    (cd flutter_booking_app && flutter clean) || echo "flutter clean failed or flutter not fully configured."
  else
    echo "flutter not found in PATH; skipping 'flutter clean'."
  fi
fi

echo "Clean submission finished. Review and then run 'git status' to confirm." 
