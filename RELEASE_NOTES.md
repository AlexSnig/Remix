# Release notes

## 1.3.22 — The selected lens and detection zone are visibly selected

### Why this release exists

1.3.21 gave the operator three detection-zone presets, but on the museum phone
no preset ever looked chosen. `.native-action` already draws an orange border
and a translucent orange fill on every button in the group, and the selected
state only nudged those same two properties (`border-[#F27D26]` plus
`bg-[#F27D26]/20`). Against the unselected style that difference is invisible in
exhibition light, so the operator cannot tell which zone — or which lens — is
currently stored.

That turns a setting the operator is supposed to verify into guesswork, on the
exact screen 1.3.21 added to widen detection range.

### What changed

- `.native-action-active` fills the selected button with the solid accent colour
  and switches its text to the dark museum background, the same language the
  header language toggle already uses. Selection is now readable at a glance.
- The front/rear lens buttons and the three zone presets use that class instead
  of re-tinting the base style.
- Three component regressions cover the stored zone marking the matching preset,
  a non-default stored zone selecting the centre preset, and a tapped preset
  reaching native `saveSettings` with the exact zone rectangle.

### What did not change

Presentation only. No trigger maths, thresholds, arming gate, route policy,
calibration behaviour or zone geometry is touched; the stored settings and the
native side are identical to 1.3.21. The default zone remains the full frame.

### Versioning

Android `versionCode 27`.

## 1.3.21 — A clamped calibration is visible, and the operator can crop the frame

### Why this release exists

`R8YL41DLHAY` served an exhibition day with a calibrated threshold of exactly
`10.0 %`. That is the hard clamp in `MotionMath.calibratedThreshold`
(`min(10, max(0.5, median + 6 × MAD + 0.5))`), and it is the least sensitive
setting the product allows. It reduces the working range of the exhibit to
roughly 1.5–2 m: several logged triggers sat at `10.4 %`, `10.5 %` and `11.0 %`,
meaning visitors were only caught at the very edge of the zone, and anyone
further away was silently missed.

Nothing in the product said so. Calibration reported a finished state and a
plausible number, and the phone went into service.

The clamp fires when the calibration scene is not quiet. The product already
contains the fix for that — `detectionZone` is honoured by `MotionMath.analyze`
on both the Kotlin and TypeScript sides, persisted, clamped and correctly
treated as invalidating calibration — but no operator could reach it, because
only the browser fallback panel exposed zone presets. The commissioned phones
therefore always analysed the whole frame, ceiling lights and windows included.

Those are the same defect from two sides, so both are fixed together.

### What changed

- Calibration now reports its raw pre-clamp value and whether the clamp fired.
  `MotionMath.calibrate()` returns `CalibrationResult(threshold, rawThreshold,
  clamped)`; `MotionSettings` persists `calibrationClamped` and
  `calibrationRawNoiseFloor`; the native completion message and the operator
  panel both state plainly that the scene was not quiet and must be
  recalibrated. The stored threshold is unchanged — this release adds reporting,
  not new detection behaviour.
- `DetectorStore.saveSettingsFromOperator` clears the new fields wherever it
  already clears `calibratedNoiseFloor`, so a stale warning cannot outlive a
  retune.
- The operator panel exposes three detection-zone presets — full frame, centre,
  and lower area — in the tuning section. Cropping the frame removes the noise
  sources that push the calibration median into the clamp, which is what
  actually limits distance. Changing the zone already invalidates calibration
  and the motion test natively, and the panel now says so before the operator
  taps.

### What did not change

Trigger maths, thresholds, arming gates, the approved-route policy, the
handset-speaker prohibition and explicit CameraX failure are all untouched. The
default detection zone remains the full frame, so an untouched phone behaves
exactly as it did on 1.3.20.

### Still planned

`docs/DETECTOR_IMPROVEMENTS.md` specifies four further items: a read-only aiming
mode so detection range can be measured without a working speaker, a cumulative
trigger counter for the 100-trigger acceptance run, a speaker-side hint when the
phone is provably streaming but the operator hears nothing, and a decision on
lowering the calibration clamp from 10 % to about 5 %.

### Versioning

Android `versionCode 26`. Not yet installed on any phone; each serial needs its
own recalibration and physical acceptance after the update.

## 1.3.20 — Bluetooth pairing confirmation remains outside Lock Task

- Opens Android Bluetooth Settings in its own task after operator maintenance
  exits Lock Task, so Samsung can display its separate pairing-confirmation
  activity instead of rejecting it as a Lock Task policy violation.
