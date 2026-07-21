package ua.alexsnig.exhibitmotion.detector

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import androidx.room.Room
import kotlinx.coroutines.flow.first
import java.io.File

private val Context.detectorDataStore by preferencesDataStore(name = "motion_detector")

data class ImportedAudio(
    val id: String,
    val displayName: String,
    val mimeType: String,
)

data class DiagnosticCounters(
    val cameraRestarts: Int,
    val errors: Int,
    val serviceStarts: Int,
    val lastStartedAtMs: Long,
)

/** A stable route fingerprint. AudioDeviceInfo.id is intentionally not kept:
 * Android may assign a different ID after reboot. AUX is matched by its type;
 * Bluetooth additionally requires the exact operator-approved device name. */
data class VerifiedAudioRoute(
    val kind: AudioRouteKind,
    val bluetoothName: String? = null,
    val verifiedAtMs: Long,
) {
    fun matches(route: AudioRoute): Boolean = when (kind) {
        AudioRouteKind.AUX -> route.kind == AudioRouteKind.AUX
        AudioRouteKind.BLUETOOTH -> route.kind == AudioRouteKind.BLUETOOTH &&
            !bluetoothName.isNullOrBlank() && route.name == bluetoothName
        AudioRouteKind.UNAVAILABLE -> false
    }

    companion object {
        fun from(route: AudioRoute): VerifiedAudioRoute? = when (route.kind) {
            AudioRouteKind.AUX -> VerifiedAudioRoute(AudioRouteKind.AUX, verifiedAtMs = System.currentTimeMillis())
            AudioRouteKind.BLUETOOTH -> route.name?.takeIf { it.isNotBlank() }?.let {
                VerifiedAudioRoute(AudioRouteKind.BLUETOOTH, it, System.currentTimeMillis())
            }
            AudioRouteKind.UNAVAILABLE -> null
        }
    }
}

data class SetupReadiness(
    val cameraGranted: Boolean,
    val audioImported: Boolean,
    val routeVerified: Boolean,
    val calibrated: Boolean,
    val motionTestPassed: Boolean,
    val audioVolume: Int,
)

/** Native-only policy. It is deliberately separate from the web/PWA settings
 * object so a stale WebView localStorage payload can never enable a boot
 * camera service. */
data class KioskAutoStartState(
    val enabled: Boolean = false,
    val commissioningComplete: Boolean = false,
    val maintenanceMode: Boolean = false,
    val bootResumePending: Boolean = false,
    val lastHandledBootCount: Int = -1,
    val lastBootStartState: String = "never",
    val lastBootStartAtMs: Long = 0L,
    val lastBootStartMessage: String = "Ще не було перезавантаження після налаштування",
)

data class PinVerification(
    val verified: Boolean,
    val retryAfterMs: Long = 0L,
)

class DetectorStore private constructor(private val context: Context) {
    private val db by lazy {
        Room.databaseBuilder(context, MotionEventDatabase::class.java, "motion-events.db")
            .fallbackToDestructiveMigration(false)
            .build()
    }

    suspend fun loadSettings(): MotionSettings = MotionSettings.fromJson(context.detectorDataStore.data.first()[SETTINGS])

    suspend fun saveSettings(settings: MotionSettings) {
        context.detectorDataStore.edit { it[SETTINGS] = settings.toJson() }
    }

    /** Stores settings while invalidating only the readiness evidence made
     * obsolete by a meaningful detector change. */
    suspend fun saveSettingsFromOperator(settings: MotionSettings) {
        val previous = loadSettings()
        val detectorChanged = previous.cameraFacingMode != settings.cameraFacingMode ||
            previous.sensitivity != settings.sensitivity ||
            previous.noiseThreshold != settings.noiseThreshold ||
            previous.requiredConsecutiveFrames != settings.requiredConsecutiveFrames ||
            previous.globalChangeCeiling != settings.globalChangeCeiling ||
            previous.detectionZone != settings.detectionZone
        val audioChanged = previous.customAudioId != settings.customAudioId
        val volumeChanged = previous.audioVolume != settings.audioVolume
        val stored = if (detectorChanged) settings.copy(calibratedNoiseFloor = null) else settings
        context.detectorDataStore.edit {
            it[SETTINGS] = stored.toJson()
            if (detectorChanged) it[MOTION_TEST_PASSED] = false
            if (audioChanged) {
                it.remove(VERIFIED_ROUTE_KIND)
                it.remove(VERIFIED_ROUTE_BLUETOOTH_NAME)
                it.remove(VERIFIED_ROUTE_AT)
                it[MOTION_TEST_PASSED] = false
            }
            if (volumeChanged) it[MOTION_TEST_PASSED] = false
        }
    }

