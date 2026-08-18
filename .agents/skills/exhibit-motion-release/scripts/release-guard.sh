#!/usr/bin/env bash
set -euo pipefail

# One versionCode carries exactly one binary. This script is the mechanical
# enforcement of that rule, plus the pre-build conditions that make a build
# traceable back to a pushed commit.
#
# Commands:
#   preflight            Conditions that must hold before assembleRelease.
#   check <apk>          The APK is recorded in the ledger and not withdrawn.
#   record <apk>         Append or confirm this APK's ledger entry.
#   lint                 Ledger self-consistency, for CI.
#
# Every path is overridable so the test suite can run against fixtures.

repo_root_default="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
REPO_ROOT="${REPO_ROOT:-$repo_root_default}"
RELEASES_LEDGER="${RELEASES_LEDGER:-$REPO_ROOT/releases.json}"
PKG_JSON="${PKG_JSON:-$REPO_ROOT/package.json}"
BUILD_GRADLE="${BUILD_GRADLE:-$REPO_ROOT/android/app/build.gradle}"
WEB_ASSETS_DIR="${WEB_ASSETS_DIR:-$REPO_ROOT/android/app/src/main/assets/public}"
SRC_DIR="${SRC_DIR:-$REPO_ROOT/src}"
GRADLE_PROPS="${GRADLE_PROPS:-$REPO_ROOT/android/gradle/wrapper/gradle-wrapper.properties}"

die() {
  printf 'BLOCKED: %s\n' "$*" >&2
  exit 1
}

note() {
  printf '%s\n' "$*"
}

usage() {
  cat <<EOF
Usage: $0 preflight
       $0 check <apk>
       $0 record <apk> [--artifact DIR] [--phone SERIAL]
       $0 lint
EOF
}

for command_name in node awk sha256sum git date find; do
  command -v "$command_name" >/dev/null || die "missing host command: $command_name"
done

[[ -f "$RELEASES_LEDGER" ]] || die "release ledger not found: $RELEASES_LEDGER"

source_version_name() {
  node -e 'console.log(require(process.argv[1]).version)' "$PKG_JSON"
}

source_version_code() {
  awk '/^[[:space:]]*versionCode[[:space:]]+[0-9]+/ {print $2; exit}' "$BUILD_GRADLE"
}

gradle_version_name() {
  awk -F'versionName[[:space:]]+' '/^[[:space:]]*versionName[[:space:]]+"/ {print $2; exit}' "$BUILD_GRADLE" |
    tr -d '"' | tr -d '[:space:]'
}

# Reads one entry as shell-safe lines: version, code, commit, sha, withdrawn.
ledger_entry_by_code() {
  node -e '
    const fs = require("fs");
    const ledger = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const code = Number(process.argv[2]);
    const entry = (ledger.releases || []).find(r => Number(r.versionCode) === code);
    if (!entry) process.exit(3);
    process.stdout.write([
      entry.version ?? "",
      entry.versionCode ?? "",
      entry.commit ?? "",
      entry.apkSha256 ?? "",
      entry.withdrawn ?? "",
    ].join("\n"));
  ' "$RELEASES_LEDGER" "$1"
}

ledger_entry_by_sha() {
  node -e '
    const fs = require("fs");
    const ledger = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const sha = String(process.argv[2]).toLowerCase();
    const entry = (ledger.releases || []).find(r =>
      String(r.apkSha256 || "").toLowerCase() === sha ||
      (r.alternateSha256 || []).some(a => String(a).toLowerCase() === sha));
    if (!entry) process.exit(3);
    process.stdout.write([
      entry.version ?? "",
      entry.versionCode ?? "",
      entry.commit ?? "",
      entry.apkSha256 ?? "",
      entry.withdrawn ?? "",
    ].join("\n"));
  ' "$RELEASES_LEDGER" "$1"
}

apk_sha256() {
  sha256sum "$1" | awk '{print $1}'
}

