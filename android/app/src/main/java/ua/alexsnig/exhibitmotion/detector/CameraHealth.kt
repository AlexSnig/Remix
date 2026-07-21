package ua.alexsnig.exhibitmotion.detector

/** Pure camera liveness policy so stalled-frame recovery remains unit-testable. */
object CameraHealth {
    fun isFrameStalled(
        nowElapsedMs: Long,
        cameraBoundAtElapsedMs: Long,
        lastFrameAtElapsedMs: Long,
        timeoutMs: Long,
    ): Boolean {
        if (timeoutMs <= 0L || cameraBoundAtElapsedMs <= 0L) return false
        val reference = if (lastFrameAtElapsedMs > 0L) lastFrameAtElapsedMs else cameraBoundAtElapsedMs
        return nowElapsedMs - reference > timeoutMs
    }
}
