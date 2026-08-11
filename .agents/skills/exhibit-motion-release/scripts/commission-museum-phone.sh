#!/usr/bin/env bash
set -euo pipefail

PACKAGE="ua.alexsnig.exhibitmotion"
GUIDE_PACKAGE="com.guidemuseum"
ADMIN_COMPONENT="$PACKAGE/.kiosk.ExhibitDeviceAdminReceiver"
PROVISIONING_COMPONENT="$PACKAGE/.kiosk.ProvisioningActivity"
MAIN_COMPONENT="$PACKAGE/.MainActivity"
EXPECTED_MODEL="${EXPECTED_MODEL:-SM-A075F}"
ADB_BIN="${ADB_BIN:-adb}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
verify_script="$repo_root/.agents/skills/exhibit-motion-release/scripts/verify-release-apk.sh"
version_name="$(node -e 'console.log(require(process.argv[1]).version)' "$repo_root/package.json")"
version_code="$(awk '/^[[:space:]]*versionCode[[:space:]]+[0-9]+/ {print $2; exit}' "$repo_root/android/app/build.gradle")"
default_handoff="/home/alex/exhibit-handoff-${version_name}-code${version_code}"
apk="$default_handoff/ExhibitMotion-${version_name}-code${version_code}-release.apk"
serial=""
preflight_only=0
reboot_after=1
evidence_dir=""

