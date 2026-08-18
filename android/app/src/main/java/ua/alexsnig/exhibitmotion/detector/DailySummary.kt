package ua.alexsnig.exhibitmotion.detector

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId

/**
 * One exhibition day, folded from events the service already records.
 *
 * The exhibit fails closed correctly and silently: the screen is off, the hall
 * is dark, and a lost route or a stuck camera looks exactly like a quiet day.
 * This is the record a person can read the next morning to tell those apart.
 *
 * Battery is sampled at the moments the service already wakes for — a trigger
 * and a service start — never on a timer, so the day summary costs no extra
 * wakeups.
 */
data class DailySummary(
    /** Local calendar day, ISO `yyyy-MM-dd`; ISO dates also sort lexicographically. */
    val day: String,
    val triggers: Int = 0,
    val firstTriggerAtMs: Long = 0L,
    val lastTriggerAtMs: Long = 0L,
    val cameraRestarts: Int = 0,
    /** Route losses while the exhibit was live; setup-time absence is not counted. */
    val routeLosses: Int = 0,
    val serviceStarts: Int = 0,
    val minBatteryPercent: Int? = null,
    val maxBatteryTemperatureC: Double? = null,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("day", day)
        put("triggers", triggers)
        put("firstTriggerAtMs", firstTriggerAtMs)
        put("lastTriggerAtMs", lastTriggerAtMs)
        put("cameraRestarts", cameraRestarts)
        put("routeLosses", routeLosses)
        put("serviceStarts", serviceStarts)
        put("minBatteryPercent", minBatteryPercent ?: JSONObject.NULL)
        put("maxBatteryTemperatureC", maxBatteryTemperatureC ?: JSONObject.NULL)
    }

    companion object {
        fun fromJson(json: JSONObject): DailySummary? {
            val day = json.optString("day").takeIf { it.isNotBlank() } ?: return null
            return DailySummary(
                day = day,
                triggers = json.optInt("triggers", 0),
                firstTriggerAtMs = json.optLong("firstTriggerAtMs", 0L),
                lastTriggerAtMs = json.optLong("lastTriggerAtMs", 0L),
                cameraRestarts = json.optInt("cameraRestarts", 0),
                routeLosses = json.optInt("routeLosses", 0),
                serviceStarts = json.optInt("serviceStarts", 0),
                minBatteryPercent = if (json.isNull("minBatteryPercent")) null else json.optInt("minBatteryPercent"),
                maxBatteryTemperatureC = if (json.isNull("maxBatteryTemperatureC")) {
                    null
                } else {
                    json.optDouble("maxBatteryTemperatureC")
                },
            )
        }
    }
}

/**
 * Pure folding rules for [DailySummary], deliberately free of Android and of
 * storage, so the whole retention and aggregation contract is covered by plain
 * JVM unit tests — the same treatment as [MotionMath] and [CameraHealth].
 *
 * Summaries live in DataStore next to the settings JSON rather than in Room.
 * `DetectorStore` builds the Room database with
 * `fallbackToDestructiveMigration(false)`, and in Room 2.7 that argument is
 * `dropAllTables`: the call enables destructive migration. Raising the schema
 * version without an explicit migration would therefore drop `motion_events`
 * on every commissioned phone. Keeping day summaries out of the database
 * removes that failure mode entirely.
 */
object DailySummaryPolicy {
    const val RETAINED_DAYS = 60

    fun dayKey(atMs: Long, zone: ZoneId = ZoneId.systemDefault()): String =
        Instant.ofEpochMilli(atMs).atZone(zone).toLocalDate().toString()

    fun recordTrigger(
        days: List<DailySummary>,
        atMs: Long,
        batteryPercent: Int? = null,
        batteryTemperatureC: Double? = null,
        zone: ZoneId = ZoneId.systemDefault(),
    ): List<DailySummary> = update(days, dayKey(atMs, zone)) { day ->
        day.copy(
            triggers = day.triggers + 1,
            firstTriggerAtMs = if (day.firstTriggerAtMs == 0L) atMs else minOf(day.firstTriggerAtMs, atMs),
            lastTriggerAtMs = maxOf(day.lastTriggerAtMs, atMs),
            minBatteryPercent = lowest(day.minBatteryPercent, batteryPercent),
            maxBatteryTemperatureC = highest(day.maxBatteryTemperatureC, batteryTemperatureC),
        )
    }

    fun recordCameraRestart(
        days: List<DailySummary>,
        atMs: Long,
        zone: ZoneId = ZoneId.systemDefault(),
    ): List<DailySummary> = update(days, dayKey(atMs, zone)) { it.copy(cameraRestarts = it.cameraRestarts + 1) }

    fun recordRouteLoss(
        days: List<DailySummary>,
        atMs: Long,
        zone: ZoneId = ZoneId.systemDefault(),
    ): List<DailySummary> = update(days, dayKey(atMs, zone)) { it.copy(routeLosses = it.routeLosses + 1) }

    fun recordServiceStart(
        days: List<DailySummary>,
        atMs: Long,
        batteryPercent: Int? = null,
        batteryTemperatureC: Double? = null,
        zone: ZoneId = ZoneId.systemDefault(),
    ): List<DailySummary> = update(days, dayKey(atMs, zone)) { day ->
        day.copy(
            serviceStarts = day.serviceStarts + 1,
            minBatteryPercent = lowest(day.minBatteryPercent, batteryPercent),
            maxBatteryTemperatureC = highest(day.maxBatteryTemperatureC, batteryTemperatureC),
        )
    }

    /** Newest first, capped at [keep] days. */
    fun prune(days: List<DailySummary>, keep: Int = RETAINED_DAYS): List<DailySummary> =
        days.sortedByDescending { it.day }.take(keep.coerceAtLeast(1))

    fun listToJson(days: List<DailySummary>): String =
        JSONArray().apply { prune(days).forEach { put(it.toJson()) } }.toString()

    fun listFromJson(raw: String?): List<DailySummary> {
        if (raw.isNullOrBlank()) return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { index ->
                array.optJSONObject(index)?.let { DailySummary.fromJson(it) }
            }
        }.getOrDefault(emptyList()).let { prune(it) }
    }

    private fun update(
        days: List<DailySummary>,
        day: String,
        transform: (DailySummary) -> DailySummary,
    ): List<DailySummary> {
        val existing = days.firstOrNull { it.day == day } ?: DailySummary(day = day)
        val updated = transform(existing)
        return prune(days.filterNot { it.day == day } + updated)
    }

    private fun lowest(current: Int?, candidate: Int?): Int? = when {
        candidate == null -> current
        current == null -> candidate
        else -> minOf(current, candidate)
    }

    private fun highest(current: Double?, candidate: Double?): Double? = when {
        candidate == null -> current
        current == null -> candidate
        else -> maxOf(current, candidate)
    }
}
