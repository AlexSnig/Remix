# Exhibit Motion project state

Last verified: 2026-08-18

## Release

- Current source version: `1.3.22`, Android `versionCode 27`. It is being
  commissioned onto the fourth museum phone `R8YYA1Y3KCD`; the three phones in
  service still run `1.3.20`/code 25, so the fleet is deliberately mixed until
  they are updated.
- `1.3.22` is a presentation-only fix on top of 1.3.21: the selected lens button
  and the selected detection-zone preset are now filled with the solid accent
  colour instead of re-tinting the base `.native-action` style, which was
  indistinguishable from an unselected button on the phone. No trigger maths,
  arming gate, route policy, calibration behaviour or zone geometry changed.
- Automated gates for 1.3.22 all passed: `npm run lint`, `npm run test:coverage`
  (26/26; in the three selected critical utilities: 100% lines, 97.07%
  statements, 84.28% branches, 89.36% functions),
  `npm run build`, `npx cap sync android` with `native-action-active` and both
  language variants of the three zone labels verified inside the packaged
  WebView, `npm run test:e2e` (6/6), Android unit tests (35/35, zero failures),
  Android lint (zero errors) and `assembleDebug` under JDK 21.
- 1.3.22 release source checkpoint: `ad79fb3` (`Make the selected lens and
  detection zone visible`), pushed to `origin/main`. The signed release was
  rebuilt from that pushed commit, after the stale `release/` output directory
  was deleted, so exactly one binary exists under `versionCode 27`.
- The exact signed 1.3.22 APK passed the full static audit — v2 signature,
  expected certificate, ZIP/zipalign valid, R8 Capacitor annotation descriptor
  present, not debuggable, no `INTERNET`, package `ua.alexsnig.exhibitmotion`,
  version 1.3.22/code 27 — with SHA-256
  `7fe3a17cc8b6802a5808db61267c1acf008499a50cdaebc4ee319ac26444b018`.
- Current client handoff: `/home/alex/exhibit-handoff-1.3.22-code27`. It
  contains exactly the signed APK, the regenerated staff PDF, the regenerated
  integrator PDF and `SHA256SUMS.txt`; no signing material, source, QA evidence
  or phone backup is present. `sha256sum -c SHA256SUMS.txt` passed for all three
  payload files on 2026-08-18. Staff PDF SHA-256:
  `54d6cca0cc151840d5fd5412f28530071044a167ec716afef436701c218ba6ec`;
  integrator PDF SHA-256:
  `2cb4a5f2f80e0f60779a560c46dc22cdcbf973f962f22dc51d7cb081ae88491a`.
- Both PDFs were regenerated from their HTML sources with the committed
  `render-pdf.mjs` scripts on 2026-08-18 and remain 9-page A4 editions. They now
  record 1.3.22/code 27 with the exact APK hash and certificate, the mixed-fleet
  state (`R8YYA1Y3KCD` on 1.3.22, the other three still on 1.3.20/code 25), the
  clamped-calibration warning with the instruction to narrow the detection zone
  and recalibrate, and the fact that the selected lens and zone are now filled
  with the accent colour. Rendered page checks confirmed no overflow.
- `1.3.21`, Android `versionCode 26`, was **never installed on any phone**, but
  its behaviour ships inside 1.3.22: a clamped calibration becomes visible and
  the operator gains detection-zone presets. It changes no trigger maths, no
  arming gate and no route policy; the default zone stays the full frame, so an
  untouched phone behaves exactly as on 1.3.20. The reasoning is in
  `RELEASE_NOTES.md` and the full six-item plan is in
  `docs/DETECTOR_IMPROVEMENTS.md`.
- Two different 1.3.21 binaries exist under `versionCode 26` and neither may be
  distributed: the development APK recorded as SHA-256
  `008168685d154eabeae3d2bc9b753680bd08e1c986114772fb94c5639228cf4a`, and a
  later local rebuild at
  `91749d926123459cbaf2bd33aa0d8daf747033aed8555e3a0538d0473f6091d1`. Its
  automated gates were 23/23 web tests, 35/35 native tests, Android lint,
  `assembleDebug` and signed `assembleRelease` under JDK 21. Because one
  `versionCode` must never cover two binaries, 1.3.21 is superseded by 1.3.22
  rather than shipped.
- Installing 1.3.22 on a commissioned phone will not by itself improve range.
  The operator must recalibrate, and where the clamp warning appears, narrow the
  detection zone and calibrate again.
- Previous shipped release: `1.3.20`, Android `versionCode 25` — the binary
  currently on all three phones in service.
- 1.3.20 release source checkpoint: `96789e2` (`Fix Bluetooth pairing outside
  Lock Task`), pushed to `origin/main`.
- The exact signed release APK was rebuilt after that checkpoint and passed the
  full release audit, SHA-256:
  `d8ad4e49c67d69b122f8df7a196f078634814d7baa3ede7558b7772e44ebed49`.