cmd_preflight() {
  local version_name version_code gradle_name entry status
  version_name="$(source_version_name)"
  version_code="$(source_version_code)"
  gradle_name="$(gradle_version_name)"
  [[ -n "$version_name" ]] || die "could not read version from $PKG_JSON"
  [[ "$version_code" =~ ^[0-9]+$ ]] || die "could not read a numeric versionCode from $BUILD_GRADLE"
  [[ "$version_name" == "$gradle_name" ]] || die \
    "package.json is $version_name but build.gradle versionName is $gradle_name; bump them together"

  if [[ -n "$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null)" ]]; then
    die "working tree is not clean; commit the reviewed source before building a release"
  fi

  local head_commit
  head_commit="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "")"

  if entry="$(ledger_entry_by_code "$version_code")"; then
    local recorded_version recorded_commit recorded_sha recorded_withdrawn
    recorded_version="$(sed -n 1p <<<"$entry")"
    recorded_commit="$(sed -n 3p <<<"$entry")"
    recorded_sha="$(sed -n 4p <<<"$entry")"
    recorded_withdrawn="$(sed -n 5p <<<"$entry")"
    [[ "$recorded_version" == "$version_name" ]] || die \
      "versionCode $version_code already belongs to $recorded_version, not $version_name"
    [[ -z "$recorded_withdrawn" ]] || die \
      "versionCode $version_code is withdrawn: $recorded_withdrawn"
    if [[ -n "$recorded_sha" && -n "$recorded_commit" && "$recorded_commit" != "$head_commit" ]]; then
      die "versionCode $version_code is already recorded from commit $recorded_commit; bump the version before building from $head_commit"
    fi
    note "ledger: rebuilding recorded $recorded_version/code$version_code from the same commit"
  else
    note "ledger: $version_name/code$version_code is new"
  fi

  if [[ -d "$WEB_ASSETS_DIR" && -d "$SRC_DIR" ]]; then
    local newest_src newest_assets
    newest_src="$(find "$SRC_DIR" -type f -newer "$WEB_ASSETS_DIR" -print -quit 2>/dev/null || true)"
    if [[ -n "$newest_src" ]]; then
      die "packaged WebView is older than $newest_src; run npm run build && npx cap sync android"
    fi
    newest_assets="$(find "$WEB_ASSETS_DIR" -type f -name '*.js' -print -quit 2>/dev/null || true)"
    [[ -n "$newest_assets" ]] || die "packaged WebView contains no JavaScript bundle: $WEB_ASSETS_DIR"
  fi

  note "PREFLIGHT_PASS $version_name/code$version_code commit=${head_commit:-unknown}"
}

cmd_check() {
  local apk="$1" sha entry version code withdrawn
  [[ -f "$apk" ]] || die "APK not found: $apk"
  sha="$(apk_sha256 "$apk")"
  if ! entry="$(ledger_entry_by_sha "$sha")"; then
    die "APK $sha is not recorded in $RELEASES_LEDGER; record it before it reaches a phone"
  fi
  version="$(sed -n 1p <<<"$entry")"
  code="$(sed -n 2p <<<"$entry")"
  withdrawn="$(sed -n 5p <<<"$entry")"
  [[ -z "$withdrawn" ]] || die "$version/code$code is withdrawn: $withdrawn"
  note "LEDGER_OK $version/code$code $sha"
}