- Cancels any pending visible-activity auto-resume before maintenance and
  rechecks both the stored maintenance state and MainActivity window focus
  immediately before entering Lock Task. This prevents a stale resume job from
  relocking the exhibit over Bluetooth Settings.
- Keeps Bluetooth Settings maintenance-only and preserves the permanent Device
  Owner, HOME, Lock Task allowlist, approved-route and handset-speaker safety
  boundaries.
- Versioned as Android `versionCode 25`; it must not be distributed as the
  already-installed 1.3.19/code 24 binary.

### Reproduced incident on 2026-08-13

- On Galaxy A07 `R8YY929PZDA`, Android discovered `ZEALOT-S24` and began SSP
  `Just Works`, but the pairing confirmation activity was denied with
  `Attempted Lock Task Mode violation`. Twelve seconds later bonding returned
  `HCI_ERR_HOST_REJECT_SECURITY`, `hciReason: 14`, leaving zero bonded devices
  and zero A2DP connections. This evidence distinguishes the kiosk/task bug
  from speaker discovery and Exhibit Motion audio routing.

### Verified fix on the same phone

- The signed 1.3.20/code 25 APK was installed on `R8YY929PZDA` with the guarded
  commissioned-update lane and one reboot. Its installed `base.apk` is
  byte-identical to the release artifact.
- Bluetooth Settings then opened as a separate standard task with
  `FLAG_ACTIVITY_NEW_TASK` while Lock Task remained `NONE`; Android no longer
  logged a Lock Task violation for the pairing confirmation.
- `ZEALOT-S24` became bonded and active for A2DP. Exhibit Motion started its
  `USAGE_MEDIA` route test on the Bluetooth output and the native panel stored
  the route as verified. Human audibility remains a separately reported fact.

### Fleet rollout on 2026-08-14 and 2026-08-15

- `R8YL41DLGLR` was still on 1.3.17/code 22 and showed the 1.3.17 lockout in the
  field: with a PIN configured and auto-start readiness incomplete, the panel
  hid **«Відкрити операторський режим»** while native Bluetooth Settings
  required maintenance mode, so the operator could not reach the screen needed
  to pair another speaker. The guarded update to 1.3.20/code 25 restored the
  action; `firstInstallTime` was preserved and the installed `base.apk` matched
  the release artifact.
- `R8YL41DLHAY` was still on 1.3.19/code 24 and was found with Bluetooth
  Settings top-resumed while Lock Task was `LOCKED` — the exact 1.3.19 defect
  condition. It was updated to 1.3.20/code 25 the same way, keeping its data,
  PIN, `SPB-010` bond and in-app event history.
- All three museum phones now run one binary, SHA-256
  `d8ad4e49c67d69b122f8df7a196f078634814d7baa3ede7558b7772e44ebed49`.
- A speaker that pairs and connects but stays silent is not covered by this
  release. On `R8YL41DLGLR` with `HOCO BS47`, the phone was proven to stream
  (`mIsPlaying: true`, SBC negotiated, A2DP thread out of standby, absolute
  volume at maximum), which locates such faults in the speaker.
  `docs/DEVICE_OWNER_KIOSK.md` carries the decision procedure.

## 1.3.19 — Any media-capable Bluetooth speaker can replace the approved route

- Allows an operator in maintenance mode to connect and test any successfully
  paired A2DP or BLE media speaker, even when a different Bluetooth name was
  approved previously.
- Makes audible confirmation replace the stored Bluetooth name and transient
  Android device ID, so changing speaker no longer requires clearing app data.
- Keeps unattended kiosk playback fail-closed: outside operator maintenance,
  the detector still accepts only the last speaker a person heard and approved.
- Continues to reject SCO/call-only devices, the phone speaker, keyboards,
  watches, and other Bluetooth devices that cannot carry media narration.
- Versioned as Android `versionCode 24`; it must not be distributed as the
  already-installed 1.3.18/code 23 binary.

### Target-phone validation on 2026-08-13

- On Galaxy A07 `R8YL41DLHAY`, the exact signed APK matched the handoff
  artifact and `SPB-010` was stored only after a person heard the route test;
  Android reported it bonded, active and selected as the A2DP media output.
- The operator completed the six native checks with the currently selected
  `Роман Шухевич.mp3` narration. A cold reboot then restored persistent HOME,
  Lock Task, the foreground detector under `action.AUTO_START`, CameraX camera
  id 1, the partial Wake Lock and the approved A2DP route.
- Three post-boot playback cycles reached playback end and automatic cooldown
  re-arm. A short display-off check retained CameraX and the Wake Lock in
  `Dozing`; a separately witnessed screen-off trigger, route-loss matrix and
  the full eight-hour/five-power-cycle burn-in remain open.

