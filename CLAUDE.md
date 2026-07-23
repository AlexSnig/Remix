# Claude instructions

Use `AGENTS.md` as the canonical repository instruction file.

Before work:

1. Read `AGENTS.md`.
2. Read `docs/DOCUMENTATION_INDEX.md`.
3. Read `docs/PROJECT_STATE.md`.
4. Use the repo-local `$exhibit-motion-release` skill for release, phone,
   kiosk, or handoff work.

The production product is the signed offline Capacitor Android APK on a
commissioned Device Owner museum phone. Kotlin owns camera, approved audio
routing, persistence, boot resume, and kiosk behavior; React is the local
operator UI. Browser/PWA and Cloudflare are regression surfaces only.

Preserve explicit CameraX failure, no simulated production fallback, no
handset-speaker fallback, bilingual visible strings, version traceability, and
the physical acceptance gates in the current runbooks.
