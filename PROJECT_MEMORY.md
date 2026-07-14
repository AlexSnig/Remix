# Project Memory

Last updated: 2026-07-14

## Verified Current State

- Repository: `https://github.com/AlexSnig/Remix`.
- Local path: `/home/alex/Remix`.
- Branch after clone: `main` tracking `origin/main`.
- Package name in `package.json`: `react-example`.
- Dependency lockfile: `package-lock.json` was generated locally with `npm install`.
- Runtime server: `server.ts`, Express on port `3000`.
- Frontend: React 19, TypeScript, Vite 6, Tailwind CSS 4.
- Primary app purpose: personal Android/PWA-first museum exhibit motion sensor with camera detection, audio playback, kiosk gate, stealth overlay, and local event logs.
- Main language default: Ukrainian. English is also supported.
- Primary persistence:
  - `localStorage` for detector settings, language, and exhibit name.
  - IndexedDB database `AndroidMotionDetectorDB` version `2` for `audioFiles` and `motionLogs`.
- Google Drive support is implemented through Express proxy/scraper routes, not directly from client-side Drive APIs.
- Current automated validation command is `npm run lint`, which runs `tsc --noEmit`.
- Validation on 2026-07-14: `npm run lint` passed and `npm run build` passed.

## Operational Assumptions

- Target browser is Android Chrome on the user's own fixed phone/tablet in a museum or exhibit setting.
- Current product target is personal use, not Play Store or enterprise distribution.
- Preferred path is to harden the current React/Vite app as PWA/add-to-home-screen first.
- If a personal APK becomes necessary, prefer a lightweight WebView/Capacitor wrapper before a full Expo/React Native rewrite.
- Localhost is valid for development camera access; production should be served over HTTPS.
- Camera/audio/fullscreen/wake-lock flows may require direct user gestures.
- The app should remain useful even without a real camera during development because `CameraDetector` can create a simulated stream.
- Google Drive folders/files used for audio should be public or otherwise downloadable without interactive login.

## Important Implementation Facts

- `App.tsx` forces `cameraFacingMode` to `user` when loading saved settings.
- Kiosk gate defaults to visible unless saved settings explicitly set `kioskModeEnabled === false`.
- `CameraDetector` throttles frame processing to about 10 FPS and diffs a `36 x 48` hidden canvas for battery efficiency.
- `noiseThreshold` is the percentage of changed pixels required to trigger motion.
- `sensitivity` maps to per-pixel color difference threshold; higher sensitivity means lower required difference.
- Motion trigger captures a compressed JPEG thumbnail from the visible canvas.
- `stopAllAudio()` in `src/utils/audio.ts` is the central cleanup path for preset and custom audio.
- Custom audio files are stored as base64 data URLs in IndexedDB and capped at 12 MB in UI flows.
- Drive-imported audio IDs are prefixed with `drive_`; cache pruning preserves the currently selected audio and Drive audio in one pruning path.

## Known Risks And Technical Debt

- Google Drive HTML scraping in `server.ts` is fragile and should be tested whenever Drive import matters.
- There is duplicated Drive/audio selection logic between `SettingsPanel.tsx` and `MinimalFilesList.tsx`.
- There is no dedicated migration layer for old `localStorage` settings.
- There is no automated browser test suite for camera/audio/fullscreen/wake-lock flows.
- Native Android packaging has not been added yet; current app is still a web app served by Express/Vite.
- README previously came from an AI Studio template and has now been rewritten to match the actual app.
- `vite.config.ts` contains a mojibake character in a comment. It is harmless but should be cleaned in a small formatting pass.

## Recommended Next Improvements

- Add/update PWA metadata and service worker strategy for personal Android install-from-browser use.
- Test the app on the user's actual Android device before any native wrapper work.
- If APK is still needed after PWA testing, evaluate Capacitor/WebView wrapper with minimal native surface.
- Add Playwright smoke tests with mocked camera/media APIs.
- Extract duplicated Drive import logic into a shared utility or hook.
- Add a small settings-normalization helper so new `DetectorSettings` fields get defaults safely.
- Make server port configurable through `PORT` while preserving `3000` default.
- Add a private/personal deployment note once the hosting target is known.
