package ua.alexsnig.exhibitmotion.detector

import android.os.Handler
import android.os.Looper
import java.lang.ref.WeakReference

/** The bridge may disappear while the foreground service continues. A snapshot is
 * always retained in DetectorRuntime, so the next WebView can recover it. */
object MotionEventBus {
    private val handler = Handler(Looper.getMainLooper())
    @Volatile private var listener: WeakReference<MotionDetectorPlugin>? = null

    fun attach(plugin: MotionDetectorPlugin) {
        listener = WeakReference(plugin)
    }

    fun detach(plugin: MotionDetectorPlugin) {
        if (listener?.get() === plugin) listener = null
    }

    fun publish(snapshot: DetectorSnapshot) {
        handler.post { listener?.get()?.emitStatus(snapshot) }
    }
}
