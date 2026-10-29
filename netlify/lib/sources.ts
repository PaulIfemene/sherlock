// Official-source watch: scrape one source, embed new items, and record health.
import type { ServerDeps } from '../../engine/adapters'
import { scrapeSource, type SourceConfig } from '../../engine/adapters/scraper'

export interface ScrapeOutcome {
  source_id: string
  ok: boolean
  items: number
  error?: string
}

export async function runSource(source: SourceConfig, deps: ServerDeps): Promise<ScrapeOutcome> {
  const db = deps.db
  if (!db) return { source_id: source.id, ok: false, items: 0, error: 'Supabase is not configured' }
  const checkedAt = new Date().toISOString()
  try {
    const items = await scrapeSource(source)
    const rows = await Promise.all(
      items.map(async (i) => ({
        source_id: source.id,
        title: i.title,
        url: i.url,
        published_at: i.published_at,
        content_text: i.content_text,
        embedding: JSON.stringify(await deps.embedder.embed(`${i.title}. ${i.content_text}`)),
      })),
    )
    if (rows.length) {
      const { error } = await db.from('source_items').upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
      if (error) throw new Error(error.message)
    }
    await db.from('sources').update({ last_success_at: checkedAt, last_checked_at: checkedAt, last_error: null }).eq('id', source.id)
    deps.log.info({ stage: 'scraper', source_id: source.id, items: rows.length })
    return { source_id: source.id, ok: true, items: rows.length }
  } catch (err) {
    const message = (err as Error).message.slice(0, 300)
    await db.from('sources').update({ last_checked_at: checkedAt, last_error: message }).eq('id', source.id)
    deps.log.error({ stage: 'scraper', source_id: source.id, message })
    return { source_id: source.id, ok: false, items: 0, error: message }
  }
}
