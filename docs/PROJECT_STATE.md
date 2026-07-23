# Exhibit Motion project state

Last verified: 2026-07-23

## Release

- Current source release: `1.3.2`, Android `versionCode 7`.
- APK source commit: `1e0e26d` (`Harden audio import and camera recovery for
  1.3.2`).
- Package: `ua.alexsnig.exhibitmotion`.
- Release certificate SHA-256:
  `bfd47221742dfdb12763a42f7cafdfdcd74469bd712e9616cb3dfa2501100f7e`
  (RSA 4096).
- Runtime has no `android.permission.INTERNET`.
- `v1.2.0` is defective and must never be installed. Its release-only R8 crash
  is retained in release notes for traceability.

## Automated evidence for 1.3.2

- `npm run lint`: passed.
- `npm run test:coverage`: 13/13 passed; 100% lines, 96.91% statements,
  84.61% branches, 88.37% functions in the selected critical utilities.
- `npm run build`: passed.
- `npm run test:e2e`: 6/6 passed with Playwright.
- Android native unit tests: 15/15 passed.
- `lintDebug`, `assembleDebug`, and signed `assembleRelease`: passed with JDK
  21.
- Exact signed APK: v2 signature valid, expected certificate, ZIP/zipalign
  valid, R8 Capacitor annotation descriptor present, no `INTERNET`.

## Target museum phone

- Samsung Galaxy A07 (`SM-A075F`), Android 15 / API 35.
- Signed 1.3.2 was installed over 1.3.1 with `adb install -r`; app data,
  Device Owner, permissions, Home, and Lock Task policy were preserved.
- Imported narration `+Сходи.MP3` and 100% operator volume were preserved.
- The phone is mounted screen-out toward visitors. The production baseline is
  the **front camera**. It was selected and recalibrated for 10 seconds on
  1.3.2; CameraX opened camera id 1 without crash, `SecurityException`, or
  pipeline failure.
- The approved narration master is `assets/audio/+Сходи.MP3`: 14.08 seconds,
  337,970 bytes, approximately 192 kbps, SHA-256
  `b28f4ca1f08414dfeb609d30e3b30c4124f1215f07830cf5c6d6c2039f476e6e`.
- Operator maintenance mode is currently active.
- No AUX or approved Bluetooth route was connected during the final 1.3.2
  install check. The app correctly blocked playback and did not use the handset
  speaker.

## Open production gates

The current status is **RELEASE CANDIDATE**, not final exhibition acceptance.

1. Connect the real AUX speaker and complete the operator-confirmed route test.
2. Complete the real motion/playback test using `+Сходи.MP3`.
3. Enter the existing operator PIN, return kiosk, and verify that maintenance
   mode is closed.
4. Reboot and prove service intent `action.AUTO_START`, foreground service,
   front-camera frames, wake lock, Lock Task, and screen-off detection.
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
