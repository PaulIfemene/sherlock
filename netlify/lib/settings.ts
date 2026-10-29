// Newsroom settings stored in the database override the env defaults at run time.
import type { ServerDeps } from '../../engine/adapters'

export async function applySettings(deps: ServerDeps): Promise<ServerDeps> {
  if (!deps.db) return deps
  const { data } = await deps.db.from('settings').select('key,value').eq('key', 'rising_threshold').maybeSingle()
  const threshold = Number(data?.value)
  if (Number.isFinite(threshold) && threshold > 0) deps.config.risingThreshold = threshold
  return deps
}
