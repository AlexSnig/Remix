package ua.alexsnig.exhibitmotion.detector

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import ua.alexsnig.exhibitmotion.kiosk.AutoResumeCoordinator
import ua.alexsnig.exhibitmotion.kiosk.KioskPolicyController

/**
 * Never starts the camera foreground service. In commissioned kiosk mode it
 * only persists a boot marker and asks the Device Owner HOME activity to
 * appear; MainActivity starts the service after it is visibly resumed.
 */
class RebootReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in setOf(
                Intent.ACTION_BOOT_COMPLETED,
                Intent.ACTION_USER_UNLOCKED,
                Intent.ACTION_MY_PACKAGE_REPLACED,
            )
        ) return
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val config = DetectorStore.get(context).loadKioskAutoStartState()
                if (config.enabled && !config.maintenanceMode && KioskPolicyController.isDeviceOwner(context)) {
                    AutoResumeCoordinator.markBootResumePending(context)
                } else {
                    postReminder(
                        context,
                        if (config.enabled) {
                            "Автозапуск очікує Device Owner або завершення операторського режиму."
                        } else {
                            "Після перезавантаження датчик не ввімкнено автоматично."
                        },
                    )
                }
            } finally {
                pending.finish()
            }
        }
    }

    private fun postReminder(context: Context, message: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        MotionNotifications.ensureChannels(context)
        NotificationManagerCompat.from(context).notify(
            MotionNotifications.REBOOT_NOTIFICATION_ID,
            MotionNotifications.rebootReminder(context, message),
        )
    }
}
