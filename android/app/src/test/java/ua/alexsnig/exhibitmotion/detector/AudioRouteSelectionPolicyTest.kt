package ua.alexsnig.exhibitmotion.detector

import android.media.AudioDeviceInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AudioRouteSelectionPolicyTest {
    private val sco = BluetoothAudioCandidate(30, "S207U", AudioDeviceInfo.TYPE_BLUETOOTH_SCO)
    private val a2dp = BluetoothAudioCandidate(33, "S207U", AudioDeviceInfo.TYPE_BLUETOOTH_A2DP)

    @Test
    fun `same named Samsung endpoints select A2DP instead of SCO`() {
        val selected = AudioRouteSelectionPolicy.selectBluetoothMediaOutput(
            candidates = listOf(sco, a2dp),
            preferredDeviceId = sco.deviceId,
            preferredDeviceName = "S207U",
        )

        assertEquals(a2dp, selected)
    }

    @Test
    fun `unverified route also prefers a media endpoint`() {
        val selected = AudioRouteSelectionPolicy.selectBluetoothMediaOutput(
            candidates = listOf(sco, a2dp),
            preferredDeviceId = null,
            preferredDeviceName = null,
        )

        assertEquals(a2dp, selected)
    }

    @Test
    fun `SCO-only device is not accepted for narration`() {
        val selected = AudioRouteSelectionPolicy.selectBluetoothMediaOutput(
            candidates = listOf(sco),
            preferredDeviceId = sco.deviceId,
            preferredDeviceName = "S207U",
        )

        assertNull(selected)
    }

    @Test
    fun `approved name never falls back to another speaker`() {
        val selected = AudioRouteSelectionPolicy.selectBluetoothMediaOutput(
            candidates = listOf(BluetoothAudioCandidate(40, "Other", AudioDeviceInfo.TYPE_BLUETOOTH_A2DP)),
            preferredDeviceId = 40,
            preferredDeviceName = "S207U",
        )

        assertNull(selected)
    }
}
