// "Check now" from the Sources page. Journalists only.
import { z } from 'zod'
import { buildDeps } from '../../engine/adapters'
import { error, json, requireJournalist } from '../lib/http'
import { runSource } from '../lib/sources'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return error(405, 'Method not allowed')
  const deps = buildDeps()
  const journalist = await requireJournalist(req, deps.db)
  if (journalist instanceof Response) return journalist
  const parsed = z.object({ source_id: z.string().uuid() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return error(400, 'Invalid request')
  const { data: source } = await deps.db!.from('sources').select('id,name,url,kind,selector').eq('id', parsed.data.source_id).single()
  if (!source) return error(404, 'Source not found')
  return json(await runSource(source, deps))
}
