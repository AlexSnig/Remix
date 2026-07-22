# Device Owner kiosk commissioning

This document is for a final exhibit phone, not the daily development phone.
The application is fully offline at runtime; provisioning is the only
privileged installation step.

Everything below the "Verified sequence" heading was executed and confirmed
against a Galaxy A07 (`SM-A075F`, Android 15 / API 35) on 2026-07-22. Where a
step failed on that device, the failure and its workaround are recorded rather
than smoothed over — the same trap will appear on the next phone.

## Non-negotiable prerequisites

- A dedicated phone, factory-reset, with **no Google account, work profile or
  secondary user**. `dpm set-device-owner` refuses to run otherwise:
  `IllegalStateException: Not allowed to set the device owner because there are
  already some accounts on the device`. ADB cannot remove accounts — a person
  must do it in Settings.
- Remove the Google account **before** any factory reset, or Factory Reset
  Protection will demand its password afterwards.
- Install a release APK signed by the same permanent release key for every
  future update. Never change the package name `ua.alexsnig.exhibitmotion` or
  the class `ua.alexsnig.exhibitmotion.kiosk.ExhibitDeviceAdminReceiver` on a
  commissioned device — Android ties Device Owner identity to that component
  and signing certificate.
- Leave the phone **without PIN, pattern or password**. An app cannot bypass a
  secure lock screen, so a credential means the exhibit will not arm after a
  power cut without a human touch. It also causes the ADB problem in the next
  section.
- Connect the intended AUX cable or approved Bluetooth speaker before the
  sound-route test. The phone speaker is never an allowed fallback.

## Before you start: ADB on Samsung drops when the screen locks

Symptom: `adb devices` goes empty and `adb logcat` hangs, while `lsusb` still
shows the phone with a live `ADB Interface`. The cause is Samsung's lock-screen
USB blocking, visible in logcat as:

```text
I/UsbPortManager: USB HAL HIDL version: 13
I/android.hardware.usb@1.3-service: Userspace turn off USB data signaling
```

A swipe-only keyguard is enough to trigger it. This is not our app — the
codebase never calls `setUsbDataSignalingEnabled`.

Mitigations, in order of preference:

```bash
adb shell svc power stayon usb     # screen stays on while USB-powered
```

Or Developer options → Stay awake, or Settings → Security and privacy →
Auto Blocker → off. The durable fix is finishing commissioning:
`applyDeviceOwnerPolicies` calls `setKeyguardDisabled(true)` when the device is
not secure, which removes the keyguard and the trigger with it.

Two false trails to avoid: restarting the adb server appears to fix it, but
only because the screen happened to be on; and USB debugging is not actually
being turned off. Separately, after a reboot the host adb server may not
re-detect the phone until `adb kill-server && adb start-server`.

## Verified sequence

### 1. Install and provision

```bash
adb install -r app-release.apk
adb shell dumpsys account | grep -i "Accounts:"      # must be 0
adb shell pm list users                              # must be user 0 only
adb shell dpm set-device-owner \
  ua.alexsnig.exhibitmotion/.kiosk.ExhibitDeviceAdminReceiver
```

`device_provisioned=1` and `user_setup_complete=1` do **not** block this. The
ADB path only rejects extra users or accounts.

Verify:

```bash
adb shell dumpsys device_policy | grep "Device Owner Type"   # expect: 0
```

After this the app is a protected package and `am force-stop` on it is ignored.

### 2. Break the configuration deadlock — do this before opening the panel

`dpm set-device-owner` over ADB does **not** run `applyDeviceOwnerPolicies`.
`ExhibitDeviceAdminReceiver.onProfileProvisioningComplete` only fires in the
managed-provisioning flow. So Lock Task is still unset, and on this phone the
panel cannot set it, because all three entry points close at once:

| Entry point | Why it is unreachable |
| --- | --- |
| «Налаштувати Home і Lock Task» | renders only when `isDeviceOwner && !isDefaultHomeApp`, but provisioning already made the exhibit the Home app |
| «Увімкнути kiosk і автозапуск» | `disabled` on `!autoStartReady`, and `autoStartReady` requires the Lock Task this button would configure |
| «Повернути kiosk» | renders only in maintenance mode, which is reachable only once autostart is enabled |

Workaround — hand HOME back to the stock launcher so the first button appears:

```bash
adb shell cmd package query-activities \
  -a android.intent.action.MAIN -c android.intent.category.HOME
adb shell cmd package set-home-activity \
  com.sec.android.app.launcher/.activities.LauncherActivity
```

The «Home app» indicator in the panel turns amber; the
**«Налаштувати Home і Lock Task»** button now appears directly beneath the four
indicators. It needs no PIN. Pressing it runs `applyDeviceOwnerPolicies`, which
restores HOME to the exhibit itself via `addPersistentPreferredActivity`.

> This is a defect, not a designed step. Fix the render condition to key off
> `!isLockTaskAllowed` instead of `!isDefaultHomeApp` and this whole section
> disappears. An installer without ADB currently cannot recover.

Verify — **note the field name**:

```bash
adb shell dumpsys device_policy | grep -i ocktask
# expect: LockTaskPolicy {mPackages= ua.alexsnig.exhibitmotion; mFlags= 0 }
```

Android 15 does not print `mLockTaskPackages`. Grepping for that name returns
empty even when the policy is correctly set — do not read that as failure.

A second confirmation that the method ran to completion, since the permission
grants sit at its end:

