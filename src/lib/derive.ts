// Dashboard metrics derived from rows: velocity, rising, sparkline series and KPIs.
import { cumulative, isRising, series, velocity } from '../../engine/cluster'
import { median } from './format'
import type { Claim, Cluster, CountPoint, Verdict } from './types'

export interface ClusterStats {
  cluster: Cluster
  lastHour: number
  prevHour: number
  delta: number
  rising: boolean
  spark: number[]
  language: string | null
  verdict: Verdict | null
}

export function clusterStats(clusters: Cluster[], counts: CountPoint[], claims: Claim[], verdicts: Verdict[], threshold: number, now = new Date()): ClusterStats[] {
  const byCluster = new Map<string, CountPoint[]>()
  for (const p of counts) {
    const list = byCluster.get(p.cluster_id) ?? []
    list.push(p)
    byCluster.set(p.cluster_id, list)
  }
  const firstLang = new Map<string, string>()
  for (const c of [...claims].sort((a, b) => a.received_at.localeCompare(b.received_at))) {
    if (c.cluster_id && c.original_language && !firstLang.has(c.cluster_id)) firstLang.set(c.cluster_id, c.original_language)
  }
  const verdictBy = new Map(verdicts.map((v) => [v.cluster_id, v]))
  return clusters.map((cluster) => {
    const points = byCluster.get(cluster.id) ?? []
    const v = velocity(points, now)
    const buckets = series(points, now, 24)
    const before = Math.max(0, cluster.report_count - buckets.reduce((a, b) => a + b, 0))
    return {
      cluster,
      ...v,
      rising: cluster.status === 'open' && isRising(cluster.report_count, v, threshold),
      spark: cumulative(buckets, before),
      language: firstLang.get(cluster.id) ?? null,
      verdict: verdictBy.get(cluster.id) ?? null,
    }
  })
}

/** Rising board order: rising first, then by last-hour velocity, then by total. */
export function rankByVelocity(stats: ClusterStats[]): ClusterStats[] {
  return [...stats].sort((a, b) => Number(b.rising) - Number(a.rising) || b.delta - a.delta || b.lastHour - a.lastHour || b.cluster.report_count - a.cluster.report_count)
}

export interface Kpis {
  reportsThisWeek: number
  risingNow: number
  openCases: number
  published: number
  medianToVerdictMs: number | null
}

export function kpis(stats: ClusterStats[], counts: CountPoint[], verdicts: Verdict[], now = Date.now()): Kpis {
  const weekAgo = now - 7 * 24 * 3600_000
  const clusterById = new Map(stats.map((s) => [s.cluster.id, s.cluster]))
  const times = verdicts
    .map((v) => {
      const c = clusterById.get(v.cluster_id)
      return c ? new Date(v.published_at).getTime() - new Date(c.first_seen).getTime() : NaN
    })
    .filter((t) => Number.isFinite(t) && t >= 0)
  return {
    reportsThisWeek: counts.filter((p) => new Date(p.bucket).getTime() >= weekAgo).reduce((a, p) => a + p.count, 0),
    risingNow: stats.filter((s) => s.rising).length,
    openCases: stats.filter((s) => s.cluster.status === 'open').length,
    published: verdicts.length,
    medianToVerdictMs: median(times),
  }
}
