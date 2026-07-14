# Remix Motion Sensor

Autonomous Android-first PWA for a personal museum exhibit. It watches a real camera stream, detects movement, plays a built-in or locally imported audio file, and keeps a small local event log with thumbnails.

## Runtime guarantees

- Production never replaces a failed camera with a simulated feed.
- The selected MP3/M4A/WAV/AAC/OGG file is stored as a `Blob` in IndexedDB and remains available offline.
- A service worker precaches the complete app shell, icons, and local fonts.
- Camera, audio, writable storage, persistent-storage permission, Wake Lock, and HTTPS are shown in the startup readiness panel.
- Camera tracks are cleaned up explicitly and recovered after `ended`, `mute`, device changes, or stalled frames.
- Motion analysis runs at 10 FPS on a `36 × 48` canvas; React status updates are capped at 2 FPS.
- Global lighting changes over 70% are ignored and motion must be present in two consecutive frames.

Google Drive and the Express proxy were deliberately removed. Runtime operation does not depend on a private server or internet access after the first successful PWA load.

## Commands

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
npm run lint
npm run test:coverage
npm run build
npm run preview
npm run test:e2e
```

Development runs at `http://localhost:5173`. Production preview runs at `http://localhost:4173` by default. Camera access on a phone requires HTTPS; localhost is only a development exception.

## Cloudflare Pages

Create a Pages project named `alex-remix-motion-sensor` with:

```text
Build command: npm ci && npm run build
Output directory: dist
Node version: 20
```

`public/_headers` enables same-origin camera access and safe static headers. `public/_redirects` supplies the SPA fallback. After deployment:

1. Open the `pages.dev` HTTPS URL in Android Chrome.
2. Install it with **Add to Home screen**.
3. Start it from the installed icon and grant camera permission.
4. Import narration from the phone before the exhibition goes offline.
5. Confirm all readiness indicators; warnings must be understood before arming.

Service-worker updates are presented as a prompt and cannot be applied while the detector is armed.

## Testing

- Vitest covers settings migration, motion math, IndexedDB Blob migration, cache pruning, persistence checks, and storage health writes.
- Playwright validates mobile and desktop kiosk entry, explicit camera denial, console health, screenshot evidence, and offline service-worker reload.
- Playwright screenshots and traces are written under `/tmp`, not committed.
- Android emulator QA still requires Java, Android SDK/ADB, and `/dev/kvm`. This workstation currently does not expose them, so browser device emulation is not a substitute for the pending Android gate.

The final production stop gate remains a real-device soak test. An emulator cannot validate Galaxy A07 camera behavior, heat, charging, or battery management.

## Data and privacy

Settings use a versioned localStorage schema. Audio and logs use `AndroidMotionDetectorDB` version `3`. Legacy base64 audio is migrated lazily to Blob storage. Automatic cleanup removes only old event logs and never deletes inactive local audio. All visitor thumbnails remain local unless the device owner exports or clears browser data.