    suspend fun loadImportedAudio(): ImportedAudio? {
        val data = context.detectorDataStore.data.first()
        val id = data[AUDIO_ID] ?: return null
        return ImportedAudio(id, data[AUDIO_NAME] ?: id, data[AUDIO_MIME] ?: "audio/*")
    }

    suspend fun saveImportedAudio(audio: ImportedAudio) {
        context.detectorDataStore.edit {
            it[AUDIO_ID] = audio.id
            it[AUDIO_NAME] = audio.displayName
            it[AUDIO_MIME] = audio.mimeType
        }
    }

    suspend fun saveVerifiedAudioRoute(route: AudioRoute): VerifiedAudioRoute? {
        val verified = VerifiedAudioRoute.from(route) ?: return null
        context.detectorDataStore.edit {
            it[VERIFIED_ROUTE_KIND] = verified.kind.name
            verified.bluetoothName?.let { name -> it[VERIFIED_ROUTE_BLUETOOTH_NAME] = name }
                ?: it.remove(VERIFIED_ROUTE_BLUETOOTH_NAME)
            it[VERIFIED_ROUTE_AT] = verified.verifiedAtMs
        }
        return verified
    }

    suspend fun loadVerifiedAudioRoute(): VerifiedAudioRoute? {
        val data = context.detectorDataStore.data.first()
        val kind = data[VERIFIED_ROUTE_KIND]?.let { value ->
            runCatching { AudioRouteKind.valueOf(value) }.getOrNull()
        } ?: return null
        return VerifiedAudioRoute(
            kind = kind,
            bluetoothName = data[VERIFIED_ROUTE_BLUETOOTH_NAME],
            verifiedAtMs = data[VERIFIED_ROUTE_AT] ?: 0L,
        )
    }

    suspend fun isAudioRouteVerified(route: AudioRoute): Boolean = loadVerifiedAudioRoute()?.matches(route) == true

    suspend fun clearVerifiedAudioRoute(clearMotionTest: Boolean = true) {
        context.detectorDataStore.edit {
            it.remove(VERIFIED_ROUTE_KIND)
            it.remove(VERIFIED_ROUTE_BLUETOOTH_NAME)
            it.remove(VERIFIED_ROUTE_AT)
            if (clearMotionTest) it[MOTION_TEST_PASSED] = false
        }
    }

    suspend fun markMotionTestPassed() {
        context.detectorDataStore.edit { it[MOTION_TEST_PASSED] = true }
    }

    suspend fun clearMotionTestPassed() {
        context.detectorDataStore.edit { it[MOTION_TEST_PASSED] = false }
    }

    suspend fun setupReadiness(): SetupReadiness {
        val settings = loadSettings()
        val audio = loadImportedAudio()
        val route = AudioRouteMonitor(context) {}.resolve(
            settings.preferredBluetoothDeviceId,
            settings.preferredBluetoothDeviceName,
        )
        val audioImported = audio?.id?.let { id -> File(context.filesDir, "audio/$id").isFile } == true
        val data = context.detectorDataStore.data.first()
        return SetupReadiness(
            cameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED,
            audioImported = audioImported,
            routeVerified = audioImported && isAudioRouteVerified(route),
            calibrated = settings.calibratedNoiseFloor != null,
            motionTestPassed = data[MOTION_TEST_PASSED] ?: false,
            audioVolume = settings.audioVolume,
        )
    }

