// DEMO_MODE only: drive a cluster's report count up in steps so the dashboard shows it rising.
import { z } from 'zod'
import { buildDeps } from '../../engine/adapters'
import { error, json, requireJournalist, siteOrigin } from '../lib/http'
import { applySettings } from '../lib/settings'
import { simulateSpread } from '../lib/simulate'

const Body = z.object({ cluster_id: z.string().uuid(), target: z.number().int().min(2).max(500).default(100) })

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return error(405, 'Method not allowed')
  const deps = await applySettings(buildDeps())
  if (!deps.config.demoMode) return error(403, 'Simulation is only available when DEMO_MODE=true')
  const journalist = await requireJournalist(req, deps.db)
  if (journalist instanceof Response) return journalist
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, 'Invalid request')
  try {
    const r = await simulateSpread(parsed.data.cluster_id, { target: parsed.data.target, origin: siteOrigin(req), actor: journalist.display_name }, deps)
    return json({ ...r, simulated: r.to - r.from })
  } catch (err) {
    return error(404, (err as Error).message)
  }
}
