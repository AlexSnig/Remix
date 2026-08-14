# Detector improvement plan

Six improvements proposed on 2026-08-15 after the three-phone 1.3.20 rollout.
Items 1 and 2 ship in 1.3.21 / `versionCode 26`; items 3–6 are specified here so
they can be picked up without re-deriving the reasoning.

Every item below came from something observed on real hardware, not from a
code read. The evidence is named in each entry.

## Why this list exists

`R8YL41DLHAY` ran a whole exhibition day with a calibrated threshold of exactly
`10.0 %`. That is the hard clamp inside `MotionMath.calibratedThreshold`, which
returns `min(10, max(0.5, median + 6 × MAD + 0.5))`. Nothing in the product told
the operator that the clamp had fired, and a 10 % threshold reduces the working
range of the exhibit to roughly 1.5–2 m. Several logged triggers sat at `10.4 %`,
`10.5 %` and `11.0 %` — visitors were being caught only at the very edge.

The clamp fires when the calibration scene is not quiet. The product already has
the tool that fixes that — `detectionZone` — but no operator can reach it,
because only the browser fallback panel exposes zone presets.

Those two facts are the same defect seen from two sides, which is why 1 and 2
ship together.

## 1. Make a clamped calibration visible — in 1.3.21

**Problem.** `calibratedThreshold` silently clamps at 10 %. The operator sees a
finished calibration and a plausible number, and the exhibit goes into service
at the least sensitive setting the product allows.

**Change.** Return the raw pre-clamp value and a clamped flag alongside the
stored threshold. Persist both, surface the warning in the calibration step, and
say it in the native completion message.

- `MotionMath.calibrate()` returns `CalibrationResult(threshold, rawThreshold, clamped)`;
  `calibratedThreshold()` stays as a thin wrapper so existing callers and tests
  keep working.
- `MotionSettings` gains `calibrationClamped` and `calibrationRawNoiseFloor`,
  serialized with the rest of the settings.
- `DetectorStore.saveSettingsFromOperator` clears both whenever it already
  clears `calibratedNoiseFloor`, so a stale warning cannot survive a retune.
- `MotionDetectorService.startCalibration` stores the result and appends an
  explicit recalibration instruction to the completion message when clamped.
- `NativeDetectorPanel` renders an amber warning inside the calibration card.

**Risk.** Low. No change to trigger logic, thresholds, or arming gates — the
stored threshold is exactly what it was before. Only new reporting.

**Validation.** Native unit tests for clamped and unclamped calibration, the
mirrored TypeScript unit tests, and a rendered check of the warning state.

## 2. Expose the detection zone to the operator — in 1.3.21

**Problem.** `detectionZone` is honoured by `MotionMath.analyze` on both the
Kotlin and TypeScript sides and is already persisted and clamped, but
`NativeDetectorPanel` never renders a control for it. Only the browser
`SettingsPanel` has zone presets, and the browser is not the product. Every
commissioned phone therefore analyses the whole frame, including ceiling
lights, windows and doorways that have nothing to do with the visitor path.

**Change.** Add zone presets to the tuning section of the native panel:

| Preset | Zone | Use |
| --- | --- | --- |
| Весь кадр / Full frame | `0, 0, 1, 1` | default; open room, nothing moving behind the visitors |
| Центр / Center | `0.2, 0.15, 0.6, 0.7` | a defined viewing spot in front of the exhibit |
| Нижня частина / Lower area | `0, 0.4, 1, 0.6` | excludes ceiling lights, windows and reflections high in the frame |

**Why this buys range.** A smaller zone removes the noise sources that inflate
the calibration median, so calibration lands well below the clamp, which is what
actually sets distance. It is the cheapest available range improvement and
changes no detection maths.

**Correctness.** `DetectorStore.saveSettingsFromOperator` already treats a zone
change as a detector change: it nulls `calibratedNoiseFloor` and clears the
motion test. The operator is therefore forced to recalibrate and re-test after
changing the zone, which is the required behaviour. The UI must state this
before the operator taps.

