package ua.alexsnig.exhibitmotion.detector

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/** PBKDF2 protects the local operator PIN at rest. A legacy unsalted SHA-256
 * value remains readable only to avoid locking out an already commissioned
 * installation; the next PIN change upgrades it automatically. */
object OperatorPinSecurity {
    private const val ALGORITHM = "PBKDF2WithHmacSHA256"
    private const val ITERATIONS = 120_000
    private const val KEY_LENGTH_BITS = 256
    private const val PREFIX = "pbkdf2-sha256"

    fun hash(pin: String): String {
        val salt = ByteArray(16).also(SecureRandom()::nextBytes)
        val derived = derive(pin, salt, ITERATIONS)
        return listOf(
            PREFIX,
            ITERATIONS.toString(),
            Base64.getEncoder().encodeToString(salt),
            Base64.getEncoder().encodeToString(derived),
        ).joinToString("$")
    }

    fun verify(stored: String, candidate: String): Boolean = runCatching {
        val parts = stored.split('$')
        if (parts.size == 4 && parts[0] == PREFIX) {
            val iterations = parts[1].toInt()
            val salt = Base64.getDecoder().decode(parts[2])
            val expected = Base64.getDecoder().decode(parts[3])
            MessageDigest.isEqual(expected, derive(candidate, salt, iterations))
        } else {
            // Pre-kiosk builds stored a plain SHA-256 hex digest.
            MessageDigest.isEqual(stored.toByteArray(), legacySha256(candidate).toByteArray())
        }
    }.getOrDefault(false)

    private fun derive(pin: String, salt: ByteArray, iterations: Int): ByteArray {
        val spec = PBEKeySpec(pin.toCharArray(), salt, iterations, KEY_LENGTH_BITS)
        return try {
            SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    private fun legacySha256(pin: String): String = MessageDigest.getInstance("SHA-256")
        .digest(pin.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
