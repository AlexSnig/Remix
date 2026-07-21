package ua.alexsnig.exhibitmotion.detector

import java.security.MessageDigest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OperatorPinSecurityTest {
    @Test
    fun saltedHashesVerifyOnlyTheCorrectPin() {
        val first = OperatorPinSecurity.hash("4826")
        val second = OperatorPinSecurity.hash("4826")
        assertNotEquals(first, second)
        assertTrue(OperatorPinSecurity.verify(first, "4826"))
        assertFalse(OperatorPinSecurity.verify(first, "4827"))
    }

    @Test
    fun legacySha256PinsRemainReadable() {
        val legacy = MessageDigest.getInstance("SHA-256")
            .digest("4826".toByteArray())
            .joinToString("") { "%02x".format(it) }
        assertTrue(OperatorPinSecurity.verify(legacy, "4826"))
        assertFalse(OperatorPinSecurity.verify(legacy, "0000"))
    }
}