    suspend fun loadKioskAutoStartState(): KioskAutoStartState {
        val data = context.detectorDataStore.data.first()
        return KioskAutoStartState(
            enabled = data[AUTO_START_ENABLED] ?: false,
            commissioningComplete = data[COMMISSIONING_COMPLETE] ?: false,
            maintenanceMode = data[MAINTENANCE_MODE] ?: false,
            bootResumePending = data[BOOT_RESUME_PENDING] ?: false,
            lastHandledBootCount = data[LAST_HANDLED_BOOT_COUNT] ?: -1,
            lastBootStartState = data[LAST_BOOT_START_STATE] ?: "never",
            lastBootStartAtMs = data[LAST_BOOT_START_AT] ?: 0L,
            lastBootStartMessage = data[LAST_BOOT_START_MESSAGE]
                ?: "Ще не було перезавантаження після налаштування",
        )
    }

    /** The current boot is stored as already handled so enabling the feature
     * never unexpectedly starts the service in the middle of commissioning. */
    suspend fun setAutoStartEnabled(enabled: Boolean, currentBootCount: Int) {
        context.detectorDataStore.edit {
            it[AUTO_START_ENABLED] = enabled
            it[COMMISSIONING_COMPLETE] = enabled || (it[COMMISSIONING_COMPLETE] ?: false)
            it[MAINTENANCE_MODE] = false
            it[BOOT_RESUME_PENDING] = false
            if (enabled) {
                it[LAST_HANDLED_BOOT_COUNT] = currentBootCount
                it[LAST_BOOT_START_STATE] = "never"
                it[LAST_BOOT_START_AT] = 0L
                it[LAST_BOOT_START_MESSAGE] = "Автозапуск увімкнено; очікується наступне перезавантаження"
            }
        }
    }

    suspend fun setMaintenanceMode(enabled: Boolean) {
        context.detectorDataStore.edit { it[MAINTENANCE_MODE] = enabled }
    }

    suspend fun markBootResumePending() {
        context.detectorDataStore.edit { it[BOOT_RESUME_PENDING] = true }
    }

    /** Atomically claims a boot so repeated Activity resumes cannot restart
     * CameraX over and over. */
    suspend fun claimAutoStartForBoot(bootCount: Int): Boolean {
        var claimed = false
        context.detectorDataStore.edit {
            val pending = it[BOOT_RESUME_PENDING] ?: false
            val handled = it[LAST_HANDLED_BOOT_COUNT] ?: -1
            if (pending || handled != bootCount) {
                claimed = true
                it[BOOT_RESUME_PENDING] = false
                it[LAST_HANDLED_BOOT_COUNT] = bootCount
                it[LAST_BOOT_START_AT] = System.currentTimeMillis()
            }
        }
        return claimed
    }

    suspend fun recordBootStartResult(state: String, message: String) {
        context.detectorDataStore.edit {
            it[LAST_BOOT_START_STATE] = state
            it[LAST_BOOT_START_AT] = System.currentTimeMillis()
            it[LAST_BOOT_START_MESSAGE] = message
        }
    }

    suspend fun recordEvent(event: MotionEventEntity, keep: Int) {
        db.motionEventDao().insert(event)
        db.motionEventDao().pruneTo(keep)
    }

    suspend fun eventCount(): Int = db.motionEventDao().count()

    suspend fun recentEvents(limit: Int): List<MotionEventEntity> = db.motionEventDao().recent(limit.coerceIn(1, 100))

    suspend fun clearEvents() = db.motionEventDao().clear()

    suspend fun deleteEvent(id: String) = db.motionEventDao().delete(id)

    suspend fun recordServiceStart() {
        context.detectorDataStore.edit {
            it[SERVICE_STARTS] = (it[SERVICE_STARTS] ?: 0) + 1
            it[LAST_STARTED] = System.currentTimeMillis()
        }
    }

    suspend fun recordCameraRestart() {
        context.detectorDataStore.edit { it[CAMERA_RESTARTS] = (it[CAMERA_RESTARTS] ?: 0) + 1 }
    }

    suspend fun recordError() {
        context.detectorDataStore.edit { it[ERRORS] = (it[ERRORS] ?: 0) + 1 }
    }

    suspend fun diagnostics(): DiagnosticCounters {
        val data = context.detectorDataStore.data.first()
        return DiagnosticCounters(
            cameraRestarts = data[CAMERA_RESTARTS] ?: 0,
            errors = data[ERRORS] ?: 0,
            serviceStarts = data[SERVICE_STARTS] ?: 0,
            lastStartedAtMs = data[LAST_STARTED] ?: 0L,
        )
    }

