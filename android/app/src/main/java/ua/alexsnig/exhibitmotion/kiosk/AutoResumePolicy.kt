package ua.alexsnig.exhibitmotion.kiosk

import ua.alexsnig.exhibitmotion.detector.KioskAutoStartState

/** Pure guard used immediately before MainActivity enters Lock Task. */
object AutoResumePolicy {
    fun shouldEnterLockTask(
        config: KioskAutoStartState,
        activityFinishing: Boolean,
        activityDestroyed: Boolean,
        activityHasWindowFocus: Boolean,
    ): Boolean = config.enabled &&
        !config.maintenanceMode &&
        !activityFinishing &&
        !activityDestroyed &&
        activityHasWindowFocus
}
