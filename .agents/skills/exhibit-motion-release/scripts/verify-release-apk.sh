#!/usr/bin/env bash
set -euo pipefail

EXPECTED_PACKAGE="${EXPECTED_PACKAGE:-ua.alexsnig.exhibitmotion}"
EXPECTED_CERT_SHA256="${EXPECTED_CERT_SHA256:-bfd47221742dfdb12763a42f7cafdfdcd74469bd712e9616cb3dfa2501100f7e}"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 path/to/app-release.apk" >&2
  exit 64
fi

apk="$1"
if [[ ! -f "$apk" ]]; then
  echo "APK not found: $apk" >&2
  exit 66
fi

for command_name in unzip sha256sum grep awk sort; do
  command -v "$command_name" >/dev/null || {
    echo "Missing command: $command_name" >&2
    exit 69
  }
done

sdk_candidates=()
[[ -n "${ANDROID_HOME:-}" ]] && sdk_candidates+=("$ANDROID_HOME")
[[ -n "${ANDROID_SDK_ROOT:-}" ]] && sdk_candidates+=("$ANDROID_SDK_ROOT")
sdk_candidates+=("/home/alex/Android/Sdk" "/usr/lib/android-sdk")

build_tools=""
for sdk in "${sdk_candidates[@]}"; do
  [[ -d "$sdk/build-tools" ]] || continue
  while IFS= read -r candidate; do
    if [[ -x "$candidate/apksigner" && -x "$candidate/aapt" && -x "$candidate/zipalign" ]]; then
      build_tools="$candidate"
      break 2
    fi
  done < <(find "$sdk/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -Vr)
done

if [[ -z "$build_tools" ]]; then
  echo "Android build-tools with apksigner, aapt, and zipalign were not found." >&2
  exit 69
fi

apksigner="$build_tools/apksigner"
aapt="$build_tools/aapt"
zipalign="$build_tools/zipalign"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "APK: $apk"
sha256sum "$apk"
unzip -tq "$apk"
"$zipalign" -c -v 4 "$apk" >/dev/null

signature_output="$("$apksigner" verify --verbose --print-certs "$apk")"
printf '%s\n' "$signature_output"

certificate="$(
  printf '%s\n' "$signature_output" \
    | awk -F': ' '/certificate SHA-256 digest/ {print tolower($NF); exit}'
)"
if [[ "$certificate" != "${EXPECTED_CERT_SHA256,,}" ]]; then
  echo "Unexpected signing certificate: $certificate" >&2
  exit 1
fi

badging="$("$aapt" dump badging "$apk")"
printf '%s\n' "$badging" | sed -n '1,4p'

package_name="$(
  printf '%s\n' "$badging" \
    | awk -F"'" '/^package:/ {for (i=1; i<=NF; i++) if ($(i-1) ~ /name=$/) {print $i; exit}}'
)"
if [[ "$package_name" != "$EXPECTED_PACKAGE" ]]; then
  echo "Unexpected package: $package_name" >&2
  exit 1
fi

if printf '%s\n' "$badging" | grep -q '^application-debuggable'; then
  echo "Release APK is debuggable." >&2
  exit 1
fi

permissions="$("$aapt" dump permissions "$apk")"
if printf '%s\n' "$permissions" | grep -q "android.permission.INTERNET"; then
  echo "Release APK unexpectedly requests INTERNET." >&2
  exit 1
fi

unzip -qq "$apk" 'classes*.dex' -d "$tmp_dir"
shopt -s nullglob
dex_files=("$tmp_dir"/classes*.dex)
if [[ ${#dex_files[@]} -eq 0 ]]; then
  echo "No DEX files found in APK." >&2
  exit 1
fi
if ! grep -a -q 'Lcom/getcapacitor/annotation/CapacitorPlugin;' "${dex_files[@]}"; then
  echo "R8 smoke check failed: CapacitorPlugin descriptor is missing." >&2
  exit 1
fi

echo "OK: signed Exhibit Motion release APK passed all static gates."
