#!/usr/bin/env bash
set -euo pipefail

# The Android APK ships a prebuilt web bundle that Git does not track:
# android/.gitignore excludes app/src/main/assets/public. A successful Gradle
# build can therefore package a stale operator UI while every other check stays
# green — that is exactly how 1.3.14 shipped with the audio catalog present in
# the APK and absent from the panel.
#
# Run after `npm run build && npx cap sync android`.

repo_root="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
assets_dir="${WEB_ASSETS_DIR:-$repo_root/android/app/src/main/assets/public}"

[[ -d "$assets_dir" ]] || {
  echo "Packaged WebView directory is missing: $assets_dir" >&2
  echo "Run: npm run build && npx cap sync android" >&2
  exit 1
}

mapfile -t bundles < <(find "$assets_dir" -type f \( -name '*.js' -o -name '*.css' \) 2>/dev/null)
[[ ${#bundles[@]} -gt 0 ]] || {
  echo "Packaged WebView contains no JavaScript or CSS bundle: $assets_dir" >&2
  exit 1
}

# Each entry is "needle|why it must be present".
required=(
  'getAudioLibrary|bundled narration catalog API (missing in the 1.3.14 defect)'
  'native-action-active|selected lens and zone are visibly selected (1.3.22)'
  'Весь кадр|detection zone preset, Ukrainian'
  'Центр|detection zone preset, Ukrainian'
  'Нижня частина|detection zone preset, Ukrainian'
  'Full frame|detection zone preset, English'
  'Center|detection zone preset, English'
  'Lower area|detection zone preset, English'
  'Звук недоступний|fail-closed route status, Ukrainian'
)

failed=0
for entry in "${required[@]}"; do
  needle="${entry%%|*}"
  reason="${entry#*|}"
  if grep -a -q -F -- "$needle" "${bundles[@]}"; then
    printf 'ok   %s\n' "$needle"
  else
    printf 'FAIL %s — %s\n' "$needle" "$reason" >&2
    failed=$((failed + 1))
  fi
done

if [[ "$failed" -gt 0 ]]; then
  echo "Packaged WebView is stale or incomplete: $failed expected string(s) missing." >&2
  echo "Run: npm run build && npx cap sync android" >&2
  exit 1
fi

echo "Packaged WebView carries the current operator UI (${#bundles[@]} bundle files checked)."
