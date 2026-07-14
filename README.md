# Remix Motion Sensor

Personal mobile-first museum exhibit motion sensor built with React, Vite, Express, and browser camera APIs. The app turns the user's own Android phone or tablet into a kiosk-style detector: it watches a camera feed, detects frame changes, plays a selected audio signal, stores motion logs locally, and can mask the screen while detection keeps running.

## What The App Does

- Starts in a museum kiosk gate, then enters fullscreen and keeps the display awake when supported.
- Uses `navigator.mediaDevices.getUserMedia()` to open the front or rear camera.
- Compares low-resolution video frames on a hidden canvas to detect motion with low CPU usage.
- Plays a built-in Web Audio beep or a custom uploaded/imported audio file.
- Saves custom audio and motion logs in IndexedDB.
- Stores user settings, language, kiosk state, and exhibit name in `localStorage`.
- Provides Ukrainian and English interface text.
- Lists and imports public Google Drive audio files through local Express proxy routes.
- Provides stealth mode: black screen, hidden status, hold-to-exit control, and wake-lock request.

## Android Strategy

This project is optimized for personal use first:

- First target: Android Chrome/PWA/add-to-home-screen.
- Next practical target, if an APK is needed: lightweight WebView or Capacitor wrapper.
- Native Expo/React Native rewrite is not the default path unless the product requirements change.
- Play Store and enterprise distribution are out of scope unless explicitly requested.

## Tech Stack

- React 19 with TypeScript.
- Vite 6 with `@vitejs/plugin-react`.
- Tailwind CSS 4 through `@tailwindcss/vite`.
- Express server in `server.ts`.
- Web APIs: Camera, Canvas, Web Audio, Fullscreen, Wake Lock, IndexedDB, `localStorage`.
- Icons from `lucide-react`.

## Project Structure

```text
.
├── server.ts                  # Express API routes and Vite middleware/static serving
├── src/App.tsx                # Main app state, kiosk gate, tabs, settings, logs, stealth mode
├── src/components/
│   ├── CameraDetector.tsx     # Camera stream, frame differencing, trigger handling
│   ├── LogsPanel.tsx          # Motion history, thumbnails, cache stats, pruning
│   ├── MinimalFilesList.tsx   # Compact audio picker and Drive import UI
│   ├── SettingsPanel.tsx      # Full settings/audio/cache controls
│   └── StealthOverlay.tsx     # Blackout overlay and hold-to-unlock flow
├── src/utils/
│   ├── audio.ts               # Web Audio presets and custom audio playback
│   ├── indexedDB.ts           # Local audio/log persistence and cache cleanup
│   └── lang.ts                # Ukrainian and English translations
├── src/types.ts               # Shared data contracts
├── src/index.css              # Tailwind import, theme tokens, base styles
├── vite.config.ts             # Vite config and HMR/watch behavior
├── AGENTS.md                  # Canonical AI-agent instructions
├── CLAUDE.md                  # Claude entrypoint, delegates to AGENTS.md
├── GEMINI.md                  # Gemini entrypoint, delegates to AGENTS.md
└── PROJECT_MEMORY.md          # Durable project facts and current assumptions
```

## Local Setup

Prerequisites:

- Node.js 20+ recommended.
- A browser with camera support. Chrome/Android is the main target.
- HTTPS or localhost for camera access. Localhost is accepted by browsers.

Install dependencies:

```bash
npm install
```

Optional environment:

```bash
cp .env.example .env.local
```

`GEMINI_API_KEY` and `APP_URL` are inherited from the AI Studio template. The current codebase does not call Gemini APIs directly; keep them only if future AI features need them.

Run development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Build production bundle:

```bash
npm run build
```

Run built server:

```bash
npm run start
```

Type-check:

```bash
npm run lint
```

Clean generated output:

```bash
npm run clean
```

## Runtime Notes

- The server always listens on port `3000`.
- In development, Express mounts Vite in middleware mode.
- In production, Express serves `dist/` and falls back to `dist/index.html`.
- Google Drive import depends on scraping public Drive folder HTML. This is fragile by nature and may need maintenance if Google changes markup.
- If no Drive files are discovered, `server.ts` returns a built-in fallback audio list.
- The app falls back to a simulated camera stream if physical camera access fails, useful for desktop development.
- The main production check for this personal app is testing on the actual Android device that will run it.

## AI Agent Files

Read `AGENTS.md` first before changing code. `PROJECT_MEMORY.md` stores the current verified project facts, operational assumptions, and known risks for future agents.

Agents working on this project should use the installed skills named in `AGENTS.md`: `frontend-app-builder`, `frontend-testing-debugging`, `react-best-practices`, `android-emulator-qa`, and `android-performance`.
