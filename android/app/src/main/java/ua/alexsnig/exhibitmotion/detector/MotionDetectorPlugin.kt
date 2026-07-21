package ua.alexsnig.exhibitmotion.detector

import android.Manifest
import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import androidx.activity.result.ActivityResult
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import ua.alexsnig.exhibitmotion.kiosk.AutoResumeCoordinator
import ua.alexsnig.exhibitmotion.kiosk.KioskPolicyController
import ua.alexsnig.exhibitmotion.kiosk.KioskRuntimeState

@CapacitorPlugin(
    name = "MotionDetector",
    permissions = [
        Permission(alias = "camera", strings = [Manifest.permission.CAMERA]),
        Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS]),
    ],
)
class MotionDetectorPlugin : Plugin() {
    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val pendingPermissionActions = ConcurrentHashMap<String, String>()
    private var routeWatch: AudioDeviceCallback? = null

    override fun load() {
        MotionEventBus.attach(this)
    }

    /** A 3.5 mm output has no identity on Android: every wired speaker reports
     * the same generic device, so an approval can only ever mean "some wired
     * output". That is deliberate, because a commissioned exhibit has to arm
     * itself after a power cut with nobody present. It does mean a stored
     * approval survives swapping the cable, so while the operator panel is on
     * screen — that is, during commissioning — treat losing the route as
     * invalidating the sound test and make the operator hear the new speaker.
     * Unattended boot resume is unaffected: nothing is unplugged there. */
    override fun handleOnResume() {
        if (routeWatch != null) return
        val audioManager = context.getSystemService(AudioManager::class.java) ?: return
        val callback = object : AudioDeviceCallback() {
            override fun onAudioDevicesRemoved(removedDevices: Array<AudioDeviceInfo>) {
                invalidateRouteIfDisconnected()
            }
        }
        audioManager.registerAudioDeviceCallback(callback, Handler(Looper.getMainLooper()))
        routeWatch = callback
    }

    override fun handleOnPause() {
        routeWatch?.let { context.getSystemService(AudioManager::class.java)?.unregisterAudioDeviceCallback(it) }
        routeWatch = null
    }

    private fun invalidateRouteIfDisconnected() {
        pluginScope.launch {
            val store = DetectorStore.get(context)
            val settings = store.loadSettings()
            val route = AudioRouteMonitor(context) {}.resolve(
                settings.preferredBluetoothDeviceId,
                settings.preferredBluetoothDeviceName,
            )
            if (route.kind != AudioRouteKind.UNAVAILABLE) return@launch
            if (store.loadVerifiedAudioRoute() == null) return@launch
            // Only the route approval is withdrawn. Swapping a cable during
            // commissioning does not disprove that motion triggers playback,
            // so the operator re-runs the sound test alone, not the whole wizard.
            store.clearVerifiedAudioRoute(clearMotionTest = false)
        }
    }

    override fun handleOnDestroy() {
        MotionEventBus.detach(this)
        handleOnPause()
        pluginScope.cancel()
    }

    @PluginMethod
    fun start(call: PluginCall) = runWithCameraPermission(call, MotionDetectorService.ACTION_START)

    @PluginMethod
    fun stop(call: PluginCall) {
        MotionDetectorService.command(context, MotionDetectorService.ACTION_STOP)
        call.resolve()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) = call.resolve(statusData(DetectorRuntime.current()))

    @PluginMethod
    fun getEvents(call: PluginCall) {
        val limit = (call.getInt("limit") ?: 20).coerceIn(1, 100)
        pluginScope.launch {
            val events = DetectorStore.get(context).recentEvents(limit)
            call.resolve(JSObject().put("events", JSONArray(events.map(::eventData))))
        }
    }

    @PluginMethod
    fun clearEvents(call: PluginCall) {
        pluginScope.launch {
            DetectorStore.get(context).clearEvents()
            call.resolve()
        }
    }

