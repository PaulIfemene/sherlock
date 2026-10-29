// Verdict editor preview: translate an English explanation to Luganda or Kiswahili. Journalists only.
import { z } from 'zod'
import { buildDeps } from '../../engine/adapters'
import { error, json, requireJournalist } from '../lib/http'

const Body = z.object({ text: z.string().trim().min(1).max(1600), to: z.enum(['lug', 'swa']) })

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return error(405, 'Method not allowed')
  const deps = buildDeps()
  const journalist = await requireJournalist(req, deps.db)
  if (journalist instanceof Response) return journalist
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, 'Invalid request')
  if (!deps.translator.live) return json({ text: null, live: false, note: 'Sunbird is not configured; translation preview unavailable (demo).' })
  try {
    return json({ text: await deps.translator.translate(parsed.data.text, 'eng', parsed.data.to), live: true })
  } catch (err) {
    deps.log.error({ stage: 'translate', message: (err as Error).message })
    return error(502, 'Sunbird translation failed. Try again, or write the translation by hand.')
  }
}