cmd_record() {
  local apk="$1"
  shift
  local artifact="" phone=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --artifact)
        [[ $# -ge 2 ]] || { usage >&2; exit 64; }
        artifact="$2"
        shift 2
        ;;
      --phone)
        [[ $# -ge 2 ]] || { usage >&2; exit 64; }
        phone="$2"
        shift 2
        ;;
      *)
        usage >&2
        exit 64
        ;;
    esac
  done

  [[ -f "$apk" ]] || die "APK not found: $apk"
  local sha version_name version_code head_commit jdk node_version gradle_version
  sha="$(apk_sha256 "$apk")"
  version_name="$(source_version_name)"
  version_code="$(source_version_code)"
  head_commit="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "")"
  # Toolchain detection is descriptive metadata, never a reason to fail a build.
  jdk="$(java -version 2>&1 | awk -F'"' 'NR==1 {print $2}' | awk -F. '{print $1}' || true)"
  node_version="$(node -v | tr -d 'v')"
  gradle_version="$(awk -F'gradle-' '/distributionUrl/ {print $2}' "$GRADLE_PROPS" 2>/dev/null |
    awk -F'-' '{print $1}' || true)"

  node -e '
    const fs = require("fs");
    const [ledgerPath, version, codeRaw, commit, sha, artifact, phone, jdk, nodeVersion, gradleVersion] =
      process.argv.slice(1);
    const code = Number(codeRaw);
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    ledger.releases = ledger.releases || [];
    const existing = ledger.releases.find(r => Number(r.versionCode) === code);

    if (existing) {
      if (existing.version !== version) {
        console.error(`BLOCKED: versionCode ${code} already belongs to ${existing.version}, not ${version}`);
        process.exit(1);
      }
      if (existing.withdrawn) {
        console.error(`BLOCKED: ${version}/code${code} is withdrawn: ${existing.withdrawn}`);
        process.exit(1);
      }
      const known = [existing.apkSha256, ...(existing.alternateSha256 || [])]
        .filter(Boolean).map(s => String(s).toLowerCase());
      if (known.length && !known.includes(sha.toLowerCase())) {
        console.error(`BLOCKED: versionCode ${code} is recorded as ${existing.apkSha256}, this build is ${sha}. ` +
          `One versionCode carries one binary: bump the version instead.`);
        process.exit(1);
      }
      if (!existing.apkSha256) existing.apkSha256 = sha;
      if (artifact) existing.artifact = artifact;
      if (phone && !(existing.phones || []).includes(phone)) {
        existing.phones = [...(existing.phones || []), phone];
      }
      fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
      console.log(`LEDGER_CONFIRMED ${version}/code${code} ${sha}`);
      process.exit(0);
    }

    ledger.releases.unshift({
      version,
      versionCode: code,
      commit: commit || null,
      apkSha256: sha,
      builtAt: new Date().toISOString().slice(0, 10),
      toolchain: { jdk: jdk || null, node: nodeVersion || null, gradle: gradleVersion || null },
      artifact: artifact || null,
      phones: phone ? [phone] : [],
      withdrawn: null,
    });
    ledger.releases.sort((a, b) => Number(b.versionCode) - Number(a.versionCode));
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
    console.log(`LEDGER_RECORDED ${version}/code${code} ${sha}`);
  ' "$RELEASES_LEDGER" "$version_name" "$version_code" "$head_commit" "$sha" "$artifact" "$phone" \
    "$jdk" "$node_version" "$gradle_version"
}

cmd_lint() {
  node -e '
    const fs = require("fs");
    const ledger = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const releases = ledger.releases || [];
    const problems = [];
    if (!releases.length) problems.push("ledger has no releases");

    const codes = new Map();
    const versions = new Map();
    const shas = new Map();
    for (const entry of releases) {
      const code = Number(entry.versionCode);
      if (!Number.isInteger(code)) { problems.push(`entry ${entry.version}: versionCode is not an integer`); continue; }
      if (codes.has(code)) problems.push(`versionCode ${code} appears twice`);
      codes.set(code, entry);
      if (versions.has(entry.version)) problems.push(`version ${entry.version} appears twice`);
      versions.set(entry.version, entry);
      for (const sha of [entry.apkSha256, ...(entry.alternateSha256 || [])].filter(Boolean)) {
        const lower = String(sha).toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(lower)) problems.push(`${entry.version}: ${sha} is not a SHA-256`);
        if (shas.has(lower) && shas.get(lower) !== code) {
          problems.push(`SHA ${lower} is claimed by both code ${shas.get(lower)} and code ${code}`);
        }
        shas.set(lower, code);
      }
    }

    const sorted = [...codes.keys()].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = codes.get(sorted[i - 1]);
      const current = codes.get(sorted[i]);
      const compare = String(previous.version).localeCompare(String(current.version), undefined, { numeric: true });
      if (compare > 0) {
        problems.push(`code ${sorted[i]} is ${current.version} but the lower code ${sorted[i - 1]} is ${previous.version}`);
      }
    }

    if (problems.length) {
      for (const problem of problems) console.error(`BLOCKED: ${problem}`);
      process.exit(1);
    }
    console.log(`LEDGER_LINT_OK ${releases.length} releases, highest code ${sorted[sorted.length - 1]}`);
  ' "$RELEASES_LEDGER"
}

case "${1:-}" in
  preflight)
    cmd_preflight
    ;;
  check)
    [[ $# -eq 2 ]] || { usage >&2; exit 64; }
    cmd_check "$2"
    ;;
  record)
    [[ $# -ge 2 ]] || { usage >&2; exit 64; }
    shift
    cmd_record "$@"
    ;;
  lint)
    cmd_lint
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 64
    ;;
esac
