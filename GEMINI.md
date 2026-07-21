# Gemini Instructions

Use `AGENTS.md` as the canonical project instruction file.

This is **not** a PWA project. The production deliverable is a signed
Capacitor Android APK for a dedicated museum exhibit phone, running as a
Device Owner kiosk. Kotlin under
`android/app/src/main/java/ua/alexsnig/exhibitmotion/` owns the production
camera, audio routing, storage, boot-resume, and kiosk behaviour. The React
code is the local operator UI packaged inside the APK.

Preserve the fully offline runtime (the APK has no `INTERNET` permission),
explicit camera failures with no simulated fallback, approved AUX/Bluetooth
audio routing with no handset-speaker fallback, Ukrainian and English strings
for every visible label, and the kiosk assumptions described in `AGENTS.md`
and `PROJECT_MEMORY.md`.

The browser/PWA and Cloudflare output exists only for development and
regression testing. It is not a release channel.
