package ua.alexsnig.exhibitmotion.kiosk

import android.content.Intent

/**
 * Bluetooth Settings must not share the allowlisted Exhibit Motion task.
 * Samsung launches the pairing confirmation as a separate Settings activity;
 * if Settings is stacked inside the kiosk task, Android immediately restores
 * Lock Task and rejects that confirmation activity as a policy violation.
 */
object BluetoothSettingsLaunchPolicy {
    const val INTENT_FLAGS: Int = Intent.FLAG_ACTIVITY_NEW_TASK
}
