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

    /**
     * Backoff before the next camera bind attempt, doubling from [baseDelayMs]
     * and capped at [maxDelayMs].
     *
     * A dedicated exhibit must never stop trying. Another app — on Samsung
     * hardware, the stock camera app during boot — can evict our client and
     * hold the sensor for an arbitrary stretch, and the phone stands unattended
     * all night. Giving up would leave a silent exhibit until someone notices
     * in the morning, so recovery is unbounded and only the interval grows.
     */
    fun recoveryDelayMs(attempt: Int, baseDelayMs: Long, maxDelayMs: Long): Long {
        val base = baseDelayMs.coerceAtLeast(0L)
        val max = maxDelayMs.coerceAtLeast(base)
        if (attempt <= 1) return base
        // Bound the shift so a long-lived exhibit cannot overflow into a
        // negative delay after thousands of attempts.
        val shift = (attempt - 1).coerceIn(0, 32)
        val scaled = base shl shift
        return if (scaled <= 0L) max else scaled.coerceAtMost(max)
    }
}
