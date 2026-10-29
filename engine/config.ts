// Typed engine configuration read from the environment.

export interface EngineConfig {
  demoMode: boolean
  risingThreshold: number
  confidenceThreshold: number
  clusterSimilarity: number
  phoneHashSecret: string
  replyAddressKey: string
  evidenceTimeoutMs: number
}

type Env = Record<string, string | undefined>

function num(value: string | undefined, fallback: number): number {
  const n = value === undefined || value === '' ? NaN : Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function readConfig(env: Env): EngineConfig {
  return {
    demoMode: (env.DEMO_MODE ?? 'true').toLowerCase() === 'true',
    risingThreshold: num(env.RISING_THRESHOLD, 20),
    confidenceThreshold: num(env.CONFIDENCE_THRESHOLD, 0.75),
    clusterSimilarity: num(env.CLUSTER_SIMILARITY, 0.86),
    phoneHashSecret: env.PHONE_HASH_SECRET ?? '',
    replyAddressKey: env.REPLY_ADDRESS_KEY ?? '',
    evidenceTimeoutMs: num(env.EVIDENCE_TIMEOUT_MS, 6000),
  }
}

/** True when a value is present and non-empty. */
export function has(env: Env, ...keys: string[]): boolean {
  return keys.every((k) => (env[k] ?? '').trim() !== '')
}