## 1.3.18 — Operator access during initial Bluetooth setup

- Keeps the PIN-gated «Відкрити операторський режим» action available on a
  commissioned Device Owner phone even before auto-start readiness is complete.
- Breaks the initial-setup deadlock where system Lock Task was already active,
  Bluetooth Settings required operator maintenance, but the maintenance action
  was hidden until route, calibration, and motion checks had all passed.
- Preserves the fail-closed readiness gate: incomplete physical checks still
  prevent detector auto-start, and Bluetooth pairing still requires the local
  operator PIN.
- Versioned as Android `versionCode 23`; it must not be distributed as the
  already-installed 1.3.17/code 22 binary.

## 1.3.17 — Traceable build for the next museum phone

- Preserves the reviewed 1.3.16 behavior while assigning a new Android
  `versionCode` to the freshly rebuilt signed APK for the next museum phone.
- Prevents the new binary from being distributed under the already-used
  1.3.16/code 21 identity; no camera, audio, kiosk, or operator behavior changes
  are introduced by this version-only release.
- Requires separate Android 16 / API 36 runtime and physical acceptance on the
  new Galaxy A07 serial before exhibition-readiness can be claimed.

## 1.3.16 — Bluetooth narration uses the media endpoint

- Rejects Bluetooth SCO/call endpoints for museum narration and selects only
  A2DP or BLE media outputs.
- Fixes Samsung speakers such as `S207U`, which Android exposes simultaneously
  as SCO and A2DP under the same product name; the old resolver could pin
  ExoPlayer to SCO and produce silence plus BTCVSD/AudioTrack errors.
- Logs the exact output ID, Android device type, and name selected for playback
  so target-phone routing can be audited without treating logs as proof that a
  person heard the speaker.
- Versioned as Android `versionCode 21`.

## 1.3.15 — Catalog selector included in the Android WebView

- Rebuilds and synchronizes the Capacitor WebView bundle before packaging the
  APK, so the operator panel exposes all bundled figure-audio files instead of
  showing only the manual import action.
- Adds a release audit that rejects an APK when the native audio catalog is
  present but the packaged WebView bundle is stale and lacks the catalog API.
- Versioned as Android `versionCode 20` because the installed 1.3.14 binary did
  not include the selector UI even though its APK contained the audio files.

## 1.3.14 — Bundled figure audio catalog

- Packages every audio file from the repository `audio/` folder into the APK,
  so each commissioned phone receives the same offline catalog.
- Adds an operator catalog selector; choosing a figure copies only the selected
  narration into private app storage and keeps it as the active detector audio.
- Keeps manual audio import available for commissioning overrides.
- Versioned as Android `versionCode 19`; release and physical-phone gates still
  require the signed APK and exact-device acceptance.

## 1.3.7 — Kiosk return is independent from detector commissioning

- Allows a valid operator PIN to close maintenance and restore Android Lock
  Task even when calibration, route verification, or the motion test is still
  incomplete.
- Keeps those detector-readiness blockers visible and continues to prevent
  unattended camera auto-start until they are resolved. They no longer trap
  the operator outside kiosk or make “Restore kiosk” appear broken.

## 1.3.6 — Detector recovery after an in-place APK update

- Restarts the detector after Android replaces the APK while kiosk auto-start
  is enabled. Package replacement kills the old foreground service without
  changing the boot counter, so the earlier one-start-per-boot guard could
  leave the camera stopped until the next reboot or a manual arm.
- Keeps the duplicate-start guard when the foreground service is already
  alive. Ordinary Activity resumes do not restart CameraX.

## 1.3.5 — Reliable operator return to kiosk

- Shows progress directly on the “Restore kiosk” button and reports success
  beside the kiosk controls instead of leaving the operator to infer whether
  Android accepted the action.
- Shows an incorrect-PIN or Lock Task failure beside the button. Previously
  kiosk errors appeared only at the top of the long setup page and were easy to
  miss.
- Reads the Android kiosk state back after the action and only reports success
  when Lock Task is active and maintenance mode is closed.
- Recovers the UI if Samsung enters Lock Task but the original Capacitor call
  does not resolve during the Activity transition.

## 1.3.4 — Robust calibration for near and far movement

- Replaces the calibration 95th percentile with a median/MAD background-noise
  estimate. A person briefly crossing the front camera during the ten-second
  calibration can no longer raise the motion threshold to the maximum and make
  distant visitors effectively invisible.
- Keeps six median absolute deviations plus a 0.5 percentage-point safety
  margin above the measured stationary background. This retains headroom for
  exposure and sensor noise without learning real visitor movement as noise.
