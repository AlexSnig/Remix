# Release notes

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
