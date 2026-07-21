package ua.alexsnig.exhibitmotion.detector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MotionMathTest {
    @Test
    fun identicalFramesReportNoMotion() {
        val frame = intArrayOf(0x101010, 0x202020, 0x303030, 0x404040)
        assertEquals(0.0, MotionMath.analyze(frame, frame, 2, 2, 70.0, DetectionZone()).percentageChanged, 0.0)
    }

    @Test
    fun detectionZoneExcludesMotionOutsideTheZone() {
        val previous = intArrayOf(0, 0, 0, 0)
        val current = intArrayOf(0xffffff, 0, 0, 0)
        val full = MotionMath.analyze(current, previous, 2, 2, 70.0, DetectionZone())
        val rightHalf = MotionMath.analyze(current, previous, 2, 2, 70.0, DetectionZone(0.5, 0.0, 0.5, 1.0))
        assertEquals(25.0, full.percentageChanged, 0.0)
        assertEquals(0.0, rightHalf.percentageChanged, 0.0)
    }

    @Test
    fun triggerRequiresConsecutiveFramesAndRejectsGlobalChanges() {
        assertFalse(MotionMath.shouldTrigger(5.0, 1.5, 70.0, 1, 2))
        assertTrue(MotionMath.shouldTrigger(5.0, 1.5, 70.0, 2, 2))
        assertFalse(MotionMath.shouldTrigger(80.0, 1.5, 70.0, 2, 2))
    }

    @Test
    fun calibrationUsesBoundedNinetyFifthPercentile() {
        assertEquals(0.5, MotionMath.calibratedThreshold(emptyList()), 0.0)
        assertEquals(2.5, MotionMath.calibratedThreshold(listOf(0.1, 0.2, 0.3, 0.4, 2.0)), 0.0)
        assertEquals(25.0, MotionMath.calibratedThreshold(listOf(100.0)), 0.0)
    }
}