- Aligns the maximum calibrated and stored threshold with the operator control
  at 10%. Existing values above 10% are safely clamped when loaded and replaced
  by the next calibration.
- Applies the same formula and bounds in the native Android detector and the
  browser fallback, with regression tests for movement outliers, elevated
  background noise, and the upper bound.

## 1.3.3 — Background detector controls and physical output volume

- Prevents a calibration command from interrupting an active detector. The
  native plugin rejects the action, the service has a second defensive guard,
  and the operator button is disabled while the detector is starting, armed,
  playing, cooling down, or recovering.
- States explicitly that calibration does not arm the detector. After an idle
  calibration the operator must complete the motion test or deliberately arm
  it; commissioning can no longer leave a silent ambiguity.
- Limits WebView status telemetry to two updates per second and updates the
  foreground notification only when its visible content changes. Camera
  analysis still runs at up to 10 frames per second and triggers immediately.
- Logs one classified motion sample per second as `below_threshold`,
  `candidate`, or `global_change`, including the saved threshold and ceiling.
  This provides near/far evidence without exposing raw camera frames.
- Applies the configured volume to Android's media stream as well as ExoPlayer,
  and reports a short operator error if the system rejects the change.
- Keeps a route test playing until the operator explicitly selects “Чую звук”
  or “Не чую”; reaching the end of the narration is not evidence that a
  speaker was audible.
- Adds a maintenance-only path to Android's trusted Bluetooth settings. The app
  still never scans, silently pairs, or approves an arbitrary speaker.
- Ignores duplicate arm commands while the detector is already running and
  makes cooldown/re-arm behavior explicit in the operator panel and Logcat.

## 1.3.2 — Reliable audio import, camera selection, and recovery

- Rejects corrupt or mislabeled audio before it replaces the last working file.
- Keeps the sound-route test independent from camera permission.
- Explains that playback remains disabled until AUX or the approved Bluetooth
  speaker is connected.
- Preserves unsaved detector tuning during native status refreshes, saves camera
  selection immediately, and applies pending tuning before calibration.
- Clears a stuck calibration action when CameraX reports a fault.
- Retries unattended CameraX recovery indefinitely with capped exponential
  backoff and prevents overlapping retry jobs.
- Keeps detailed playback and CameraX exceptions in Logcat while showing the
  operator a short recovery message.

## 1.3.1 — The kiosk can actually be configured on a provisioned phone

Driven by commissioning the target Galaxy A07, where the operator panel turned
out to offer no way at all to finish the kiosk setup.

### Fixed: the configure button was hidden exactly when it was needed

«Налаштувати Home і Lock Task» rendered only when the app was *not* already the
Home app. But `dpm set-device-owner` makes the exhibit the Home app immediately,
while leaving Lock Task unconfigured — `onProfileProvisioningComplete` only
fires in the managed-provisioning flow, never over ADB. So on a freshly
provisioned phone the button was hidden, and the «Увімкнути kiosk і автозапуск»
button below it stays disabled until Lock Task exists, which is what the hidden
button would have configured. Both routes out were closed at once and the only
recovery was an ADB command an installer in the field would not have.

The button now appears whenever *either* half of the policy is missing —
Home app or Lock Task. Re-running it is harmless.

### Factory reset protection is now readable

`factoryResetProtection` was collected by diagnostics but only reachable through
«Експорт JSON», which opens a share sheet — and a phone already in Lock Task
cannot launch another app to receive it. The value was effectively unreadable on
exactly the devices it describes. It is now shown directly in the diagnostics
list, verbatim, so a technician can tell `unsupported_by_manufacturer` apart
from a value that is merely not knowable yet.

## 1.3.0 — Operator-confirmed sound test and Bluetooth auto-recovery

Driven by the physical acceptance test on the target Galaxy A07.

### Route test is confirmed by the operator, not by the file ending

Previously the sound test only counted once the narration played to its very
end, so a four-minute recording had to be listened to in full and any early
stop discarded the test. The service now plays the audio and waits for the
operator to answer:

- **"Чую звук"** approves the route. Enabled only after three seconds of
  playback, enforced in the service (`MIN_ROUTE_TEST_MS`) as well as the UI,
  so nobody can approve before sound could reach the speaker.
- **"Не чую"** cancels and clears any stored approval, so a failed test can
  never leave an earlier one standing.
- A file that ends on its own still approves the route, as before.

Only a person can confirm that the approved speaker is audible; a timer would
have passed a muted speaker or a broken cable.

### A swapped cable no longer keeps its tick during commissioning