- `1.3.20` exits Lock Task before opening Bluetooth Settings, launches Settings
  in a separate standard task, and suppresses delayed kiosk auto-resume while
  Settings owns focus. This lets Samsung Android 16 display its separate
  pairing-confirmation activity instead of rejecting it as a Lock Task policy
  violation and later returning `AUTH_FAIL 14`.
- It preserves the `1.3.19` route policy: an operator in maintenance can connect
  and audibly test any
  successfully paired A2DP/BLE media speaker, even when a different Bluetooth
  name was approved before. Confirmation replaces the stored route; outside
  maintenance, unattended playback still accepts only the last heard and
  approved speaker. SCO/call-only and non-media Bluetooth devices remain
  rejected.
- `1.3.18` restores PIN-gated operator access on a commissioned phone before
  the physical auto-start checklist is complete. This breaks the 1.3.17 setup
  deadlock without relaxing route, calibration, motion-test, or auto-start
  gates.
- `1.3.17` / code 22 is superseded and must not be distributed: after a PIN
  was created but before auto-start readiness was complete, its React panel
  hid the only operator-maintenance action while native Bluetooth Settings
  correctly required maintenance mode.
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
- Superseded client handoff: `/home/alex/exhibit-handoff-1.3.20-code25`. It is
  kept only because three phones still run that binary; it must not be delivered
  as the current package.
- Its PDFs were regenerated on 2026-08-15 after the fleet rollout;
  `sha256sum -c SHA256SUMS.txt` passed for all three payload files at that time.
  Staff PDF SHA-256:
  `b959a3850659d817edbaee9b24dfbcaaffabff231a215f07e78b9e27e7644302`;
  integrator PDF SHA-256:
  `fca816f79b7db5b1c8f04c281010cd2e31efa932ff372ad965f96f20cbeaf3e2`.
- The superseded 1.3.20 PDFs remain 9-page A4 editions. They record
  1.3.20/code 25,
  the exact APK hash/certificate, guarded commissioning, automatic ADB restart,
  post-boot OTA verification and the workflow for replacing an approved route
  with any audible A2DP/BLE media speaker. The 2026-08-15 edition adds the
  three-phone rollout state, the version check that identifies a 1.3.17 operator
  lockout, and the decision rule that separates a silent speaker from a faulty
  phone. The staff edition gained a plain-language entry for a speaker that
  appears connected and tested but is inaudible.
- `v1.2.0` is defective and must never be installed. Its release-only R8 crash
  is retained in release notes for traceability.

## Automated evidence for 1.3.20

- `npm run lint`: passed.
- `npm run test:coverage`: 21/21 passed; 100% lines, 97.02% statements,
  85.07% branches, 89.13% functions in the selected critical utilities.
- The component regression reproduces the exact commissioned-phone state:
  Device Owner and Lock Task active, PIN configured, auto-start disabled, and
  route/calibration/motion incomplete. It proves that operator access is
  available while auto-start remains disabled.
- `npm run build`: passed.
- `npx cap sync android`: passed; the packaged Android WebView contains
  `getAudioLibrary` and the Ukrainian catalog selector.
- `npm run test:e2e`: 6/6 passed with Playwright.
- Android native unit tests: 31/31 passed. Six route-selection tests cover
  same-name SCO/A2DP preference, unverified media selection, SCO-only
  rejection, strict approved-name matching, maintenance replacement with a
  different A2DP name, and continued rejection of call-only replacement.
  Three new kiosk regressions verify the Bluetooth Settings new-task flag,
  prevent relocking while maintenance/background owns focus, and preserve
  focused enabled auto-resume.
- Android native unit tests, lint, `assembleDebug`, and signed
  `assembleRelease` passed together with JDK 21 (`BUILD SUCCESSFUL` in 7m 18s,
  274 actionable tasks).
- The final signed APK audit passed: v2 signature valid, expected certificate, ZIP/zipalign
  valid, R8 Capacitor annotation descriptor present, not debuggable, no
  `INTERNET`, package `ua.alexsnig.exhibitmotion`, version 1.3.20/code 25.
  Its SHA-256 is
  `d8ad4e49c67d69b122f8df7a196f078634814d7baa3ede7558b7772e44ebed49`.

## Target museum phone

### Fourth phone `R8YYA1Y3KCD` — 1.3.22 fresh commissioning, 2026-08-18

- Samsung Galaxy A07 serial `R8YYA1Y3KCD` (`SM-A075F`), Android 16 / API 36, is
  a fourth museum phone with no prior record in this project. It arrived
  authorized in ADB; no host ADB restart was needed for discovery.
- The guarded lane classified it `fresh_commission` and its fresh-phone guards
  passed: current user 0, exactly one `UserInfo{0:Власник}`, zero accounts,
  `CredentialType: NONE`, no Device Owner (`Device Owner Type: -1`), no
  GuideMuseum package and no prior Exhibit Motion install. **No factory reset
  was needed or performed.**
