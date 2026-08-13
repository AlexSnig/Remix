# Device Owner kiosk commissioning

This document is for a final exhibit phone, not the daily development phone.
The application is fully offline at runtime; provisioning is the only
privileged installation step.

The sequence was first confirmed against Galaxy A07 serial `R8YY929R75R`
(`SM-A075F`, Android 15 / API 35) on 2026-07-22. On 2026-08-11 the fresh-phone
guards also passed on serial `R8YL41DLGLR` (`SM-A075F`, Android 16 / API 36):
one owner user, zero accounts, no Device Owner, and no conflicting museum APK.
Keep evidence serial-scoped; do not transfer physical acceptance between them.

## Non-negotiable prerequisites

- A dedicated phone in a clean provisioning state with **no Google account,
  work profile or secondary user**. A factory reset is one way to reach this
  state, but it is not required when the guards already pass. Never reset
  without separate explicit approval. `dpm set-device-owner` refuses otherwise:
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
adb -s SERIAL shell svc power stayon usb  # screen stays on while USB-powered
```

Or Developer options → Stay awake, or Settings → Security and privacy →
Auto Blocker → off. The durable fix is finishing commissioning:
`applyDeviceOwnerPolicies` calls `setKeyguardDisabled(true)` when the device is
not secure, which removes the keyguard and the trigger with it.

Two false trails to avoid: restarting the adb server appears to fix it, but
only because the screen happened to be on; and USB debugging is not actually
being turned off. Separately, after a reboot the host adb server may not
re-detect the phone until `adb kill-server && adb start-server`.

For the guarded agent workflow, that host-only restart is now the automatic
first recovery whenever no authorized physical ADB phone appears or the target
serial is not ready. Retry discovery once before returning a blocker. On
2026-08-12, Galaxy A07 serial `R8YY929PZDA` changed from `unauthorized` to
`device` immediately after this restart, without any phone-state change or
additional USB-dialog action.

## Preferred agent command

The user has granted standing authorization for the guarded Exhibit Motion
museum-phone lane, including the exact signed-APK install/update, clean Device
Owner provisioning, HOME/Lock Task/fixed-permission policy, the documented
Samsung OTA blocks, and one commissioning reboot. When exactly one dedicated
phone is connected, run from `/home/alex/Remix`:

```bash
bash .agents/skills/exhibit-motion-release/scripts/commission-museum-phone.sh
```

No repeated confirmation is required when its guards pass. The script derives
the current handoff APK from `package.json` and `android/app/build.gradle`, runs
the full signed-APK verifier, rejects emulators and GuideMuseum, requires the
physical model `SM-A075F`, one owner user, zero accounts, no secure Android
credential and no conflicting Device Owner, then chooses fresh commissioning
or a data-preserving update. It verifies the pulled installed `base.apk`, calls
the native policy-compliance Activity rather than using screen coordinates,
checks HOME, Lock Task, fixed permissions and OTA state, reboots, and records a
serial-scoped summary under `/tmp`.

Use `--preflight-only` only for diagnostics; the default production path does
the authorized write and reboot. A failed guard must stop with its single
`BLOCKED:` reason. Never work around it by resetting, deleting an account,
removing another Device Owner, uninstalling, or clearing app data.

The script finishes the Android **system kiosk**. A fresh phone still requires
a person at the installation to choose the mounted lens and narration, hear and
approve the final AUX/Bluetooth route, calibrate, complete a real motion test,
and set the private operator PIN. Those physical facts cannot be safely
invented or confirmed through ADB; after they are complete, the next cold boot
must show `action.AUTO_START`.

## Verified sequence

### 1. Install and provision

```bash
adb -s SERIAL install -r app-release.apk
adb -s SERIAL shell dumpsys account | grep -i "Accounts:"  # must be 0
adb -s SERIAL shell pm list users                          # user 0 only
adb -s SERIAL shell dpm set-device-owner \
  ua.alexsnig.exhibitmotion/.kiosk.ExhibitDeviceAdminReceiver
```

`device_provisioned=1` and `user_setup_complete=1` do **not** block this. The
ADB path only rejects extra users or accounts.

Verify:

```bash
adb -s SERIAL shell dumpsys device_policy | grep "Device Owner Type"
# expect: 0
```

After this the app is a protected package and `am force-stop` on it is ignored.

### 2. Apply HOME and Lock Task policy in the current panel

`dpm set-device-owner` over ADB does **not** run `applyDeviceOwnerPolicies`.
Open Exhibit Motion after provisioning. In current 1.3.19 the
**«Налаштувати Home і Lock Task»** button appears whenever either HOME or Lock
Task policy is missing. It needs no operator PIN. Pressing it applies the
persistent HOME preference, Lock Task allowlist, keyguard policy and fixed
camera/notification/Bluetooth grants.

On Android 16 / API 36 Galaxy A07 serial `R8YL41DLGLR`, this action applied all
four policy groups without a launcher chooser. The live activity state became
`mLockTaskModeState=LOCKED`, and all three runtime permissions were
`POLICY_FIXED`. This serial-scoped observation is not a substitute for running
the same checks on another phone or Android release.

Earlier builds hid this button when the app was already HOME but Lock Task was
unset, and required temporarily handing HOME to Samsung Launcher. That
workaround is obsolete. Do not use it on 1.3.19; if the button is absent,
verify the installed package/version and record the discrepancy instead.

Verify — **note the field name**:

```bash
adb -s SERIAL shell dumpsys device_policy | grep -i ocktask
# expect: LockTaskPolicy {mPackages= ua.alexsnig.exhibitmotion; mFlags= 0 }
```

Android 15 and 16 may omit `mLockTaskPackages`. Grepping for that name can be
empty even when `LockTaskPolicy {mPackages=...}` is correct.

A second confirmation that the method ran to completion, since the permission
grants sit at its end:

```bash
adb -s SERIAL shell dumpsys package ua.alexsnig.exhibitmotion | \
  grep -E "android.permission.(CAMERA|POST_NOTIFICATIONS|BLUETOOTH_CONNECT): granted"
