# Release and client handoff

Use this runbook for every Exhibit Motion version that reaches a phone.

## Release states

Keep these states separate:

1. **Source verified** — code, lint, tests, and builds pass.
2. **Signed artifact verified** — the exact release APK passes signature, R8,
   package, offline, ZIP, and checksum checks.
3. **Target phone verified** — the exact APK works with the real camera, audio
   route, kiosk, and cold boot.
4. **Exhibition accepted** — sustained charging, heat, repeated triggers, route
   loss, recovery, and power cycles pass.

Anything below state 3 is a release candidate. A short target-phone check does
not replace the burn-in in state 4.

## 1. Preflight

```bash
git status --short --branch
git diff --check
node --version
java -version
adb devices -l
```

- Preserve unrelated work and untracked user files.
- Use JDK 21.
- Resolve the real ADB serial; never assume `emulator-5554` or the Galaxy is
  present.
- Keep signing credentials outside Git.
- Confirm the intended camera from the physical mount before changing it.

## 2. Version and release notes

Any behavior that reaches a device requires one traceable version:

- update `package.json` and `package-lock.json`;
- update `android/app/build.gradle` `versionCode` and `versionName`;
- update `RELEASE_NOTES.md`;
- update `docs/PROJECT_STATE.md`;
- never ship two binaries under one `versionCode`.

## 3. Automated gates

```bash
npm ci
npm run lint
npm run test:coverage
npm run build
npm run test:e2e
```

Use the Browser plugin when available; otherwise record Playwright as the
fallback.

Run Android from `android/` with JDK 21 and a real SDK path:

```bash
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 \
ANDROID_HOME=/home/alex/Android/Sdk \
ANDROID_SDK_ROOT=/home/alex/Android/Sdk \
./gradlew --no-daemon testDebugUnitTest lintDebug assembleDebug assembleRelease
```

Require `BUILD SUCCESSFUL`, test XML with zero failures, lint output, APK files,
and release metadata. Gradle progress or `UP-TO-DATE` lines are not completion.

## 4. Verify the signed APK

```bash
.agents/skills/exhibit-motion-release/scripts/verify-release-apk.sh \
  android/app/build/outputs/apk/release/app-release.apk
```

The expected certificate is recorded in `docs/PROJECT_STATE.md`. The script
also fails if the APK requests `INTERNET`, is debuggable, has the wrong package,
is misaligned, has a broken signature, or lost the Capacitor annotation through
R8.

Record the APK SHA-256 and source commit in the client verification report.

## 5. Update a commissioned phone

Record state before writing:

```bash
adb devices -l
adb -s SERIAL shell dumpsys package ua.alexsnig.exhibitmotion \
  | grep -E "versionCode=|versionName=|firstInstallTime|lastUpdateTime"
adb -s SERIAL shell dumpsys device_policy \
  | grep -E "Device Owner|LockTaskPolicy|ua.alexsnig.exhibitmotion"
adb -s SERIAL shell dumpsys activity activities \
  | grep -E "mLockTaskModeState|ResumedActivity"
```

Install without deleting data:

```bash
adb -s SERIAL install -r android/app/build/outputs/apk/release/app-release.apk
```

Never uninstall, clear data, remove Device Owner, or factory-reset during an
update. Confirm the new version and unchanged `firstInstallTime`, then reboot:

```bash
adb -s SERIAL reboot
adb -s SERIAL wait-for-device
```

Samsung may return as MTP before ADB. Unlock the screen and accept the existing
USB-debugging trust if necessary; do not mistake that delay for an app crash.

After boot, prove Home, Lock Task, Device Owner, service, and camera:

```bash
adb -s SERIAL shell dumpsys activity activities \
  | grep -E "mLockTaskModeState|ResumedActivity"
adb -s SERIAL shell dumpsys activity services ua.alexsnig.exhibitmotion \
  | grep -A3 MotionDetectorService
adb -s SERIAL shell dumpsys power | grep motion-detector
adb -s SERIAL shell dumpsys media.camera | grep -A4 "Active Camera Clients"
```

The service must start from `ua.alexsnig.exhibitmotion.action.AUTO_START`.
`action.START` proves only manual arming.

## 6. Physical operator acceptance

Follow the six native checks in order:

1. camera permission;
2. approved local audio import;
3. audible AUX or named Bluetooth route test;
4. volume;
5. 10-second calibration on the lens matching the physical mount;
6. real motion/playback test.

Then close operator maintenance with the existing PIN, enable kiosk/autostart,
reboot, and repeat a motion trigger with the screen off.

Safety invariants:

- only the intended AUX or approved Bluetooth speaker may play;
- route loss must block playback and never use the handset speaker;
- a corrupt or mislabeled audio file must not replace the last working file;
- camera failure must be visible and must never fall back to a simulated feed;
- detailed exceptions go to Logcat, not the operator screen.

## 7. Burn-in

Before exhibition acceptance, run at least eight hours with:

- the final charger and physical mount;
- heat observation;
- at least 100 triggers;
- at least five complete power-off/power-on cycles;
- AUX disconnect and return;
- app switching and kiosk return;
- camera permission loss and recovery;
- camera contention/recovery;
- confirmation that the handset speaker never plays.

The in-app log keeps only 20 events, so keep an external test tally.

## 8. Client package

Assemble outside Git:

- signed APK named with version and version code;
- installation instructions;
- staff PDF;
- Device Owner/kiosk runbook;
- release notes;
- verification report with completed and open gates;
- SHA-256 manifest.

Signing-key material must be in a separate restricted subfolder or a separate
secure delivery. Never place a key, password, `keystore.properties`, APK, or
client package in Git.

## 9. Retention and cleanup

Keep:

- current source and release notes;
- the approved narration master under `assets/audio/`;
- current verification report and checksums;
- the newest accepted client package until its replacement is accepted;
- signing keys in their protected off-repository backup.

Remove:

- intermediate and superseded APKs;
- temporary screenshots, traces, extracted DEX, and logs;
- obsolete handoff directories after the replacement passes checksums;
- stale duplicated state documents after their current facts are migrated.

Never delete the only signing key, approved audio master, or latest accepted
APK. Use Git history or recoverable trash for cleanup when possible.

## 10. Git publication

```bash
git status --short
git diff --check
git diff --cached --stat
git commit -m "..."
git push origin HEAD
```

Inspect the staged file list for secrets and generated artifacts. Pushing the
branch does not authorize force-pushing or rewriting an existing tag.
