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

for command_name in unzip sha256sum grep awk sort find node; do
  command -v "$command_name" >/dev/null || {
    echo "Missing command: $command_name" >&2
    exit 69
  }
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
expected_version_name="${EXPECTED_VERSION_NAME:-$(node -e 'console.log(require(process.argv[1]).version)' "$repo_root/package.json")}"
expected_version_code="${EXPECTED_VERSION_CODE:-$(
  awk '/^[[:space:]]*versionCode[[:space:]]+[0-9]+/ {print $2; exit}' \
    "$repo_root/android/app/build.gradle"
)}"
if [[ -z "$expected_version_name" || -z "$expected_version_code" ]]; then
  echo "Could not resolve expected web and Android versions from source." >&2
  exit 69
fi

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

version_code="$(
  printf '%s\n' "$badging" \
    | awk -F"'" '/^package:/ {for (i=1; i<=NF; i++) if ($(i-1) ~ /versionCode=$/) {print $i; exit}}'
)"
version_name="$(
  printf '%s\n' "$badging" \
    | awk -F"'" '/^package:/ {for (i=1; i<=NF; i++) if ($(i-1) ~ /versionName=$/) {print $i; exit}}'
)"
if [[ "$version_code" != "$expected_version_code" || "$version_name" != "$expected_version_name" ]]; then
  echo "APK version $version_name/code $version_code does not match source $expected_version_name/code $expected_version_code." >&2
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

shopt -s nullglob
unzip -qq "$apk" 'assets/public/assets/*.js' -d "$tmp_dir"
web_bundles=("$tmp_dir"/assets/public/assets/*.js)
if [[ ${#web_bundles[@]} -eq 0 ]]; then
  echo "Packaged Capacitor WebView bundle is missing." >&2
  exit 1
fi
if ! grep -a -q 'getAudioLibrary' "${web_bundles[@]}"; then
  echo "Packaged WebView bundle is stale: audio catalog API is missing." >&2
  exit 1
fi

audio_source_dir="$repo_root/audio"
if [[ -d "$audio_source_dir" ]]; then
  archive_entries="$(unzip -Z1 "$apk")"
  while IFS= read -r -d '' source_audio; do
    packaged_audio="assets/${source_audio##*/}"
    if ! grep -F -x -q "$packaged_audio" <<<"$archive_entries"; then
      echo "Bundled audio is missing from APK: ${source_audio##*/}" >&2
      exit 1
    fi
  done < <(find "$audio_source_dir" -maxdepth 1 -type f -print0)
fi

unzip -qq "$apk" 'classes*.dex' -d "$tmp_dir"
dex_files=("$tmp_dir"/classes*.dex)
if [[ ${#dex_files[@]} -eq 0 ]]; then
  echo "No DEX files found in APK." >&2
  exit 1
fi
if ! grep -a -q 'Lcom/getcapacitor/annotation/CapacitorPlugin;' "${dex_files[@]}"; then
  echo "R8 smoke check failed: CapacitorPlugin descriptor is missing." >&2
  exit 1
fi

# Cross-check against the release ledger. A freshly built APK is legitimately
# absent until `release-guard.sh record` runs, so absence is a note. A recorded
# versionCode that carries a different binary is the failure this catches.
ledger="$repo_root/releases.json"
apk_sha256="$(sha256sum "$apk" | awk '{print $1}')"
if [[ -f "$ledger" ]]; then
  ledger_status="$(
    node -e '
      const fs = require("fs");
      const [path, code, sha] = process.argv.slice(1);
      const ledger = JSON.parse(fs.readFileSync(path, "utf8"));
      const entry = (ledger.releases || []).find(r => Number(r.versionCode) === Number(code));
      if (!entry) { console.log("UNRECORDED"); process.exit(0); }
      if (entry.withdrawn) { console.log("WITHDRAWN " + entry.withdrawn); process.exit(0); }
      const known = [entry.apkSha256, ...(entry.alternateSha256 || [])]
        .filter(Boolean).map(value => String(value).toLowerCase());
      if (!known.length) { console.log("UNRECORDED"); process.exit(0); }
      console.log(known.includes(String(sha).toLowerCase()) ? "MATCH" : "CONFLICT " + entry.apkSha256);
    ' "$ledger" "$expected_version_code" "$apk_sha256"
  )"
  case "$ledger_status" in
    MATCH)
      echo "Ledger: this binary is the recorded build for code $expected_version_code."
      ;;
    UNRECORDED)
      echo "Ledger: code $expected_version_code is not recorded yet; run release-guard.sh record before installing."
      ;;
    WITHDRAWN*)
      echo "Ledger conflict: code $expected_version_code is withdrawn — ${ledger_status#WITHDRAWN }" >&2
      exit 1
      ;;
    CONFLICT*)
      echo "Ledger conflict: code $expected_version_code is recorded as ${ledger_status#CONFLICT }, this APK is $apk_sha256." >&2
      echo "One versionCode carries one binary. Bump the version instead of shipping a second build." >&2
      exit 1
      ;;
  esac
fi

echo "OK: signed Exhibit Motion release APK passed all static gates."
