package ua.alexsnig.exhibitmotion.detector

import org.junit.Assert.assertEquals
import org.junit.Test

class AudioOutputVolumeTest {
    @Test
    fun mapsOperatorPercentToAndroidStreamRange() {
        assertEquals(0, AudioOutputVolume.targetIndex(0, 0, 15))
        assertEquals(8, AudioOutputVolume.targetIndex(50, 0, 15))
        assertEquals(15, AudioOutputVolume.targetIndex(100, 0, 15))
    }

    @Test
    fun clampsInvalidPercentAndHonorsNonZeroMinimum() {
        assertEquals(2, AudioOutputVolume.targetIndex(-10, 2, 12))
        assertEquals(12, AudioOutputVolume.targetIndex(150, 2, 12))
        assertEquals(2, AudioOutputVolume.targetIndex(50, 2, 2))
    }
}
