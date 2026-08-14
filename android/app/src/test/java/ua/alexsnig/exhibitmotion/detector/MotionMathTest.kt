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
    fun classifiesNearFarCandidatesSeparatelyFromGlobalFrameChanges() {
        assertEquals(
            MotionSampleClassification.BELOW_THRESHOLD,
            MotionMath.classify(1.49, 1.5, 70.0),
        )
        assertEquals(
            MotionSampleClassification.CANDIDATE,
            MotionMath.classify(1.5, 1.5, 70.0),
        )
        assertEquals(
            MotionSampleClassification.CANDIDATE,
            MotionMath.classify(69.99, 1.5, 70.0),
        )
        assertEquals(
            MotionSampleClassification.GLOBAL_CHANGE,
            MotionMath.classify(70.0, 1.5, 70.0),
        )
    }

    @Test
    fun calibrationUsesRobustBackgroundNoiseAndIgnoresMovementOutliers() {
        assertEquals(0.5, MotionMath.calibratedThreshold(emptyList()), 0.0)
        assertEquals(
            1.4,
            MotionMath.calibratedThreshold(listOf(0.1, 0.2, 0.2, 0.3, 0.3, 0.3, 0.4, 0.4, 30.0, 80.0)),
            0.0,
        )
        assertEquals(
            3.0,
            MotionMath.calibratedThreshold(listOf(1.0, 1.2, 1.3, 1.5, 1.7)),
            0.0,
        )
        assertEquals(10.0, MotionMath.calibratedThreshold(List(10) { 100.0 }), 0.0)
    }

    @Test
    fun `calibrate reports a quiet scene as unclamped`() {
        val result = MotionMath.calibrate(listOf(1.0, 1.2, 1.3, 1.5, 1.7))
        assertEquals(3.0, result.threshold, 0.0)
        assertEquals(3.0, result.rawThreshold, 0.0)
        assertFalse(result.clamped)
    }

    @Test
    fun `calibrate reports the raw estimate when the clamp fires`() {
        // A scene this noisy is what left a commissioned phone reacting only
        // within about two metres, with nothing on screen saying so.
        val result = MotionMath.calibrate(List(10) { 100.0 })
        assertEquals(10.0, result.threshold, 0.0)
        assertTrue(result.clamped)
        assertTrue("raw estimate must exceed the clamp", result.rawThreshold > 10.0)
    }

    @Test
    fun `calibrate without samples returns the minimum and is not clamped`() {
        val result = MotionMath.calibrate(emptyList())
        assertEquals(0.5, result.threshold, 0.0)
        assertEquals(0.5, result.rawThreshold, 0.0)
        assertFalse(result.clamped)
    }

    @Test
    fun `a threshold sitting exactly on the clamp is not reported as clamped`() {
        // Guards against warning on a scene that legitimately estimates 10.0%.
        val result = MotionMath.calibrate(listOf(9.5, 9.5, 9.5, 9.5, 9.5))
        assertEquals(10.0, result.threshold, 0.0)
        assertEquals(10.0, result.rawThreshold, 0.0)
        assertFalse(result.clamped)
    }
}
