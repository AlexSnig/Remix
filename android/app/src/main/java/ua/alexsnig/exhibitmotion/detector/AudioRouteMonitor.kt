package ua.alexsnig.exhibitmotion.detector

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Handler
import android.os.Looper

enum class AudioRouteKind { AUX, BLUETOOTH, UNAVAILABLE }

data class AudioRoute(
    val kind: AudioRouteKind,
    val deviceId: Int? = null,
    val name: String? = null,
) {
    val displayName: String
        get() = when (kind) {
            AudioRouteKind.AUX -> "AUX"
            AudioRouteKind.BLUETOOTH -> "Bluetooth: ${name ?: "пристрій"}"
            AudioRouteKind.UNAVAILABLE -> "Звук недоступний"
        }

    companion object {
        fun unavailable() = AudioRoute(AudioRouteKind.UNAVAILABLE)
    }
}

class AudioRouteMonitor(
    context: Context,
    private val onRouteChanged: (AudioRoute) -> Unit,
) {
    private val audioManager = context.getSystemService(AudioManager::class.java)
    private val handler = Handler(Looper.getMainLooper())
    private val callback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<AudioDeviceInfo>) = notifyChange()
        override fun onAudioDevicesRemoved(removedDevices: Array<AudioDeviceInfo>) = notifyChange()
    }

    fun start() {
        audioManager.registerAudioDeviceCallback(callback, handler)
        notifyChange()
    }

    fun stop() = audioManager.unregisterAudioDeviceCallback(callback)

    fun resolve(
        preferredBluetoothDeviceId: Int?,
        preferredBluetoothDeviceName: String? = null,
    ): AudioRoute {
        val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS).toList()
        val aux = outputs.firstOrNull { it.isAuxOutput() }
        if (aux != null) return aux.toRoute(AudioRouteKind.AUX)

        val bluetooth = outputs.filter { it.isBluetoothOutput() }
        // Device IDs are transient across reboots. Once an operator has
        // approved a Bluetooth device, never silently fall back to another
        // paired speaker with the same output type.
        val preferredByName = preferredBluetoothDeviceName?.takeIf { it.isNotBlank() }?.let { name ->
            bluetooth.firstOrNull { it.productName?.toString() == name }
        }
        val preferred = preferredBluetoothDeviceId?.let { id -> bluetooth.firstOrNull { it.id == id } }
        val selected = if (!preferredBluetoothDeviceName.isNullOrBlank()) {
            // Once a stable BT name was approved, even a reused numeric device
            // ID must not select a different output after reboot.
            preferredByName
        } else {
            preferred ?: bluetooth.firstOrNull()
        }
        return selected?.toRoute(AudioRouteKind.BLUETOOTH)
            ?: AudioRoute.unavailable()
    }

    private fun notifyChange() = onRouteChanged(resolve(null))

    private fun AudioDeviceInfo.isAuxOutput(): Boolean = type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
        type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
        type == AudioDeviceInfo.TYPE_USB_HEADSET

    private fun AudioDeviceInfo.isBluetoothOutput(): Boolean = type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
        type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
        type == AudioDeviceInfo.TYPE_BLE_HEADSET ||
        type == AudioDeviceInfo.TYPE_BLE_SPEAKER

    private fun AudioDeviceInfo.toRoute(kind: AudioRouteKind) = AudioRoute(kind, id, productName?.toString())
}
