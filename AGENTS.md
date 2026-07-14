# AI Agent Instructions

## Project Identity

This repository is a personal mobile-first museum exhibit motion sensor app. It is intended to run on the user's own Android phone or tablet near an exhibit, detect visitor movement through the camera, play an audio signal or narration, and keep a local event log with snapshots.

Primary target environment:

- Android Chrome on the user's own fixed device, especially kiosk-like museum use.
- PWA/add-to-home-screen behavior before native packaging.
- Optional lightweight Android WebView/Capacitor wrapper if the user wants a personal APK.
- Local development through `http://localhost:3000`.
- Browser APIs that require user gestures or secure contexts: camera, audio unlock, fullscreen, and wake lock.

## Required Agent Skills

For this project, agents should use these installed skills when the task matches their scope:

- `frontend-app-builder`: use for UI/product work on the existing React/Vite app, especially mobile-first PWA flows.
- `frontend-testing-debugging`: use for browser/mobile viewport verification, screenshots, visual regressions, and frontend debugging.
- `react-best-practices`: use for React architecture, state, effects, rendering, performance, bundle, and TypeScript guidance.
- `android-emulator-qa`: use when validating an APK/WebView wrapper or Android flow through `adb`, emulator screenshots, UI tree, and logcat.
- `android-performance`: use when diagnosing Android runtime performance, startup, jank, CPU, frame timing, or memory behavior.

Do not treat `Expo` skills as default for this repository. Use Expo only if the user explicitly chooses a native React Native rewrite. Do not use Zoom Android skills unless a Zoom integration is requested.

Non-goals unless the user explicitly asks:

- Play Store readiness.
- Enterprise distribution.
- Full native rewrite in Expo/React Native.
- Heavy CI/CD or app-store metadata work.

## Canonical Commands

Use these commands from the repository root:

```bash
npm install
npm run dev
npm run lint
npm run build
npm run start
npm run clean
```

Command meanings:

- `npm run dev`: runs `tsx server.ts`; Express serves API routes and Vite middleware on port `3000`.
- `npm run lint`: runs `tsc --noEmit`; this is type-checking, not ESLint.
- `npm run build`: builds the Vite client and bundles `server.ts` to `dist/server.cjs`.
- `npm run start`: runs the production server from `dist/server.cjs`.
- `npm run clean`: removes `dist` and `server.js`.

## Architecture

`server.ts`:

- Creates an Express app on port `3000`.
- Exposes `GET /api/drive/list-folder?folderId=...` to scrape public Google Drive folder HTML and return audio/video-like files.
- Exposes `/api/drive/download?fileId=...` for `GET` and `HEAD`, proxying Drive downloads to avoid browser-side Drive limitations.
- Uses Vite middleware in development.
- Serves `dist/` in production.

`src/App.tsx`:

- Owns global app state: language, settings, logs, kiosk gate, fullscreen, wake lock, tabs, modal visibility, and stealth mode.
- Persists settings, language, and exhibit name through `localStorage`.
- Initializes IndexedDB and loads motion logs on mount.
- Starts kiosk mode by unlocking audio, requesting fullscreen, requesting wake lock, and enabling detection.

`src/components/CameraDetector.tsx`:

- Opens a real camera stream with preferred facing mode.
- Falls back to a simulated canvas stream if physical camera access fails.
- Draws video into a visible canvas and compares tiny hidden-canvas frames at roughly 10 FPS.
- Uses `sensitivity` and `noiseThreshold` from `DetectorSettings` to decide motion triggers.
- Captures a JPEG thumbnail and saves a `MotionLog` to IndexedDB.
- Plays preset or custom audio and coordinates cooldown state with `App.tsx`.

`src/components/SettingsPanel.tsx` and `src/components/MinimalFilesList.tsx`:

- Manage audio source selection.
- Upload local audio files to IndexedDB as base64.
- Import or preview Google Drive audio through the Express API routes.
- Enforce a 12 MB custom audio size limit.

`src/components/LogsPanel.tsx`:

- Displays motion logs and thumbnails.
- Deletes individual logs or clears all logs.
- Shows approximate cache usage and can prune old logs/unused audio.