- The exact signed 1.3.22/code 27 APK was installed fresh. The pulled installed
  `base.apk` is byte-identical to the verified release, SHA-256
  `7fe3a17cc8b6802a5808db61267c1acf008499a50cdaebc4ee319ac26444b018`;
  `firstInstallTime` and `lastUpdateTime` are both `2026-08-18 22:15:56`.
- Device Owner was provisioned, native HOME/Lock Task/fixed-permission policies
  applied, the three Samsung OTA packages disabled and one authorized reboot
  performed. ADB did not re-enumerate after that reboot, so only the host ADB
  server was restarted; the phone was not rebooted a second time.
- Independent post-boot ADB evidence: version 1.3.22/code 27, Device Owner type
  0 with `LockTaskPolicy {mPackages= ua.alexsnig.exhibitmotion}`, HOME resolving
  to `ua.alexsnig.exhibitmotion/.MainActivity`, that activity top-resumed in
  task `t8`, `mLockTaskModeState=LOCKED`, Camera/POST_NOTIFICATIONS/
  BLUETOOTH_CONNECT granted with `POLICY_FIXED`, all three OTA packages in the
  disabled list, `ota_disable_automatic_update=1`, `boot_count` advanced 2 → 3,
  no Exhibit Motion crash or ANR, USB-powered at 100 %.
- Rendered Ukrainian operator screen confirms the correct fail-closed state:
  camera granted, no narration selected, explicit `Звук недоступний`, and the
  four system gates Device Owner / Home app / Lock Task / Kiosk lock all green
  with five open operator blockers.
- The same screen proves the 1.3.22 fix on real hardware: in
  `НАЛАШТУВАННЯ ДЕТЕКТОРА`, `Фронтальна камера` and `Весь кадр` are filled with
  the solid accent colour and dark text, while `Задня камера`, `Центр` and
  `Нижня частина` keep the unselected style. On 1.3.21 none of them looked
  chosen.
- Result: `SYSTEM_KIOSK_READY_OPERATOR_WIZARD_PENDING`; evidence at
  `/tmp/exhibit-motion-commission-R8YYA1Y3KCD-20260818T221553`.
- Open on this serial, all local and physical: choose the narration, connect and
  audibly approve the AUX or Bluetooth route, save volume, calibrate, pass a
  real motion test, set the private operator PIN, enable auto-start, then cold
  boot and confirm `action.AUTO_START`. Burn-in is separate. No
  `MotionDetectorService` runs yet, and that is correct.
- The three phones in service (`R8YY929PZDA`, `R8YL41DLHAY`, `R8YL41DLGLR`)
  remain on 1.3.20/code 25 and were not touched during this session.

- Standing installation authority: when the user connects a dedicated Exhibit
  Motion museum phone and asks for everything/kiosk, the agent may run the
  guarded commissioning lane without repeated install/policy/reboot questions.
  `bash .agents/skills/exhibit-motion-release/scripts/commission-museum-phone.sh`
  automatically verifies the current signed APK, resolves one physical
  `SM-A075F`, rejects the GuideMuseum/emulator lane, distinguishes fresh versus
  commissioned state, preserves data, applies Device Owner/HOME/Lock Task and
  OTA policy, performs one reboot, and records evidence. Factory reset,
  destructive repair, PIN, lens/narration/route selection, audible acceptance,
  and burn-in remain outside that standing authority.
- The new script's read-only `--preflight-only` path passed on 2026-08-11 for
  serial `R8YL41DLGLR`: exact 1.3.17/code 22 APK gates passed, the phone was
  classified `commissioned_update`, and one-user/zero-account/no-credential,
  product-lane and existing system-kiosk checks passed. No phone state changed
  during this validation.
- On 2026-08-13 the same no-argument path resolved the then-current
  `/home/alex/exhibit-handoff-1.3.19-code24` APK and serial `R8YL41DLHAY`
  without overrides. The signed-APK audit and commissioned-update guards
  passed with `RESULT=PREFLIGHT_PASS_NO_DEVICE_CHANGES`. This proves that the
  checked-in workflow finds the current delivery artifact for the next
  guarded phone run; a new serial must still pass its own fresh-phone guards.

- The phone connected for the latest commissioning run is Samsung Galaxy A07 serial `R8YY929PZDA`
  (`SM-A075F`), Android 16 / API 36. Its initial ADB state was `unauthorized`;
  restarting only the host ADB server changed it to an authorized `device`.
  The commissioning script now performs this one automatic restart whenever no
  authorized physical phone appears, before returning a blocker.
- On 2026-08-12 the guarded fresh-phone preflight for `R8YY929PZDA` proved one
  owner user, zero accounts, no secure Android credential, no Device Owner, no
  GuideMuseum/Exhibit Motion package, and the correct product lane. No factory
  reset was needed or performed.
- The exact signed 1.3.17/code 22 APK was installed fresh. Its pulled installed
  `base.apk` is byte-identical to the workstation/client artifact, SHA-256
  `840314d7079b3f0fb3f42b297892643d6d044bf7467fbb244b849e268dc1cfc7`;
  package metadata records both first install and update at
  `2026-08-12 15:41:06`.
