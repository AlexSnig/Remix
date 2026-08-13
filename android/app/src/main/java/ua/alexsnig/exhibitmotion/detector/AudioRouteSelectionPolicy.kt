package ua.alexsnig.exhibitmotion.detector

import android.media.AudioDeviceInfo

internal data class BluetoothAudioCandidate(
    val deviceId: Int,
    val name: String?,
    val deviceType: Int,
)

/** Selects only Bluetooth endpoints that can carry media narration.
 *
 * Samsung exposes the same physical speaker as both A2DP and SCO. SCO is a
 * narrow-band call endpoint; pinning ExoPlayer to it prevents the A2DP stream
 * from starting even though the UI still shows the correct product name.
 */
internal object AudioRouteSelectionPolicy {
    fun selectBluetoothMediaOutput(
        candidates: List<BluetoothAudioCandidate>,
        preferredDeviceId: Int?,
        preferredDeviceName: String?,
        allowUnapprovedMediaOutput: Boolean = false,
    ): BluetoothAudioCandidate? {
        val mediaOutputs = candidates
            .filter { isBluetoothMediaOutput(it.deviceType) }
            .sortedBy { mediaOutputPriority(it.deviceType) }

        val preferredByName = preferredDeviceName?.takeIf { it.isNotBlank() }?.let { name ->
            mediaOutputs.firstOrNull { it.name == name }
        }
        val preferredById = preferredDeviceId?.let { id ->
            mediaOutputs.firstOrNull { it.deviceId == id }
        }
        return if (!preferredDeviceName.isNullOrBlank()) {
            preferredByName ?: if (allowUnapprovedMediaOutput) {
                preferredById ?: mediaOutputs.firstOrNull()
            } else {
                null
            }
        } else {
            preferredById ?: mediaOutputs.firstOrNull()
        }
    }

    fun isBluetoothMediaOutput(deviceType: Int): Boolean =
        deviceType == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
            deviceType == AudioDeviceInfo.TYPE_BLE_SPEAKER ||
            deviceType == AudioDeviceInfo.TYPE_BLE_HEADSET

    private fun mediaOutputPriority(deviceType: Int): Int = when (deviceType) {
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> 0
        AudioDeviceInfo.TYPE_BLE_SPEAKER -> 1
        AudioDeviceInfo.TYPE_BLE_HEADSET -> 2
        else -> Int.MAX_VALUE
    }
}
