package ua.alexsnig.exhibitmotion

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import ua.alexsnig.exhibitmotion.detector.MotionDetectorPlugin
import ua.alexsnig.exhibitmotion.kiosk.AutoResumeCoordinator

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(MotionDetectorPlugin::class.java)
        super.onCreate(savedInstanceState)
    }

    /**
     * This is intentionally native and runs before the WebView/React UI. A
     * persistent Device Owner HOME activity is visible here, which is the
     * supported context for starting the camera foreground service.
     */
    override fun onPostResume() {
        super.onPostResume()
        AutoResumeCoordinator.onVisibleMainActivity(this)
    }
}
