package ua.alexsnig.exhibitmotion.kiosk

import android.Manifest
import android.app.Activity
import android.app.ActivityManager
import android.app.KeyguardManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import ua.alexsnig.exhibitmotion.MainActivity
import ua.alexsnig.exhibitmotion.detector.DetectorStore
import ua.alexsnig.exhibitmotion.detector.KioskAutoStartState
import ua.alexsnig.exhibitmotion.detector.SetupReadiness

data class KioskRuntimeState(
    val operatorPinConfigured: Boolean,
    val isDeviceOwner: Boolean,
    val isDefaultHomeApp: Boolean,
    val isLockTaskAllowed: Boolean,
    val isLockTaskActive: Boolean,
    val autoStartAfterRebootEnabled: Boolean,
    val autoStartReady: Boolean,
    val blockers: List<String>,
    val lastBootStartState: String,
    val lastBootStartAtMs: Long,
    val lastBootStartMessage: String,
    val requiresFirstUnlock: Boolean,
    val maintenanceMode: Boolean,
    val readiness: SetupReadiness,
)

/** Device Owner and Lock Task policies. Every mutating operation is guarded
 * by isDeviceOwnerApp so installing the APK on an ordinary phone remains safe
 * and behaves as a normal operator-controlled app. */
object KioskPolicyController {
    fun isDeviceOwner(context: Context): Boolean = context
        .getSystemService(DevicePolicyManager::class.java)
        .isDeviceOwnerApp(context.packageName)

    fun applyDeviceOwnerPolicies(context: Context): Result<Unit> = runCatching {
        val dpm = context.getSystemService(DevicePolicyManager::class.java)
        if (!dpm.isDeviceOwnerApp(context.packageName)) {
            throw SecurityException("APK не підготовлено як Device Owner")
        }
        val admin = adminComponent(context)
        dpm.setLockTaskPackages(admin, arrayOf(context.packageName))
        dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_NONE)
        dpm.addPersistentPreferredActivity(admin, homeIntentFilter(), mainActivityComponent(context))

        // A Device Owner may grant these runtime permissions during the clean
        // commissioning flow. The wizard still reports their real state.
        dpm.setPermissionGrantState(
            admin,
            context.packageName,
            Manifest.permission.CAMERA,
            DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            dpm.setPermissionGrantState(
                admin,
                context.packageName,
                Manifest.permission.POST_NOTIFICATIONS,
                DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED,
            )
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Without this the exhibit cannot re-enable its own Bluetooth
            // radio after a power cut, and a Bluetooth installation would sit
            // silent until a person walked up to it.
            dpm.setPermissionGrantState(
                admin,
                context.packageName,
                Manifest.permission.BLUETOOTH_CONNECT,
                DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED,
            )
        }

        // A secure credential prevents credential-encrypted audio/settings
        // from being available at cold boot. We never remove a PIN: the
        // installer must leave the exhibit device without one for no-touch
        // startup. On an unsecured device this also suppresses the keyguard.
        val keyguard = context.getSystemService(KeyguardManager::class.java)
        if (!keyguard.isDeviceSecure) dpm.setKeyguardDisabled(admin, true)
    }

    fun enterLockTask(activity: Activity): Boolean {
        if (!isDeviceOwner(activity)) return false
        val dpm = activity.getSystemService(DevicePolicyManager::class.java)
        if (!dpm.isLockTaskPermitted(activity.packageName)) return false
        return runCatching {
            if (!isLockTaskActive(activity)) activity.startLockTask()
            true
        }.getOrDefault(false)
    }

    fun exitLockTask(activity: Activity): Boolean = runCatching {
        if (isLockTaskActive(activity)) activity.stopLockTask()
        true
    }.getOrDefault(false)

    fun launchHome(context: Context) {
        runCatching {
            context.startActivity(
                Intent(context, MainActivity::class.java)
                    .setAction(Intent.ACTION_MAIN)
                    .addCategory(Intent.CATEGORY_HOME)
                    .addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP,
                    ),
            )
        }
    }

    suspend fun state(context: Context): KioskRuntimeState {
        val store = DetectorStore.get(context)
        val config = store.loadKioskAutoStartState()
        val readiness = store.setupReadiness()
        val deviceOwner = isDeviceOwner(context)
        val defaultHome = isDefaultHomeApp(context)
        val lockTaskAllowed = deviceOwner && context
            .getSystemService(DevicePolicyManager::class.java)
            .isLockTaskPermitted(context.packageName)
        val lockTaskActive = isLockTaskActive(context)
        val requiresFirstUnlock = context.getSystemService(KeyguardManager::class.java).isDeviceSecure
        val pinConfigured = store.hasOperatorPin()
        val blockers = readinessBlockers(
            config = config,
            readiness = readiness,
            pinConfigured = pinConfigured,
            deviceOwner = deviceOwner,
            defaultHome = defaultHome,
            lockTaskAllowed = lockTaskAllowed,
            requiresFirstUnlock = requiresFirstUnlock,
        )
        return KioskRuntimeState(
            operatorPinConfigured = pinConfigured,
            isDeviceOwner = deviceOwner,
            isDefaultHomeApp = defaultHome,
            isLockTaskAllowed = lockTaskAllowed,
            isLockTaskActive = lockTaskActive,
            autoStartAfterRebootEnabled = config.enabled,
            autoStartReady = blockers.isEmpty(),
            blockers = blockers,
            lastBootStartState = config.lastBootStartState,
            lastBootStartAtMs = config.lastBootStartAtMs,
            lastBootStartMessage = config.lastBootStartMessage,
            requiresFirstUnlock = requiresFirstUnlock,
            maintenanceMode = config.maintenanceMode,
            readiness = readiness,
        )
    }

    fun readinessBlockers(
        config: KioskAutoStartState,
        readiness: SetupReadiness,
        pinConfigured: Boolean,
        deviceOwner: Boolean,
        defaultHome: Boolean,
        lockTaskAllowed: Boolean,
        requiresFirstUnlock: Boolean,
    ): List<String> = buildList {
        if (!deviceOwner) add("device_owner_required")
        if (!defaultHome) add("home_launcher_required")
        if (!lockTaskAllowed) add("lock_task_not_active")
        if (requiresFirstUnlock) add("secure_lock_requires_first_unlock")
        if (!readiness.cameraGranted) add("camera_permission_missing")
        if (!readiness.audioImported) add("audio_missing")
        if (!readiness.routeVerified) add("audio_route_not_verified")
        if (!readiness.calibrated) add("calibration_missing")
        if (!readiness.motionTestPassed) add("motion_test_missing")
        if (!pinConfigured) add("operator_pin_missing")
        if (config.maintenanceMode) add("maintenance_mode_active")
    }

    private fun isDefaultHomeApp(context: Context): Boolean {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val resolved = context.packageManager.resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY)
        return resolved?.activityInfo?.packageName == context.packageName
    }

    private fun isLockTaskActive(context: Context): Boolean = context
        .getSystemService(ActivityManager::class.java)
        .lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE

    private fun adminComponent(context: Context) = ComponentName(context, ExhibitDeviceAdminReceiver::class.java)

    private fun mainActivityComponent(context: Context) = ComponentName(context, MainActivity::class.java)

    private fun homeIntentFilter() = IntentFilter(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_HOME)
        addCategory(Intent.CATEGORY_DEFAULT)
    }
}
