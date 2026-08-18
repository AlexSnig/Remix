# Documentation index

This page is the entry point for agents, developers, installers, museum staff,
and client handoff.

## Current truth

- [PROJECT_STATE.md](PROJECT_STATE.md) — current release, target-phone state,
  accepted evidence, and open gates.
- [RELEASE_NOTES.md](../RELEASE_NOTES.md) — behavior by version.
- [DETECTOR_IMPROVEMENTS.md](DETECTOR_IMPROVEMENTS.md) — the six detector
  improvements, why each exists, and which ones ship in 1.3.21.
- [README.md](../README.md) — product architecture, commands, and development
  overview.

`PROJECT_STATE.md` replaces the deleted historical `PROJECT_MEMORY.md`. Do not
reconstruct current readiness from old commits or handoff filenames.

## Agents

- [AGENTS.md](../AGENTS.md) — canonical repository instructions and invariants.
- [AGENT_PROMPTS.md](AGENT_PROMPTS.md) — copy-paste task prompts with evidence
  requirements.
- [exhibit-motion-release skill](../.agents/skills/exhibit-motion-release/SKILL.md)
  — repeatable release, phone-install, kiosk, and handoff workflow.

`CLAUDE.md` and `GEMINI.md` are thin adapters; they defer to `AGENTS.md` and
this documentation index.

## Developers and release engineers

- [RELEASE_AND_HANDOFF.md](RELEASE_AND_HANDOFF.md) — versioning, automated
  gates, signed APK verification, target-phone update, retention, and Git
  publishing.
- [DEVICE_OWNER_KIOSK.md](DEVICE_OWNER_KIOSK.md) — guarded fresh-phone
  commissioning, Device Owner, Lock Task, operator maintenance, and cold boot;
  factory reset is used only when prerequisites fail and is separately approved.
- [Guarded museum-phone script](../.agents/skills/exhibit-motion-release/scripts/commission-museum-phone.sh)
  — automatic current-APK audit, fresh/update classification, system kiosk,
  one reboot, and serial-scoped evidence without repeated operator questions.
- [releases.json](../releases.json) — one entry per `versionCode`: commit, APK
  SHA-256, toolchain, artifact directory, the serials it reached, and a
  `withdrawn` reason where a build must never be distributed.
- [Release guard](../.agents/skills/exhibit-motion-release/scripts/release-guard.sh)
  — `preflight`, `check`, `record` and `lint` around that ledger;
  `release-guard.test.sh` covers it against temporary fixtures.
- [CI workflow](../.github/workflows/verify.yml) — web gates, packaged-WebView
  assertion, native tests with Android lint and a debug APK, and the ledger
  suite. It never runs `assembleRelease` and never sees a signing key.

## Museum staff

- [Exhibit Motion staff PDF](staff-guide/ExhibitMotion_інструкція_для_персоналу.pdf)
  — daily operation and first-line recovery.
- [Staff-manual source](staff-guide/exhibit-motion-staff-manual.html) — editable
  source used to regenerate the PDF.

## Integrator

- [Exhibit Motion integrator PDF](integrator-guide/ExhibitMotion_інструкція_для_інтегратора.pdf)
  — guarded installation, Device Owner/HOME/Lock Task, OTA, operator wizard,
  cold boot, update, recovery, current 1.3.22 target-phone evidence, and the
  still-open exhibition burn-in gates.
- [Integrator-manual source](integrator-guide/exhibit-motion-integrator-manual.html)
  — editable A4 source used to regenerate the PDF.

## Assets and secrets

- `assets/audio/+Сходи.MP3` — approved 14-second narration master.
- Signing keys, passwords, `keystore.properties`, built APKs, client handoff
  packages, screenshots, traces, and diagnostics are never Git content.
- The current client package is assembled at
  `/home/alex/exhibit-handoff-1.3.22-code27` outside this repository and
  verified with its own SHA-256 manifest.
