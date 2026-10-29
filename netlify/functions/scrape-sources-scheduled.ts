// Hourly watch of enabled official sources that are due for a check.
import { buildDeps } from '../../engine/adapters'
import { runSource } from '../lib/sources'

export default async (): Promise<Response> => {
  const deps = buildDeps()
  if (!deps.db) return new Response('Supabase not configured', { status: 200 })
  const { data: sources } = await deps.db.from('sources').select('id,name,url,kind,selector,interval_minutes,last_checked_at').eq('enabled', true)
  const now = Date.now()
  const due = (sources ?? []).filter((s) => !s.last_checked_at || now - new Date(s.last_checked_at).getTime() >= (s.interval_minutes ?? 60) * 60_000 - 60_000)
  const results = []
  for (const s of due) results.push(await runSource(s, deps))
  return new Response(JSON.stringify({ checked: results.length, results }), { status: 200 })
}

export const config = { schedule: '@hourly' }
