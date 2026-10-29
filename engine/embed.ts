// Zero-budget local embedding: hashed word and character-trigram features, 1024 dims, L2 normalised.
// Good enough to cluster near-duplicate forwards of the same claim. Swap for a hosted embedding model
// (EMBEDDING_URL) when one is funded; the vector(1024) column stays the same.

export const EMBED_DIMS = 1024

const STOPWORDS = new Set(
  'a an the is are was were be been of to in on at for and or but that this it its as by with from will has have had not no yes do does'.split(' '),
)

function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

export function embedLocal(text: string, dims = EMBED_DIMS): number[] {
  const v = new Array<number>(dims).fill(0)
  const add = (feature: string, weight: number) => {
    const h = fnv1a(feature)
    // Sign from a second hash bit keeps collisions from only ever adding up.
    v[h % dims] += (h & 0x80000000 ? -1 : 1) * weight
  }
  const words = tokens(text)
  for (const w of words) {
    add(`w:${w}`, 1)
    const padded = `^${w}$`
    for (let i = 0; i + 3 <= padded.length; i++) add(`c:${padded.slice(i, i + 3)}`, 0.35)
  }
  for (let i = 0; i + 1 < words.length; i++) add(`b:${words[i]}_${words[i + 1]}`, 0.6)
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return norm === 0 ? v : v.map((x) => x / norm)
}
