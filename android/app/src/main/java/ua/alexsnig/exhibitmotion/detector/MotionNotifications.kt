package ua.alexsnig.exhibitmotion.detector

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import ua.alexsnig.exhibitmotion.MainActivity
import ua.alexsnig.exhibitmotion.R

object MotionNotifications {
    const val SERVICE_CHANNEL = "motion_detector_active"
    const val ALERT_CHANNEL = "motion_detector_alerts"
    const val SERVICE_NOTIFICATION_ID = 4101
    const val REBOOT_NOTIFICATION_ID = 4102

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(
            SERVICE_CHANNEL,
            "Датчик руху",
            NotificationManager.IMPORTANCE_LOW,
        ))
        manager.createNotificationChannel(NotificationChannel(
            ALERT_CHANNEL,
            "Критичний стан датчика",
            NotificationManager.IMPORTANCE_HIGH,
        ))
    }

    fun service(context: Context, snapshot: DetectorSnapshot): Notification = NotificationCompat.Builder(context, SERVICE_CHANNEL)
        .setSmallIcon(R.drawable.ic_launcher_foreground)
        .setContentTitle(if (snapshot.status == DetectorStatus.AUDIO_ROUTE_LOST) "Звук недоступний" else "Датчик активний")
        .setContentText(snapshot.message)
        .setContentIntent(openAppIntent(context))
        .setOngoing(true)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build()

    fun rebootReminder(
        context: Context,
        message: String = "Після перезавантаження камера не запускається автоматично.",
    ): Notification = NotificationCompat.Builder(context, ALERT_CHANNEL)
        .setSmallIcon(R.drawable.ic_launcher_foreground)
        .setContentTitle("Запустіть датчик")
        .setContentText(message)
        .setContentIntent(openAppIntent(context))
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .build()

    private fun openAppIntent(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