- After the authorized reboot, `R8YY929PZDA` is Device Owner type 0, Exhibit
  Motion is the top-resumed HOME activity, Lock Task is `LOCKED`, and Camera,
  Notifications and Bluetooth are granted with `POLICY_FIXED`. All three
  Samsung OTA packages are disabled after the post-boot reapplication and
  `ota_disable_automatic_update=1`; boot count is 2.
- The rendered Ukrainian operator screen shows Camera granted, the bundled
  catalog selector, no selected narration and explicit `Звук недоступний`.
  No service/`action.AUTO_START` runs until the physical route/audibility,
  calibration, motion test and private operator PIN are completed locally.
- On 2026-08-13 the no-argument guarded lane resolved `R8YY929PZDA` and the
  then-current `/home/alex/exhibit-handoff-1.3.19-code24` release without overrides.
  Because the phone was already commissioned, it correctly selected
  `commissioned_update`; the one-user, zero-account, no-credential, Device
  Owner and product-lane guards passed before installation.
- `adb install -r` preserved `firstInstallTime=2026-08-12 15:41:06` and set
  `lastUpdateTime=2026-08-13 13:45:45`. An independent pull of the installed
  `base.apk` is byte-identical to the signed client artifact, SHA-256
  `f3ac8083e7912101b581d21b3c087ceb23af654172d3fee8514a6c2d77b00425`.
- The one authorized reboot advanced Android `boot_count` from 2 to 3. When
  Samsung did not re-enumerate in ADB, the workflow restarted only the host ADB
  server; it did not reboot the phone again. Post-boot evidence independently
  confirms Device Owner type 0, Exhibit Motion as resolved and top-resumed
  HOME, Lock Task `LOCKED`, and Camera, Notifications and Bluetooth granted
  with `POLICY_FIXED`. All three Samsung OTA packages are disabled,
  `ota_disable_automatic_update=1`, and no Exhibit Motion crash/ANR was found.
- `MotionDetectorService` and `action.AUTO_START` remain absent by design. The
  guarded result is `SYSTEM_KIOSK_READY_OPERATOR_WIZARD_PENDING`: narration,
  audible AUX/Bluetooth route approval, calibration, real motion test, private
  operator PIN and auto-start must be completed locally for this serial.
  Evidence is at
  `/tmp/exhibit-motion-commission-R8YY929PZDA-20260813T134541`.

- On 2026-08-13 the guarded commissioned-update lane installed the signed
  1.3.20/code 25 release on `R8YY929PZDA` with `adb install -r` and one reboot.
  `firstInstallTime=2026-08-12 15:41:06` was preserved,
  `lastUpdateTime=2026-08-13 19:31:38`, and the pulled installed `base.apk` is
  byte-identical to the release APK, SHA-256
  `d8ad4e49c67d69b122f8df7a196f078634814d7baa3ede7558b7772e44ebed49`.
- The commissioned-update guards again proved one owner user, zero accounts,
  no Android lock credential, the existing Exhibit Motion Device Owner, and
  the correct `SM-A075F` product lane. Post-boot evidence preserved persistent
  HOME, Lock Task `LOCKED`, Camera/Notifications/Bluetooth as granted and
  `POLICY_FIXED`, and all Samsung OTA blocks. The script returned
  `SYSTEM_KIOSK_READY_OPERATOR_WIZARD_PENDING`; evidence is at
  `/tmp/exhibit-motion-commission-R8YY929PZDA-20260813T193136`.
- Before that update, repeated `ZEALOT-S24` attempts on 1.3.19 reproduced the
  real pairing defect. Android discovered the speaker and began SSP
  `Just Works`, but tried to open
  `com.android.settings/.bluetooth.BluetoothPairingDialog` inside the
  allowlisted Exhibit Motion task. ActivityTaskManager logged
  `Attempted Lock Task Mode violation`; about twelve seconds later bonding
  ended with `HCI_ERR_HOST_REJECT_SECURITY`, `hciReason: 14`, zero bonds and
  zero A2DP endpoints. The app did not crash.
- With 1.3.20, Bluetooth Settings opened as its own standard task (`t7`) with
  `FLAG_ACTIVITY_NEW_TASK`, while Exhibit Motion remained HOME task `t6` and
  `mLockTaskModeState=NONE`. No immediate relock or new pairing-dialog Lock
  Task violation occurred. Android then stored exactly one bond for
  `ZEALOT-S24`; its `AudioSink` profile was `Connected` and `Active` for A2DP,
  and media used `bt_a2dp` (`0x80`).
- Returning to Exhibit Motion preserved operator maintenance. The panel showed
  `ZEALOT-S24`, started a `USAGE_MEDIA` / `CONTENT_TYPE_SPEECH` AudioTrack on
  the Bluetooth output, and later displayed **«Маршрут перевірено»** with the
  route and 100% volume stored. The selected narration shown on this phone is
  `Володимир_Великий_…mp3`. The UI state proves app route approval, while a
  separately stated human audible result is not inferred from ADB telemetry.
