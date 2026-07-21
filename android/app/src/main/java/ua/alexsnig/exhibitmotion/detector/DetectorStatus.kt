package ua.alexsnig.exhibitmotion.detector

enum class DetectorStatus(val wireValue: String) {
    IDLE("idle"),
    STARTING("starting"),
    ARMED("armed"),
    TRIGGERED("triggered"),
    PLAYING("playing"),
    COOLDOWN("cooldown"),
    RECOVERING("recovering"),
    AUDIO_ROUTE_LOST("audio_route_lost"),
    FAULT("fault"),
}

data class DetectorSnapshot(
    val status: DetectorStatus = DetectorStatus.IDLE,
    val message: String = "Готово до запуску",
    val audioRoute: AudioRoute = AudioRoute.unavailable(),
    val motionPercent: Double = 0.0,
    /** Number of frames that reached the native analyser in the current run. */
    val analyzedFrameCount: Long = 0,
    /** Wall-clock time of the most recent analysed frame, or 0 before one arrives. */
    val lastFrameAtMs: Long = 0,
    val cooldownRemainingSeconds: Int = 0,
    val requiresSoundTest: Boolean = true,
    val updatedAtMs: Long = System.currentTimeMillis(),
)

object DetectorRuntime {
    private val lock = Any()
    private var snapshot = DetectorSnapshot()

    fun current(): DetectorSnapshot = synchronized(lock) { snapshot }

    fun update(next: DetectorSnapshot) {
        synchronized(lock) { snapshot = next.copy(updatedAtMs = System.currentTimeMillis()) }
        MotionEventBus.publish(current())
    }
}
