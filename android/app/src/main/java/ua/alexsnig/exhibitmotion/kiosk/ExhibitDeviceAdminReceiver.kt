package ua.alexsnig.exhibitmotion.kiosk

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

/**
 * Stable Device Owner receiver for dedicated exhibit devices. Do not rename
 * this class after a production device has been provisioned: Android ties the
 * Device Owner identity to the component and APK signing certificate.
 */
class ExhibitDeviceAdminReceiver : DeviceAdminReceiver() {
    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)
        KioskPolicyController.applyDeviceOwnerPolicies(context)
        KioskPolicyController.launchHome(context)
    }
}
