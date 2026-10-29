import { describe, expect, it } from 'vitest'
import { bucketOf, cosine, crossedThreshold, cumulative, isRising, nearest, series, velocity } from '../engine/cluster'
import { embedLocal } from '../engine/embed'
import { hamming, phashFromGrey } from '../engine/phash'

const now = new Date('2026-10-29T12:00:00Z')
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000)

describe('cosine and nearest', () => {
  it('scores identical vectors 1 and orthogonal 0', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1)
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
    expect(cosine([], [])).toBe(0)
  })

  it('returns the best candidate above the threshold only', () => {
    const items = [
      { id: 'a', embedding: [1, 0] },
      { id: 'b', embedding: [0.9, 0.1] },
    ]
    expect(nearest([0.95, 0.05], items, 0.5)?.item.id).toBe('a')
    expect(nearest([0, 1], items, 0.5)).toBeNull()
  })
})

describe('local embedder', () => {
  it('puts forwards of the same claim close together and different claims apart', () => {
    const a = embedLocal('Monday is an official public holiday, according to a ministry notice.')
    const b = embedLocal('Monday is an official public holiday according to the ministry notice!!')
    const c = embedLocal('Bus fares across the city are free from Friday.')
    expect(a).toHaveLength(1024)
    expect(cosine(a, b)).toBeGreaterThan(0.86)
    expect(cosine(a, c)).toBeLessThan(0.3)
  })
})

describe('velocity and rising', () => {
  const points = [
    { bucket: bucketOf(minsAgo(5)), count: 30 },
    { bucket: bucketOf(minsAgo(50)), count: 5 },
    { bucket: bucketOf(minsAgo(90)), count: 4 },
    { bucket: bucketOf(minsAgo(200)), count: 99 },
  ]

  it('sums the last hour and the previous hour', () => {
    expect(velocity(points, now)).toEqual({ lastHour: 35, prevHour: 4, delta: 31 })
  })

  it('is rising only at or above the threshold and when the last hour beats the previous', () => {
    expect(isRising(25, { lastHour: 35, prevHour: 4, delta: 31 }, 20)).toBe(true)
    expect(isRising(19, { lastHour: 35, prevHour: 4, delta: 31 }, 20)).toBe(false)
    expect(isRising(50, { lastHour: 4, prevHour: 35, delta: -31 }, 20)).toBe(false)
  })

  it('detects the threshold crossing once', () => {
    expect(crossedThreshold(19, 20, 20)).toBe(true)
    expect(crossedThreshold(20, 25, 20)).toBe(false)
  })

  it('builds fixed-length sparkline series', () => {
    const s = series(points, now, 24)
    expect(s).toHaveLength(24)
    expect(s.reduce((a, b) => a + b, 0)).toBe(39)
    expect(cumulative([1, 2, 3])).toEqual([1, 3, 6])
  })
})

describe('pHash', () => {
  // A textured scene, a lightly recompressed copy, and an unrelated picture.
  const scene = Array.from({ length: 1024 }, (_, i) => {
    const x = i % 32
    const y = Math.floor(i / 32)
    return 128 + 60 * Math.sin(x / 4) + 50 * Math.cos(y / 6) + (x > 16 && y < 12 ? 40 : 0)
  })
  const noisy = scene.map((v, i) => v + ((i * 37) % 11) - 5)
  const other = Array.from({ length: 1024 }, (_, i) => 128 + 90 * Math.sin((i % 32) / 2 + Math.floor(i / 32) / 3))

  it('hashes to 16 hex characters and survives small noise', () => {
    const a = phashFromGrey(scene)
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(hamming(a, phashFromGrey(noisy))).toBeLessThanOrEqual(10)
    expect(hamming(a, phashFromGrey(other))).toBeGreaterThan(10)
  })
})

describe('searchQuery', () => {
  it('adds Uganda only when the claim names no East African place', async () => {
    const { searchQuery } = await import('../engine/evidence')
    expect(searchQuery('Monday is a public holiday')).toBe('Monday is a public holiday Uganda')
    expect(searchQuery('Kampala schools close on Friday')).toBe('Kampala schools close on Friday')
    expect(searchQuery('Kenya raises fuel prices')).toBe('Kenya raises fuel prices')
  })
})
