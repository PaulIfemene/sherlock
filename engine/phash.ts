// Perceptual hash (DCT pHash) over a 32x32 greyscale image. Pure: decoding lives in adapters/phash.ts.

const N = 32
const K = 8

function dct1d(input: number[]): number[] {
  const out = new Array<number>(N).fill(0)
  for (let k = 0; k < N; k++) {
    let sum = 0
    for (let n = 0; n < N; n++) sum += input[n] * Math.cos((Math.PI / N) * (n + 0.5) * k)
    out[k] = sum
  }
  return out
}

/** 64-bit pHash as 16 hex characters. `grey` must hold 32*32 luminance values. */
export function phashFromGrey(grey: ArrayLike<number>): string {
  if (grey.length !== N * N) throw new Error(`expected ${N * N} pixels`)
  const rows: number[][] = []
  for (let y = 0; y < N; y++) rows.push(dct1d(Array.from({ length: N }, (_, x) => grey[y * N + x])))
  const coeffs: number[] = []
  for (let x = 0; x < K; x++) {
    const col = dct1d(rows.map((r) => r[x]))
    for (let y = 0; y < K; y++) coeffs[y * K + x] = col[y]
  }
  // Skip the DC term when taking the median, as in the standard pHash.
  const median = [...coeffs.slice(1)].sort((a, b) => a - b)[Math.floor((coeffs.length - 1) / 2)]
  let hex = ''
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0
    for (let b = 0; b < 4; b++) nibble = (nibble << 1) | (coeffs[i + b] > median ? 1 : 0)
    hex += nibble.toString(16)
  }
  return hex
}

export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64
  let d = 0
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      d += x & 1
      x >>= 1
    }
  }
  return d
}

/** Distance at or below this is treated as the same picture (crops and recompression survive). */
export const PHASH_MATCH_DISTANCE = 10
