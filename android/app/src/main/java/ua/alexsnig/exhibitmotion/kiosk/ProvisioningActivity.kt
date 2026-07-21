package ua.alexsnig.exhibitmotion.kiosk

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.os.Bundle

/**
 * Android 12+ can ask a DPC which provisioning mode it supports and then ask
 * it to acknowledge policy compliance. Keeping this tiny native Activity
 * avoids depending on the Capacitor WebView during device provisioning.
 */
class ProvisioningActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        when (intent.action) {
            DevicePolicyManager.ACTION_GET_PROVISIONING_MODE -> {
                setResult(
                    RESULT_OK,
                    intent.putExtra(
                        DevicePolicyManager.EXTRA_PROVISIONING_MODE,
                        DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE,
                    ),
                )
            }
            DevicePolicyManager.ACTION_ADMIN_POLICY_COMPLIANCE -> {
                KioskPolicyController.applyDeviceOwnerPolicies(this)
                setResult(RESULT_OK)
            }
            else -> setResult(RESULT_CANCELED)
        }
        finish()
    }
}
