# Claude Instructions

Use `AGENTS.md` as the canonical project instruction file.

Before editing code:

1. Read `AGENTS.md`.
2. Read `PROJECT_MEMORY.md`.
3. Inspect the files directly related to the requested change.
4. Run `npm run lint` and `npm run build` when dependencies are installed.
5. For Android changes, also run `npm run android:test` and assemble the APK.

Do not treat this as a generic React app, and do not treat it as a web app.
The production target is a signed Capacitor **Android APK** running as a
Device Owner kiosk on a dedicated museum phone. Kotlin owns all production
camera, audio routing, persistence, boot-resume, and kiosk behaviour. React
is only the local operator UI inside that APK.

The browser/PWA and Cloudflare paths are development and regression surfaces
only. Never make APK startup depend on them, and never add a browser
MediaStream or simulated-camera fallback to the production path.
