// DEMO_MODE "Simulate spread": raise a cluster's count in steps so the dashboard shows it rising.
// Every simulated report is counted in clusters.simulated_reports and labelled in the UI.
import type { ServerDeps } from '../../engine/adapters'
import { crossedThreshold } from '../../engine/cluster'
import { sendRisingAlert } from './alerts'

export interface SimulateOptions {
  target: number
  steps?: number
  stepDelayMs?: number
  origin: string
  actor: string
}

export async function simulateSpread(clusterId: string, opts: SimulateOptions, deps: ServerDeps): Promise<{ from: number; to: number }> {
  const { store, config } = deps
  const steps = opts.steps ?? 12
  const delay = opts.stepDelayMs ?? 550
  const cluster = await store.getCluster(clusterId)
  if (!cluster) throw new Error('cluster not found')
  const start = cluster.report_count
  if (start >= opts.target) return { from: start, to: start }

  // Ease-in curve so the climb accelerates, like a forward going viral.
  let current = start
  let alerted = false
  for (let i = 1; i <= steps; i++) {
    const next = Math.round(start + (opts.target - start) * (i / steps) ** 1.6)
    const by = next - current
    if (by > 0) {
      const { before, after } = await store.bumpCluster(clusterId, by, deps.now(), true)
      current = after
      if (!alerted && crossedThreshold(before, after, config.risingThreshold)) {
        alerted = true
        await sendRisingAlert(deps, clusterId, after, opts.origin)
      }
    }
    if (i < steps && delay > 0) await new Promise((r) => setTimeout(r, delay))
  }
  await store.addEvent({ cluster_id: clusterId, kind: 'simulated', detail: `Simulated spread (demo): ${start} to ${current} reports.`, actor: opts.actor })
  return { from: start, to: current }
}
