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

If a freshly rebuilt APK has a different SHA-256 from a binary already used
under the same `versionCode`, treat it as a new binary and bump both version
boundaries before installation, even when the behavior is intentionally
unchanged.

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
npm run build
npx cap sync android
cd android
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 \
ANDROID_HOME=/home/alex/Android/Sdk \
ANDROID_SDK_ROOT=/home/alex/Android/Sdk \
./gradlew --no-daemon testDebugUnitTest lintDebug assembleDebug assembleRelease
```

Do not run `assembleRelease` against an unsynchronized
`android/app/src/main/assets/public` tree. A successful native Gradle build can
otherwise package a stale operator UI even when the Kotlin implementation and
other APK assets are current.

Require `BUILD SUCCESSFUL`, test XML with zero failures, lint output, APK files,
and release metadata. Gradle progress or `UP-TO-DATE` lines are not completion.

Before the installable APK is built, review and push a source checkpoint with
no APKs, signing material, or secrets. Rebuild from that commit and record both
the source commit and final APK SHA-256. Phone evidence may be recorded in a
follow-up documentation commit after the exact binary is installed.

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

## 6. Commission a fresh phone

Do not reuse the update assumptions for a new phone. Follow
`docs/DEVICE_OWNER_KIOSK.md` and use one explicit serial for every command.

For the normal agent-operated lane, the user has already authorized the
guarded full system commissioning and one required reboot. Run this from the
repository instead of asking for each safe sub-step:

```bash
bash .agents/skills/exhibit-motion-release/scripts/commission-museum-phone.sh
```

It also recognizes an existing Exhibit Motion Device Owner and switches to an
in-place `adb install -r` update. It fails closed on multiple physical phones,
an emulator, a non-`SM-A075F` model, GuideMuseum, extra users/accounts, a secure
lock credential, or another Device Owner. Factory reset and destructive repair
remain outside this standing authorization.

Before installation, prove:

```bash
adb -s SERIAL shell pm list users
adb -s SERIAL shell dumpsys account | grep -m1 "Accounts:"
adb -s SERIAL shell dumpsys device_policy | grep "Device Owner Type"
adb -s SERIAL shell pm list packages | \
  grep -E "ua.alexsnig.exhibitmotion|com.guidemuseum"
```

Continue only with user 0 alone, zero accounts, no Device Owner, and no
conflicting museum package. A factory reset remains a separate destructive
action and needs explicit approval if these guards fail.

Install the exact committed artifact, verify the installed `base.apk` hash,
then provision the permanent admin component:

```bash
adb -s SERIAL install -r android/app/build/outputs/apk/release/app-release.apk
adb -s SERIAL shell dpm set-device-owner \
  ua.alexsnig.exhibitmotion/.kiosk.ExhibitDeviceAdminReceiver
```

Open Exhibit Motion and use **«Налаштувати Home і Lock Task»**. Current 1.3.17
shows this whenever either HOME or Lock Task policy is missing; do not apply the
obsolete stock-launcher workaround from earlier releases. Then verify Device
Owner type `0`, Lock Task policy, permissions, persistent HOME, and disabled OTA
packages before the operator wizard and cold boot.

## 7. Physical operator acceptance

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

## 8. Burn-in

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

## 9. Client package

Assemble outside Git. The default client delivery is exactly four files:

- signed APK named with version and version code;
- current staff PDF;
- current integrator PDF, containing installation, Device Owner/kiosk,
  release identity, verification boundaries, and completed/open gates;
- `SHA256SUMS.txt` for the three payload files.

Do not add source, release notes, QA screenshots, phone backups, build output,
or engineering evidence to the ordinary client folder. If a contract requires
an engineering annex, deliver it separately with an explicit audience and
retention boundary.

Signing-key material must be in a separate restricted location or secure
delivery, never a subfolder that could be copied with the client handoff.
Never place a key, password, `keystore.properties`, APK, or client package in
Git.

## 10. Retention and cleanup

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

## 11. Git publication

```bash
git status --short
git diff --check
git diff --cached --stat
git commit -m "..."
git push origin HEAD
```

Inspect the staged file list for secrets and generated artifacts. Pushing the
branch does not authorize force-pushing or rewriting an existing tag.
