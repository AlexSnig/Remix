# Agent task prompts

These prompts are deliberately evidence-first. Replace placeholders, then give
the prompt to an agent that can access this repository.

## Full release audit

> Use `$exhibit-motion-release`. Audit the current Exhibit Motion release from
> source through the exact signed APK. Read `AGENTS.md`,
> `docs/PROJECT_STATE.md`, and `docs/RELEASE_AND_HANDOFF.md`. Run every web and
> Android gate, verify signature, certificate, R8, package identity, offline
> permissions, ZIP integrity, and checksums. Separate automated, emulator,
> target-phone, and burn-in evidence. Do not claim readiness for any physical
> gate you did not perform.

## Install an update on the museum phone

> Use `$exhibit-motion-release`. Identify the connected phone with
> `adb devices -l`; confirm model, installed version, Device Owner, Lock Task,
> permissions, and current service before writing. Install the exact signed APK
> with `adb install -r`, never uninstall or clear data, then reboot. Confirm
> version, unchanged first-install time, Home, Lock Task, Device Owner, imported
> audio, selected camera, and `action.AUTO_START`. Stop and name the blocker if
> AUX, PIN, or physical confirmation is missing.

## Diagnose camera reliability

> Use `$exhibit-motion-release` and `android-emulator-qa` only if an emulator is
> relevant. Reproduce the CameraX issue on the actual target when available.
> Confirm the physical mount before changing front/rear lens. Capture first
> frame, calibration completion, frame count, camera restarts, contention,
> recovery timing, and Logcat exceptions. Keep the operator error short and
> technical detail in Logcat. Never add a simulated production fallback.

## Diagnose file import or playback

> Use `$exhibit-motion-release`. Test a valid narration and a corrupt or
> mislabeled file without destroying the last working import. Inspect the real
> Android audio route. Require a person to confirm the intended AUX or approved
> Bluetooth speaker is audible. Verify route loss blocks playback and never
> falls back to the handset speaker. Do not approve a route from ADB alone.

## Commission a new phone

> Use `$exhibit-motion-release` and follow `docs/DEVICE_OWNER_KIOSK.md`
> literally. First confirm the phone can be factory-reset and that the user has
> authorized this destructive step. Remove accounts before reset, provision
> Device Owner, apply Home and Lock Task policy, complete all six native checks,
> set the operator PIN, and prove five cold boots. Record exact evidence and
> correct the runbook in the same session if hardware behavior differs.

## Prepare client handoff

> Use `$exhibit-motion-release`. Build the package outside Git with the signed
> APK, installation instructions, staff PDF, kiosk runbook, release notes,
> verification report, and SHA-256 manifest. Keep signing secrets isolated and
> never commit them. Delete only confirmed superseded artifacts after the
> replacement verifies. Report which hardware and burn-in gates remain open.

## Run exhibition burn-in

> Use `$exhibit-motion-release`. On the final mounted phone and speaker, run the
> eight-hour acceptance matrix from `docs/RELEASE_AND_HANDOFF.md`: charging,
> heat, at least 100 triggers, five power cycles, AUX loss/return, camera
> recovery, permission recovery, screen-off operation, and no handset-speaker
> fallback. Keep an external trigger tally because the app log retains only 20
> events. Produce a concise pass/fail report with timestamps and evidence.
