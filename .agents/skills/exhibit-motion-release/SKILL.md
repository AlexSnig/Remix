---
name: exhibit-motion-release
description: Build, verify, install, commission, and hand off signed Exhibit Motion Android releases for museum phones. Use when preparing or auditing a release APK, updating the Galaxy A07, diagnosing CameraX or approved-route playback, validating Device Owner and Lock Task boot resume, assembling a client package, or deciding whether a build is ready for exhibition use.
---

# Exhibit Motion Release

Treat the signed Capacitor Android APK on the commissioned museum phone as the
product. Treat the browser build and emulator as regression surfaces.

## Start from current truth

1. Read `AGENTS.md`.
2. Read `docs/DOCUMENTATION_INDEX.md`.
3. Read `docs/PROJECT_STATE.md`.
4. Read `docs/RELEASE_AND_HANDOFF.md`.
5. Read `docs/DEVICE_OWNER_KIOSK.md` before provisioning or changing kiosk
   policy.
6. Inspect `git status --short --branch` and preserve unrelated user changes.

Do not use deleted historical notes or old APK filenames as current evidence.

## Classify the task

- For source changes, bump `package.json` and Android `versionCode` /
  `versionName` together before a build reaches a device.
- For a fresh phone, prove one owner user, zero accounts, no existing Device
  Owner, and no conflicting museum package before installing or provisioning.
- For a release audit, run every automated gate and verify the exact signed APK.
- For an existing commissioned phone, inspect model, installed version, Device
  Owner, Lock Task, permissions, audio route, and service state before writing.
- For client handoff, keep signing secrets outside Git and distinguish a release
  candidate from hardware acceptance and burn-in.
- For camera or audio incidents, reproduce on the target phone when available;
  keep operator messages short and put technical detail in Logcat.

## Execute the release gate

Run the repository checks from `docs/RELEASE_AND_HANDOFF.md`. Build Android with
JDK 21. Require terminal `BUILD SUCCESSFUL`; Gradle progress is not evidence.
Run `npm run build && npx cap sync android` before Gradle whenever the packaged
WebView may have changed.

Before an APK reaches a phone, commit and push the reviewed source without APKs
or secrets, rebuild from that source checkpoint, and record its commit and APK
SHA-256. If a rebuild differs from an already-used binary under the same
`versionCode`, bump both web and Android versions before installation.

Verify the exact APK with:

```bash
.agents/skills/exhibit-motion-release/scripts/verify-release-apk.sh \
  android/app/build/outputs/apk/release/app-release.apk
```

The script checks package identity, signature, certificate, ZIP alignment,
absence of `INTERNET`, and the R8 Capacitor annotation descriptor.

## Execute the phone gate

Use one explicit ADB serial after `adb devices -l` and run phone queries
sequentially. Keep fresh-phone commissioning separate from an in-place update:

- Fresh phone: follow `docs/DEVICE_OWNER_KIOSK.md`; provision Device Owner only
  after the user authorizes it and the one-user/zero-account guards pass.
  Factory reset remains a separate destructive approval.
- Commissioned phone: use `adb install -r`; never uninstall or clear data.

For this project the user granted standing authorization to run the guarded
museum-phone lane without repeated questions. When they connect the dedicated
phone and ask for everything/kiosk, use:

```bash
bash .agents/skills/exhibit-motion-release/scripts/commission-museum-phone.sh
```

The script selects the only authorized physical `SM-A075F`, derives the exact
current handoff APK from the source version, verifies the signed artifact,
classifies fresh versus commissioned state, installs with `-r`, compares the
installed `base.apk`, provisions Device Owner when the clean guards pass,
applies native HOME/Lock Task/fixed-permission policies, disables the documented
Samsung OTA entry points, reboots once, and verifies the post-boot system kiosk.
It writes concise evidence under `/tmp`. Use `--preflight-only` for a read-only
audit and explicit `--serial`/`--apk` only when automatic resolution cannot be
unambiguous.

If no authorized physical phone appears, or an explicit serial is not ready,
the script must restart only the host ADB server once and repeat discovery
before returning a blocker. This is the default recovery for Samsung appearing
as USB/MTP or `unauthorized`; it does not modify or reboot the phone. If the
second result remains `unauthorized`, the only manual step is approving the USB
debugging dialog on the unlocked phone.

Do not ask for repeat permission for those scripted actions when every guard
passes. A guard failure is a stop condition, not a reason to improvise. The
standing authority excludes factory reset, account/user/other-owner removal,
uninstall or data clearing, PIN creation/guessing, narration/lens/route choice,
human audibility, and burn-in acceptance.

After installation, pull the installed `base.apk` and compare its SHA-256 with
the verified release artifact. Reboot after the update or completed kiosk
commissioning. Prove boot resume with `action.AUTO_START`, not a manual
`action.START`.

Do not arm when AUX or the approved Bluetooth route is absent. Never approve a
route from ADB: a person must hear the intended speaker. Do not guess or brute
force the operator PIN.

Starting with 1.3.19, operator maintenance may expose any successfully paired
A2DP or BLE media speaker for a new audible route test, even when another
Bluetooth name was approved before. **«Чую звук»** replaces the stored
approval; cancel or silence does not. Outside maintenance the detector remains
pinned to the last audible-approved speaker and must fail closed on a different
route. SCO/call-only devices, watches, keyboards and the handset speaker never
qualify. Android pairing authentication is still owned by the speaker and
system Settings; do not work around `AUTH_FAIL` by clearing app data or
weakening kiosk policy.

On an already commissioned phone, system Lock Task can be active before the
operator wizard is complete. Since 1.3.18 the configured PIN must expose
**«Відкрити операторський режим»** even while auto-start readiness is false;
Bluetooth Settings remains maintenance-only. If Bluetooth reports that
operator mode is required but the PIN-gated maintenance action is absent,
classify it as a release/UI regression rather than a pairing failure. Never
work around it by removing Device Owner or clearing app data.

Current lens choice is a physical-installation decision. Follow
`docs/PROJECT_STATE.md`; do not switch front/rear camera without confirming how
the phone is mounted, then recalibrate after any change.

## Record evidence

Use the schema in `references/acceptance-evidence.md`. Update
`docs/PROJECT_STATE.md` in the same change whenever the release, target-phone
state, or remaining gates change. Update `RELEASE_NOTES.md` for shipped
behavior.

State separately:

- source and automated gates;
- signed artifact checks;
- emulator runtime evidence;
- real-phone camera, audio, kiosk, and boot evidence;
- remaining motion, route-loss, cold-boot, and soak gates.

Never turn compilation, Playwright, emulator success, or a partial phone check
into a production-readiness claim.

## Publish only when requested

Before committing, review the exact diff, run `git diff --check`, verify no key,
password, `keystore.properties`, APK, or temporary report is staged, and keep
the master narration only at its documented repository path.

Push the current branch only after checks pass. Never force-push or rewrite tags
unless the user explicitly authorizes that exact history change.
