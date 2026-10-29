// Stage 8: a journalist publishes a verdict. JWT required.
import { z } from 'zod'
import { buildDeps } from '../../engine/adapters'
import { AI_LABELS } from '../../engine/types'
import { error, json, requireJournalist } from '../lib/http'
import { publishVerdict } from '../lib/publish'
import { applySettings } from '../lib/settings'

const Body = z.object({
  cluster_id: z.string().uuid(),
  label: z.enum(AI_LABELS).refine((l) => l !== 'under_investigation', 'Pick a final label'),
  explanation_en: z.string().trim().min(20, 'Write at least a sentence of explanation').max(1200),
  explanation_lug: z.string().max(1600).nullish(),
  explanation_swa: z.string().max(1600).nullish(),
  source_url: z.string().url('Source must be a full URL').nullish().or(z.literal('')),
})

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return error(405, 'Method not allowed')
  const deps = await applySettings(buildDeps())
  const journalist = await requireJournalist(req, deps.db)
  if (journalist instanceof Response) return journalist
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, parsed.error.issues[0]?.message ?? 'Invalid request')
  try {
    const result = await publishVerdict(parsed.data, journalist, deps)
    return json(result)
  } catch (err) {
    deps.log.error({ stage: 'publish', message: (err as Error).message })
    return error(500, 'Publishing failed. Check the logs and try again.')
  }
}
