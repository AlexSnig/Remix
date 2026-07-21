package ua.alexsnig.exhibitmotion.detector

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RoomDatabase

@Entity(tableName = "motion_events")
data class MotionEventEntity(
    @androidx.room.PrimaryKey val id: String,
    val timestampMs: Long,
    val motionPercent: Double,
    val threshold: Double,
)

@Dao
interface MotionEventDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(event: MotionEventEntity)

    @Query("DELETE FROM motion_events WHERE id NOT IN (SELECT id FROM motion_events ORDER BY timestampMs DESC LIMIT :keep)")
    suspend fun pruneTo(keep: Int)

    @Query("SELECT COUNT(*) FROM motion_events")
    suspend fun count(): Int

    @Query("SELECT * FROM motion_events ORDER BY timestampMs DESC LIMIT :limit")
    suspend fun recent(limit: Int): List<MotionEventEntity>

    @Query("DELETE FROM motion_events")
    suspend fun clear()

    @Query("DELETE FROM motion_events WHERE id = :id")
    suspend fun delete(id: String)
}

@Database(entities = [MotionEventEntity::class], version = 1, exportSchema = true)
abstract class MotionEventDatabase : RoomDatabase() {
    abstract fun motionEventDao(): MotionEventDao
}
