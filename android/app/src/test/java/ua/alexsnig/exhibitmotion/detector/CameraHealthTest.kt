package ua.alexsnig.exhibitmotion.detector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CameraHealthTest {
    @Test
    fun waitsForTheInitialFrameGracePeriod() {
        assertFalse(CameraHealth.isFrameStalled(7_999, 1_000, 0, 8_000))
        assertTrue(CameraHealth.isFrameStalled(9_001, 1_000, 0, 8_000))
    }

    @Test
    fun detectsAStaleDeliveredFrame() {
        assertFalse(CameraHealth.isFrameStalled(12_000, 1_000, 5_000, 8_000))
        assertTrue(CameraHealth.isFrameStalled(13_001, 1_000, 5_000, 8_000))
    }

    @Test
    fun neverFlagsAnUnboundCamera() {
        assertFalse(CameraHealth.isFrameStalled(50_000, 0, 0, 8_000))
    }

    @Test
    fun backsOffByDoublingFromTheBaseDelay() {
        assertEquals(1_500L, CameraHealth.recoveryDelayMs(1, 1_500, 30_000))
        assertEquals(3_000L, CameraHealth.recoveryDelayMs(2, 1_500, 30_000))
        assertEquals(6_000L, CameraHealth.recoveryDelayMs(3, 1_500, 30_000))
        assertEquals(12_000L, CameraHealth.recoveryDelayMs(4, 1_500, 30_000))
        assertEquals(24_000L, CameraHealth.recoveryDelayMs(5, 1_500, 30_000))
    }

    @Test
    fun capsTheDelaySoRecoveryKeepsRetrying() {
        assertEquals(30_000L, CameraHealth.recoveryDelayMs(6, 1_500, 30_000))
        assertEquals(30_000L, CameraHealth.recoveryDelayMs(50, 1_500, 30_000))
    }

    /** An exhibit left overnight against a camera it can never take must still
     * be retrying in the morning, not sleeping on a delay that overflowed. */
    @Test
    fun neverOverflowsIntoAZeroOrNegativeDelay() {
        for (attempt in intArrayOf(64, 1_000, Int.MAX_VALUE)) {
            assertEquals(30_000L, CameraHealth.recoveryDelayMs(attempt, 1_500, 30_000))
        }
    }

    @Test
    fun treatsTheFirstAttemptAndDegenerateInputAsTheBaseDelay() {
        assertEquals(1_500L, CameraHealth.recoveryDelayMs(0, 1_500, 30_000))
        assertEquals(1_500L, CameraHealth.recoveryDelayMs(-5, 1_500, 30_000))
        // A cap below the base must not invert the interval.
        assertEquals(1_500L, CameraHealth.recoveryDelayMs(3, 1_500, 500))
    }
}
