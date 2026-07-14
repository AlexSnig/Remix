# Project Memory

Last updated: 2026-07-14

## Current state

- Repository: `https://github.com/AlexSnig/Remix`, branch `main`.
- Product: personal Android-first museum motion-sensor PWA.
- Runtime: static React 19/Vite 6 build for Cloudflare Pages; no Express server.
- Offline: `vite-plugin-pwa` generateSW strategy precaches app shell, local fonts, and icons.
- Audio: built-in Web Audio beep or a local phone file stored as IndexedDB Blob, maximum 12 MB.
- Storage: `AndroidMotionDetectorDB` version `3`; legacy base64 records migrate lazily.
- Settings: versioned and normalized through `src/utils/settings.ts`; saved camera choice is preserved.
- Camera: production failures are visible errors; there is no simulated production stream.
- Detection: 36 × 48 analysis, 10 FPS maximum, two-frame confirmation, 70% global-light rejection, optional center zone, 10-second calibration.
- Reliability: one Wake Lock owner, visibility recovery, track ended/mute recovery, device-change recovery, and stalled-frame watchdog.
- Updates: service-worker updates require confirmation and are disabled while armed.

## Validation snapshot

- `npm run lint`: passing.
- `npm run test:coverage`: 13 tests passing; 100% lines, 96.91% statements, 84.61% branches, 88.37% functions across selected critical utilities.
- `npm run build`: passing; main JS about 90 KB gzip; PWA precache about 646 KB.
- Playwright: mobile/desktop arming, camera denial, and offline service-worker flows are committed.
- Browser plugin is unavailable, so regular Playwright is the accepted fallback.
- Android emulator gate is blocked on this workstation: Java, Android SDK/ADB, and `/dev/kvm` are unavailable. CPU VT-x exists but KVM is not exposed.

## Product decisions

- Cloudflare Pages project name: `alex-remix-motion-sensor`; fallback `alex-remix-motion-sensor-2026`.
- Runtime must work without a private server. Google Drive integration was removed.
- Audio is imported from the phone and copied locally before offline use.
- PWA-first remains the target. Capacitor is considered only after a real-device PWA soak test fails.
- Play Store, Expo rewrite, enterprise deployment, cloud logging, and visitor identification are out of scope.

## Remaining production gate

Cloudflare authentication/deployment and Android hardware/emulator access are external prerequisites. The final trustworthy test is an 8-hour Galaxy A07 run with charging, heat observation, 100+ triggers, network loss, background/foreground, camera permission loss, storage pressure, and repeated custom narration playback.
