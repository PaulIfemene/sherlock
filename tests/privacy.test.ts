import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptAddress, encryptAddress, hashSender, redact, signToken, toE164, verifyToken } from '../engine/privacy'

describe('hashSender', () => {
  it('is a keyed HMAC: same input and key match, a different key does not', () => {
    const a = hashSender('secret-one', '+256700000001')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(hashSender('secret-one', '+256700000001')).toBe(a)
    expect(hashSender('secret-two', '+256700000001')).not.toBe(a)
  })

  it('refuses to hash without a secret', () => {
    expect(() => hashSender('', '+256700000001')).toThrow()
  })
})

describe('toE164', () => {
  it('normalises WhatsApp ids and typed numbers', () => {
    expect(toE164('256700000001')).toBe('+256700000001')
    expect(toE164('+256 700-000-001')).toBe('+256700000001')
  })
})

describe('reply address encryption', () => {
  const key = randomBytes(32).toString('base64')

  it('round-trips with AES-256-GCM and a fresh IV each time', () => {
    const a = encryptAddress(key, '+256700000001')
    const b = encryptAddress(key, '+256700000001')
    expect(a.address_ciphertext).not.toContain('256700000001')
    expect(a.iv).not.toBe(b.iv)
    expect(decryptAddress(key, a)).toBe('+256700000001')
  })

  it('rejects tampered ciphertext', () => {
    const enc = encryptAddress(key, '+256700000001')
    const bytes = Buffer.from(enc.address_ciphertext, 'base64')
    bytes[0] ^= 1
    expect(() => decryptAddress(key, { ...enc, address_ciphertext: bytes.toString('base64') })).toThrow()
  })

  it('rejects a key that is not 32 bytes', () => {
    expect(() => encryptAddress(randomBytes(16).toString('base64'), 'x')).toThrow(/32 bytes/)
  })
})

describe('redact', () => {
  it('removes phone numbers, emails and national IDs', () => {
    const out = redact('Call +256 772 123 456 or mail jane.doe@example.com, NIN CM12345678ABCD')
    expect(out).not.toMatch(/772|123 456|jane|CM12345678ABCD/)
    expect(out).toContain('[phone]')
    expect(out).toContain('[email]')
    expect(out).toContain('[id]')
  })

  it('removes self-identifying names in English, Luganda and Kiswahili', () => {
    expect(redact('My name is Sarah Nakato and Monday is a holiday')).toBe('My name is [name] and Monday is a holiday')
    expect(redact('Erinnya lyange nze Musoke, olunaku lwa Mmande')).toContain('[name]')
    expect(redact('Jina langu ni Amina. Kesho ni sikukuu')).not.toContain('Amina')
  })

  it('keeps the claim itself, including short numbers and dates', () => {
    const text = 'The ministry says Monday 14 October is a public holiday, and fares rise by 2000 shillings'
    expect(redact(text)).toBe(text)
  })
})

describe('check tokens', () => {
  it('verifies only the matching id', () => {
    const t = signToken('s', 'claim-1')
    expect(verifyToken('s', 'claim-1', t)).toBe(true)
    expect(verifyToken('s', 'claim-2', t)).toBe(false)
    expect(verifyToken('s', 'claim-1', 'short')).toBe(false)
  })
})
