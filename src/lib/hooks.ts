import { useEffect, useMemo, useState } from 'react'
import { useNewsroom } from './newsroom'
import { clusterStats, rankByVelocity } from './derive'

/** Re-render on an interval so relative times ("4 min ago") stay current. */
export function useNow(ms = 30000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** Cluster stats ranked by velocity, recomputed as Realtime rows arrive. */
export function useClusterStats() {
  const { clusters, counts, claims, verdicts, threshold } = useNewsroom()
  const now = useNow(60000)
  return useMemo(() => rankByVelocity(clusterStats(clusters, counts, claims, verdicts, threshold, new Date(now))), [clusters, counts, claims, verdicts, threshold, now])
}

/** Demo controls show when the server says DEMO_MODE=true, or when running on offline demo data. */
export function useDemoMode(): boolean {
  const { offline, status } = useNewsroom()
  return offline || Boolean(status?.demo_mode)
}