    suspend fun hasOperatorPin(): Boolean = !context.detectorDataStore.data.first()[OPERATOR_PIN_HASH].isNullOrBlank()

    suspend fun operatorPinHash(): String? = context.detectorDataStore.data.first()[OPERATOR_PIN_HASH]

    suspend fun saveOperatorPinHash(hash: String) {
        context.detectorDataStore.edit {
            it[OPERATOR_PIN_HASH] = hash
            it[PIN_FAILED_ATTEMPTS] = 0
            it[PIN_LOCKED_UNTIL] = 0L
        }
    }

    suspend fun verifyOperatorPin(pin: String): PinVerification {
        val now = System.currentTimeMillis()
        val data = context.detectorDataStore.data.first()
        val lockedUntil = data[PIN_LOCKED_UNTIL] ?: 0L
        if (lockedUntil > now) return PinVerification(false, lockedUntil - now)
        val stored = data[OPERATOR_PIN_HASH] ?: return PinVerification(false)
        if (OperatorPinSecurity.verify(stored, pin)) {
            context.detectorDataStore.edit {
                it[PIN_FAILED_ATTEMPTS] = 0
                it[PIN_LOCKED_UNTIL] = 0L
            }
            return PinVerification(true)
        }
        var retryAfter = 0L
        context.detectorDataStore.edit {
            val attempts = (it[PIN_FAILED_ATTEMPTS] ?: 0) + 1
            if (attempts >= MAX_PIN_ATTEMPTS) {
                retryAfter = PIN_LOCKOUT_MS
                it[PIN_FAILED_ATTEMPTS] = 0
                it[PIN_LOCKED_UNTIL] = now + PIN_LOCKOUT_MS
            } else {
                it[PIN_FAILED_ATTEMPTS] = attempts
            }
        }
        return PinVerification(false, retryAfter)
    }

    companion object {
        private val SETTINGS = stringPreferencesKey("settings_json")
        private val AUDIO_ID = stringPreferencesKey("audio_id")
        private val AUDIO_NAME = stringPreferencesKey("audio_name")
        private val AUDIO_MIME = stringPreferencesKey("audio_mime")
        private val CAMERA_RESTARTS = intPreferencesKey("camera_restarts")
        private val ERRORS = intPreferencesKey("errors")
        private val SERVICE_STARTS = intPreferencesKey("service_starts")
        private val LAST_STARTED = longPreferencesKey("last_started_at_ms")
        private val OPERATOR_PIN_HASH = stringPreferencesKey("operator_pin_hash")
        private val VERIFIED_ROUTE_KIND = stringPreferencesKey("verified_route_kind")
        private val VERIFIED_ROUTE_BLUETOOTH_NAME = stringPreferencesKey("verified_route_bluetooth_name")
        private val VERIFIED_ROUTE_AT = longPreferencesKey("verified_route_at_ms")
        private val MOTION_TEST_PASSED = booleanPreferencesKey("motion_test_passed")
        private val AUTO_START_ENABLED = booleanPreferencesKey("auto_start_after_reboot")
        private val COMMISSIONING_COMPLETE = booleanPreferencesKey("kiosk_commissioning_complete")
        private val MAINTENANCE_MODE = booleanPreferencesKey("kiosk_maintenance_mode")
        private val BOOT_RESUME_PENDING = booleanPreferencesKey("boot_resume_pending")
        private val LAST_HANDLED_BOOT_COUNT = intPreferencesKey("last_handled_boot_count")
        private val LAST_BOOT_START_STATE = stringPreferencesKey("last_boot_start_state")
        private val LAST_BOOT_START_AT = longPreferencesKey("last_boot_start_at_ms")
        private val LAST_BOOT_START_MESSAGE = stringPreferencesKey("last_boot_start_message")
        private val PIN_FAILED_ATTEMPTS = intPreferencesKey("operator_pin_failed_attempts")
        private val PIN_LOCKED_UNTIL = longPreferencesKey("operator_pin_locked_until")
        private const val MAX_PIN_ATTEMPTS = 5
        private const val PIN_LOCKOUT_MS = 30_000L

        @Volatile private var instance: DetectorStore? = null

        fun get(context: Context): DetectorStore = instance ?: synchronized(this) {
            instance ?: DetectorStore(context.applicationContext).also { instance = it }
        }
    }
}
