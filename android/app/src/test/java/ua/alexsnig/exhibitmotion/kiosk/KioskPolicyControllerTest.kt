package ua.alexsnig.exhibitmotion.kiosk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import ua.alexsnig.exhibitmotion.detector.KioskAutoStartState
import ua.alexsnig.exhibitmotion.detector.SetupReadiness

class KioskPolicyControllerTest {
    @Test
    fun fullyCommissionedDeviceHasNoBlockers() {
        val blockers = KioskPolicyController.readinessBlockers(
            config = KioskAutoStartState(),
            readiness = SetupReadiness(true, true, true, true, true, 80),
            pinConfigured = true,
            deviceOwner = true,
            defaultHome = true,
            lockTaskAllowed = true,
            requiresFirstUnlock = false,
        )
        assertTrue(blockers.isEmpty())
    }

    @Test
    fun incompleteCommissioningReportsEverySafetyGate() {
        val blockers = KioskPolicyController.readinessBlockers(
            config = KioskAutoStartState(maintenanceMode = true),
            readiness = SetupReadiness(false, false, false, false, false, 100),
            pinConfigured = false,
            deviceOwner = false,
            defaultHome = false,
            lockTaskAllowed = false,
            requiresFirstUnlock = true,
        )
        assertEquals(
            listOf(
                "device_owner_required", "home_launcher_required", "lock_task_not_active",
                "secure_lock_requires_first_unlock", "camera_permission_missing", "audio_missing",
                "audio_route_not_verified", "calibration_missing", "motion_test_missing",
                "operator_pin_missing", "maintenance_mode_active",
            ),
            blockers,
        )
    }
}
