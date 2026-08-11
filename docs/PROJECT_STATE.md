# Exhibit Motion project state

Last verified: 2026-08-11

## Release

- Current release candidate: `1.3.17`, Android `versionCode 22`.
- Candidate source checkpoint: pending the authorized release commit in this
  session. Do not install a pre-commit build.
- Pre-commit validation APK SHA-256 (to be replaced by the committed rebuild):
  `840314d7079b3f0fb3f42b297892643d6d044bf7467fbb244b849e268dc1cfc7`.
- `1.3.17` preserves the reviewed 1.3.16 behavior and uses a new version code
  because the freshly rebuilt signed APK is a different binary from the
  already-used code 21 artifact. It adds no camera, audio, kiosk, or operator
  behavior change.
- `1.3.15` / code 20 is superseded and must not be distributed: on Bluetooth
  devices such as S207U that expose both call audio (SCO) and media audio
  (A2DP), it could select SCO and produce silent or broken narration.
- `1.3.14` / code 19 is superseded and must not be distributed: its APK
  contained the 20 catalog MP3s, but a stale Capacitor WebView bundle omitted
  the catalog selector.
- Package: `ua.alexsnig.exhibitmotion`.
- Release certificate SHA-256:
  `bfd47221742dfdb12763a42f7cafdfdcd74469bd712e9616cb3dfa2501100f7e`
  (RSA 4096).
- Runtime has no `android.permission.INTERNET`.
- `v1.2.0` is defective and must never be installed. Its release-only R8 crash
  is retained in release notes for traceability.

## Automated evidence for 1.3.17

- `npm run lint`: passed.
- `npm run test:coverage`: 17/17 passed; 100% lines, 97.02% statements,
  85.07% branches, 89.13% functions in the selected critical utilities.
- `npm run build`: passed.
- `npx cap sync android`: passed; the packaged Android WebView contains
  `getAudioLibrary` and the Ukrainian catalog selector.
- `npm run test:e2e`: 6/6 passed with Playwright.
- Android native unit tests: 26/26 passed. The four new route-selection tests
  cover same-name SCO/A2DP preference, unverified A2DP selection, SCO-only
  rejection, and fail-closed approved-name matching.
- `lintDebug`, `assembleDebug`, and signed `assembleRelease`: passed with JDK
  21. Lint was run separately from release assembly after a combined Gradle
  invocation exposed a temporary KAPT/Lint file race.
- Exact signed APK: v2 signature valid, expected certificate, ZIP/zipalign
  valid, R8 Capacitor annotation descriptor present, not debuggable, no
  `INTERNET`. The release audit also proved that all 20 repository `audio/`
  files and the current catalog-enabled WebView bundle are packaged.

## Target museum phone

- The next installation target is Samsung Galaxy A07 serial `R8YL41DLGLR`
  (`SM-A075F`), Android 16 / API 36. On 2026-08-11 ADB proved one owner user,
  zero accounts, no Device Owner, Samsung Launcher as HOME, Lock Task `NONE`,
  and neither `ua.alexsnig.exhibitmotion` nor `com.guidemuseum` installed.
- The exact 1.3.17/code 22 APK has not been installed on `R8YL41DLGLR` yet.
  No Device Owner, HOME, OTA, permission, or application state was changed
  during the preparation audit.
- Previous runtime evidence below belongs only to the earlier Samsung Galaxy
  A07 serial `R8YY929R75R` (`SM-A075F`), Android 15 / API 35. It cannot be
  transferred as physical acceptance for the new Android 16 phone.
- Signed 1.3.16 was installed over 1.3.15 with `adb install -r`; unchanged
  `firstInstallTime` proved that app data was not cleared. Device Owner, camera,
  notification and Bluetooth permissions, Home, and Lock Task policy were
  preserved.
- The installed `base.apk` is byte-identical to the verified release APK:
  SHA-256 `fa43fa29db2a3b8cf377a49676c31282eedc6588f28317790799c0c9a385c377`.
- A live route test with AUX removed and S207U connected proved that 1.3.16
  selected Android output id 33, type 8 (`TYPE_BLUETOOTH_A2DP`). AudioFlinger
  selected device mask `0x80` (A2DP); no SCO/BTCVSD playback path or ExoPlayer
  failure appeared. A person beside the speaker must still confirm audibility;
  Android telemetry alone is not physical acceptance.
- After the 1.3.15 reboot, the real operator panel showed the catalog selector. Opening
  and scrolling the native list exposed all 20 bundled MP3 options; no option
  was selected during QA, and the active `+Сходи.MP3` remained unchanged.
- The failed “Повернути kiosk” action was traced to
  `motion_test_missing`: native code incorrectly treated unfinished detector
  commissioning as a reason to reject closing operator maintenance. 1.3.7
  decouples those actions. A valid operator PIN can now restore Lock Task while
  the motion-test blocker remains visible and continues to prevent unattended
  detector auto-start.
- 1.3.7 also reads the Android Lock Task state back after the action, places
  PIN/Lock Task errors beside the button, shows progress and success locally,
  and recovers the UI if the bridge response is delayed during the Activity
  transition.
- The current 1.3.16 operator panel reports `Симон Петлюра.mp3` as the selected
  narration. The configured operator volume was 47%. During a 100% route test,
  the operator reduced Samsung Bluetooth media to 5/15; Exhibit Motion was then
  aligned and saved at 33%, which Android applied as 5/15 to active A2DP. The
  pre-update values were not recorded independently, so their preservation is
  not claimed from the unchanged `firstInstallTime` alone.