- Calibration, a serial-specific real motion test, enabling auto-start with the
  private operator PIN, a cold reboot proving `action.AUTO_START`, screen-off
  playback and burn-in remain open on `R8YY929PZDA`. The operator PIN was not
  read, guessed or automated.
- After assembling `/home/alex/exhibit-handoff-1.3.20-code25`, a no-argument
  `--preflight-only` run automatically resolved that exact APK and independently
  passed its signed-artifact audit plus the phone's commissioned-update guards.
  It then correctly stopped with `BLOCKED: Lock Task is not active`, because
  Bluetooth operator maintenance was still open for the human audio check.
  This proves current-artifact discovery; it does not claim a completed kiosk
  preflight until the operator closes maintenance with the private PIN.

- On 2026-08-15 `R8YL41DLHAY` was brought to the same 1.3.20/code 25 release, so
  all three museum phones now run one binary. Before the update it was still on
  1.3.19/code 24 and reproduced that release's pairing defect directly:
  `com.android.settings/.Settings$BluetoothSettingsActivity` was the top-resumed
  activity while `mLockTaskModeState` was still `LOCKED`. No
  `MotionDetectorService` and no Wake Lock were present before the update, so
  the update did not interrupt a running exhibit.
- The guarded commissioned-update lane passed its preflight
  (`PREFLIGHT_PASS_NO_DEVICE_CHANGES`) and then installed with `adb install -r`
  and one reboot. `firstInstallTime` remained `2026-08-12 15:10:13`,
  `lastUpdateTime` is `2026-08-15 00:24:15`, and the pulled installed
  `base.apk` is byte-identical to the release, SHA-256
  `d8ad4e49c67d69b122f8df7a196f078634814d7baa3ede7558b7772e44ebed49`. ADB again
  needed only a host-server restart after the reboot. Evidence is at
  `/tmp/exhibit-motion-commission-R8YL41DLHAY-20260815T002412`.
- Post-boot evidence confirms 1.3.20/code 25, Device Owner intact, Lock Task
  `LOCKED`, Exhibit Motion `.MainActivity` top-resumed, `boot_count` advanced
  from 5 to 6, and `SPB-010` still bonded. App data survived the update: the
  in-app event log still holds the 13.08 trigger history against the stored
  10.0% threshold.
- Auto-start did **not** resume on this boot, and that is correct fail-closed
  behavior rather than a boot-resume regression. The operator had changed
  narration on this phone to `+Бандера.mp3`, which by design cleared the stored
  route approval and motion test, and `SPB-010` is currently powered off, so
  media falls back to `speaker(2)` and the panel reports `Звук недоступний`
  with the route step unchecked. The detector must not arm in that state.
- To return `R8YL41DLHAY` to service: power on the approved speaker, repeat the
  audible route test and **«Чую звук»**, recalibrate, repeat the real motion
  test, re-enable auto-start with the private PIN, then cold-boot and confirm
  `action.AUTO_START`. The earlier 1.3.19 acceptance for this serial does not
  carry over the narration change.

- The physically accepted target from the preceding run is Samsung Galaxy A07 serial `R8YL41DLHAY`
  (`SM-A075F`), Android 16 / API 36. On 2026-08-12 the guarded preflight proved
  exactly one owner user, zero accounts, no secure Android credential, no
  Device Owner, no GuideMuseum/Exhibit Motion package, and the correct physical
  product lane. No factory reset was needed or performed.
- The exact signed 1.3.17/code 22 APK was installed fresh. Its pulled installed
  `base.apk` is byte-identical to the workstation/client artifact, SHA-256
  `840314d7079b3f0fb3f42b297892643d6d044bf7467fbb244b849e268dc1cfc7`;
  package metadata records both first install and update at
  `2026-08-12 15:10:13`.
- `R8YL41DLHAY` is Device Owner type 0. After the authorized commissioning
  reboot, Exhibit Motion was the top-resumed HOME activity with Lock Task
  `LOCKED`; Camera, Notifications and Bluetooth permissions were granted with
  `POLICY_FIXED`. Boot count was 2.
- Samsung re-enabled `com.wssyncmldm`,
  `com.samsung.android.app.updatecenter`, and `com.sec.android.soagent` during
  the first commissioned boot even though they were `disabled-user` before it.
  The workflow reapplied those blocks after boot; all three now appear in the
  disabled package list and `ota_disable_automatic_update=1`. The guarded
  script was corrected to perform and verify that post-boot reapplication on
  future phones.
- At that initial 1.3.17 commissioning checkpoint no `MotionDetectorService`,
  Wake Lock, active Exhibit Motion camera or `action.AUTO_START` was present on
  `R8YL41DLHAY`, because the physical operator wizard, approved
  route/audibility, calibration, motion test and private PIN are intentionally
  not automated. Later 1.3.19 physical and cold-boot evidence is recorded
  below; this historical fail-closed state is retained for traceability.
