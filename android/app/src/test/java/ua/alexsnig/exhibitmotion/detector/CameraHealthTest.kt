package ua.alexsnig.exhibitmotion.detector

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
}
