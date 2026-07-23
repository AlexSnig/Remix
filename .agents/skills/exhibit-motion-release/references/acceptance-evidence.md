# Acceptance evidence

Use this checklist to make release claims auditable. Record the command,
artifact or device, observed result, and remaining blocker.

## Workstation

| Gate | Required evidence |
| --- | --- |
| Source identity | Git commit, clean relevant diff, matching web and Android versions |
| React | `npm run lint`, `npm run test:coverage`, `npm run build` |
| Browser regression | `npm run test:e2e`; note Browser plugin or Playwright fallback |
| Android | native unit tests, `lintDebug`, debug assembly, release assembly |
| Release artifact | APK path, SHA-256, package, version code/name |
| Signature | `apksigner verify --print-certs`, expected certificate SHA-256 |
| R8 | `Lcom/getcapacitor/annotation/CapacitorPlugin;` present in packaged DEX |
| Offline | no `android.permission.INTERNET` in the exact APK |

## Target phone

Resolve the serial first:

```bash
adb devices -l
adb -s SERIAL shell getprop ro.product.model
adb -s SERIAL shell getprop ro.build.version.release
```

Before installation, record:

```bash
adb -s SERIAL shell dumpsys package ua.alexsnig.exhibitmotion \
  | grep -E "versionCode=|versionName=|firstInstallTime|lastUpdateTime"
adb -s SERIAL shell dumpsys device_policy \
  | grep -E "Device Owner|LockTaskPolicy|ua.alexsnig.exhibitmotion"
adb -s SERIAL shell dumpsys activity activities \
  | grep -E "mLockTaskModeState|ResumedActivity"
```

After `adb install -r` and reboot, prove:

- expected version is installed and `firstInstallTime` is unchanged;
- imported audio and calibration were not erased;
- camera, notification, and Bluetooth permissions remain granted;
- Device Owner and Lock Task policy remain;
- Home returns to `MainActivity`;
- the detector starts from `action.AUTO_START` when operator mode is closed and
  the approved route is available;
- the partial wake lock and CameraX client are present while armed.

## Physical acceptance

A person must confirm:

1. the intended front/rear camera matches the mount and sees the visitor zone;
2. a valid local narration imports and a corrupt file is rejected;
3. sound is audible from the intended AUX or approved Bluetooth speaker;
4. unplugging or changing the route never falls back to the handset speaker;
5. calibration completes and frame count rises;
6. real motion triggers exactly one playback and cooldown re-arms;
7. operator PIN opens maintenance and returns kiosk;
8. cold boot restores Home, Lock Task, approved route, service, camera, and
   screen-off detection;
9. repeated triggers, charging, heat, permission loss, route loss, and camera
   recovery pass the planned burn-in.

If any physical item is missing, report `RELEASE CANDIDATE` and name the exact
open gate.