- A rendered screenshot after boot confirmed the native Ukrainian operator
  screen: camera access is granted, the bundled-catalog selector is visible,
  no narration is selected, and the route test explicitly reports
  `Звук недоступний`. This is the correct fail-closed state with no approved AUX
  or Bluetooth output connected; it is not audio acceptance.
- On 2026-08-13 the installed `base.apk` was pulled again and remained
  byte-identical to the 1.3.17/code 22 handoff artifact, SHA-256
  `840314d7079b3f0fb3f42b297892643d6d044bf7467fbb244b849e268dc1cfc7`.
  This excludes a wrong-file installation as the cause of the incident.
- The live UI and source inspection reproduced the actual deadlock: Android
  reported Lock Task `LOCKED`; the panel reported a configured operator PIN,
  disabled auto-start, and incomplete route/calibration/motion checks; the
  «Відкрити операторський режим» action was absent, while tapping Bluetooth
  produced «Спочатку відкрийте операторський режим». The PIN value was not
  used, guessed, recorded in the project, or retained; temporary UI diagnostics
  were deleted immediately after the check.
- The exact signed 1.3.18/code 23 APK was then installed with `adb install -r`.
  `firstInstallTime=2026-08-12 15:10:13` was preserved and
  `lastUpdateTime=2026-08-13 00:32:42`; Device Owner, HOME, Lock Task and all
  three `POLICY_FIXED` runtime permissions remained intact. The pulled
  installed `base.apk` is byte-identical to the post-checkpoint release,
  SHA-256 `b240f2432ee3d45c5638b3262d83a3cd9a91da3c2b335b549f0aa60bac1a9ba8`.
- The guarded workflow performed one update reboot, automatically restarted
  host ADB when Samsung did not re-enumerate, and re-applied/verified the three
  OTA package blocks. Its result was
  `SYSTEM_KIOSK_READY_OPERATOR_WIZARD_PENDING`.
- Rendered post-reboot evidence on `R8YL41DLHAY` shows the missing action is
  fixed: with Lock Task still active, PIN configured and the physical checklist
  incomplete, the panel now displays both «Відкрити операторський режим» and
  the separately disabled «Увімкнути kiosk і автозапуск». Entering the private
  PIN and proving the subsequent Bluetooth Settings screen remain local human
  acceptance steps.
- On 2026-08-13 the guarded commissioned-update lane installed the exact signed
  1.3.19/code 24 release with `adb install -r`. `firstInstallTime` remained
  `2026-08-12 15:10:13`, `lastUpdateTime` is `2026-08-13 11:10:30`, and the
  pulled installed `base.apk` is byte-identical to the final release, SHA-256
  `f3ac8083e7912101b581d21b3c087ceb23af654172d3fee8514a6c2d77b00425`.
- The authorized update reboot preserved Device Owner type 0, Exhibit Motion as
  persistent and top-resumed HOME, Lock Task `LOCKED`, and Camera,
  Notifications and Bluetooth as granted with `POLICY_FIXED`. The guarded
  workflow restarted only the host ADB server when the phone did not
  re-enumerate, reapplied the OTA blocks, and returned
  `SYSTEM_KIOSK_READY_OPERATOR_WIZARD_PENDING`. Serial-scoped evidence is at
  `/tmp/exhibit-motion-commission-R8YL41DLHAY-20260813T111027`.
- Rendered real-phone evidence shows the 1.3.19 action «Підключити або змінити
  Bluetooth-колонку» and its explicit support for any A2DP/BLE media speaker.
  At capture time AUX was physically connected and therefore correctly had
  priority over Bluetooth. The previous S207U and ZEALOT-S24 attempts ended in
  Android `AUTH_FAIL 14` before a bond was created; this is pairing-layer
  evidence, not an Exhibit Motion crash or route rejection.
- Later on 2026-08-13 the operator paired `SPB-010` successfully and physically
  confirmed hearing the route test. Android then reported exactly one bonded
  device, `SPB-010` connected and active as A2DP, with media default device
  `0x80` (`bt_a2dp`) and no active AUX route. The native panel stored
  «Маршрут перевірено»; this supersedes the earlier `AUTH_FAIL 14` attempts.
- The current operator-selected narration is `Роман Шухевич.mp3`. After that
  final selection the operator repeated the audible route approval and motion
  test. The native panel showed camera permission, local audio, route, saved
  volume, calibration and «Рух і відтворення підтверджено» all complete. The
  operator reported that sound was audible and the real motion trigger worked;
  the private PIN was neither read, guessed nor recorded.
- A cold reboot advanced Android `boot_count` from 4 to 5. Samsung first
  returned only as USB/MTP; one host-only `adb kill-server` / `adb start-server`
  restored the same authorized serial without a second phone reboot. Exhibit
  Motion returned as top-resumed HOME with Lock Task `LOCKED`, and
  `MotionDetectorService` was foreground under the exact intent
  `ua.alexsnig.exhibitmotion.action.AUTO_START`.
