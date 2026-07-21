package ua.alexsnig.exhibitmotion.detector

import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

data class DetectionZone(
    val x: Double = 0.0,
    val y: Double = 0.0,
    val width: Double = 1.0,
    val height: Double = 1.0,
)

data class MotionSettings(
    val schemaVersion: Int = 3,
    val sensitivity: Double = 70.0,
    val noiseThreshold: Double = 1.5,
    val coolDownDelaySeconds: Int = 6,
    val customAudioId: String? = null,
    val audioVolume: Int = 100,
    /** `user` is the front camera, matching the operator-facing web UI. */
    val cameraFacingMode: String = "user",
    val requiredConsecutiveFrames: Int = 2,
    val globalChangeCeiling: Double = 70.0,
    val detectionZone: DetectionZone = DetectionZone(),
    val calibratedNoiseFloor: Double? = null,
    val preferredBluetoothDeviceId: Int? = null,
    val preferredBluetoothDeviceName: String? = null,
    val saveEventPhotos: Boolean = false,
) {
    fun toJson(): String = JSONObject().apply {
        put("schemaVersion", schemaVersion)
        put("sensitivity", sensitivity)
        put("noiseThreshold", noiseThreshold)
        put("coolDownDelay", coolDownDelaySeconds)
        put("customAudioId", customAudioId ?: JSONObject.NULL)
        put("audioVolume", audioVolume)
        put("cameraFacingMode", cameraFacingMode)
        put("requiredConsecutiveFrames", requiredConsecutiveFrames)
        put("globalChangeCeiling", globalChangeCeiling)
        put("calibratedNoiseFloor", calibratedNoiseFloor)
        put("preferredBluetoothDeviceId", preferredBluetoothDeviceId)
        put("preferredBluetoothDeviceName", preferredBluetoothDeviceName ?: JSONObject.NULL)
        put("saveEventPhotos", saveEventPhotos)
        put("detectionZone", JSONObject().apply {
            put("x", detectionZone.x)
            put("y", detectionZone.y)
            put("width", detectionZone.width)
            put("height", detectionZone.height)
        })
    }.toString()

    companion object {
        fun fromJson(raw: String?): MotionSettings {
            val source = runCatching { JSONObject(raw ?: "{}") }.getOrDefault(JSONObject())
            val zone = source.optJSONObject("detectionZone") ?: JSONObject()
            val x = clamp(zone.optDouble("x", 0.0), 0.0, 0.9)
            val y = clamp(zone.optDouble("y", 0.0), 0.0, 0.9)
            return MotionSettings(
                sensitivity = clamp(source.optDouble("sensitivity", 70.0), 1.0, 100.0),
                noiseThreshold = clamp(source.optDouble("noiseThreshold", 1.5), 0.1, 25.0),
                coolDownDelaySeconds = round(clamp(source.optDouble("coolDownDelay", 6.0), 2.0, 300.0)).toInt(),
                customAudioId = nullableString(source, "customAudioId"),
                audioVolume = round(clamp(source.optDouble("audioVolume", 100.0), 0.0, 100.0)).toInt(),
                cameraFacingMode = if (source.optString("cameraFacingMode") == "environment") "environment" else "user",
                requiredConsecutiveFrames = round(clamp(source.optDouble("requiredConsecutiveFrames", 2.0), 1.0, 5.0)).toInt(),
                globalChangeCeiling = clamp(source.optDouble("globalChangeCeiling", 70.0), 30.0, 100.0),
                detectionZone = DetectionZone(
                    x = x,
                    y = y,
                    width = min(1.0 - x, clamp(zone.optDouble("width", 1.0), 0.1, 1.0)),
                    height = min(1.0 - y, clamp(zone.optDouble("height", 1.0), 0.1, 1.0)),
                ),
                calibratedNoiseFloor = source.takeIf { !it.isNull("calibratedNoiseFloor") }
                    ?.optDouble("calibratedNoiseFloor")
                    ?.takeIf { it.isFinite() }
                    ?.let { clamp(it, 0.0, 25.0) },
                preferredBluetoothDeviceId = source.takeIf { it.has("preferredBluetoothDeviceId") }
                    ?.optInt("preferredBluetoothDeviceId")
                    ?.takeIf { it > 0 },
                preferredBluetoothDeviceName = nullableString(source, "preferredBluetoothDeviceName"),
                saveEventPhotos = source.optBoolean("saveEventPhotos", false),
            )
        }

        private fun clamp(value: Double, lower: Double, upper: Double): Double = min(upper, max(lower, value))

        private fun nullableString(source: JSONObject, key: String): String? {
            if (!source.has(key) || source.isNull(key)) return null
            return source.optString(key).trim().takeIf { it.isNotEmpty() }
        }
    }
}
