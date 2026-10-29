// Stage 3: quick check (target under 5 s). Attach to the nearest cluster, count the report, and
// answer straight from the verified library when the cluster already has a published verdict.
import type { ClusterRow, VerdictRow } from './types'
import type { Deps } from './ports'
import { crossedThreshold, isRising } from './cluster'

export interface QuickCheckResult {
  clusterId: string
  isNewCluster: boolean
  similarity: number
  countBefore: number
  countAfter: number
  verdict: VerdictRow | null
  rising: boolean
}

export async function quickCheck(
  claimEn: string,
  embedding: number[],
  isDemo: boolean,
  deps: Pick<Deps, 'store' | 'config' | 'now' | 'onRising' | 'log'>,
): Promise<QuickCheckResult> {
  const now = deps.now()
  const match = await deps.store.matchCluster(embedding, deps.config.clusterSimilarity)
  let cluster: Pick<ClusterRow, 'id' | 'status'>
  if (match) {
    cluster = match.cluster
  } else {
    cluster = await deps.store.createCluster(claimEn, embedding, isDemo)
  }
  const { before, after } = await deps.store.bumpCluster(cluster.id, 1, now)
  const verdict = cluster.status === 'published' || match ? await deps.store.getVerdict(cluster.id) : null
  const v = await deps.store.clusterVelocity(cluster.id, now)
  const velocity = { ...v, delta: v.lastHour - v.prevHour }
  const rising = isRising(after, velocity, deps.config.risingThreshold)
  if (rising && crossedThreshold(before, after, deps.config.risingThreshold) && deps.onRising) {
    try {
      await deps.onRising(cluster.id, after)
    } catch (err) {
      deps.log.error({ stage: 'newsroom', event: 'alert_failed', message: (err as Error).message })
    }
  }
  return {
    clusterId: cluster.id,
    isNewCluster: !match,
    similarity: match?.similarity ?? 1,
    countBefore: before,
    countAfter: after,
    verdict,
    rising,
  }
}