    @PluginMethod
    fun deleteEvent(call: PluginCall) {
        val id = call.getString("id")
        if (id.isNullOrBlank()) {
            call.reject("Event id is required", "INVALID_EVENT_ID")
            return
        }
        pluginScope.launch {
            DetectorStore.get(context).deleteEvent(id)
            call.resolve()
        }
    }

    /** The setup wizard must be able to request camera access without starting
     * a foreground camera service. */
    @PluginMethod
    fun requestCameraPermission(call: PluginCall) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        requestPermissionForAliases(arrayOf("camera"), call, "onCameraPermission")
    }

    @PluginMethod
    fun getAudioRoute(call: PluginCall) {
        pluginScope.launch {
            val settings = DetectorStore.get(context).loadSettings()
            val route = AudioRouteMonitor(context) {}.resolve(
                settings.preferredBluetoothDeviceId,
                settings.preferredBluetoothDeviceName,
            )
            call.resolve(routeData(route))
        }
    }

    /** Restores only operator metadata. Imported audio bytes stay private to
     * the app and never pass through the WebView bridge. */
    @PluginMethod
    fun getSetupState(call: PluginCall) {
        pluginScope.launch {
            val store = DetectorStore.get(context)
            val audio = store.loadImportedAudio()
            val readiness = store.setupReadiness()
            call.resolve(JSObject().apply {
                put("hasImportedAudio", audio != null)
                audio?.let {
                    put("audio", JSObject().apply {
                        put("id", it.id)
                        put("name", it.displayName)
                        put("mimeType", it.mimeType)
                    })
                }
                put("readiness", readinessData(readiness))
            })
        }
    }

    @PluginMethod
    fun getSettings(call: PluginCall) {
        pluginScope.launch {
            call.resolve(JSObject(DetectorStore.get(context).loadSettings().toJson()))
        }
    }

    @PluginMethod
    fun saveSettings(call: PluginCall) {
        val raw = call.getObject("settings")
        if (raw == null) {
            call.reject("settings is required")
            return
        }
        pluginScope.launch {
            val store = DetectorStore.get(context)
            val merged = JSONObject(store.loadSettings().toJson())
            val incoming = JSONObject(raw.toString())
            incoming.keys().forEach { key -> merged.put(key, incoming.get(key)) }
            val saved = MotionSettings.fromJson(merged.toString())
            store.saveSettingsFromOperator(saved)
            MotionDetectorService.applyActiveSettings(saved)
            call.resolve()
        }
    }

    @PluginMethod
    fun importAudio(call: PluginCall) {
        val picker = Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("audio/*")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startActivityForResult(call, picker, "onAudioPicked")
    }

    @ActivityCallback
    private fun onAudioPicked(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.reject("Audio import cancelled", "CANCELLED")
            return
        }
        val uri = result.data?.data
        if (uri == null) {
            call.reject("No audio file was selected")
            return
        }
        pluginScope.launch {
            var pendingDestination: File? = null
            try {
                val fileName = displayName(uri) ?: "audio"
                val extension = fileName.substringAfterLast('.', "")
                    .filter(Char::isLetterOrDigit)
                    .take(8)
                val id = UUID.randomUUID().toString() + if (extension.isBlank()) "" else ".${extension.lowercase()}"
                val directory = File(context.filesDir, "audio").apply { mkdirs() }
                val destination = File(directory, id)
                pendingDestination = destination
                copyAudio(uri, destination)
                val imported = ImportedAudio(id, fileName, context.contentResolver.getType(uri) ?: "audio/*")
                val store = DetectorStore.get(context)
                val previousAudio = store.loadImportedAudio()
                store.saveImportedAudio(imported)
                store.saveSettings(store.loadSettings().copy(customAudioId = id))
                pendingDestination = null
                previousAudio?.id?.takeIf { it != id }?.let { oldId -> File(directory, oldId).delete() }
                directory.listFiles()?.filter { it.isFile && it.name != id }?.forEach(File::delete)
                // A newly imported file must be heard through the selected
                // output and included in a new motion test before boot arm.
                store.clearVerifiedAudioRoute()
                store.clearMotionTestPassed()
                call.resolve(JSObject().apply {
                    put("id", id)
                    put("name", fileName)
                    put("mimeType", imported.mimeType)
                })
            } catch (error: Exception) {
                pendingDestination?.delete()
                call.reject(error.message ?: "Could not import local audio", "IMPORT_FAILED", error)
            }
        }
    }

    @PluginMethod
    fun playTest(call: PluginCall) = runWithCameraPermission(call, MotionDetectorService.ACTION_TEST_AUDIO)

    /** Route approval is an operator judgement about audible sound, so it needs
     * no camera permission and must not wait for a long narration to end. */
    @PluginMethod
    fun confirmAudioRoute(call: PluginCall) {
        MotionDetectorService.command(context, MotionDetectorService.ACTION_CONFIRM_AUDIO)
        call.resolve(statusData(DetectorRuntime.current()))
    }

    @PluginMethod
    fun cancelAudioTest(call: PluginCall) {
        MotionDetectorService.command(context, MotionDetectorService.ACTION_CANCEL_AUDIO)
        call.resolve(statusData(DetectorRuntime.current()))
    }

    @PluginMethod
    fun calibrate(call: PluginCall) = runWithCameraPermission(call, MotionDetectorService.ACTION_CALIBRATE)

    @PluginMethod
    fun finishMotionTest(call: PluginCall) {
        pluginScope.launch {
            if (!MotionDetectorService.finishMotionTest(context)) {
                call.reject("Motion test requires an actual detector trigger", "MOTION_TEST_NOT_TRIGGERED")
                return@launch
            }
            DetectorStore.get(context).markMotionTestPassed()
            call.resolve()
        }
    }

    @PluginMethod
    fun getKioskState(call: PluginCall) {
        pluginScope.launch {
            call.resolve(kioskData(KioskPolicyController.state(context)))
        }
    }

    /** Applies only Device Owner policies. It never enters Lock Task while the
     * operator is still importing audio or calibrating the exhibit. */
    @PluginMethod
    fun configureKiosk(call: PluginCall) {
        pluginScope.launch {
            val result = KioskPolicyController.applyDeviceOwnerPolicies(context)
            if (result.isFailure) {
                val cause = result.exceptionOrNull()
                val error = cause as? Exception
                    ?: IllegalStateException("Device Owner kiosk is unavailable", cause)
                call.reject(
                    error.message ?: "Device Owner kiosk is unavailable",
                    "DEVICE_OWNER_REQUIRED",
                    error,
                )
                return@launch
            }
            call.resolve(kioskData(KioskPolicyController.state(context)))
        }
    }

    @PluginMethod
    fun setAutoStartAfterReboot(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        val pin = call.getString("operatorPin") ?: ""
        pluginScope.launch {
            val store = DetectorStore.get(context)
            val pinCheck = store.verifyOperatorPin(pin)
            if (!pinCheck.verified) {
                call.reject(pinFailureMessage(pinCheck.retryAfterMs), "INCORRECT_PIN")
                return@launch
            }
            if (!enabled) {
                store.setAutoStartEnabled(false, AutoResumeCoordinator.currentBootCount(context))
                withContext(Dispatchers.Main.immediate) { activity?.let(KioskPolicyController::exitLockTask) }
                call.resolve(kioskData(KioskPolicyController.state(context)))
                return@launch
            }

            val policy = KioskPolicyController.applyDeviceOwnerPolicies(context)
            if (policy.isFailure) {
                call.reject(policy.exceptionOrNull()?.message ?: "Device Owner kiosk is unavailable", "DEVICE_OWNER_REQUIRED")
                return@launch
            }
            // Enabling is an explicit end of maintenance mode; validate the
            // complete native readiness checklist after that transition.
            val wasMaintenanceMode = store.loadKioskAutoStartState().maintenanceMode
            store.setMaintenanceMode(false)
            val state = KioskPolicyController.state(context)
            if (!state.autoStartReady) {
                store.setMaintenanceMode(wasMaintenanceMode)
                call.reject("Автозапуск ще не готовий: ${state.blockers.joinToString(", ")}", "AUTOSTART_NOT_READY")
                return@launch
            }
            store.setAutoStartEnabled(true, AutoResumeCoordinator.currentBootCount(context))
            val locked = withContext(Dispatchers.Main.immediate) {
                activity?.let(KioskPolicyController::enterLockTask) ?: false
            }
            if (!locked) {
                store.setAutoStartEnabled(false, AutoResumeCoordinator.currentBootCount(context))
                call.reject("Не вдалося увімкнути Lock Task", "LOCK_TASK_FAILED")
                return@launch
            }
            call.resolve(kioskData(KioskPolicyController.state(context)))
        }
    }

    @PluginMethod
    fun setOperatorPin(call: PluginCall) {
        val pin = call.getString("pin")?.trim()
        val currentPin = call.getString("currentPin") ?: ""
        if (pin == null || !pin.matches(Regex("\\d{4,12}"))) {
            call.reject("PIN must contain 4 to 12 digits", "INVALID_PIN")
            return
        }
        pluginScope.launch {
            val store = DetectorStore.get(context)
            if (store.hasOperatorPin()) {
                val verification = store.verifyOperatorPin(currentPin)
                if (!verification.verified) {
                    call.reject(pinFailureMessage(verification.retryAfterMs), "INCORRECT_PIN")
                    return@launch
                }
            }
            store.saveOperatorPinHash(OperatorPinSecurity.hash(pin))
            call.resolve()
        }
    }

    @PluginMethod
    fun unlockKiosk(call: PluginCall) {
        val pin = call.getString("pin") ?: ""
        pluginScope.launch {
            val store = DetectorStore.get(context)
            val pinCheck = store.verifyOperatorPin(pin)
            if (!pinCheck.verified) {
                call.reject(pinFailureMessage(pinCheck.retryAfterMs), "INCORRECT_PIN")
                return@launch
            }
            store.setMaintenanceMode(true)
            MotionDetectorService.command(context, MotionDetectorService.ACTION_STOP)
            withContext(Dispatchers.Main.immediate) { activity?.let(KioskPolicyController::exitLockTask) }
            call.resolve(kioskData(KioskPolicyController.state(context)))
        }
    }

    @PluginMethod
    fun lockKiosk(call: PluginCall) {
        val pin = call.getString("operatorPin") ?: ""
        pluginScope.launch {
            val store = DetectorStore.get(context)
            val pinCheck = store.verifyOperatorPin(pin)
            if (!pinCheck.verified) {
                call.reject(pinFailureMessage(pinCheck.retryAfterMs), "INCORRECT_PIN")
                return@launch
            }
            val policy = KioskPolicyController.applyDeviceOwnerPolicies(context)
            if (policy.isFailure) {
                call.reject(policy.exceptionOrNull()?.message ?: "Device Owner kiosk is unavailable", "DEVICE_OWNER_REQUIRED")
                return@launch
            }
            store.setMaintenanceMode(false)
            val readiness = KioskPolicyController.state(context)
            if (readiness.autoStartAfterRebootEnabled && !readiness.autoStartReady) {
                store.setMaintenanceMode(true)
                call.reject(
                    "Не можна повернути kiosk: ${readiness.blockers.joinToString(", ")}",
                    "AUTOSTART_NOT_READY",
                )
                return@launch
            }
            val locked = withContext(Dispatchers.Main.immediate) {
                activity?.let(KioskPolicyController::enterLockTask) ?: false
            }
            if (!locked) {
                store.setMaintenanceMode(true)
                call.reject("Не вдалося повернути Lock Task", "LOCK_TASK_FAILED")
                return@launch
            }
            call.resolve(kioskData(KioskPolicyController.state(context)))
        }
    }

    @PluginMethod
    fun getDiagnostics(call: PluginCall) {
        pluginScope.launch {
            call.resolve(diagnosticJson())
        }
    }

    @PluginMethod
    fun exportDiagnostics(call: PluginCall) {
        pluginScope.launch {
            try {
                val directory = File(context.cacheDir, "diagnostics").apply { mkdirs() }
                val file = File(directory, "exhibit-motion-diagnostics-${System.currentTimeMillis()}.json")
                file.writeText(diagnosticJson().toString(2))
                val shareUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                val shareIntent = Intent(Intent.ACTION_SEND)
                    .setType("application/json")
                    .putExtra(Intent.EXTRA_STREAM, shareUri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                activity.startActivity(Intent.createChooser(shareIntent, "Експорт діагностики"))
                call.resolve()
            } catch (error: Exception) {
                call.reject(error.message ?: "Could not export diagnostics", "EXPORT_FAILED", error)
            }
        }
    }

    @PermissionCallback
    private fun onCameraPermission(call: PluginCall) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            pendingPermissionActions.remove(call.callbackId)?.let { MotionDetectorService.command(context, it) }
            call.resolve(statusData(DetectorRuntime.current()))
        } else {
            pendingPermissionActions.remove(call.callbackId)
            call.reject("Camera permission is required for the motion detector", "CAMERA_PERMISSION_DENIED")
        }
    }

    fun emitStatus(snapshot: DetectorSnapshot) {
        notifyListeners("statusChanged", statusData(snapshot), true)
    }

    private fun runWithCameraPermission(call: PluginCall, action: String) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            MotionDetectorService.command(context, action)
            call.resolve(statusData(DetectorRuntime.current()))
            return
        }
        pendingPermissionActions[call.callbackId] = action
        requestPermissionForAliases(arrayOf("camera", "notifications"), call, "onCameraPermission")
    }

    private fun statusData(snapshot: DetectorSnapshot): JSObject = JSObject().apply {
        put("status", snapshot.status.wireValue)
        put("message", snapshot.message)
        put("motionPercent", snapshot.motionPercent)
        put("analyzedFrameCount", snapshot.analyzedFrameCount)
        put("lastFrameAtMs", snapshot.lastFrameAtMs)
        put("cooldownRemainingSeconds", snapshot.cooldownRemainingSeconds)
        put("requiresSoundTest", snapshot.requiresSoundTest)
        put("updatedAtMs", snapshot.updatedAtMs)
        put("audioRoute", routeData(snapshot.audioRoute))
    }

    private fun eventData(event: MotionEventEntity): JSObject = JSObject().apply {
        put("id", event.id)
        put("timestampMs", event.timestampMs)
        put("motionPercent", event.motionPercent)
        put("threshold", event.threshold)
    }

    private fun routeData(route: AudioRoute): JSObject = JSObject().apply {
        put("kind", route.kind.name.lowercase())
        put("deviceId", route.deviceId)
        put("name", route.name)
        put("label", route.displayName)
    }

    private fun readinessData(readiness: SetupReadiness): JSObject = JSObject().apply {
        put("cameraGranted", readiness.cameraGranted)
        put("audioImported", readiness.audioImported)
        put("routeVerified", readiness.routeVerified)
        put("calibrated", readiness.calibrated)
        put("motionTestPassed", readiness.motionTestPassed)
        put("audioVolume", readiness.audioVolume)
    }

    private fun kioskData(state: KioskRuntimeState): JSObject = JSObject().apply {
        put("operatorPinConfigured", state.operatorPinConfigured)
        put("isDeviceOwner", state.isDeviceOwner)
        put("isDefaultHomeApp", state.isDefaultHomeApp)
        put("isLockTaskAllowed", state.isLockTaskAllowed)
        put("isLockTaskActive", state.isLockTaskActive)
        put("autoStartAfterRebootEnabled", state.autoStartAfterRebootEnabled)
        put("autoStartReady", state.autoStartReady)
        put("blockers", JSONArray(state.blockers))
        put("lastBootStartState", state.lastBootStartState)
        put("lastBootStartAtMs", state.lastBootStartAtMs)
        put("lastBootStartMessage", state.lastBootStartMessage)
        put("requiresFirstUnlock", state.requiresFirstUnlock)
        put("maintenanceMode", state.maintenanceMode)
        put("readiness", readinessData(state.readiness))
    }

    private fun pinFailureMessage(retryAfterMs: Long): String = if (retryAfterMs > 0L) {
        "PIN тимчасово заблоковано ще на ${(retryAfterMs + 999L) / 1_000L} с"
    } else {
        "Неправильний PIN оператора"
    }

    /** There is no public "is it supported" query: the only honest probe is to
     * read the policy as Device Owner and see whether the manufacturer
     * implements it. Reported as a string so the technician can tell "not
     * supported" apart from "not yet knowable". */
    private fun factoryResetProtectionSupport(): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return "unsupported_android_version"
        if (!KioskPolicyController.isDeviceOwner(context)) return "unknown_requires_device_owner"
        val dpm = context.getSystemService(DevicePolicyManager::class.java)
            ?: return "unknown_no_policy_service"
        return runCatching {
            dpm.getFactoryResetProtectionPolicy(KioskPolicyController.adminComponent(context))
            "supported"
        }.getOrElse { error ->
            if (error is UnsupportedOperationException) "unsupported_by_manufacturer"
            else "unknown_${error.javaClass.simpleName}"
        }
    }

    private suspend fun diagnosticJson(): JSObject {
        val store = DetectorStore.get(context)
        val counters = store.diagnostics()
        val settings = store.loadSettings()
        val route = AudioRouteMonitor(context) {}.resolve(
            settings.preferredBluetoothDeviceId,
            settings.preferredBluetoothDeviceName,
        )
        val battery = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val temperatureTenths = battery?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE) ?: Int.MIN_VALUE
        val version = context.packageManager.getPackageInfo(context.packageName, 0)
        val snapshot = DetectorRuntime.current()
        val kiosk = KioskPolicyController.state(context)
        return JSObject().apply {
            put("versionName", version.versionName)
            put("versionCode", version.longVersionCode)
            // A dedicated exhibit has no Google account, which is what normally
            // arms factory reset protection. A Device Owner can arm it through
            // policy instead, but only where the manufacturer implements the
            // AOSP API, so the technician needs the real answer per device.
            put("factoryResetProtection", factoryResetProtectionSupport())
            put("uptimeMs", android.os.SystemClock.elapsedRealtime())
            put("serviceStarts", counters.serviceStarts)
            put("lastStartedAtMs", counters.lastStartedAtMs)
            put("cameraRestarts", counters.cameraRestarts)
            put("errors", counters.errors)
            put("eventCount", store.eventCount())
            put("status", snapshot.status.wireValue)
            put("analyzedFrameCount", snapshot.analyzedFrameCount)
            put("lastFrameAtMs", snapshot.lastFrameAtMs)
            put("audioRoute", routeData(route))
            put("batteryPercent", if (level >= 0 && scale > 0) level * 100 / scale else JSONObject.NULL)
            put("batteryTemperatureC", if (temperatureTenths != Int.MIN_VALUE) temperatureTenths / 10.0 else JSONObject.NULL)
            put("kiosk", kioskData(kiosk))
        }
    }

    private fun displayName(uri: android.net.Uri): String? = context.contentResolver.query(
        uri,
        arrayOf(OpenableColumns.DISPLAY_NAME),
        null,
        null,
        null,
    )?.use { cursor: Cursor ->
        if (cursor.moveToFirst()) cursor.getString(cursor.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME)) else null
    }

    private fun copyAudio(uri: android.net.Uri, destination: File) {
        context.contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(destination).use { output ->
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                var copied = 0L
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    copied += count
                    if (copied > MAX_AUDIO_BYTES) throw IllegalArgumentException("Максимальний розмір аудіо — 12 MB")
                    output.write(buffer, 0, count)
                }
            }
        } ?: throw IllegalArgumentException("Не вдалося прочитати вибраний аудіофайл")
    }

    companion object {
        private const val MAX_AUDIO_BYTES = 12L * 1024 * 1024
    }
}
