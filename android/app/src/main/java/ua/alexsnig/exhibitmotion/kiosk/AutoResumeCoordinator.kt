package ua.alexsnig.exhibitmotion.kiosk

import android.app.Activity
import android.content.Context
import android.provider.Settings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ua.alexsnig.exhibitmotion.detector.DetectorStore
import ua.alexsnig.exhibitmotion.detector.MotionDetectorService

/**
 * Coordinates a boot resume only after MainActivity is visible. The boot
 * receiver merely persists a marker and asks the persistent HOME activity to
 * come forward; it never starts a camera/media foreground service itself.
 */
object AutoResumeCoordinator {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    suspend fun markBootResumePending(context: Context) {
        val store = DetectorStore.get(context)
        val config = store.loadKioskAutoStartState()
        if (config.enabled && !config.maintenanceMode) {
            store.markBootResumePending()
            if (KioskPolicyController.isDeviceOwner(context)) {
                KioskPolicyController.launchHome(context)
            }
        }
    }

    fun onVisibleMainActivity(activity: Activity) {
        scope.launch {
            val context = activity.applicationContext
            val store = DetectorStore.get(context)
            val config = store.loadKioskAutoStartState()
            if (!config.enabled || config.maintenanceMode) return@launch

            // Lock Task is an Activity operation and is only attempted after
            // MainActivity has reached onPostResume.
            withContext(Dispatchers.Main.immediate) {
                if (!activity.isFinishing && !activity.isDestroyed) {
                    KioskPolicyController.enterLockTask(activity)
                }
            }

            if (!KioskPolicyController.isDeviceOwner(context)) {
                store.recordBootStartResult("blocked", "Автозапуск потребує Device Owner")
                return@launch
            }

            val bootCount = currentBootCount(context)
            if (!store.claimAutoStartForBoot(bootCount)) return@launch

            val runtime = KioskPolicyController.state(context)
            // A route mismatch/unavailable output is handled by the service
            // itself so it can publish AUDIO_ROUTE_LOST and never fall back to
            // the handset speaker. All other blockers avoid a needless FGS.
            val hardBlockers = runtime.blockers.filter { it != "audio_route_not_verified" }
            if (hardBlockers.isNotEmpty()) {
                store.recordBootStartResult(
                    "blocked",
                    "Автозапуск заблоковано: ${hardBlockers.joinToString(", ")}",
                )
                return@launch
            }

            store.recordBootStartResult(
                if (runtime.readiness.routeVerified) "started" else "waiting_for_route",
                if (runtime.readiness.routeVerified) {
                    "Home-екран активний; запускається датчик"
                } else {
                    "Очікується перевірений AUX або Bluetooth-маршрут"
                },
            )
            withContext(Dispatchers.Main.immediate) {
                if (!activity.isFinishing && !activity.isDestroyed) {
                    MotionDetectorService.command(context, MotionDetectorService.ACTION_AUTO_START)
                }
            }
        }
    }

    fun currentBootCount(context: Context): Int = runCatching {
        Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT)
    }.getOrDefault(-1)
}
