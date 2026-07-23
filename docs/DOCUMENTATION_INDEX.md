# Documentation index

This page is the entry point for agents, developers, installers, museum staff,
and client handoff.

## Current truth

- [PROJECT_STATE.md](PROJECT_STATE.md) — current release, target-phone state,
  accepted evidence, and open gates.
- [RELEASE_NOTES.md](../RELEASE_NOTES.md) — behavior by version.
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
- [DEVICE_OWNER_KIOSK.md](DEVICE_OWNER_KIOSK.md) — factory-reset phone
  commissioning, Device Owner, Lock Task, operator maintenance, and cold boot.

## Museum staff

- [Exhibit Motion staff PDF](staff-guide/ExhibitMotion_інструкція_для_персоналу.pdf)
  — daily operation and first-line recovery.
- [Staff-manual source](staff-guide/exhibit-motion-staff-manual.html) — editable
  source used to regenerate the PDF.

## Assets and secrets

- `assets/audio/+Сходи.MP3` — approved 14-second narration master.
- Signing keys, passwords, `keystore.properties`, built APKs, client handoff
  packages, screenshots, traces, and diagnostics are never Git content.
- The current client package is assembled outside this repository and verified
  with its own SHA-256 manifest.
