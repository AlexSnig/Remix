# Gemini instructions

Use `AGENTS.md` as the canonical repository instruction file.

Read `docs/DOCUMENTATION_INDEX.md` and `docs/PROJECT_STATE.md` before editing.
For release, signed APK, target-phone, Device Owner, kiosk, or client-handoff
work, follow the repo-local `$exhibit-motion-release` skill.

This is an offline Capacitor Android museum installation, not a generic PWA.
Kotlin owns production camera, approved AUX/Bluetooth playback, persistence,
boot resume, and kiosk behavior. React is the packaged operator UI.

Do not add a cloud runtime, simulated production camera, handset-speaker
fallback, untraced device build, or readiness claim without physical evidence.