A 3.5 mm output has no identity on Android — every wired speaker reports the
same generic device — so an AUX approval can only ever mean "some wired
output". That is deliberate, because a commissioned exhibit has to arm itself
after a power cut with nobody present. It did mean the tick survived swapping
the cable. While the operator panel is on screen the app now watches audio
devices and withdraws the route approval when the output disappears, so the
operator hears the new speaker before arming. The motion test is kept: moving
a cable does not disprove that motion triggers playback. Unattended boot
resume is unaffected, since nothing is unplugged there.

### Bluetooth exhibits recover on their own after a power cut

Auto-start now switches the Bluetooth radio back on when the approved route is
a speaker, and waits up to 30 seconds for that exact speaker to reconnect
before reporting it missing. `BLUETOOTH_CONNECT` is declared and granted
automatically during Device Owner commissioning; from Android 13 only a Device
Owner may enable the radio, which the exhibit is.

The approved speaker is still matched by name, so any speaker may be chosen
during commissioning but only the approved one is ever used afterwards. There
is no public API to force an A2DP connection, so this relies on Android's own
reconnect to a bonded device; the app never scans and never pairs.

## 1.2.1 — Fix release-only camera permission crash

Found on 2026-07-22 during the physical acceptance test on the target
Galaxy A07 (`SM-A075F`, Android 15). Tapping "grant camera access" — the
first step of the operator wizard — killed the app immediately.

- R8 stripped the Capacitor annotation types from the minified release
  build, so `PluginHandle.getPluginAnnotation()` returned `null` and the
  first `getPermissionState("camera")` call raised a `NullPointerException`
  on the `CapacitorPlugins` thread. Added keep rules for
  `com.getcapacitor.annotation.**`, for `@CapacitorPlugin`-annotated
  plugins and their reflective members, and for `MotionDetectorPlugin`
  itself.
- Verified by counting the annotation descriptors in the packaged DEX:
  debug had 5 `@CapacitorPlugin` / 6 `@Permission` references, the broken
  release had 0 / 0, and the fixed release has 1 / 2. After the fix the
  wizard grants camera permission with no crash.

This defect existed only in the signed release APK. Unit tests, lint,
Playwright, and the emulator all pass against unminified code, and the
earlier phone check ran a debug build, so nothing but installing the real
release APK on a real phone could have caught it. Treat "the release APK
runs the wizard end to end on the target device" as a required gate.

## 1.2.0 — Native operator surface and release hardening

Released 2026-07-21 (`versionCode` 3). Signed with the same permanent
release key as 1.1.0, so it installs over 1.1.0 as an ordinary update and
keeps settings, imported audio, calibration, and the event log.

- The React UI now detects the Capacitor runtime and hands the whole
  detector workflow to the native `MotionDetector` bridge. The legacy
  browser MediaStream path, the IndexedDB log reader, and the local audio
  selector no longer run inside the APK.
- Added the native operator panel for commissioning, kiosk/boot status,
  and diagnostics, replacing the browser-oriented controls.
- Camera failures now show a short operator-facing message instead of raw
  CameraX internals; the complete exception is written to Logcat under the
  `MotionDetectorService` tag for diagnosis.
- Added `audio_route_lost` and `fault` runtime states so a lost AUX or
  Bluetooth route is reported distinctly from a hard camera fault.
- The service worker is unregistered on the native platform. The APK always
  ships a complete local bundle, and a stale cached bundle could otherwise
  survive an APK update.
- Release builds now run R8 minification and resource shrinking: the signed
  APK is about 4.1 MB, down from about 17.8 MB in 1.1.0.
- Verified that the shipped APK requests no `INTERNET` permission, so the
  installation is provably incapable of network access.

Validation: `lint`, `test:coverage` (13/13), `build`, `test:e2e` (6/6),
Android `testDebugUnitTest` (11/11), `lintDebug` (0 errors), `assembleDebug`,
and `assembleRelease` all pass. The physical target-phone acceptance test in
`docs/DEVICE_OWNER_KIOSK.md` is still required before exhibition use.

## 1.1.0 — Device Owner kiosk foundation

- Added persistent Home / Device Owner / Lock Task support for dedicated
  exhibition phones.
- Added boot resume from visible `MainActivity`, never from a background boot
  receiver.
- Persisted verified audio-route fingerprint, calibration and motion-test
  evidence in native storage.
- Added native-only kiosk/boot status, PIN-protected operator maintenance,
  and boot diagnostics.
- Hardened audio safety: approved AUX or exact approved Bluetooth only; no
  handset speaker fallback after a reboot or route change.

This release requires factory-reset Device Owner provisioning and a physical
target-phone cold-boot acceptance test before it may be called production
ready.