`src/components/StealthOverlay.tsx`:

- Provides a black screen overlay for exhibit operation.
- Requests wake lock separately.
- Uses a hold-to-exit gesture to avoid accidental unlock.

`src/utils/audio.ts`:

- Owns all active Web Audio and HTML audio playback state.
- `stopAllAudio()` must remain the single cleanup path before starting new audio.
- `unlockAudioContext()` is needed because mobile browsers block audio before user interaction.

`src/utils/indexedDB.ts`:

- Uses database `AndroidMotionDetectorDB`, version `2`.
- Stores `audioFiles` and `motionLogs`.
- Provides cache stats and pruning helpers.

`src/utils/lang.ts`:

- Defines `Language = 'uk' | 'en'`.
- Every visible UI string should be added to both translation sets.

## Data Contracts

`DetectorSettings` in `src/types.ts` is the main user settings contract. Be careful when adding fields because saved settings are loaded from `localStorage` and may not contain new keys.

`MotionLog` contains:

- `id`: generated string.
- `timestamp`: numeric epoch milliseconds.
- `thumbnail`: base64 JPEG or `null`.

`CustomAudioFile` contains:

- `id`: local id or Drive-derived id.
- `name`: display name.
- `data`: base64 data URL.
- `size`: byte size.
- `timestamp`: numeric epoch milliseconds.

## Development Rules

- Preserve Ukrainian and English support. Any new visible UI text needs both translations.
- Keep the app mobile-first. Test narrow layouts before considering desktop-only polish.
- Optimize for the user's own Android device first, not broad market compatibility.
- Prefer improving the existing web/PWA surface before proposing a native rewrite.
- If an APK is needed for personal use, prefer a minimal WebView/Capacitor wrapper around the working app before considering Expo.
- Treat Android Chrome and iOS Safari autoplay restrictions as real constraints.
- Do not assume camera, fullscreen, wake lock, or audio playback can start without a user gesture.
- Keep camera and audio cleanup explicit. Leaking tracks or audio nodes will hurt long-running kiosk use.
- Avoid increasing the frame-diff resolution unless battery/CPU impact has been tested on the target device.
- Keep IndexedDB records small. Thumbnails are already compressed; do not store full-resolution frames.
- Keep Google Drive parsing isolated in `server.ts`; the browser should call local API routes.
- Do not add server-only dependencies to client code.
- Do not store API keys or private Drive links in the repo.

## Validation Checklist

Before handing off changes, run:

```bash
npm run lint
npm run build
```

For behavior changes, also manually verify:

- `npm run dev` serves `http://localhost:3000`.
- Camera permission prompt appears and the video feed renders.
- Detection can be toggled on/off.
- Motion creates a log entry with timestamp and thumbnail.
- Audio can be unlocked and stopped.
- Stealth mode enters and exits through hold gesture.
- Language switching still works for Ukrainian and English.
- Custom audio upload/import does not exceed the 12 MB limit.
- Cache cleanup does not remove the active selected Drive audio.

## Known Risk Areas

- Google Drive folder scraping is brittle and can break when Drive HTML changes.
- The app intentionally falls back to a simulated camera stream, so desktop tests can pass without validating real camera behavior.
- Wake Lock and Fullscreen APIs vary by browser and can fail silently or require gestures.
- Audio autoplay restrictions differ across mobile browsers.
- `localStorage` migrations are informal; new settings must tolerate missing old fields.
- There is no automated browser/E2E test suite yet.

## Agent Handoff Notes

- Read `PROJECT_MEMORY.md` before making broad changes.
- Keep changes scoped; this app is closer to an installation/kiosk tool than a generic web dashboard.
- Treat this as a personal Android/PWA-first project unless the user changes the target.
- Prefer the required installed skills listed above before reaching for generic advice.
- Use Expo skills only if the user asks for a native rewrite or new React Native app.
- Use Android emulator/performance skills when packaging or validating an APK/WebView wrapper.
- If adding tests, prefer focused tests around utility functions first, then Playwright-style smoke tests for camera/audio flows with mocks.
- If changing UI, preserve the current dark museum-control visual language and orange brand accent unless the user asks for a redesign.