usage() {
  cat <<EOF
Usage: $0 [--apk PATH] [--serial SERIAL] [--preflight-only] [--no-reboot]

With no arguments, uses the APK matching package.json/build.gradle and the
only authorized physical ADB phone. The production path reboots once.

  --apk PATH          Exact signed Exhibit Motion release APK.
  --serial SERIAL     Explicit physical ADB serial.
  --preflight-only    Run every read-only guard; do not change the phone.
  --no-reboot         Commission but skip the required cold reboot (diagnostics only).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apk)
      [[ $# -ge 2 ]] || { usage >&2; exit 64; }
      apk="$2"
      shift 2
      ;;
    --serial)
      [[ $# -ge 2 ]] || { usage >&2; exit 64; }
      serial="$2"
      shift 2
      ;;
    --preflight-only)
      preflight_only=1
      shift
      ;;
    --no-reboot)
      reboot_after=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 64
      ;;
  esac
done

die() {
  local message="BLOCKED: $*"
  printf '%s\n' "$message" >&2
  if [[ -n "$evidence_dir" ]]; then
    printf '%s\n' "$message" >>"$evidence_dir/summary.txt"
  fi
  exit 1
}

note() {
  printf '%s\n' "$*"
  if [[ -n "$evidence_dir" ]]; then
    printf '%s\n' "$*" >>"$evidence_dir/summary.txt"
  fi
}

for command_name in "$ADB_BIN" awk chmod date grep head mkdir mktemp node sed sha256sum sleep timeout tr; do
  command -v "$command_name" >/dev/null || die "missing host command: $command_name"
done
[[ -x "$verify_script" ]] || die "release verifier is unavailable: $verify_script"
[[ -f "$apk" ]] || die "current signed APK not found: $apk"

note "[1/8] Verify exact signed release"
"$verify_script" "$apk"
apk_sha="$(sha256sum "$apk" | awk '{print $1}')"

devices_output="$("$ADB_BIN" devices)"
if [[ -z "$serial" ]]; then
  mapfile -t physical_serials < <(
    awk 'NR > 1 && $2 == "device" && $1 !~ /^emulator-/ {print $1}' <<<"$devices_output"
  )
  [[ ${#physical_serials[@]} -eq 1 ]] || die \
    "expected exactly one authorized physical ADB phone; found ${#physical_serials[@]}"
  serial="${physical_serials[0]}"
else
  device_state="$(awk -v wanted="$serial" '$1 == wanted {print $2; exit}' <<<"$devices_output")"
  [[ "$device_state" == "device" ]] || die "ADB serial $serial is not authorized and online"
fi
[[ "$serial" != emulator-* ]] || die "emulators are never commissioning targets"

adb_serial() {
  "$ADB_BIN" -s "$serial" "$@"
}

device_shell() {
  adb_serial shell "$@"
}

model="$(device_shell getprop ro.product.model | tr -d '\r')"
manufacturer="$(device_shell getprop ro.product.manufacturer | tr -d '\r' | tr '[:upper:]' '[:lower:]')"
qemu="$(device_shell getprop ro.kernel.qemu | tr -d '\r')"
boot_completed="$(device_shell getprop sys.boot_completed | tr -d '\r')"
[[ "$qemu" != "1" ]] || die "ADB serial $serial reports an emulator"
[[ "$manufacturer" == "samsung" ]] || die "unexpected manufacturer '$manufacturer' on $serial"
[[ "$model" == "$EXPECTED_MODEL" ]] || die \
  "unexpected model '$model' on $serial; expected dedicated museum model '$EXPECTED_MODEL'"
[[ "$boot_completed" == "1" ]] || die "Android has not completed boot on $serial"

evidence_dir="${EVIDENCE_DIR:-/tmp/exhibit-motion-commission-${serial}-$(date +%Y%m%dT%H%M%S)}"
mkdir -p "$evidence_dir"
chmod 700 "$evidence_dir"
note "release=$version_name/code$version_code"
note "apk_sha256=$apk_sha"
note "serial=$serial"
note "model=$model"

note "[2/8] Run fresh/update safety guards"
current_user="$(device_shell am get-current-user | tr -d '\r')"
users_output="$(device_shell pm list users)"
user_count="$(grep -c 'UserInfo{' <<<"$users_output" || true)"
accounts_output="$(device_shell dumpsys account)"
accounts_count="$(awk '/^[[:space:]]*Accounts:[[:space:]]*[0-9]+/ {print $2; exit}' <<<"$accounts_output")"
lock_output="$(device_shell dumpsys lock_settings)"
credential_type="$(awk -F': ' '/^[[:space:]]*CredentialType:/ {print $2; exit}' <<<"$lock_output")"
dpm_output="$(device_shell dumpsys device_policy)"
owner_package="$(awk -F= '/^[[:space:]]*package=/{print $2; exit}' <<<"$dpm_output" | tr -d '[:space:]')"
app_path="$(device_shell pm path "$PACKAGE" 2>/dev/null || true)"
guide_path="$(device_shell pm path "$GUIDE_PACKAGE" 2>/dev/null || true)"

[[ "$current_user" == "0" ]] || die "current Android user is $current_user, not owner user 0"
[[ "$user_count" == "1" && "$users_output" == *"UserInfo{0:"* ]] || die \
  "phone must contain only owner user 0; found $user_count users"
[[ "$accounts_count" == "0" ]] || die "phone has $accounts_count account(s); Device Owner provisioning is unsafe"
[[ "$credential_type" == "NONE" ]] || die \
  "secure lock credential '$credential_type' blocks touch-free cold boot"
[[ -z "$guide_path" ]] || die "GuideMuseum is installed; this is the wrong museum-phone lane"
[[ -z "$owner_package" || "$owner_package" == "$PACKAGE" ]] || die \
  "another Device Owner is present: $owner_package"
if [[ "$owner_package" == "$PACKAGE" && -z "$app_path" ]]; then
  die "Device Owner metadata names $PACKAGE but the package is missing"
fi

if [[ "$owner_package" == "$PACKAGE" ]]; then
  commission_mode="commissioned_update"
else
  commission_mode="fresh_commission"
fi
note "mode=$commission_mode"
note "guards=PASS (one owner user, zero accounts, no secure credential, correct product lane)"

ota_packages=(
  com.wssyncmldm
  com.samsung.android.app.updatecenter
  com.sec.android.soagent
)

verify_system_kiosk() {
  local current_dpm current_package current_activity current_home disabled_packages ota_setting permission_line
  current_dpm="$(device_shell dumpsys device_policy)"
  current_package="$(device_shell dumpsys package "$PACKAGE")"
  current_activity="$(device_shell dumpsys activity activities)"
  current_home="$(device_shell cmd package resolve-activity --brief \
    -a android.intent.action.MAIN -c android.intent.category.HOME | tr -d '\r')"
  disabled_packages="$(device_shell pm list packages -d)"
  ota_setting="$(device_shell settings get global ota_disable_automatic_update | tr -d '\r')"

  [[ "$current_dpm" == *"package=$PACKAGE"* ]] || die "Device Owner package is not $PACKAGE"
  [[ "$current_dpm" == *"Device Owner Type: 0"* ]] || die "Device Owner type 0 is missing"
  [[ "$current_dpm" == *"LockTaskPolicy {mPackages= $PACKAGE"* ]] || die "Lock Task allowlist is missing"
  [[ "$current_home" == *"$PACKAGE"* ]] || die "Exhibit Motion is not the resolved HOME app: $current_home"
  [[ "$current_activity" == *"mLockTaskModeState=LOCKED"* ]] || die "Lock Task is not active"
  [[ "$current_activity" == *"$PACKAGE/.MainActivity"* || "$current_activity" == *"$PACKAGE/$PACKAGE.MainActivity"* ]] || die \
    "Exhibit Motion MainActivity is not present in the activity state"

  for permission_name in CAMERA POST_NOTIFICATIONS BLUETOOTH_CONNECT; do
    permission_line="$(grep -F "android.permission.$permission_name: granted=true" <<<"$current_package" | head -n 1 || true)"
    [[ "$permission_line" == *"POLICY_FIXED"* ]] || die \
      "android.permission.$permission_name is not granted and POLICY_FIXED"
  done
  for ota_package in "${ota_packages[@]}"; do
    [[ "$disabled_packages" == *"package:$ota_package"* ]] || die "OTA package remains enabled: $ota_package"
  done
  [[ "$ota_setting" == "1" ]] || die "ota_disable_automatic_update is not 1"
}

if [[ "$preflight_only" == "1" ]]; then
  if [[ "$commission_mode" == "commissioned_update" ]]; then
    verify_system_kiosk
    note "existing_system_kiosk=PASS"
  fi
  note "RESULT=PREFLIGHT_PASS_NO_DEVICE_CHANGES"
  note "evidence=$evidence_dir"
  exit 0
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

note "[3/8] Install without clearing app data"
device_shell svc power stayon usb >/dev/null
if ! install_output="$(adb_serial install -r "$apk" 2>&1)"; then
  die "adb install -r failed: $install_output"
fi
[[ "$install_output" == *"Success"* ]] || die "installation did not report Success: $install_output"

package_output="$(device_shell dumpsys package "$PACKAGE")"
installed_version_code="$(sed -n 's/.*versionCode=\([0-9][0-9]*\).*/\1/p' <<<"$package_output" | head -n 1)"
installed_version_name="$(sed -n 's/.*versionName=\([^[:space:]]*\).*/\1/p' <<<"$package_output" | head -n 1)"
[[ "$installed_version_code" == "$version_code" && "$installed_version_name" == "$version_name" ]] || die \
  "installed version $installed_version_name/code$installed_version_code does not match $version_name/code$version_code"

installed_path="$(device_shell pm path "$PACKAGE" | awk -F: '/^package:/{print $2; exit}' | tr -d '\r')"
[[ -n "$installed_path" ]] || die "could not resolve installed base.apk"
adb_serial pull "$installed_path" "$tmp_dir/base.apk" >/dev/null
installed_sha="$(sha256sum "$tmp_dir/base.apk" | awk '{print $1}')"
[[ "$installed_sha" == "$apk_sha" ]] || die \
  "installed base.apk hash differs: $installed_sha (expected $apk_sha)"
note "installed_base_apk_sha256=$installed_sha"

note "[4/8] Provision Device Owner and apply native kiosk policies"
if [[ "$commission_mode" == "fresh_commission" ]]; then
  if ! owner_result="$(device_shell dpm set-device-owner "$ADMIN_COMPONENT" 2>&1)"; then
    die "Device Owner provisioning failed: $owner_result"
  fi
  [[ "$owner_result" == *"Success"* ]] || die "Device Owner provisioning did not report Success: $owner_result"
fi

device_shell am start -W \
  -a android.app.action.ADMIN_POLICY_COMPLIANCE \
  -c android.intent.category.DEFAULT \
  -n "$PROVISIONING_COMPONENT" >/dev/null
device_shell am start -W \
  -a android.intent.action.MAIN \
  -c android.intent.category.HOME \
  -n "$MAIN_COMPONENT" >/dev/null
sleep 2

note "[5/8] Disable unattended Samsung OTA entry points"
for ota_package in "${ota_packages[@]}"; do
  [[ -n "$(device_shell pm path "$ota_package" 2>/dev/null || true)" ]] || die \
    "expected Samsung OTA package is missing: $ota_package"
  device_shell pm disable-user --user 0 "$ota_package" >/dev/null
done
device_shell settings put global ota_disable_automatic_update 1

note "[6/8] Verify Device Owner, HOME, Lock Task, fixed permissions and OTA"
verify_system_kiosk

if [[ "$reboot_after" == "0" ]]; then
  note "RESULT=SYSTEM_KIOSK_READY_REBOOT_SKIPPED"
  note "operator_gate=select narration, approve and hear route, calibrate, motion-test, set private PIN, enable autostart"
  note "evidence=$evidence_dir"
  exit 0
fi

note "[7/8] Perform the authorized commissioning reboot"
adb_serial reboot
sleep 5
if ! timeout 90 "$ADB_BIN" -s "$serial" wait-for-device; then
  note "ADB did not re-enumerate after reboot; restart the host ADB server once"
  "$ADB_BIN" kill-server
  "$ADB_BIN" start-server
  timeout 90 "$ADB_BIN" -s "$serial" wait-for-device || die \
    "ADB serial $serial did not return after reboot"
fi
boot_completed="0"
for _ in {1..90}; do
  boot_completed="$(device_shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  [[ "$boot_completed" == "1" ]] && break
  sleep 2
done
[[ "$boot_completed" == "1" ]] || die "phone did not complete Android boot within 180 seconds"
sleep 5

note "[8/8] Verify post-boot kiosk and AUTO_START evidence"
verify_system_kiosk
service_output="$(device_shell dumpsys activity services "$PACKAGE")"
if [[ "$service_output" == *"$PACKAGE.action.AUTO_START"* ]]; then
  note "autostart=PASS action.AUTO_START"
  note "RESULT=SYSTEM_KIOSK_AND_BOOT_AUTOSTART_READY"
else
  note "autostart=PENDING operator wizard/PIN/readiness"
  note "RESULT=SYSTEM_KIOSK_READY_OPERATOR_WIZARD_PENDING"
fi
note "operator_gate=select narration, approve and hear route, calibrate, motion-test, set private PIN, enable autostart"
note "evidence=$evidence_dir"
