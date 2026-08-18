#!/usr/bin/env bash
set -uo pipefail

# Fixture-driven tests for release-guard.sh. Nothing here touches the real
# repository, the real ledger, or a phone: every path the guard reads is
# redirected into a temporary directory.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
guard="$script_dir/release-guard.sh"
real_ledger="$(cd "$script_dir/../../../.." && pwd)/releases.json"

passed=0
failed=0

report_pass() {
  printf 'ok   %s\n' "$1"
  passed=$((passed + 1))
}

report_fail() {
  printf 'FAIL %s\n     %s\n' "$1" "$2"
  failed=$((failed + 1))
}

# expect_exit <expected code> <name> <substring the output must contain> -- command...
expect_exit() {
  local expected="$1" name="$2" needle="$3"
  shift 4
  local output status
  output="$("$@" 2>&1)"
  status=$?
  if [[ "$status" -ne "$expected" ]]; then
    report_fail "$name" "expected exit $expected, got $status: $output"
    return
  fi
  if [[ -n "$needle" && "$output" != *"$needle"* ]]; then
    report_fail "$name" "output did not contain '$needle': $output"
    return
  fi
  report_pass "$name"
}

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

make_ledger() {
  local path="$1" sha="$2" withdrawn="$3"
  cat >"$path" <<EOF
{
  "package": "ua.alexsnig.exhibitmotion",
  "releases": [
    {
      "version": "1.9.0",
      "versionCode": 90,
      "commit": "aaaaaaa",
      "apkSha256": "$sha",
      "builtAt": "2026-01-01",
      "toolchain": null,
      "artifact": null,
      "phones": [],
      "withdrawn": $withdrawn
    }
  ]
}
EOF
}

make_repo() {
  local root="$1" package_version="$2" gradle_version="$3" gradle_code="$4"
  mkdir -p "$root/src" "$root/android/app/src/main/assets/public"
  cat >"$root/package.json" <<EOF
{ "name": "fixture", "version": "$package_version" }
EOF
  cat >"$root/android/app/build.gradle" <<EOF
android {
    defaultConfig {
        versionCode $gradle_code
        versionName "$gradle_version"
    }
}
EOF
  printf 'export const a = 1;\n' >"$root/src/app.ts"
  printf 'console.log(1);\n' >"$root/android/app/src/main/assets/public/index.js"
  git -C "$root" init -q
  git -C "$root" add -A
  git -C "$root" -c user.email=t@example.com -c user.name=Test commit -qm fixture
}

run_guard() {
  local root="$1" ledger="$2"
  shift 2
  REPO_ROOT="$root" \
  RELEASES_LEDGER="$ledger" \
  PKG_JSON="$root/package.json" \
  BUILD_GRADLE="$root/android/app/build.gradle" \
  WEB_ASSETS_DIR="$root/android/app/src/main/assets/public" \
  SRC_DIR="$root/src" \
  GRADLE_PROPS="$root/android/gradle/wrapper/gradle-wrapper.properties" \
    "$guard" "$@"
}

# ---------------------------------------------------------------- ledger shape

expect_exit 0 "lint accepts the real ledger" "LEDGER_LINT_OK" -- \
  env RELEASES_LEDGER="$real_ledger" "$guard" lint

duplicate_ledger="$work_dir/duplicate.json"
cat >"$duplicate_ledger" <<'EOF'
{
  "releases": [
    { "version": "1.9.0", "versionCode": 90, "apkSha256": null, "withdrawn": null },
    { "version": "1.9.1", "versionCode": 90, "apkSha256": null, "withdrawn": null }
  ]
}
EOF
expect_exit 1 "lint rejects a duplicated versionCode" "appears twice" -- \
  env RELEASES_LEDGER="$duplicate_ledger" "$guard" lint

# ----------------------------------------------------------------------- check

apk="$work_dir/app-release.apk"
printf 'binary-one\n' >"$apk"
known_sha="$(sha256sum "$apk" | awk '{print $1}')"

other_apk="$work_dir/other-release.apk"
printf 'binary-two\n' >"$other_apk"