```bash
adb shell dumpsys package ua.alexsnig.exhibitmotion | \
  grep -E "android.permission.(CAMERA|POST_NOTIFICATIONS|BLUETOOTH_CONNECT): granted"
# expect granted=true with POLICY_FIXED on all three
```

### 3. Block OS updates

An unattended One UI upgrade reboots the exhibit and can break it.

```bash
adb shell pm disable-user --user 0 com.wssyncmldm
adb shell pm disable-user --user 0 com.samsung.android.app.updatecenter
adb shell pm disable-user --user 0 com.sec.android.soagent
adb shell settings put global ota_disable_automatic_update 1
adb shell pm list packages -d | grep -E "wssyncmldm|updatecenter|soagent"
```

Reversible with `pm enable`. **This does not survive a factory reset** and is
not a managed-device guarantee. The durable fix is a Device Owner
`SystemUpdatePolicy`, which is not implemented in the app yet.

### 4. Operator wizard

1. Open the app. Complete every step: camera permission, local audio import,
   route test, volume, calibration, and a real motion/playback test.
2. Create the 4–12 digit operator PIN in **Kiosk і автозапуск** if it does not
   exist. Note that an unset PIN is reported as «невірний PIN», not as
   "not configured" — if every PIN is rejected on a fresh install, that is why.
   Five wrong attempts trigger a 30-second lockout.
3. Import the exhibition audio. Push it first if convenient:
   `adb push narration.mp3 /sdcard/Download/`, then import through the wizard —
   the file only counts once it is copied into app-private storage.
4. When all six checks are green, enter the PIN and tap
   **«Увімкнути kiosk і автозапуск»**. If the button stays greyed out, the
   amber blocker list directly above it names the reason verbatim.

### 5. Verify the kiosk before rebooting

```bash
adb shell dumpsys activity activities | grep -E "topResumedActivity|mLockTaskModeState"
adb shell dumpsys activity services ua.alexsnig.exhibitmotion | grep isForeground
```

Expect `MainActivity` on top, `mLockTaskModeState=LOCKED`, `isForeground=true`.

### 6. Cold-boot test

```bash
adb reboot
# then, once the phone re-enumerates:
adb kill-server && adb start-server
adb shell dumpsys activity services ua.alexsnig.exhibitmotion | grep -A1 ServiceRecord
```

A correct resume shows the service started from
`intent={act=ua.alexsnig.exhibitmotion.action.AUTO_START}` — the boot path, not
a manual launch — with `mLockTaskModeState=LOCKED` and the wake lock held:

```bash
adb shell dumpsys power | grep motion-detector
# PARTIAL_WAKE_LOCK 'ua.alexsnig.exhibitmotion:motion-detector' ... LONG
```

Check the camera actually attached:

```bash
adb shell dumpsys media.camera | grep -A3 "Active Camera Clients"
```

Observed on the A07: a boot-time contention where our client was EVICTed and a
reconnect was DENIED with `Too many cameras already open`, before the next
attempt succeeded about a second later. The likely conflicting client is the
Samsung camera app. It self-recovered, but watch `cameraRestarts` in
diagnostics across boots.

## What a reboot does

```text
Power on
  -> Android opens the persistent Exhibit Motion Home activity
  -> visible MainActivity enters Lock Task
  -> native coordinator claims this boot once
  -> service checks camera, audio, calibration, motion test and route
  -> arm only when all checks match
```

The boot receiver does not start the camera service by itself. If AUX or
Bluetooth is missing or changed, the service reports `audio_route_lost` or
waits for a route, and never falls back to the handset speaker.

## Maintenance after commissioning

Enter the PIN, choose **«Відкрити операторський режим»**, make changes,
complete any invalidated checks, then choose **«Повернути kiosk»**. Updates
installed with `adb install -r` under the same signing key preserve Device
Owner. Undoing Device Owner requires a factory reset.

## Known limits to state plainly at handover

- **Factory reset protection** is reported by diagnostics as
  `factoryResetProtection`, but only through **«Експорт JSON»** — the field is
  not shown in the diagnostics list. `unsupported_by_manufacturer` means a
  stolen exhibit can be wiped and resold. Physical mounting is the primary
  control either way.
- **The event log keeps only the last 20 entries**
  (`MotionDetectorService.MAX_EVENTS = 20`, pruned on every trigger), so a
  long acceptance run cannot be evidenced from the in-app log.
- **Device Owner hardening is available but not built**:
  `DISALLOW_FACTORY_RESET`, `DISALLOW_SAFE_BOOT`, `DISALLOW_ADD_USER`,
  `setStatusBarDisabled`. `DISALLOW_DEBUGGING_FEATURES` must come last — it
  cuts ADB access.

## Physical release acceptance gate

On the commissioned phone, record the result of at least five full power-off /
power-on cycles with charging connected:

1. Valid AUX: Home app appears, Lock Task active, camera frame counter rises,
   a real motion trigger plays through AUX.
2. AUX removed: no speaker fallback; status reports route loss / waiting.
3. Approved Bluetooth: the saved device name is selected and plays.
4. Different Bluetooth device: rejected until a new route test is performed.
5. Operator maintenance: PIN opens maintenance, import and diagnostics work,
   then re-lock and reboot successfully.

Also capture `dumpsys device_policy`, service notifications, camera frames,
heat, charging behaviour and the diagnostics JSON for the handover.
