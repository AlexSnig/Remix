package ua.alexsnig.exhibitmotion.detector

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

data class MotionAnalysis(
    val percentageChanged: Double,
    val changedPixels: Int,
)

/**
 * This mirrors src/utils/motionDetection.ts. Frames contain packed 8-bit RGB
 * values in the same 36 x 48 analysis resolution used by the PWA.
 */
object MotionMath {
    fun analyze(
        current: IntArray,
        previous: IntArray,
        width: Int,
        height: Int,
        sensitivity: Double,
        zone: DetectionZone,
    ): MotionAnalysis {
        val startX = floor(zone.x * width).toInt()
        val startY = floor(zone.y * height).toInt()
        val endX = min(width, ceil((zone.x + zone.width) * width).toInt())
        val endY = min(height, ceil((zone.y + zone.height) * height).toInt())
        val channelThreshold = max(10.0, 100.0 - sensitivity * 0.9)
        var changed = 0

        for (y in startY until endY) {
            for (x in startX until endX) {
                val index = y * width + x
                val a = current[index]
                val b = previous[index]
                val difference = (
                    abs(((a shr 16) and 0xff) - ((b shr 16) and 0xff)) +
                    abs(((a shr 8) and 0xff) - ((b shr 8) and 0xff)) +
                    abs((a and 0xff) - (b and 0xff))
                ) / 3.0
                if (difference > channelThreshold) changed += 1
            }
        }

        val total = max(1, (endX - startX) * (endY - startY))
        return MotionAnalysis(changed.toDouble() / total * 100.0, changed)
    }

    fun shouldTrigger(
        percentageChanged: Double,
        threshold: Double,
        globalChangeCeiling: Double,
        consecutiveFrames: Int,
        requiredConsecutiveFrames: Int,
    ): Boolean = percentageChanged >= threshold &&
        percentageChanged < globalChangeCeiling &&
        consecutiveFrames >= requiredConsecutiveFrames

    fun calibratedThreshold(samples: List<Double>, minimum: Double = 0.5): Double {
        if (samples.isEmpty()) return minimum
        val sorted = samples.sorted()
        val index = min(sorted.lastIndex, floor(sorted.size * 0.95).toInt())
        return min(25.0, max(minimum, roundToOneDecimal(sorted[index] + 0.5)))
    }

    private fun roundToOneDecimal(value: Double): Double = kotlin.math.round(value * 10.0) / 10.0
}
