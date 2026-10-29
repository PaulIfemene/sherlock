// Privacy primitives: keyed sender hashing, reply-address encryption, and text redaction.
// Uganda Data Protection and Privacy Act 2019: phone numbers never leave this module in plain form
// except to the WhatsApp send call.
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { EncryptedAddress } from './types'

/** Normalise a WhatsApp wa_id or user-typed number to E.164 (`+256700000000`). */
export function toE164(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.length < 8) throw new Error('not a phone number')
  return `+${digits}`
}

/** sender_hash = HMAC-SHA256(PHONE_HASH_SECRET, e164). Never a plain hash. */
export function hashSender(secret: string, address: string): string {
  if (!secret) throw new Error('PHONE_HASH_SECRET is not set')
  return createHmac('sha256', secret).update(address).digest('hex')
}

/** Short HMAC token used to let a web client read back its own check result. */
export function signToken(secret: string, value: string): string {
  return createHmac('sha256', secret).update(`token:${value}`).digest('base64url').slice(0, 24)
}

export function verifyToken(secret: string, value: string, token: string): boolean {
  const expected = Buffer.from(signToken(secret, value))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

function keyFrom(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64')
  if (key.length !== 32) throw new Error('REPLY_ADDRESS_KEY must be 32 bytes, base64')
  return key
}

/** AES-256-GCM encrypt a reply address. */
export function encryptAddress(keyB64: string, plaintext: string): EncryptedAddress {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFrom(keyB64), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    address_ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  }
}

export function decryptAddress(keyB64: string, enc: EncryptedAddress): string {
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(keyB64), Buffer.from(enc.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(enc.address_ciphertext, 'base64')), decipher.final()]).toString('utf8')
}

// Redaction --------------------------------------------------------------------------------------

const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// Uganda National ID Number: two letters (CM/CF) followed by 12 letters or digits.
const NIN = /\bC[MF][A-Z0-9]{12}\b/gi
// Self-identifying phrases in English, Luganda and Kiswahili, followed by up to three capitalised words.
// No `i` flag: the name part must stay capitalised, so the cues spell out both cases.
const NAME_CUES =
  /\b([Mm]y name is|I am called|[Ee]rinnya lyange(?: nze)?|[Nn]ze|[Jj]ina langu ni|[Nn]aitwa|[Mm]imi ni)\s+((?:\p{Lu}[\p{L}'-]+\s?){1,3})/gu

/**
 * Strip phone numbers, emails, national IDs and self-identifying names before text leaves for
 * any external AI or search API. Keeps the claim readable.
 */
export function redact(text: string): string {
  return text
    .replace(EMAIL, '[email]')
    .replace(NIN, '[id]')
    .replace(PHONE, (match) => (match.replace(/\D/g, '').length >= 9 ? '[phone]' : match))
    .replace(NAME_CUES, (_m, cue: string) => `${cue} [name] `)
    .replace(/\s{2,}/g, ' ')
    .trim()
}
