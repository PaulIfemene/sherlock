// Privacy: delete raw claim images within 24 hours. OCR text and the pHash stay.
import { buildDeps } from '../../engine/adapters'

const MAX_AGE_MS = 23 * 60 * 60 * 1000

export default async (): Promise<Response> => {
  const deps = buildDeps()
  if (!deps.db) return new Response('Supabase not configured', { status: 200 })
  const cutoff = new Date(Date.now() - MAX_AGE_MS).toISOString()
  const { data: claims } = await deps.db.from('claims').select('id,image_path').not('image_path', 'is', null).lt('received_at', cutoff).limit(500)
  const paths = (claims ?? []).map((c) => c.image_path as string)
  if (paths.length) {
    const { error } = await deps.db.storage.from('claim-media').remove(paths)
    if (error) {
      deps.log.error({ stage: 'purge', message: error.message })
      return new Response('Purge failed', { status: 500 })
    }
    await deps.db.from('claims').update({ image_path: null }).in('id', (claims ?? []).map((c) => c.id as string))
  }
  deps.log.info({ stage: 'purge', removed: paths.length })
  return new Response(JSON.stringify({ removed: paths.length }), { status: 200 })
}

export const config = { schedule: '@hourly' }
