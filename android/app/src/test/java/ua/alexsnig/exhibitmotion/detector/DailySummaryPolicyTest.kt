package ua.alexsnig.exhibitmotion.detector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class DailySummaryPolicyTest {
    private val kyiv: ZoneId = ZoneId.of("Europe/Kyiv")

    private fun at(year: Int, month: Int, day: Int, hour: Int, minute: Int = 0): Long =
        ZonedDateTime.of(year, month, day, hour, minute, 0, 0, kyiv).toInstant().toEpochMilli()

    @Test
    fun `first trigger of a day creates that day`() {
        val days = DailySummaryPolicy.recordTrigger(emptyList(), at(2026, 8, 19, 10), zone = kyiv)

        assertEquals(1, days.size)
        assertEquals("2026-08-19", days[0].day)
        assertEquals(1, days[0].triggers)
        assertEquals(at(2026, 8, 19, 10), days[0].firstTriggerAtMs)
        assertEquals(at(2026, 8, 19, 10), days[0].lastTriggerAtMs)
    }

    @Test
    fun `later triggers move only the last timestamp`() {
        var days = DailySummaryPolicy.recordTrigger(emptyList(), at(2026, 8, 19, 10), zone = kyiv)
        days = DailySummaryPolicy.recordTrigger(days, at(2026, 8, 19, 17, 42), zone = kyiv)

        assertEquals(1, days.size)
        assertEquals(2, days[0].triggers)
        assertEquals(at(2026, 8, 19, 10), days[0].firstTriggerAtMs)
        assertEquals(at(2026, 8, 19, 17, 42), days[0].lastTriggerAtMs)
    }

    @Test
    fun `a trigger after local midnight starts a new day`() {
        var days = DailySummaryPolicy.recordTrigger(emptyList(), at(2026, 8, 19, 23, 59), zone = kyiv)
        days = DailySummaryPolicy.recordTrigger(days, at(2026, 8, 20, 0, 1), zone = kyiv)

        assertEquals(2, days.size)
        assertEquals("2026-08-20", days[0].day)
        assertEquals("2026-08-19", days[1].day)
        assertTrue(days.all { it.triggers == 1 })
    }

    @Test
    fun `the day boundary follows the exhibit timezone, not UTC`() {
        // 22:30 in Kyiv is still 19:30 UTC on the same date, but 00:30 Kyiv the
        // next day is 21:30 UTC on the previous one. The hall's calendar wins.
        val lateEvening = at(2026, 8, 19, 22, 30)
        val afterMidnight = at(2026, 8, 20, 0, 30)

        assertEquals("2026-08-19", DailySummaryPolicy.dayKey(lateEvening, kyiv))
        assertEquals("2026-08-20", DailySummaryPolicy.dayKey(afterMidnight, kyiv))
    }

    @Test
    fun `camera restarts, route losses and service starts fold into the same day`() {
        var days = DailySummaryPolicy.recordTrigger(emptyList(), at(2026, 8, 19, 9), zone = kyiv)
        days = DailySummaryPolicy.recordCameraRestart(days, at(2026, 8, 19, 11), zone = kyiv)
        days = DailySummaryPolicy.recordRouteLoss(days, at(2026, 8, 19, 12), zone = kyiv)
        days = DailySummaryPolicy.recordServiceStart(days, at(2026, 8, 19, 13), zone = kyiv)

        assertEquals(1, days.size)
        assertEquals(1, days[0].triggers)
        assertEquals(1, days[0].cameraRestarts)
        assertEquals(1, days[0].routeLosses)
        assertEquals(1, days[0].serviceStarts)
    }

    @Test
    fun `battery keeps the lowest charge and the highest temperature`() {
        var days = DailySummaryPolicy.recordTrigger(
            emptyList(), at(2026, 8, 19, 9), batteryPercent = 100, batteryTemperatureC = 29.5, zone = kyiv,
        )
        days = DailySummaryPolicy.recordTrigger(
            days, at(2026, 8, 19, 12), batteryPercent = 84, batteryTemperatureC = 34.2, zone = kyiv,
        )
        days = DailySummaryPolicy.recordTrigger(
            days, at(2026, 8, 19, 15), batteryPercent = 91, batteryTemperatureC = 31.0, zone = kyiv,
        )

        assertEquals(84, days[0].minBatteryPercent)
        assertEquals(34.2, days[0].maxBatteryTemperatureC!!, 0.001)
    }

    @Test
    fun `a missing battery sample never overwrites a recorded one`() {
        var days = DailySummaryPolicy.recordTrigger(
            emptyList(), at(2026, 8, 19, 9), batteryPercent = 77, batteryTemperatureC = 30.0, zone = kyiv,
        )
        days = DailySummaryPolicy.recordTrigger(days, at(2026, 8, 19, 10), zone = kyiv)

        assertEquals(77, days[0].minBatteryPercent)
        assertEquals(30.0, days[0].maxBatteryTemperatureC!!, 0.001)
    }

    @Test
    fun `retention keeps the newest days and drops the oldest`() {
        var days = emptyList<DailySummary>()
        repeat(DailySummaryPolicy.RETAINED_DAYS + 10) { index ->
            days = DailySummaryPolicy.recordTrigger(days, at(2026, 1, 1, 12) + index * 86_400_000L, zone = kyiv)
        }

        assertEquals(DailySummaryPolicy.RETAINED_DAYS, days.size)
        assertEquals(days.map { it.day }.sortedDescending(), days.map { it.day })
        assertTrue(days.first().day > days.last().day)
    }

    @Test
    fun `a round trip through JSON preserves every field`() {
        var days = DailySummaryPolicy.recordTrigger(
            emptyList(), at(2026, 8, 19, 9), batteryPercent = 88, batteryTemperatureC = 33.5, zone = kyiv,
        )
        days = DailySummaryPolicy.recordCameraRestart(days, at(2026, 8, 19, 10), zone = kyiv)
        days = DailySummaryPolicy.recordRouteLoss(days, at(2026, 8, 19, 11), zone = kyiv)

        val restored = DailySummaryPolicy.listFromJson(DailySummaryPolicy.listToJson(days))

        assertEquals(days, restored)
    }

    @Test
    fun `unreadable stored summaries degrade to empty instead of crashing`() {
        assertEquals(emptyList<DailySummary>(), DailySummaryPolicy.listFromJson("not json at all"))
        assertEquals(emptyList<DailySummary>(), DailySummaryPolicy.listFromJson(""))
        assertEquals(emptyList<DailySummary>(), DailySummaryPolicy.listFromJson(null))
    }

    @Test
    fun `an entry without a day is skipped rather than stored blank`() {
        val restored = DailySummaryPolicy.listFromJson("""[{"triggers":5},{"day":"2026-08-19","triggers":2}]""")

        assertEquals(1, restored.size)
        assertEquals("2026-08-19", restored[0].day)
        assertEquals(2, restored[0].triggers)
    }

    @Test
    fun `a day with no battery sample reports no battery`() {
        val days = DailySummaryPolicy.recordTrigger(emptyList(), at(2026, 8, 19, 9), zone = kyiv)

        assertNull(days[0].minBatteryPercent)
        assertNull(days[0].maxBatteryTemperatureC)
    }
}
