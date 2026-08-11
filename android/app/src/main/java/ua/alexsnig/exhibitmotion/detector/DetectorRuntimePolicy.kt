package ua.alexsnig.exhibitmotion.detector

data class ServiceNotificationKey(
    val title: String,
    val message: String,
)

object DetectorRuntimePolicy {
    const val TELEMETRY_INTERVAL_MS = 500L

    private val runningStatuses = setOf(
        DetectorStatus.STARTING,
        DetectorStatus.ARMED,
        DetectorStatus.TRIGGERED,
        DetectorStatus.PLAYING,
        DetectorStatus.COOLDOWN,
        DetectorStatus.RECOVERING,
    )

    fun isRunning(status: DetectorStatus): Boolean = status in runningStatuses

    fun canStartCalibration(status: DetectorStatus): Boolean = !isRunning(status)

    /**
     * A boot claim prevents ordinary Activity resumes from restarting CameraX.
     * Package replacement is different: Android kills the old service while
     * keeping the same boot count. In that case the visible Home Activity must
     * restore the missing service even though the boot was already claimed.
     */
    fun shouldStartAutoResume(bootClaimed: Boolean, detectorServiceRunning: Boolean): Boolean =
        bootClaimed || !detectorServiceRunning

    fun shouldPublishTelemetry(
        nowMs: Long,
        lastPublishedAtMs: Long,
        intervalMs: Long = TELEMETRY_INTERVAL_MS,
    ): Boolean =
        lastPublishedAtMs <= 0L ||
            intervalMs <= 0L ||
            nowMs - lastPublishedAtMs >= intervalMs

    fun notificationKey(snapshot: DetectorSnapshot): ServiceNotificationKey {
        val title = if (snapshot.status == DetectorStatus.AUDIO_ROUTE_LOST) {
            "Звук недоступний"
        } else {
            "Датчик активний"
        }
        return ServiceNotificationKey(title, snapshot.message)
    }
}
