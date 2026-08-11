package ua.alexsnig.exhibitmotion.detector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DetectorRuntimePolicyTest {
    @Test
    fun calibrationCannotInterruptAnActiveDetectorState() {
        val running = listOf(
            DetectorStatus.STARTING,
            DetectorStatus.ARMED,
            DetectorStatus.TRIGGERED,
            DetectorStatus.PLAYING,
            DetectorStatus.COOLDOWN,
            DetectorStatus.RECOVERING,
        )

        running.forEach { status ->
            assertTrue(DetectorRuntimePolicy.isRunning(status))
            assertFalse(DetectorRuntimePolicy.canStartCalibration(status))
        }

        listOf(
            DetectorStatus.IDLE,
            DetectorStatus.AUDIO_ROUTE_LOST,
            DetectorStatus.FAULT,
        ).forEach { status ->
            assertFalse(DetectorRuntimePolicy.isRunning(status))
            assertTrue(DetectorRuntimePolicy.canStartCalibration(status))
        }
    }

    @Test
    fun telemetryIsLimitedToTwoUpdatesPerSecond() {
        assertTrue(DetectorRuntimePolicy.shouldPublishTelemetry(nowMs = 10_000, lastPublishedAtMs = 0))
        assertFalse(DetectorRuntimePolicy.shouldPublishTelemetry(nowMs = 10_499, lastPublishedAtMs = 10_000))
        assertTrue(DetectorRuntimePolicy.shouldPublishTelemetry(nowMs = 10_500, lastPublishedAtMs = 10_000))
    }

    @Test
    fun packageReplacementRestartsOnlyAMissingDetectorService() {
        assertTrue(
            DetectorRuntimePolicy.shouldStartAutoResume(
                bootClaimed = false,
                detectorServiceRunning = false,
            ),
        )
        assertFalse(
            DetectorRuntimePolicy.shouldStartAutoResume(
                bootClaimed = false,
                detectorServiceRunning = true,
            ),
        )
        assertTrue(
            DetectorRuntimePolicy.shouldStartAutoResume(
                bootClaimed = true,
                detectorServiceRunning = false,
            ),
        )
    }

    @Test
    fun notificationKeyIgnoresPerFrameTelemetry() {
        val first = DetectorSnapshot(
            status = DetectorStatus.ARMED,
            message = "Датчик активний",
            motionPercent = 1.0,
            analyzedFrameCount = 10,
            lastFrameAtMs = 100,
        )
        val laterFrame = first.copy(
            motionPercent = 7.5,
            analyzedFrameCount = 200,
            lastFrameAtMs = 500,
        )

        assertEquals(
            DetectorRuntimePolicy.notificationKey(first),
            DetectorRuntimePolicy.notificationKey(laterFrame),
        )
        assertNotEquals(
            DetectorRuntimePolicy.notificationKey(first),
            DetectorRuntimePolicy.notificationKey(first.copy(message = "Відновлення камери")),
        )
    }
}