known_ledger="$work_dir/known.json"
make_ledger "$known_ledger" "$known_sha" "null"
expect_exit 0 "check accepts a recorded APK" "LEDGER_OK" -- \
  env RELEASES_LEDGER="$known_ledger" "$guard" check "$apk"

expect_exit 1 "check rejects an unrecorded APK" "is not recorded" -- \
  env RELEASES_LEDGER="$known_ledger" "$guard" check "$other_apk"

withdrawn_ledger="$work_dir/withdrawn.json"
make_ledger "$withdrawn_ledger" "$known_sha" '"two binaries under one versionCode"'
expect_exit 1 "check rejects a withdrawn release" "is withdrawn" -- \
  env RELEASES_LEDGER="$withdrawn_ledger" "$guard" check "$apk"

# ---------------------------------------------------------------------- record

record_root="$work_dir/record-repo"
make_repo "$record_root" "1.9.0" "1.9.0" "90"

conflict_ledger="$work_dir/conflict.json"
make_ledger "$conflict_ledger" "$known_sha" "null"
expect_exit 1 "record rejects a second binary under one versionCode" "One versionCode carries one binary" -- \
  run_guard "$record_root" "$conflict_ledger" record "$other_apk"

idempotent_ledger="$work_dir/idempotent.json"
make_ledger "$idempotent_ledger" "$known_sha" "null"
expect_exit 0 "record confirms an identical rebuild" "LEDGER_CONFIRMED" -- \
  run_guard "$record_root" "$idempotent_ledger" record "$apk"

new_root="$work_dir/new-repo"
make_repo "$new_root" "1.9.1" "1.9.1" "91"
new_ledger="$work_dir/new.json"
make_ledger "$new_ledger" "$known_sha" "null"
expect_exit 0 "record appends an unseen versionCode" "LEDGER_RECORDED" -- \
  run_guard "$new_root" "$new_ledger" record "$other_apk" --phone R8YTESTONLY
if ! grep -q "R8YTESTONLY" "$new_ledger"; then
  report_fail "record stores the serial it installed to" "serial missing from $new_ledger"
else
  report_pass "record stores the serial it installed to"
fi

# ------------------------------------------------------------------- preflight

clean_root="$work_dir/clean-repo"
make_repo "$clean_root" "1.9.2" "1.9.2" "92"
clean_ledger="$work_dir/clean.json"
make_ledger "$clean_ledger" "$known_sha" "null"
expect_exit 0 "preflight passes on a clean tree with a new versionCode" "PREFLIGHT_PASS" -- \
  run_guard "$clean_root" "$clean_ledger" preflight

dirty_root="$work_dir/dirty-repo"
make_repo "$dirty_root" "1.9.2" "1.9.2" "92"
printf 'export const b = 2;\n' >>"$dirty_root/src/app.ts"
expect_exit 1 "preflight rejects a dirty working tree" "working tree is not clean" -- \
  run_guard "$dirty_root" "$clean_ledger" preflight

mismatch_root="$work_dir/mismatch-repo"
make_repo "$mismatch_root" "1.9.3" "1.9.2" "93"
expect_exit 1 "preflight rejects a version mismatch" "bump them together" -- \
  run_guard "$mismatch_root" "$clean_ledger" preflight

stale_root="$work_dir/stale-repo"
make_repo "$stale_root" "1.9.4" "1.9.4" "94"
sleep 1
printf 'export const c = 3;\n' >"$stale_root/src/app.ts"
git -C "$stale_root" add -A
git -C "$stale_root" -c user.email=t@example.com -c user.name=Test commit -qm "newer source"
expect_exit 1 "preflight rejects a stale packaged WebView" "run npm run build" -- \
  run_guard "$stale_root" "$clean_ledger" preflight

reused_root="$work_dir/reused-repo"
make_repo "$reused_root" "1.9.0" "1.9.0" "90"
expect_exit 1 "preflight rejects building a recorded code from another commit" "bump the version" -- \
  run_guard "$reused_root" "$clean_ledger" preflight

printf '\n%d passed, %d failed\n' "$passed" "$failed"
[[ "$failed" -eq 0 ]]
