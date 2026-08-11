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

        val bluetooth = outputs.map { output ->
            BluetoothAudioCandidate(
                deviceId = output.id,
                name = output.productName?.toString(),
                deviceType = output.type,
            )
        }
        // Device IDs are transient across reboots. Once an operator has
        // approved a Bluetooth device, never silently fall back to another
        // paired speaker with the same output type.
        val selected = AudioRouteSelectionPolicy.selectBluetoothMediaOutput(
            candidates = bluetooth,
            preferredDeviceId = preferredBluetoothDeviceId,
            preferredDeviceName = preferredBluetoothDeviceName,
        )
        return selected?.let { AudioRoute(AudioRouteKind.BLUETOOTH, it.deviceId, it.name) }
            ?: AudioRoute.unavailable()
    }

    private fun notifyChange() = onRouteChanged(resolve(null))

    private fun AudioDeviceInfo.isAuxOutput(): Boolean = type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
        type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
        type == AudioDeviceInfo.TYPE_USB_HEADSET

    private fun AudioDeviceInfo.toRoute(kind: AudioRouteKind) = AudioRoute(kind, id, productName?.toString())
}
