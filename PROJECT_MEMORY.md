# Project Memory

Last updated: 2026-07-21

## Current state

- Repository: `https://github.com/AlexSnig/Remix`, branch `main`.
- Product: premium fully local Android museum motion-sensor APK for a dedicated kiosk phone.
- Current release: `1.2.1` (`versionCode` 4). Package `ua.alexsnig.exhibitmotion`. `v1.2.0` is tagged but its APK is defective — see the release-only R8 crash below.
- Release signing certificate SHA-256: `bfd47221742dfdb12763a42f7cafdfdcd74469bd712e9616cb3dfa2501100f7e` (RSA 4096, alias `exhibit-motion`, valid to 2053). Keystore lives outside the repo; Gradle credentials are in the gitignored `android/keystore.properties`.
- Runtime: signed Capacitor APK; React is the local operator WebView and Kotlin owns production behavior. No server or network is required.
- Audio: operator-imported local audio in app-private storage; only a verified AUX or named Bluetooth route is accepted, never the phone speaker.
- Storage: Android DataStore owns settings/readiness and Room owns the bounded event log.
- Camera: CameraX foreground service at 36 × 48 analysis and at most 10 FPS; no simulated or browser fallback exists in the APK.
- Kiosk: Device Owner, persistent Home activity, Lock Task, operator PIN, visible-activity boot resume, and explicit ordinary-install behavior.
- Browser/PWA: retained only for UI and regression testing; Cloudflare is not a production dependency or release target.

## Validation snapshot

- `npm run lint`: passing.
- `npm run test:coverage`: 13 tests passing; 100% lines, 96.91% statements, 84.61% branches, 88.37% functions across selected critical utilities.
- `npm run build`: passing; main JS about 90 KB gzip; PWA precache about 646 KB.
- `npm run test:e2e`: 6/6 mobile/desktop arming, camera-denial, and offline service-worker scenarios passing.
- Browser plugin is unavailable, so regular Playwright is the accepted fallback.
- Android native gate (`testDebugUnitTest`, `lintDebug`, `assembleDebug`, `assembleRelease`) passes on this workstation with JDK 21 and a local Android SDK/emulator (`BUILD SUCCESSFUL`, 11/11 unit tests, 0 lint errors). The release APK signature was independently verified with `apksigner` against the existing release key. This environment previously lacked Java/SDK/KVM; that gap has since been closed.

## Release-build hazard

Minified release builds are not covered by any automated check in this repository. On 2026-07-22 R8 stripped the Capacitor annotation types, which made `getPermissionState("camera")` throw a `NullPointerException` and killed the app on the first wizard step. Debug builds were unaffected because they are not minified, so lint, unit tests, Playwright, and a debug install on a second phone all reported success while the signed client APK was unusable.

Keep rules for `com.getcapacitor.annotation.**` and the plugin reflection surface now live in `android/app/proguard-rules.pro`. Do not remove them, and do not assume a green automated run says anything about the minified artifact. Before shipping any release APK, install that exact APK on a real phone and walk the operator wizard at least as far as granting camera permission. A quick structural check is to count annotation descriptors in the packaged DEX; a healthy build references `Lcom/getcapacitor/annotation/CapacitorPlugin;` at least once.

## Product decisions

- Native APK and Device Owner kiosk are the canonical production target.
- Runtime must be fully local. Google Drive, private servers, cloud logging, and visitor identification remain out of scope.
- Audio is copied into app-private Android storage before arming.
- Direct controlled installation is the release channel; Play Store and enterprise MDM distribution remain out of scope unless explicitly added later.

## Client handoff

- The client delivery package is assembled outside this repository, so the signing key can never be committed. It holds the 1.2.0 APK, staff PDF, Device Owner guide, a verification report, a build guide, and the signing key in an isolated subfolder with its own checksums so it can be delivered separately over a secure channel. The maintainer keeps its location privately; it is deliberately not recorded here.
- Superseded 1.1.0 artifacts were removed from the repository root and archived offline. That build predates the tagged history and exists nowhere else.
- The handoff keystore was verified end-to-end: re-signing an APK using only the files in the package reproduces the shipped certificate fingerprint exactly.

## Remaining production gate

A reproducible signed release build with the existing signing identity is now done and tagged. The remaining gates are Device Owner provisioning on the target phone and an 8-hour Galaxy A07 run with charging, heat observation, 100+ triggers, cold boot, route loss, app switching, camera permission loss, storage pressure, and repeated custom narration playback. Automated results must never be presented as physical readiness.
