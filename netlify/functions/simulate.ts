// DEMO_MODE only: drive a cluster's report count up in steps so the dashboard shows it rising.
// Every simulated report is counted in clusters.simulated_reports and shown as "simulated".
import { z } from 'zod'
import { buildDeps } from '../../engine/adapters'
import { crossedThreshold } from '../../engine/cluster'
import { error, json, requireJournalist, siteOrigin } from '../lib/http'
import { sendRisingAlert } from '../lib/alerts'

const Body = z.object({ cluster_id: z.string().uuid(), target: z.number().int().min(2).max(500).default(100) })

const STEPS = 12
const STEP_DELAY_MS = 550

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return error(405, 'Method not allowed')
  const deps = buildDeps()
  if (!deps.config.demoMode) return error(403, 'Simulation is only available when DEMO_MODE=true')
  const journalist = await requireJournalist(req, deps.db)
  if (journalist instanceof Response) return journalist
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, 'Invalid request')
  const { cluster_id, target } = parsed.data

  const { data: cluster } = await deps.db!.from('clusters').select('report_count').eq('id', cluster_id).single()
  if (!cluster) return error(404, 'Cluster not found')
  const start = cluster.report_count as number
  if (start >= target) return json({ from: start, to: start, simulated: 0 })

  const { data: threshold } = await deps.db!.from('settings').select('value').eq('key', 'rising_threshold').maybeSingle()
  const risingAt = Number(threshold?.value ?? deps.config.risingThreshold)

  // Ease-in curve so the climb accelerates, like a forward going viral.
  let current = start
  let alerted = false
  for (let i = 1; i <= STEPS; i++) {
    const next = Math.round(start + (target - start) * (i / STEPS) ** 1.6)
    const by = next - current
    if (by > 0) {
      const { before, after } = await deps.store.bumpCluster(cluster_id, by, deps.now(), true)
      current = after
      if (!alerted && crossedThreshold(before, after, risingAt)) {
        alerted = true
        await sendRisingAlert(deps, cluster_id, after, siteOrigin(req))
      }
    }
    if (i < STEPS) await new Promise((r) => setTimeout(r, STEP_DELAY_MS))
  }
  await deps.store.addEvent({ cluster_id, kind: 'simulated', detail: `Simulated spread (demo): ${start} to ${current} reports.`, actor: journalist.display_name })
  return json({ from: start, to: current, simulated: current - start })
}
