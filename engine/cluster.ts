// Clustering and velocity: similarity, 5-minute buckets, rising detection.

export const BUCKET_MS = 5 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

export function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb)
}

export interface Candidate {
  id: string
  embedding: readonly number[]
}

/** Nearest candidate at or above the threshold, or null. */
export function nearest<T extends Candidate>(embedding: readonly number[], candidates: T[], threshold: number) {
  let best: { item: T; similarity: number } | null = null
  for (const item of candidates) {
    const similarity = cosine(embedding, item.embedding)
    if (similarity >= threshold && (!best || similarity > best.similarity)) best = { item, similarity }
  }
  return best
}

/** Floor a time to its 5-minute bucket. */
export function bucketOf(at: Date): Date {
  return new Date(Math.floor(at.getTime() / BUCKET_MS) * BUCKET_MS)
}

export interface CountPoint {
  bucket: string | Date
  count: number
}

export interface Velocity {
  lastHour: number
  prevHour: number
  delta: number
}

export function velocity(points: CountPoint[], now: Date): Velocity {
  const t = now.getTime()
  let lastHour = 0
  let prevHour = 0
  for (const p of points) {
    const age = t - new Date(p.bucket).getTime()
    if (age < 0) continue
    if (age < HOUR_MS) lastHour += p.count
    else if (age < 2 * HOUR_MS) prevHour += p.count
  }
  return { lastHour, prevHour, delta: lastHour - prevHour }
}

/** Rising: report_count at or above the threshold and the last hour beats the previous hour. */
export function isRising(reportCount: number, v: Velocity, threshold: number): boolean {
  return reportCount >= threshold && v.lastHour > v.prevHour
}

export function crossedThreshold(before: number, after: number, threshold: number): boolean {
  return before < threshold && after >= threshold
}

/** Fixed-length series of bucket counts for sparklines, oldest first. */
export function series(points: CountPoint[], now: Date, buckets = 24): number[] {
  const end = bucketOf(now).getTime()
  const out = new Array<number>(buckets).fill(0)
  for (const p of points) {
    const idx = buckets - 1 - Math.round((end - new Date(p.bucket).getTime()) / BUCKET_MS)
    if (idx >= 0 && idx < buckets) out[idx] += p.count
  }
  return out
}

/** Running total series, so a sparkline shows the cluster climbing. */
export function cumulative(values: number[], start = 0): number[] {
  let acc = start
  return values.map((v) => (acc += v))
}
