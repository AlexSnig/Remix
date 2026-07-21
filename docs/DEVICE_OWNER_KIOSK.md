# Device Owner kiosk commissioning

This document is for the final exhibit phone, not the daily development
phone. The application remains fully offline at runtime; provisioning is the
only privileged installation step.

## Non-negotiable prerequisites

- Use the final Galaxy A07 (or a dedicated spare), factory-reset and with no
  Google account, work profile, or secondary user.
- Install a release APK signed by the same permanent release key for every
  future update. Never change the package name
  `ua.alexsnig.exhibitmotion` or the class
  `ua.alexsnig.exhibitmotion.kiosk.ExhibitDeviceAdminReceiver` on a
  commissioned device.
- Leave the phone without PIN, pattern, or password if the detector must arm
  without a first touch after a cold boot. An Android app must not bypass a
  secure lock screen.
- Connect the intended AUX cable or approved Bluetooth device before the
  final sound-route test. The phone speaker is not an allowed fallback.

## Development provisioning with ADB

This is only for a fresh test device. It erases/changes device management
state and must not be run on the current development phone without a backup.

```bash
adb install -r app-release.apk
adb shell dpm set-device-owner \
  ua.alexsnig.exhibitmotion/.kiosk.ExhibitDeviceAdminReceiver
adb shell dumpsys device_policy
```

For a deployed installation prefer Android Enterprise QR or zero-touch
provisioning with the signed release APK. The provisioning channel may need
network access only to deliver the APK; the installed exhibit does not.

## Operator sequence

1. Open the application after provisioning. It is now the persistent Home
   app, but it is intentionally not locked into Lock Task yet.
2. Complete the native wizard: camera permission, local audio import, route
   test, volume, calibration, and a real motion/playback test.
3. Create the 4–12 digit operator PIN in **Kiosk і автозапуск**.
4. Confirm that every native readiness item is green, then tap
   **Увімкнути kiosk і автозапуск**. This configures Home, Lock Task and the
   next-boot policy.
5. For later maintenance, enter the PIN, choose **Відкрити операторський
   режим**, make changes, complete any invalidated checks, then choose
   **Повернути kiosk**.

## What a reboot does

```text
Power on
  -> Android opens persistent Exhibit Motion Home activity
  -> visible MainActivity enters Lock Task
  -> native coordinator claims this boot once
  -> service checks camera, audio, calibration, motion test and route
  -> arm only when all checks match
```

The boot receiver does not start the camera service. If AUX/Bluetooth is
missing or changed, the service reports `audio_route_lost` / waiting for a
route and does not play through the handset speaker.

## Physical release acceptance gate

On the commissioned target phone, record the result of at least five full
power-off / power-on cycles with charging connected:

1. Valid AUX: Home app appears, Lock Task is active, camera frame counter
   rises, and a real motion trigger plays through AUX.
2. AUX removed: no camera-triggered speaker fallback; status reports route
   loss/waiting route.
3. Approved Bluetooth: the saved Bluetooth name is selected and plays.
4. Different Bluetooth device: it is rejected until the operator performs a
   new route test.
5. Operator maintenance: PIN opens maintenance, import/diagnostics work,
   then re-lock and reboot successfully.

Also capture `adb shell dumpsys device_policy`, service notifications, camera
frames, heat, charging behaviour and the diagnostics JSON for the handover.
