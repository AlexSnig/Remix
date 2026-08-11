package ua.alexsnig.exhibitmotion.detector

import android.content.Context
import android.media.AudioManager
import android.os.Build
import android.util.Log
import kotlin.math.roundToInt

/** Applies the in-app volume to Android's current approved output. */
object AudioOutputVolume {
    private const val TAG = "AudioOutputVolume"

    fun targetIndex(percent: Int, minimum: Int, maximum: Int): Int {
        if (maximum <= minimum) return minimum
        val normalized = percent.coerceIn(0, 100) / 100.0
        return (minimum + (maximum - minimum) * normalized)
            .roundToInt()
            .coerceIn(minimum, maximum)
    }

    fun apply(context: Context, percent: Int, route: AudioRoute): Result<Int> {
        if (route.kind == AudioRouteKind.UNAVAILABLE) {
            return Result.failure(IllegalStateException("External audio route is unavailable"))
        }
        return runCatching {
            val audioManager = context.getSystemService(AudioManager::class.java)
                ?: error("Android AudioManager is unavailable")
            val minimum = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                audioManager.getStreamMinVolume(AudioManager.STREAM_MUSIC)
            } else {
                0
            }
            val maximum = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val target = targetIndex(percent, minimum, maximum)
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
            val actual = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            check(actual == target) {
                "Android applied media volume $actual instead of requested $target"
            }
            Log.i(
                TAG,
                "Applied STREAM_MUSIC=$actual/$maximum for ${route.displayName} (deviceId=${route.deviceId})",
            )
            actual
        }.onFailure { error ->
            Log.e(TAG, "Could not apply media volume for ${route.displayName}", error)
        }
    }
}

// Android stores independent STREAM_MUSIC indexes per wired/Bluetooth route.
// ExoPlayer volume alone cannot raise a connected route whose system index is zero.
