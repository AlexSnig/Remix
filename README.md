# Exhibit Motion

Premium fully local Android APK for a dedicated museum exhibit phone. CameraX detects movement, Media3 plays operator-imported narration through a verified output route, and Device Owner Lock Task keeps the installation in kiosk mode without a server or internet connection.

## Native Android APK

The Capacitor Android target is the canonical production application. The React
interface is packaged locally as its operator UI and switches to the native
`MotionDetector` bridge. The browser/PWA path is retained only for development
and regression testing.

- The foreground Kotlin service owns CameraX analysis (`640 × 480`, 10 FPS,
  `STRATEGY_KEEP_ONLY_LATEST`) and Media3 playback. It has no `INTERNET`
  permission and does not rely on Chrome or a network connection at runtime.
- Audio is imported into app-private Android storage. Playback prefers AUX,
  uses Bluetooth only as an alternative, and never falls back to the phone
  speaker. A route change invalidates the sound test and blocks new triggers.
- The Android operator workflow is: camera permission → local audio import →
  route test → volume → 10-second calibration → motion/playback test → arm.
  The UI includes a native route/status panel, native-only Device Owner kiosk
  commissioning, boot-result status, and JSON diagnostics export.
- The native service uses a partial wake lock only while armed or playing. It
  is `START_NOT_STICKY`: Android never restarts the camera from a background
  boot receiver. A dedicated installation can instead use the supported
  Device Owner → persistent Home activity → visible native service path.

### Dedicated kiosk and automatic startup

The APK has two deliberately different modes:

- **Ordinary APK install:** reboot shows an operator reminder. The app does
  not try to start a camera foreground service from `BOOT_COMPLETED`.
- **Commissioned dedicated exhibit device:** after Device Owner provisioning,
  the APK becomes the persistent Home app. On a boot, `MainActivity` becomes
  visible and only then asks the native service to arm. The service re-checks
  camera permission, local audio, calibration, a completed motion test, and
  the physically matching verified AUX/Bluetooth route. It never uses the
  phone speaker as a fallback.

The kiosk switch remains disabled until all native checks pass and an
operator PIN exists. Audio-route approval, calibration and motion-test proof
are stored in Android DataStore rather than React/localStorage, so a reboot
cannot accidentally rely on stale WebView state. Bluetooth is accepted only
when its saved device name matches; AUX is accepted by its physical route
type. Any route loss invalidates approval and blocks new triggers.

For a true no-touch cold boot, the exhibition phone must have **no PIN,
pattern, or password**. Android keeps app-private audio and settings
credential-encrypted until the first unlock otherwise; this APK never tries
to bypass that security boundary.

Full provisioning and acceptance steps are in
[docs/DEVICE_OWNER_KIOSK.md](docs/DEVICE_OWNER_KIOSK.md).

### Building an APK

Install these local prerequisites before the Android build:

- JDK 21 (`java -version` must report 21)
- Android SDK Platform 36, Build-Tools 36, and Platform-Tools (`adb`)
- A physical target such as the Galaxy A07 for the final verification gate

Set `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) to that SDK, then build the web
bundle and copy it into the native project:

```bash
npm ci
npm run lint
npm run build
npx cap sync android
cd android
./gradlew --no-daemon assembleDebug
```

The debug APK is normally written to
`android/app/build/outputs/apk/debug/app-debug.apk`. For a connected device:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -s ExhibitMotion MotionDetector CameraX AndroidRuntime
```

Before an unattended installation, verify camera permission and rear-camera
framing, imported-audio playback through the intended AUX/Bluetooth route,
route-loss lockout and re-arm, repeated motion triggers, charging, thermal
behaviour, app switching, and the dedicated-device cold-boot matrix. A
successful web build or emulator run alone is not production readiness for
the physical exhibit.

## Native production guarantees

- Production never replaces a failed CameraX stream with a simulated or browser feed.
- Imported narration is copied into app-private Android storage and remains local.
- The APK contains its complete UI, fonts, icons, detector, and playback stack.
- Camera, local audio, verified AUX/Bluetooth route, volume, calibration, motion test, operator PIN, and kiosk state are explicit readiness gates.
- Motion analysis runs at no more than 10 FPS at `36 × 48`; Android owns recovery and the partial Wake Lock.
- Global lighting changes over 70% are ignored and motion must be present in two consecutive frames.

Google Drive and the Express proxy were deliberately removed. Runtime operation never depends on a browser installation, private server, Cloudflare, or internet access.

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

## Browser regression deployment (non-production)

The optional Worker is useful for browser regression tests only. It is not the museum production release channel.

```text
Build command: npm ci && npm run build
Deploy command: npx wrangler deploy
Output directory: dist
Node version: 20
```

`wrangler.jsonc` declares `dist` as the static asset directory and enables Cloudflare's native `single-page-application` fallback. Do not add a catch-all `_redirects` rewrite to `/index.html`; Workers rejects it as an infinite loop. `public/_headers` enables same-origin camera access and safe static headers.

For a manual browser-test deployment, run `npm run deploy`. Do not use that URL as the unattended museum installation.

## Testing

- Vitest covers settings migration, motion math, IndexedDB Blob migration, cache pruning, persistence checks, and storage health writes.
- Playwright validates mobile and desktop kiosk entry, explicit camera denial, console health, screenshot evidence, and offline service-worker reload.
- Playwright screenshots and traces are written under `/tmp`, not committed.
- Android emulator/device QA requires JDK 21, Android SDK/ADB, and (for an
  emulator) `/dev/kvm`. This workstation now has the build SDK and a connected
  Android test phone; browser device emulation is still not a substitute for
  the final Galaxy A07 gate.

The final production stop gate remains a real-device soak test. An emulator cannot validate Galaxy A07 camera behavior, heat, charging, or battery management.

## Data and privacy

Settings use a versioned localStorage schema. Audio and logs use `AndroidMotionDetectorDB` version `3`. Legacy base64 audio is migrated lazily to Blob storage. Automatic cleanup removes only old event logs and never deletes inactive local audio. All visitor thumbnails remain local unless the device owner exports or clears browser data.