**Risk.** Low, with one caveat worth stating plainly: a badly chosen zone can
make an exhibit miss visitors who walk outside it. The presets are deliberately
coarse, the default stays the full frame, and the change is gated behind
operator maintenance and a forced recalibration.

**Validation.** Native unit tests already cover zone-restricted analysis; add
component coverage that a preset change marks tuning dirty and that the reset
warning is shown. Physically: recalibrate on a real phone and confirm the stored
threshold drops below the clamp.

## 3. Live motion readout without arming — planned

**Problem.** `MotionDetectorService.analyzeFrame` publishes `motionPercent`
telemetry only after `if (snapshot.status != DetectorStatus.ARMED) return`.
Arming requires a verified audio route. On 2026-08-15 the detection range on two
phones could not be measured at all, because both were waiting on a speaker —
camera aiming and range measurement are blocked behind an unrelated subsystem.

**Change.** A read-only aiming mode that opens the camera, publishes the motion
percentage and the current threshold, and never plays audio, never arms, and
never sets any readiness flag. It must be maintenance-only and must stop on its
own after a bounded interval so it cannot be left running.

**Why.** It makes the documented range walk (`docs/DEVICE_OWNER_KIOSK.md`)
executable during installation instead of after the audio route is finished, and
it lets the integrator aim the lens before mounting.

**Risk.** Medium. It introduces a second camera-owning path, so it must reuse
the existing camera lifecycle, Wake Lock and recovery code rather than
duplicating it, and must be provably unable to reach the playback path.

## 4. Cumulative trigger counter — planned

**Problem.** `MotionDetectorService.MAX_EVENTS = 20`. The acceptance gate asks
for at least 100 triggers across eight hours, and the in-app log physically
cannot evidence that. The counter that does exist, `analyzedFrameCount`, counts
frames rather than triggers.

**Change.** A monotonic trigger counter alongside `analyzedFrameCount`, exposed
in diagnostics and the diagnostics JSON export, reset only with the event log.

**Risk.** Low. One counter, one export field.

## 5. Speaker-side hint when the phone is provably streaming — planned

**Problem.** On `R8YL41DLGLR` the operator reported no sound while the phone was
demonstrably streaming to `HOCO BS47`: A2DP connected and playing, SBC
negotiated, AVRCP absolute volume at maximum, output thread out of standby.
Diagnosing that took a full ADB session. The operator saw only silence.

**Change.** When the route test ends without confirmation and the app can see a
connected, playing A2DP endpoint at full volume, show the speaker-side checklist
directly: the speaker's own volume, its input mode, and any inserted TF card or
AUX cable. Text only; it must not touch the approval path, and **«Чую звук»**
must keep meaning exactly what it means today.

**Risk.** Low, provided the wording never implies the route was approved.

## 6. Lower the calibration clamp and fail loudly — planned, needs a decision

**Problem.** The 10 % clamp is not a safe upper bound; it is the value that
produces a 1.5–2 m exhibit. Clamping quietly converts an unusable calibration
into a poor but accepted one.

**Change.** Lower `MAX_CALIBRATED_THRESHOLD` to roughly 5 % and treat a
computed value above it as a failed calibration with a clear reason, rather than
a clamped success.

**Why it is listed last.** This one changes behaviour on phones already in the
field: a scene that calibrates to 7 % today would start failing. That is
arguably correct, but it is a product decision about whether a noisy room should
block commissioning outright. It needs an explicit answer before implementation,
and item 1 should be in the field first so there is evidence about how often the
clamp actually fires.

## Sequencing

1 and 2 ship together in 1.3.21 because they address the same defect and neither
changes detection maths. 3 unblocks the range measurement and should come next.
4 and 5 are small and independent. 6 waits for a decision and for clamp evidence
from 1.

Every item that reaches a device needs `package.json` and
`android/app/build.gradle` bumped together, the full automated gate, a signed
APK audit, and a fresh physical acceptance run on the target serial. None of
these improvements changes the standing safety invariants: explicit CameraX
failure, no simulated fallback, no handset-speaker fallback, bilingual strings,
and an audible human route approval.
