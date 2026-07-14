# AI Agent Instructions

## Product

This repository is a personal Android-first museum motion-sensor PWA. It runs in the foreground on the user's fixed phone, detects visitors with the camera, plays local narration or an alert, and stores a small local event log.

The production target is a static Cloudflare Pages deployment installed from Android Chrome. There is no Express server, Google Drive runtime integration, native APK, Play Store scope, or enterprise distribution.

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
```

Browser plugin is preferred when available. Otherwise use the committed Playwright suite. Keep temporary screenshots, traces, and reports outside the repository.

## Architecture and invariants

- `src/App.tsx` owns kiosk entry, readiness checks, Wake Lock intent, tabs, and global detector state.
- `src/components/CameraDetector.tsx` owns the real MediaStream, recovery watchdog, low-resolution frame loop, trigger lifecycle, and calibration.
- `src/utils/motionDetection.ts` is pure motion math; keep it covered by unit tests.
- `src/utils/audio.ts` owns every Web Audio and HTMLAudio resource. `stopAllAudio()` is the sole cleanup path.
- `src/utils/indexedDB.ts` owns database version `3`, legacy audio migration, Blob storage, logs, persistence health, and pruning.
- `src/utils/settings.ts` is the only settings migration/default boundary.
- PWA setup lives in `vite.config.ts` and `src/utils/pwa.ts`. Updates must not reload an armed detector.

Production camera failure must be explicit. Never add an automatic simulated-camera fallback to production. A test stream may be injected only inside tests.

Audio playback must not wait for or depend on a successful log write. Local audio must remain untouched by automatic log pruning. Do not store new audio as base64.

Keep motion processing at or below 10 FPS and UI telemetry at or below 2 FPS unless performance evidence on the target device supports a change. Low-power masking must avoid large-canvas repainting while preserving low-resolution detection.

Every visible string needs Ukrainian and English. Preserve the dark museum-control visual language and orange accent unless redesign is requested.

## Required validation

Before handoff, run lint, coverage, build, and Playwright. For camera changes, verify success and permission-denied paths. For PWA changes, verify a controlled service worker can reload offline. For storage changes, test legacy migration and `QuotaExceededError` handling.

Do not claim physical Android readiness from Playwright alone. Final on-device readiness requires a sustained test with the real camera, charger, thermal conditions, app switching, permission loss, and repeated triggers.
