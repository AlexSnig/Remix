package ua.alexsnig.exhibitmotion.kiosk

import android.app.Activity
import android.content.Context
import android.provider.Settings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicReference
import ua.alexsnig.exhibitmotion.detector.DetectorStore
import ua.alexsnig.exhibitmotion.detector.DetectorRuntimePolicy
import ua.alexsnig.exhibitmotion.detector.MotionDetectorService

/**
 * Coordinates a boot resume only after MainActivity is visible. The boot
 * receiver merely persists a marker and asks the persistent HOME activity to
 * come forward; it never starts a camera/media foreground service itself.
 */
object AutoResumeCoordinator {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val visibleResumeJob = AtomicReference<Job?>(null)

    /**
     * Operator maintenance owns the foreground until the operator explicitly
     * returns to kiosk. Cancel a boot/visibility job that may otherwise reach
     * startLockTask after Bluetooth Settings has already opened.
     */
    suspend fun cancelPendingResumeForMaintenance() {
        visibleResumeJob.getAndSet(null)?.cancelAndJoin()
    }

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
        val job = scope.launch {
            val context = activity.applicationContext
            val store = DetectorStore.get(context)
            val config = store.loadKioskAutoStartState()
            if (!config.enabled || config.maintenanceMode) return@launch

            // Lock Task is an Activity operation and is only attempted after
            // MainActivity has reached onPostResume. Re-read configuration and
            // require window focus at the last possible moment: an older
            // visibility job must never relock the task over operator Settings.
            val latestConfig = store.loadKioskAutoStartState()
            withContext(Dispatchers.Main.immediate) {
                if (AutoResumePolicy.shouldEnterLockTask(
                        config = latestConfig,
                        activityFinishing = activity.isFinishing,
                        activityDestroyed = activity.isDestroyed,
                        activityHasWindowFocus = activity.hasWindowFocus(),
                    )
                ) {
                    KioskPolicyController.enterLockTask(activity)
                }
            }

            if (!KioskPolicyController.isDeviceOwner(context)) {
                store.recordBootStartResult("blocked", "Автозапуск потребує Device Owner")
                return@launch
            }

            val bootCount = currentBootCount(context)
            val bootClaimed = store.claimAutoStartForBoot(bootCount)
            if (!DetectorRuntimePolicy.shouldStartAutoResume(
                    bootClaimed = bootClaimed,
                    detectorServiceRunning = MotionDetectorService.isServiceRunning(),
                )
            ) return@launch

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
        visibleResumeJob.getAndSet(job)?.cancel()
    }

    fun currentBootCount(context: Context): Int = runCatching {
        Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT)
    }.getOrDefault(-1)
}
