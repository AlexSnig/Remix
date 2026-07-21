# AI Agent Instructions

## Product

This repository is a premium, fully local Android museum motion-sensor APK for a dedicated fixed phone. It detects visitors with CameraX, plays local narration through an operator-approved AUX or Bluetooth route, stores a small local event log, and runs as a Device Owner Home app in Lock Task kiosk mode.

The production target is a signed Capacitor Android APK installed directly on a commissioned museum phone. The React bundle is the local operator UI inside the APK; Kotlin owns all production camera, audio, persistence, boot-resume, and kiosk behavior. Cloudflare/PWA output is a development and browser-regression surface only. There is no runtime server, Google Drive integration, Play Store scope, visitor identification, or cloud dependency.

## Required skills

- Use `frontend-testing-debugging` for rendered behavior, mobile viewport, console, screenshot, and offline QA.
- Use `react-best-practices` for React state, effects, refs, rendering frequency, bundle, and TypeScript work.
- Use `android-emulator-qa` only when ADB and an emulator are available.
- Use `android-performance` when collecting Android CPU, frame, memory, or startup evidence.
- Use `frontend-app-builder` only for deliberate redesign work.

Do not use Expo or Zoom skills unless the user explicitly changes the product scope.

## Commands

```bash
npm run dev
npm run lint
npm run test:coverage
npm run build
npm run preview
npm run test:e2e
ANDROID_HOME=/path/to/android-sdk npm run android:test
ANDROID_HOME=/path/to/android-sdk npm run android:debug
ANDROID_HOME=/path/to/android-sdk npm run android:release
```

Browser plugin is preferred when available. Otherwise use the committed Playwright suite. Keep temporary screenshots, traces, and reports outside the repository.

## Architecture and invariants

- `src/App.tsx` selects the Capacitor-native operator surface and owns shared UI state. Browser camera behavior is non-production fallback only.
- `src/components/NativeDetectorPanel.tsx` owns the native commissioning and operator workflow without duplicating Android runtime state.
- `android/app/src/main/java/ua/alexsnig/exhibitmotion/detector/MotionDetectorService.kt` is the sole production camera, trigger, Wake Lock, audio, recovery, and cooldown owner.
- `android/app/src/main/java/ua/alexsnig/exhibitmotion/detector/DetectorStore.kt` owns native settings, readiness evidence, PIN retry state, event retention, and boot metadata.
- `android/app/src/main/java/ua/alexsnig/exhibitmotion/kiosk/` owns Device Owner, persistent Home, Lock Task, and visible-activity boot resume.
- `src/components/CameraDetector.tsx` owns only the browser fallback MediaStream path.
- `src/utils/motionDetection.ts` is pure motion math; keep it covered by unit tests.
- `src/utils/audio.ts` owns every Web Audio and HTMLAudio resource. `stopAllAudio()` is the sole cleanup path.
- `src/utils/indexedDB.ts` owns database version `3`, legacy audio migration, Blob storage, logs, persistence health, and pruning.
- `src/utils/settings.ts` is the only settings migration/default boundary.
- PWA setup in `vite.config.ts` and Cloudflare deployment in `wrangler.jsonc` are non-production regression surfaces. Never make APK startup depend on them.

Production camera failure must be explicit. Never add an automatic simulated-camera fallback or browser MediaStream fallback to the APK. A test stream may be injected only inside tests.

Audio playback must not wait for or depend on a successful log write. Local audio must remain untouched by automatic log pruning. Do not store new audio as base64.

Keep CameraX motion processing at or below 10 FPS and WebView telemetry at or below 2 FPS unless Android performance evidence on the target device supports a change.

Every visible string needs Ukrainian and English. Preserve the dark museum-control visual language and orange accent unless redesign is requested.

## Required validation

Before handoff, run lint, coverage, build, Playwright, native unit tests, debug APK assembly, and release assembly when the production signing key is available. For native camera changes, verify first-frame success, permission denial, stalled-frame recovery, route loss, and repeated recovery. For kiosk changes, verify ordinary-install behavior separately from Device Owner behavior and cover the cold-boot matrix.

Do not claim physical Android readiness from Playwright or compilation alone. Final readiness requires a sustained test on the target museum phone with the real camera, approved audio route, charger, thermal conditions, cold boot, app switching, permission loss, route loss, and repeated triggers. Device Owner provisioning may require a factory reset and is destructive; never perform it without explicit user approval.