- Post-boot runtime held the partial Wake Lock
  `ua.alexsnig.exhibitmotion:motion-detector`, kept CameraX camera id 1 active,
  and restored `SPB-010` as bonded, active and default A2DP. Three observed
  playback cycles reached playback end and automatic cooldown re-arm. The
  final check found no Exhibit Motion fatal, ANR, CameraX or service error;
  the phone was USB-powered at 100% and 29.5 °C, and all three Samsung OTA
  packages plus `ota_disable_automatic_update=1` remained enforced.
- With the display then off, Android reported `Dozing` while the same Wake Lock
  and camera id 1 remained active. No additional trigger occurred during that
  short screen-off observation because samples stayed below the saved 10%
  threshold, so a separately heard screen-off trigger remains an open physical
  gate rather than an inferred pass.

- On 2026-08-14 the third museum phone, Samsung Galaxy A07 serial `R8YL41DLGLR`
  (`SM-A075F`), Android 16 / API 36, was connected because the operator could
  not open operator maintenance to pair
  a different Bluetooth speaker. It was still running the superseded
  1.3.17/code 22 build, so this reproduced the documented 1.3.17 regression
  rather than a pairing or speaker fault: with a PIN already configured and
  auto-start readiness incomplete, the panel hid the only maintenance action,
  while native Bluetooth Settings correctly demanded maintenance mode. Android
  reported zero bonded devices and Lock Task `LOCKED` before the repair.
- The read-only guarded preflight passed for that serial and returned
  `PREFLIGHT_PASS_NO_DEVICE_CHANGES`, classifying the phone as
  `commissioned_update`; evidence is at
  `/tmp/exhibit-motion-commission-R8YL41DLGLR-20260814T234328`.
- The no-argument guarded lane then installed the exact signed 1.3.20/code 25
  release with `adb install -r` and one reboot. `firstInstallTime` remained
  `2026-08-11 15:09:28`, `lastUpdateTime` is `2026-08-14 23:43:41`, and the
  pulled installed `base.apk` is byte-identical to the release, SHA-256
  `d8ad4e49c67d69b122f8df7a196f078634814d7baa3ede7558b7772e44ebed49`. When
  Samsung did not re-enumerate, only the host ADB server was restarted; the OTA
  blocks were reapplied after the first commissioned boot. The result was
  `SYSTEM_KIOSK_READY_OPERATOR_WIZARD_PENDING`, evidence at
  `/tmp/exhibit-motion-commission-R8YL41DLGLR-20260814T234339`.
- Post-boot ADB confirms 1.3.20/code 25, Lock Task `LOCKED`, and Exhibit Motion
  `.MainActivity` as the top-resumed HOME activity. The rendered Ukrainian panel
  shows camera granted, narration `+Петлюра.mp3` selected, Device Owner, Home
  app, Lock Task and Kiosk lock all satisfied, and the two expected open
  blockers: unverified AUX/Bluetooth route and unconfirmed motion test. Route
  state is correctly `Звук недоступний` with no speaker attached.
- The repair is confirmed on this serial: the panel now renders the PIN field
  together with both **«Відкрити операторський режим»** and **«Увімкнути kiosk і
  автозапуск»**. It renders the existing-PIN form, not the create-PIN form, so a
  private operator PIN is already configured on `R8YL41DLGLR`. The PIN was not
  read, guessed, entered or recorded.
- On 2026-08-15 the operator paired `HOCO BS47` on this serial under 1.3.20 and
  reported no audible sound. ADB evidence shows the pairing fix itself working
  on a third phone and speaker: exactly one bond exists, `A2dpStateMachine` is
  `Connected` with `mIsPlaying: true`, SBC is negotiated at 44100 Hz / 16-bit /
  stereo, and no Lock Task violation or `AUTH_FAIL` occurred.
- The phone-side audio chain was proven complete while the route test ran:
  media default device `bt_a2dp` (`0x80`), `STREAM_MUSIC` neither muted nor
  internally muted at `15/15` on `bt_a2dp`, AVRCP absolute volume enabled and
  pushed to the speaker at `150/150`, the AudioFlinger A2DP output thread out of
  standby for the whole playback with master volume `1.000000`, and repeated
  Exhibit Motion `USAGE_MEDIA` / `CONTENT_TYPE_SPEECH` AudioTracks in
  `state:started`. The foreground service ran under
  `ua.alexsnig.exhibitmotion.action.TEST_AUDIO`, so nothing was armed.
- Silence with that evidence is therefore located in the speaker or its input
  mode, not in Exhibit Motion, the route policy or the kiosk. It is not route
  acceptance: **«Чую звук»** was not pressed and the stored approval is still
  absent. `HOCO BS47` must be proven audible from an independent source before
  it is treated as the exhibit speaker.
- The operator also changed narration on this serial to `+Шептицький.mp3`. By
  design that cleared the earlier route approval and motion test, so both must
  be repeated after the speaker is audible.