# expect granted=true with POLICY_FIXED on all three
```

### 3. Block OS updates

An unattended One UI upgrade reboots the exhibit and can break it.

```bash
adb -s SERIAL shell pm disable-user --user 0 com.wssyncmldm
adb -s SERIAL shell pm disable-user --user 0 com.samsung.android.app.updatecenter
adb -s SERIAL shell pm disable-user --user 0 com.sec.android.soagent
adb -s SERIAL shell settings put global ota_disable_automatic_update 1
adb -s SERIAL shell pm list packages -d | grep -E "wssyncmldm|updatecenter|soagent"
```

Reversible with `pm enable`. **This does not survive a factory reset** and is
not a managed-device guarantee. The durable fix is a Device Owner
`SystemUpdatePolicy`, which is not implemented in the app yet.

On newly commissioned Android 16 Galaxy A07 serial `R8YL41DLHAY`, the three
packages reported `disabled-user` before the first reboot but Samsung enabled
them again during that boot; the global setting remained `1`. The guarded
commissioning script therefore reapplies all three `pm disable-user` commands
after Android reports boot completion and verifies the post-boot state. Do not
accept only the pre-reboot package state as evidence.

### 4. Operator wizard

1. Open the app. Complete every step: camera permission, bundled-catalog
   selection or local audio import, route test, volume, calibration, and a
   real motion/playback test.
2. Create the 4–12 digit operator PIN in **Kiosk і автозапуск** if it does not
   exist. Note that an unset PIN is reported as «невірний PIN», not as
   "not configured" — if every PIN is rejected on a fresh install, that is why.
   Five wrong attempts trigger a 30-second lockout.
3. Select the intended narration from the bundled offline catalog. Manual
   import remains available for an approved master that is not in the catalog;
   push it with `adb -s SERIAL push narration.mp3 /sdcard/Download/`, then
   import through the wizard so it is copied into app-private storage.
4. When all six checks are green, enter the PIN and tap
   **«Увімкнути kiosk і автозапуск»**. If the button stays greyed out, the
   amber blocker list directly above it names the reason verbatim.

On a phone where system Lock Task was applied before the wizard is complete,
1.3.19 keeps **«Відкрити операторський режим»** visible as soon as an operator
PIN exists. Enter that PIN before opening Android Bluetooth Settings. The
auto-start button remains independently disabled until route, calibration and
motion evidence are complete. 1.3.17 hid maintenance in this exact state and
must not be used for new installation or handoff.

Inside operator maintenance, **«Підключити або змінити Bluetooth-колонку»** may
be used with any successfully paired A2DP/BLE media speaker. Disconnect AUX,
pair in Android Settings, return to Exhibit Motion, run the route test, and let
the person beside the speaker tap **«Чую звук»**. That confirmation replaces
the previous Bluetooth approval. SCO/call-only devices and non-media Bluetooth
accessories remain invalid; Android `AUTH_FAIL` means the speaker pairing mode
or its existing connection must be fixed physically, not by removing Device
Owner or clearing app data.

### 5. Verify the kiosk before rebooting

```bash
adb -s SERIAL shell dumpsys activity activities | grep -E "topResumedActivity|mLockTaskModeState"
adb -s SERIAL shell dumpsys activity services ua.alexsnig.exhibitmotion | grep isForeground
```

Expect `MainActivity` on top, `mLockTaskModeState=LOCKED`, `isForeground=true`.

### 6. Cold-boot test

```bash
adb -s SERIAL reboot
# then, once the phone re-enumerates:
adb kill-server && adb start-server
adb -s SERIAL shell dumpsys activity services ua.alexsnig.exhibitmotion | grep -A1 ServiceRecord
```

A correct resume shows the service started from
`intent={act=ua.alexsnig.exhibitmotion.action.AUTO_START}` — the boot path, not
a manual launch — with `mLockTaskModeState=LOCKED` and the wake lock held:

```bash
adb -s SERIAL shell dumpsys power | grep motion-detector
# PARTIAL_WAKE_LOCK 'ua.alexsnig.exhibitmotion:motion-detector' ... LONG
```

Check the camera actually attached:

```bash
adb -s SERIAL shell dumpsys media.camera | grep -A3 "Active Camera Clients"
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