- The phone is mounted screen-out toward visitors. The production baseline is
  the **front camera**. CameraX opened camera id 1 without crash,
  `SecurityException`, or pipeline failure.
- A 30-minute 1.3.3 screen-off test passed 60/60 checks with Android in
  `Dozing`, camera id 1 continuously open, the partial wake lock held, and the
  service still foreground under `action.AUTO_START`. The operator UI showed
  19,675 analysed frames after the test. There was no crash, ANR, camera
  recovery, or process restart; battery temperature was 28.0 °C on USB power.
- The active-detector calibration control was visibly disabled on the target
  phone. An ADB tap on the disabled control did not start calibration,
  disconnect camera id 1, or interrupt frame analysis.
- Foreground-notification churn fell from per-frame updates to 16 updates over
  the 30-minute interval. That is more than 1,000 times below the approximately
  18,000 updates the old 10 Hz path would have requested.
- The front camera is fixed-focus: its active request reported `afMode=OFF`,
  `afState=INACTIVE`, available AF modes `[0]`, and minimum focus distance
  `0.0`. Near/far sensitivity is therefore controlled by motion scale,
  exposure and the calibrated threshold, not autofocus.
- The previous `23.7%` threshold was traced to the old calibration's 95th
  percentile: short real movement inside the ten-second window was learned as
  background noise. 1.3.4 now uses a median/MAD estimate and caps calibrated
  values at 10%.
- A new on-device 1.3.4 calibration produced a `1.0%` threshold. The stationary
  scene then remained between `0.00%` and `0.81%` over 90 seconds with no false
  trigger after cooldown.
- The 1.3.4 motion test remained alive with the display off for at least four
  minutes: Android reported `Dozing`, a foreground `action.START` service, the
  partial wake lock continuously held, and camera id 1 open. No crash, ANR,
  stalled-frame warning, or camera-pipeline failure was present.
- The approved narration master is `assets/audio/+Сходи.MP3`: 14.08 seconds,
  337,970 bytes, approximately 192 kbps, SHA-256
  `b28f4ca1f08414dfeb609d30e3b30c4124f1215f07830cf5c6d6c2039f476e6e`.
- A cold 1.3.3 reboot passed after the required first manual unlock. Android
  launched the Home activity, started the detector with `action.AUTO_START`,
  acquired the partial wake lock, and opened front camera id 1. Samsung Camera
  Saver briefly evicted the camera; the detector recovered and reopened id 1
  approximately two seconds later.
- Real post-reboot movement triggered narration twice. The first playback
  finished at 13:57:35 and re-armed after cooldown at 13:57:40; a second
  trigger played and finished at 13:58:58.
- The later 13:59:02 detector stop was not a crash or screen-off failure.
  Android recorded a touch in Exhibit Motion followed by the app's normal
  `STOP_FOREGROUND`; the operator had entered maintenance mode to reach USB
  settings. The settings screen opened only afterward.
- After manually arming 1.3.3 in maintenance mode, a further three-minute
  screen-off test passed 6/6 checks: `Dozing`, foreground service, wake lock,
  and front camera id 1 remained active.
- After the 1.3.16 reboot and required first manual unlock, Android restored
  Exhibit Motion as the resumed Home activity. Version 1.3.16/code 21 and
  Device Owner were intact. Lock Task was `NONE`, and no detector service,
  Wake Lock, or active camera remained because operator maintenance mode was
  still active; no `action.AUTO_START` occurred, so boot resume remains open.
- A later operator-initiated `action.START` opened front camera id 1. Real
  movement reached 25.7% against the stored 2.7% threshold, played the selected
  narration on S207U output id 24/type 8 (A2DP), and reached playback end. This
  proves the manual camera/trigger/media path, not boot resume or human-audible
  output.
- The operator panel now reports the motion test and route test as completed.
  It also contains an unsaved 99% sensitivity draft; the runtime continued to
  use the stored 2.7% threshold. Do not save the draft unless that extreme
  sensitivity change is deliberate.

## Open production gates

The current status is **RELEASE CANDIDATE**, not final exhibition acceptance.

1. Install the exact verified 1.3.17 APK on `R8YL41DLGLR`, provision Device
   Owner and Lock Task only with explicit approval, complete the operator
   wizard locally, then cold-reboot and prove `action.AUTO_START`. Do not
   disclose, guess, or automate the PIN.
2. Record near/far samples at approximately 4–5 m, 2 m, and 0.5–1 m and prove
   that intended visitor movement triggers without treating whole-frame light
   changes as motion.
3. Physically hear the intended selected narration through the final approved
   AUX or Bluetooth speaker, then prove playback end, cooldown, and automatic
   re-arm at least twice with the screen off. Verify that the handset speaker
   remains silent.
4. Commit the exact reviewed 1.3.17 source, rebuild from that commit, verify the
   resulting APK, and update the client package checksum. Do not publish the
   current working-tree candidate as the final handoff.
5. Run the documented 8-hour acceptance test with charging, heat observation,
   at least 100 triggers, route loss/return, permission recovery, and at least
   five full power cycles.

Do not guess or brute-force the operator PIN. A person responsible for the
installation must enter it.

## Storage and release boundaries

- Git contains source, documentation, the release skill, staff manual, and the
  approved narration master.
- Git does not contain signing keys, passwords, `keystore.properties`, APK/AAB
  files, client packages, temporary screenshots, logs, or traces.
- The client package lives outside Git and has its own SHA-256 manifest.
- The obsolete untracked 1.3.0 rollback APK was removed after 1.3.2 was
  installed and verified. Git history and release notes retain provenance.