- Pairing the new speaker, its audible route approval, calibration, the real
  motion test, PIN-gated auto-start and a cold reboot proving
  `action.AUTO_START` remain open local human steps for this serial. Operator
  maintenance was left open with Lock Task `NONE`; the operator must close it
  with **«Повернути kiosk»** and the private PIN.

- The earlier commissioning history for `R8YL41DLGLR` follows. Pre-install ADB
  on 2026-08-11 proved one owner user,
  zero accounts, no Device Owner, Samsung Launcher as HOME, Lock Task `NONE`,
  and neither `ua.alexsnig.exhibitmotion` nor `com.guidemuseum` installed. No
  factory reset was needed or performed.
- The exact 1.3.17/code 22 APK was installed fresh on 2026-08-11. Its pulled
  installed `base.apk` is byte-identical to the workstation release, SHA-256
  `840314d7079b3f0fb3f42b297892643d6d044bf7467fbb244b849e268dc1cfc7`;
  package metadata records `firstInstallTime=2026-08-11 15:09:28`.
- Exhibit Motion is Device Owner type 0 for user 0. Android 16 records its
  persistent preferred HOME activity and `LockTaskPolicy` package; the live
  activity state before reboot was `mLockTaskModeState=LOCKED` with Exhibit
  Motion resumed. Camera, notifications, and Bluetooth permissions are
  granted and `POLICY_FIXED`.
- Samsung OTA packages `com.wssyncmldm`,
  `com.samsung.android.app.updatecenter`, and `com.sec.android.soagent` are
  `disabled-user`; global `ota_disable_automatic_update` is `1`.
- The native 1.3.17 operator UI visibly exposed the offline catalog selector.
  Opening and scrolling its Android list on this serial exposed all 20 bundled
  filenames. It also reported Device Owner, Home app, Lock Task, and kiosk lock
  ready. No narration was selected and no operator PIN was created: the
  intended figure, approved physical output, audible confirmation, and PIN
  belong to the local installation operator and must not be guessed by
  automation.
- An authorized cold reboot completed after provisioning. Restarting the host
  ADB server re-detected the handset; Android reported boot count 2, Exhibit
  Motion as the default and top-resumed HOME activity, and Lock Task still
  `LOCKED`. Camera permission and the catalog selector remained present.
- No `MotionDetectorService` ran and no `action.AUTO_START` occurred after this
  reboot because the operator wizard and auto-start/PIN enable step have not
  been completed. This is an explicit open commissioning gate, not a failed
  boot-resume test.
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

All three museum phones — `R8YY929PZDA`, `R8YL41DLGLR` and `R8YL41DLHAY` — now
run the identical signed 1.3.20/code 25 binary, each installed through the
guarded lane with its own byte-identical `base.apk` check. Release 1.3.20 has
**signed-artifact, guarded update and Bluetooth pairing/A2DP/app-route
evidence** on `R8YY929PZDA`. Cold-boot `action.AUTO_START` evidence exists only
from the earlier 1.3.19 run on `R8YL41DLHAY`. None of the three is at final
exhibition acceptance, and no serial currently has an armed detector.

1. `R8YY929PZDA` now runs the exact 1.3.20/code 25 release. Android bonding,
   active A2DP, test AudioTrack and the stored `ZEALOT-S24` approved-route UI
   are proven. Record the operator's separate audible statement, then complete
   calibration, a real motion/playback test, PIN-gated auto-start enable and a
   cold reboot with `action.AUTO_START`. `R8YL41DLGLR` also runs 1.3.20/code 25
   since 2026-08-14 and now exposes the PIN-gated maintenance action again, but
   it still needs its own full physical workflow: pair the speaker, hear the
   route, calibrate, motion-test, enable auto-start and prove cold boot.
   Acceptance from `R8YL41DLHAY` cannot be copied to either serial.
2. `R8YL41DLHAY` runs 1.3.20/code 25 since 2026-08-15 with its data, PIN and
   `SPB-010` bond preserved, but its narration was changed to `+Бандера.mp3`,
   which cleared the stored route approval and motion test. Power on the
   speaker, repeat the audible route test, recalibrate, repeat the motion test,
   re-enable auto-start with the PIN and prove `action.AUTO_START` on a cold
   boot before this phone counts as in service again.
3. On `R8YL41DLHAY`, formally confirm the mounted lens and visitor zone, then
   record near/far samples at approximately 4–5 m, 2 m and 0.5–1 m. Prove that
   intended visitor movement triggers without treating whole-frame light
   changes as motion.
4. Produce one separately witnessed screen-off trigger through `SPB-010`, then
   prove playback end, cooldown and re-arm while the display remains off.
   Exercise route loss/return and a different Bluetooth device, confirming
   fail-closed behavior and that the handset speaker stays silent.
5. Run the documented 8-hour acceptance test on the final mount and charger:
   at least 100 triggers, permission loss/recovery, camera contention/recovery,
   app switching/kiosk return, heat observation and at least five complete
   power-off/power-on cycles. Only one new accepted reboot is recorded here.

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
