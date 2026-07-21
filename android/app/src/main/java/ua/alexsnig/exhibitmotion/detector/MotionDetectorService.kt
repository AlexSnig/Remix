package ua.alexsnig.exhibitmotion.detector

import android.Manifest
import android.annotation.SuppressLint
import android.app.Service
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Rect
import android.media.AudioDeviceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.annotation.OptIn
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.media3.common.C
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Collections
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.max
import kotlin.math.min

/**
 * The only owner of the production camera. It remains START_NOT_STICKY: an
 * Android boot receiver never restarts it. A commissioned Device Owner HOME
 * activity may explicitly request ACTION_AUTO_START only after it is visible.
 */
class MotionDetectorService : LifecycleService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    // Media3 players are bound to the application looper on which they are
    // created. Keep every player operation on Android's main looper; service
    // actions and CameraX analysis may otherwise arrive on worker threads.
    private val playerScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private lateinit var store: DetectorStore
    private lateinit var routeMonitor: AudioRouteMonitor
    private lateinit var wakeLock: PowerManager.WakeLock

    private var cameraProvider: ProcessCameraProvider? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var player: ExoPlayer? = null
    @Volatile private var settings = MotionSettings()
    private var previousFrame: IntArray? = null
    private var lastAnalyzedAtMs = 0L
    @Volatile private var analyzedFrameCount = 0L
    @Volatile private var lastFrameAtMs = 0L
    private var consecutiveFrames = 0
    private val calibrationSamples = Collections.synchronizedList(mutableListOf<Double>())
    private var calibrationJob: Job? = null
    private var cooldownJob: Job? = null
    private var cameraWatchdogJob: Job? = null
    @Volatile private var isCalibrating = false
    @Volatile private var isTestingAudio = false
    @Volatile private var routeTestStartedAtMs = 0L
    @Volatile private var routeVerified = false
    @Volatile private var motionTriggeredInCurrentRun = false
    @Volatile private var startedFromAutoResume = false
    private var cameraRecoveryAttempts = 0
    @Volatile private var cameraBoundAtElapsedMs = 0L
    @Volatile private var lastFrameAtElapsedMs = 0L
    private val startedAtElapsedMs = SystemClock.elapsedRealtime()

    override fun onCreate() {
        super.onCreate()
        activeInstance = this
        store = DetectorStore.get(this)
        wakeLock = getSystemService(PowerManager::class.java)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:motion-detector")
        routeMonitor = AudioRouteMonitor(this) { onAudioDevicesChanged() }
        MotionNotifications.ensureChannels(this)
        routeMonitor.start()
        serviceScope.launch { store.recordServiceStart() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // LifecycleService advances its LifecycleRegistry here. Without this
        // call CameraX can bind the use case but never open the camera.
        super.onStartCommand(intent, flags, startId)
        promoteToForeground()
        when (intent?.action ?: ACTION_START) {
            ACTION_START -> {
                startedFromAutoResume = false
                startArmedRun()
            }
            ACTION_AUTO_START -> {
                startedFromAutoResume = true
                startArmedRun()
            }
            ACTION_STOP -> stopDetector("Датчик зупинено оператором")
            ACTION_TEST_AUDIO -> playRouteTest()
            ACTION_CONFIRM_AUDIO -> confirmRouteTest()
            ACTION_CANCEL_AUDIO -> cancelRouteTest()
            ACTION_CALIBRATE -> startCalibration()
        }
        return Service.START_NOT_STICKY
    }

    /** A Bluetooth exhibit has to come back on its own after a power cut. The
     * radio may boot off, and Android reconnects a bonded speaker only once the
     * adapter is on, so switch it on and wait for the approved device to appear.
     * There is no public API to force an A2DP connection, so this relies on
     * Android's own reconnect to a bonded device and simply gives it time.
     * Never scans and never pairs: only an already approved speaker qualifies. */
    // hasBluetoothConnectPermission() guards every adapter call below; lint
    // cannot follow the check through a helper.
    @SuppressLint("MissingPermission")
    private suspend fun awaitApprovedBluetoothRoute(): AudioRoute {
        var route = resolveRoute()
        if (route.kind != AudioRouteKind.UNAVAILABLE) return route
        val verified = store.loadVerifiedAudioRoute() ?: return route
        if (verified.kind != AudioRouteKind.BLUETOOTH) return route

        if (!hasBluetoothConnectPermission()) {
            recordAutoStartResult("waiting_for_route", "Немає дозволу Bluetooth для автопідключення колонки")
            return route
        }
        val adapter = getSystemService(BluetoothManager::class.java)?.adapter ?: return route
        if (!adapter.isEnabled) {
            transition(DetectorStatus.STARTING, "Вмикаю Bluetooth для затвердженої колонки", route)
            @Suppress("DEPRECATION")
            val accepted = runCatching { adapter.enable() }.getOrDefault(false)
            if (!accepted) {
                // Only a Device Owner may switch the radio on from Android 13.
                recordAutoStartResult("waiting_for_route", "Не вдалося увімкнути Bluetooth автоматично")
                return route
            }
        }
        transition(DetectorStatus.STARTING, "Очікую підключення колонки ${verified.bluetoothName ?: ""}".trim(), route)
        val deadline = SystemClock.elapsedRealtime() + BLUETOOTH_RECONNECT_TIMEOUT_MS
        while (SystemClock.elapsedRealtime() < deadline) {
            delay(BLUETOOTH_POLL_INTERVAL_MS)
            route = resolveRoute()
            if (store.isAudioRouteVerified(route)) return route
        }
        return resolveRoute()
    }

    private fun startArmedRun() {
        serviceScope.launch {
            settings = store.loadSettings()
            val route = awaitApprovedBluetoothRoute()
            routeVerified = store.isAudioRouteVerified(route)
            when {
                !hasCameraPermission() -> fail("Доступ до камери не надано")
                !hasImportedAudio() -> fail("Спочатку імпортуйте локальний аудіофайл")
                route.kind == AudioRouteKind.UNAVAILABLE -> {
                    recordAutoStartResult("waiting_for_route", "Звук недоступний: підключіть AUX або вибраний Bluetooth")
                    audioRouteLost("Звук недоступний: підключіть AUX або вибраний Bluetooth")
                }
                !routeVerified -> {
                    recordAutoStartResult("waiting_for_route", "Потрібен тест звуку або повернення перевіреного маршруту")
                    transition(
                        DetectorStatus.IDLE,
                        "Потрібен тест звуку перед увімкненням",
                        route,
                    )
                }
                else -> startCamera(DetectorStatus.STARTING, "Запуск основної камери")
            }
        }
    }

    private fun startCalibration() {
        serviceScope.launch {
            settings = store.loadSettings()
            val route = resolveRoute()
            if (!hasCameraPermission()) return@launch fail("Доступ до камери не надано")
            isCalibrating = true
            calibrationSamples.clear()
            transition(DetectorStatus.STARTING, "Калібрування: не рухайтесь перед камерою", route)
            startCamera(DetectorStatus.STARTING, "Калібрування: 10 секунд")
            calibrationJob?.cancel()
            calibrationJob = serviceScope.launch {
                delay(CALIBRATION_DURATION_MS)
                val samples = synchronized(calibrationSamples) { calibrationSamples.toList() }
                val threshold = MotionMath.calibratedThreshold(samples)
                settings = settings.copy(noiseThreshold = threshold, calibratedNoiseFloor = threshold)
                store.saveSettings(settings)
                store.clearMotionTestPassed()
                isCalibrating = false
                withContext(Dispatchers.Main.immediate) {
                    stopCamera()
                    transition(DetectorStatus.IDLE, "Калібрування завершено: ${"%.1f".format(threshold)}%", route)
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                }
            }
        }
    }

    private fun playRouteTest() {
        serviceScope.launch {
            settings = store.loadSettings()
            val route = resolveRoute()
            when {
                !hasImportedAudio() -> fail("Спочатку імпортуйте локальний аудіофайл")
                route.kind == AudioRouteKind.UNAVAILABLE -> audioRouteLost("Звук недоступний: тест не розпочато")
                else -> {
                    isTestingAudio = true
                    routeTestStartedAtMs = SystemClock.elapsedRealtime()
                    transition(
                        DetectorStatus.PLAYING,
                        "Тест звуку через ${route.displayName}. Підтвердьте, коли почуєте звук",
                        route,
                    )
                    startPlayback(route)
                }
            }
        }
    }

    /** The operator, not the file length, decides when a route test succeeded.
     * Narration can run for minutes, and only a person can confirm that the
     * approved speaker is actually audible. */
    private fun confirmRouteTest() {
        if (!isTestingAudio) return
        if (SystemClock.elapsedRealtime() - routeTestStartedAtMs < MIN_ROUTE_TEST_MS) {
            transition(
                DetectorStatus.PLAYING,
                "Дослухайте ще кілька секунд, перш ніж підтверджувати",
                resolveRoute(),
            )
            return
        }
        completeRouteTest(resolveRoute())
    }

    /** Shared by operator confirmation and by a file that played to its end. */
    private fun completeRouteTest(route: AudioRoute) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            playerScope.launch { completeRouteTest(route) }
            return
        }
        player?.release()
        player = null
        if (route.kind == AudioRouteKind.UNAVAILABLE) {
            isTestingAudio = false
            routeTestStartedAtMs = 0L
            audioRouteLost("Аудіомаршрут зник під час тесту")
            return
        }
        serviceScope.launch {
            val verified = store.saveVerifiedAudioRoute(route)
            if (verified == null) {
                withContext(Dispatchers.Main.immediate) {
                    isTestingAudio = false
                    routeTestStartedAtMs = 0L
                    fail("Не вдалося зберегти перевірку аудіомаршруту")
                }
                return@launch
            }
            if (route.kind == AudioRouteKind.BLUETOOTH) {
                settings = settings.copy(
                    preferredBluetoothDeviceId = route.deviceId,
                    preferredBluetoothDeviceName = route.name,
                )
                store.saveSettings(settings)
            }
            withContext(Dispatchers.Main.immediate) {
                isTestingAudio = false
                routeTestStartedAtMs = 0L
                routeVerified = true
                transition(DetectorStatus.IDLE, "Тест звуку успішний: ${route.displayName}", route)
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    private fun cancelRouteTest() {
        if (!isTestingAudio) return
        isTestingAudio = false
        routeTestStartedAtMs = 0L
        player?.release()
        player = null
        serviceScope.launch {
            // A failed test must never leave an earlier approval in place.
            store.clearVerifiedAudioRoute()
            withContext(Dispatchers.Main.immediate) {
                routeVerified = false
                transition(DetectorStatus.IDLE, "Тест звуку скасовано", resolveRoute())
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    private fun startCamera(startStatus: DetectorStatus, message: String) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            playerScope.launch { startCamera(startStatus, message) }
            return
        }
        transition(startStatus, message, resolveRoute())
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            try {
                val provider = providerFuture.get()
                val analysis = ImageAnalysis.Builder()
                    .setResolutionSelector(
                        ResolutionSelector.Builder()
                            .setResolutionStrategy(
                                ResolutionStrategy(
                                    Size(640, 480),
                                    ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                                ),
                            )
                            .build(),
                    )
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                    .build()
                analysis.setAnalyzer(cameraExecutor, ::analyzeFrame)
                provider.unbindAll()
                val cameraSelector = if (settings.cameraFacingMode == "environment") {
                    CameraSelector.DEFAULT_BACK_CAMERA
                } else {
                    CameraSelector.DEFAULT_FRONT_CAMERA
                }
                provider.bindToLifecycle(this, cameraSelector, analysis)
                cameraProvider = provider
                imageAnalysis = analysis
                previousFrame = null
                lastAnalyzedAtMs = 0L
                analyzedFrameCount = 0L
                lastFrameAtMs = 0L
                lastFrameAtElapsedMs = 0L
                cameraBoundAtElapsedMs = SystemClock.elapsedRealtime()
                consecutiveFrames = 0
                motionTriggeredInCurrentRun = false
                startCameraWatchdog()
                // Do not announce an active detector until CameraX actually
                // delivers its first frame. Binding a use case alone is not
                // evidence that the camera can stream.
            } catch (error: Exception) {
                recoverCamera(error)
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun analyzeFrame(image: ImageProxy) {
        try {
            val now = SystemClock.elapsedRealtime()
            if (now - lastAnalyzedAtMs < FRAME_INTERVAL_MS) return
            lastAnalyzedAtMs = now
            val current = downsampleToRgb(image, ANALYSIS_WIDTH, ANALYSIS_HEIGHT)
            analyzedFrameCount += 1
            lastFrameAtMs = System.currentTimeMillis()
            lastFrameAtElapsedMs = now
            val previous = previousFrame
            if (previous == null) {
                previousFrame = current
                cameraRecoveryAttempts = 0
                if (!isCalibrating && DetectorRuntime.current().status == DetectorStatus.STARTING) {
                    transition(
                        DetectorStatus.ARMED,
                        "Датчик активний",
                        resolveRoute(),
                        motionPercent = 0.0,
                    )
                }
                return
            }

            val analysis = MotionMath.analyze(
                current,
                previous,
                ANALYSIS_WIDTH,
                ANALYSIS_HEIGHT,
                settings.sensitivity,
                settings.detectionZone,
            )
            previousFrame = current
            if (isCalibrating) {
                calibrationSamples += analysis.percentageChanged
                return
            }

            val snapshot = DetectorRuntime.current()
            if (snapshot.status != DetectorStatus.ARMED) return
            if (analysis.percentageChanged >= settings.noiseThreshold &&
                analysis.percentageChanged < settings.globalChangeCeiling
            ) {
                consecutiveFrames += 1
            } else {
                consecutiveFrames = 0
            }

            transition(
                DetectorStatus.ARMED,
                "Датчик активний",
                resolveRoute(),
                motionPercent = analysis.percentageChanged,
            )
            if (MotionMath.shouldTrigger(
                    analysis.percentageChanged,
                    settings.noiseThreshold,
                    settings.globalChangeCeiling,
                    consecutiveFrames,
                    settings.requiredConsecutiveFrames,
                )
            ) {
                consecutiveFrames = 0
                trigger(analysis.percentageChanged)
            }
        } catch (error: Exception) {
            recoverCamera(error)
        } finally {
            image.close()
        }
    }

    private fun trigger(motionPercent: Double) {
        val route = resolveRoute()
        if (route.kind == AudioRouteKind.UNAVAILABLE || !routeVerified) {
            audioRouteLost("Аудіомаршрут втрачено; нові спрацювання заблоковано")
            return
        }
        motionTriggeredInCurrentRun = true
        transition(DetectorStatus.TRIGGERED, "Рух виявлено", route, motionPercent)
        serviceScope.launch {
            store.recordEvent(
                MotionEventEntity(
                    id = UUID.randomUUID().toString(),
                    timestampMs = System.currentTimeMillis(),
                    motionPercent = motionPercent,
                    threshold = settings.noiseThreshold,
                ),
                keep = MAX_EVENTS,
            )
        }
        transition(DetectorStatus.PLAYING, "Відтворення через ${route.displayName}", route, motionPercent)
        startPlayback(route)
    }

    @OptIn(markerClass = [UnstableApi::class])
    private fun startPlayback(route: AudioRoute) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            playerScope.launch { startPlayback(route) }
            return
        }
        val audio = File(filesDir, "audio/${settings.customAudioId ?: ""}")
        if (!audio.isFile) {
            fail("Локальний аудіофайл відсутній")
            return
        }
        player?.release()
        player = ExoPlayer.Builder(this).build().also { exo ->
            exo.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                    .build(),
                true,
            )
            route.deviceId?.let { deviceId ->
                getSystemService(android.media.AudioManager::class.java)
                    .getDevices(android.media.AudioManager.GET_DEVICES_OUTPUTS)
                    .firstOrNull { it.id == deviceId }
                    ?.let(exo::setPreferredAudioDevice)
            }
            exo.volume = settings.audioVolume / 100f
            exo.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    if (state == Player.STATE_ENDED) onPlaybackFinished(route)
                }

                override fun onPlayerError(error: PlaybackException) {
                    fail("Не вдалося відтворити аудіо: ${error.errorCodeName}")
                }
            })
            exo.setMediaItem(MediaItem.fromUri(Uri.fromFile(audio)))
            exo.prepare()
            exo.play()
        }
    }

    private fun onPlaybackFinished(route: AudioRoute) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            playerScope.launch { onPlaybackFinished(route) }
            return
        }
        player?.release()
        player = null
        if (isTestingAudio) {
            completeRouteTest(route)
            return
        }
        cooldownJob?.cancel()
        cooldownJob = serviceScope.launch {
            val seconds = max(2, settings.coolDownDelaySeconds)
            for (remaining in seconds downTo 1) {
                transition(DetectorStatus.COOLDOWN, "Пауза після сигналу: ${remaining} с", route, cooldown = remaining)
                delay(1_000)
            }
            val currentRoute = resolveRoute()
            routeVerified = store.isAudioRouteVerified(currentRoute)
            if (currentRoute.kind == AudioRouteKind.UNAVAILABLE || !routeVerified) {
                audioRouteLost("Аудіомаршрут втрачено під час паузи")
            } else {
                transition(DetectorStatus.ARMED, "Датчик активний", currentRoute)
            }
        }
    }

    private fun onAudioDevicesChanged() {
        // During an explicit route test the operator may be attaching the
        // approved output. Do not invalidate the test before playback ends.
        if (isTestingAudio) return
        serviceScope.launch {
            val route = resolveRoute()
            val stillVerified = store.isAudioRouteVerified(route)
            routeVerified = stillVerified
            val active = DetectorRuntime.current().status
            if (active in setOf(DetectorStatus.ARMED, DetectorStatus.TRIGGERED, DetectorStatus.PLAYING, DetectorStatus.COOLDOWN) &&
                !stillVerified
            ) {
                audioRouteLost("Аудіомаршрут змінено або відключено; потрібні тест звуку й повторне увімкнення")
            }
        }
    }

    private fun audioRouteLost(message: String) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            playerScope.launch { audioRouteLost(message) }
            return
        }
        routeVerified = false
        serviceScope.launch {
            store.clearVerifiedAudioRoute()
            recordAutoStartResult("waiting_for_route", message)
        }
        player?.stop()
        player?.release()
        player = null
        cooldownJob?.cancel()
        stopCamera()
        transition(DetectorStatus.AUDIO_ROUTE_LOST, message, AudioRoute.unavailable())
    }

    private fun recoverCamera(error: Exception) {
        Log.e(TAG, "Camera pipeline failure", error)
        if (isCalibrating || DetectorRuntime.current().status !in setOf(DetectorStatus.ARMED, DetectorStatus.STARTING)) {
            fail("Не вдалося запустити вибрану камеру. Перевірте вибір камери та повторіть спробу")
            return
        }
        cameraRecoveryAttempts += 1
        if (cameraRecoveryAttempts > MAX_CAMERA_RECOVERY_ATTEMPTS) {
            fail("Камера не відновилась після $MAX_CAMERA_RECOVERY_ATTEMPTS спроб")
            return
        }
        stopCamera()
        serviceScope.launch {
            store.recordCameraRestart()
            transition(DetectorStatus.RECOVERING, "Відновлення камери ($cameraRecoveryAttempts/$MAX_CAMERA_RECOVERY_ATTEMPTS)")
            delay(CAMERA_RECOVERY_DELAY_MS)
            startCamera(DetectorStatus.STARTING, "Повторний запуск камери")
        }
    }

    private fun startCameraWatchdog() {
        cameraWatchdogJob?.cancel()
        cameraWatchdogJob = serviceScope.launch {
            while (true) {
                delay(CAMERA_WATCHDOG_INTERVAL_MS)
                val status = DetectorRuntime.current().status
                if (status in setOf(DetectorStatus.IDLE, DetectorStatus.AUDIO_ROUTE_LOST, DetectorStatus.FAULT)) return@launch
                if (status !in setOf(DetectorStatus.STARTING, DetectorStatus.ARMED)) continue
                val now = SystemClock.elapsedRealtime()
                if (CameraHealth.isFrameStalled(
                        nowElapsedMs = now,
                        cameraBoundAtElapsedMs = cameraBoundAtElapsedMs,
                        lastFrameAtElapsedMs = lastFrameAtElapsedMs,
                        timeoutMs = CAMERA_STALL_TIMEOUT_MS,
                    )
                ) {
                    playerScope.launch {
                        recoverCamera(IllegalStateException("Camera frames stopped"))
                    }
                    return@launch
                }
            }
        }
    }

    private fun stopDetector(message: String) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            playerScope.launch { stopDetector(message) }
            return
        }
        calibrationJob?.cancel()
        cooldownJob?.cancel()
        player?.stop()
        player?.release()
        player = null
        stopCamera()
        // A normal operator stop does not alter the selected output route.
        // Keep a successful route test valid; only an actual route loss
        // (handled by audioRouteLost) must force another sound test.
        transition(DetectorStatus.IDLE, message, resolveRoute())
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun stopCamera() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            playerScope.launch { stopCamera() }
            return
        }
        imageAnalysis?.clearAnalyzer()
        cameraWatchdogJob?.cancel()
        cameraWatchdogJob = null
        imageAnalysis = null
        cameraProvider?.unbindAll()
        cameraProvider = null
        previousFrame = null
        cameraBoundAtElapsedMs = 0L
        lastFrameAtElapsedMs = 0L
    }

    private fun fail(message: String) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            playerScope.launch { fail(message) }
            return
        }
        serviceScope.launch { store.recordError() }
        calibrationJob?.cancel()
        cooldownJob?.cancel()
        player?.release()
        player = null
        stopCamera()
        routeVerified = false
        serviceScope.launch {
            store.clearVerifiedAudioRoute()
            recordAutoStartResult("failed", message)
        }
        transition(DetectorStatus.FAULT, message, resolveRoute())
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun transition(
        status: DetectorStatus,
        message: String,
        route: AudioRoute = resolveRoute(),
        motionPercent: Double = DetectorRuntime.current().motionPercent,
        cooldown: Int = 0,
    ) {
        val snapshot = DetectorSnapshot(
            status = status,
            message = message,
            audioRoute = route,
            motionPercent = motionPercent,
            analyzedFrameCount = analyzedFrameCount,
            lastFrameAtMs = lastFrameAtMs,
            cooldownRemainingSeconds = cooldown,
            requiresSoundTest = !routeVerified,
        )
        DetectorRuntime.update(snapshot)
        applyWakeLock(status)
        if (status != DetectorStatus.IDLE) {
            getSystemService(android.app.NotificationManager::class.java)
                .notify(MotionNotifications.SERVICE_NOTIFICATION_ID, MotionNotifications.service(this, snapshot))
        }
    }

    private fun applyWakeLock(status: DetectorStatus) {
        val shouldHold = status in setOf(
            DetectorStatus.STARTING,
            DetectorStatus.ARMED,
            DetectorStatus.TRIGGERED,
            DetectorStatus.PLAYING,
            DetectorStatus.COOLDOWN,
            DetectorStatus.RECOVERING,
        )
        if (shouldHold && !wakeLock.isHeld) wakeLock.acquire()
        if (!shouldHold && wakeLock.isHeld) wakeLock.release()
    }

    private fun promoteToForeground() {
        val notification = MotionNotifications.service(this, DetectorRuntime.current())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                MotionNotifications.SERVICE_NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
            )
        } else {
            startForeground(MotionNotifications.SERVICE_NOTIFICATION_ID, notification)
        }
    }

    private fun hasCameraPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun hasBluetoothConnectPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) ==
            PackageManager.PERMISSION_GRANTED

    private fun resolveRoute(): AudioRoute = routeMonitor.resolve(
        settings.preferredBluetoothDeviceId,
        settings.preferredBluetoothDeviceName,
    )

    private suspend fun recordAutoStartResult(state: String, message: String) {
        if (startedFromAutoResume) store.recordBootStartResult(state, message)
    }

    private suspend fun hasImportedAudio(): Boolean {
        val audioId = settings.customAudioId ?: store.loadImportedAudio()?.id ?: return false
        return File(filesDir, "audio/$audioId").isFile
    }

    override fun onDestroy() {
        calibrationJob?.cancel()
        cooldownJob?.cancel()
        cameraWatchdogJob?.cancel()
        player?.release()
        stopCamera()
        routeMonitor.stop()
        if (wakeLock.isHeld) wakeLock.release()
        cameraExecutor.shutdown()
        serviceScope.cancel()
        playerScope.cancel()
        if (activeInstance === this) activeInstance = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent): IBinder? = super.onBind(intent)

    private fun downsampleToRgb(image: ImageProxy, outputWidth: Int, outputHeight: Int): IntArray {
        val crop = image.cropRect
        val result = IntArray(outputWidth * outputHeight)
        for (outY in 0 until outputHeight) {
            val sourceY = crop.top + min(crop.height() - 1, (outY + 0.5).times(crop.height() / outputHeight.toDouble()).toInt())
            for (outX in 0 until outputWidth) {
                val sourceX = crop.left + min(crop.width() - 1, (outX + 0.5).times(crop.width() / outputWidth.toDouble()).toInt())
                result[outY * outputWidth + outX] = yuvPixelToRgb(image, sourceX, sourceY)
            }
        }
        return result
    }

    private fun yuvPixelToRgb(image: ImageProxy, x: Int, y: Int): Int {
        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]
        val luma = yPlane.buffer.get(y * yPlane.rowStride + x * yPlane.pixelStride).toInt() and 0xff
        val chromaX = x / 2
        val chromaY = y / 2
        val u = (uPlane.buffer.get(chromaY * uPlane.rowStride + chromaX * uPlane.pixelStride).toInt() and 0xff) - 128
        val v = (vPlane.buffer.get(chromaY * vPlane.rowStride + chromaX * vPlane.pixelStride).toInt() and 0xff) - 128
        val adjustedY = max(0, luma - 16)
        val red = (1.164 * adjustedY + 1.596 * v).toInt().coerceIn(0, 255)
        val green = (1.164 * adjustedY - 0.813 * v - 0.391 * u).toInt().coerceIn(0, 255)
        val blue = (1.164 * adjustedY + 2.018 * u).toInt().coerceIn(0, 255)
        return (red shl 16) or (green shl 8) or blue
    }

    companion object {
        private const val TAG = "MotionDetectorService"
        const val ACTION_START = "ua.alexsnig.exhibitmotion.action.START"
        const val ACTION_AUTO_START = "ua.alexsnig.exhibitmotion.action.AUTO_START"
        const val ACTION_STOP = "ua.alexsnig.exhibitmotion.action.STOP"
        const val ACTION_TEST_AUDIO = "ua.alexsnig.exhibitmotion.action.TEST_AUDIO"
        const val ACTION_CONFIRM_AUDIO = "ua.alexsnig.exhibitmotion.action.CONFIRM_AUDIO"
        const val ACTION_CANCEL_AUDIO = "ua.alexsnig.exhibitmotion.action.CANCEL_AUDIO"

        /** Guards against confirming before any sound could be heard. */
        private const val MIN_ROUTE_TEST_MS = 3_000L

        /** Android reconnects a bonded speaker on its own; this is how long the
         * exhibit waits for that before reporting it is missing. */
        private const val BLUETOOTH_RECONNECT_TIMEOUT_MS = 30_000L
        private const val BLUETOOTH_POLL_INTERVAL_MS = 1_000L
        const val ACTION_CALIBRATE = "ua.alexsnig.exhibitmotion.action.CALIBRATE"
        private const val ANALYSIS_WIDTH = 36
        private const val ANALYSIS_HEIGHT = 48
        private const val FRAME_INTERVAL_MS = 100L
        private const val CALIBRATION_DURATION_MS = 10_000L
        private const val CAMERA_RECOVERY_DELAY_MS = 1_500L
        private const val CAMERA_WATCHDOG_INTERVAL_MS = 3_000L
        private const val CAMERA_STALL_TIMEOUT_MS = 8_000L
        private const val MAX_CAMERA_RECOVERY_ATTEMPTS = 3
        private const val MAX_EVENTS = 20

        @Volatile private var activeInstance: MotionDetectorService? = null

        fun command(context: Context, action: String) {
            ContextCompat.startForegroundService(context, Intent(context, MotionDetectorService::class.java).setAction(action))
        }

        /** Only an actual native trigger during the current camera run may
         * certify the operator's motion test. */
        fun finishMotionTest(context: Context): Boolean {
            val service = activeInstance ?: return false
            if (!service.motionTriggeredInCurrentRun || service.analyzedFrameCount <= 0L) return false
            command(context, ACTION_STOP)
            return true
        }

        /**
         * Applies changes made by the operator immediately when this service is
         * already playing, without starting a new foreground service.  Player
         * access stays on its application (main) looper.
         */
        fun applyActiveSettings(updated: MotionSettings) {
            val service = activeInstance ?: return
            service.playerScope.launch {
                if (activeInstance !== service) return@launch
                service.settings = updated
                service.player?.volume = updated.audioVolume / 100f
            }
        }
    }
}
