import crypto from 'node:crypto'

const KEY_LENGTH = 64

export function verifyPassword(password, encodedHash) {
  if (!password || !encodedHash) return false
  const [algorithm, saltText, expectedText] = encodedHash.split('$')
  if (algorithm !== 'scrypt' || !saltText || !expectedText) return false

  try {
    const salt = Buffer.from(saltText, 'base64url')
    const expected = Buffer.from(expectedText, 'base64url')
    const actual = crypto.scryptSync(password, salt, KEY_LENGTH)
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
