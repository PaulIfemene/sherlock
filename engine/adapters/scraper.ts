// Official-source watch: RSS feeds via rss-parser, HTML pages via cheerio and a CSS selector.
// Respects robots.txt for our user agent and the `*` group.
import Parser from 'rss-parser'
import * as cheerio from 'cheerio'
import { fetchWithTimeout } from './http'

export const USER_AGENT = 'SherlockBot/0.1 (+misinformation checker for Uganda; contact via site)'

export interface SourceConfig {
  id: string
  name: string
  url: string
  kind: 'rss' | 'page'
  selector: string | null
}

export interface ScrapedItem {
  title: string
  url: string
  published_at: string | null
  content_text: string
}

/** Minimal robots.txt check: longest matching Allow/Disallow rule wins. */
export function robotsAllows(robotsTxt: string, path: string, agent = 'sherlockbot'): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = []
  let current: (typeof groups)[number] | null = null
  let lastWasAgent = false
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim()
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
    } else if ((key === 'allow' || key === 'disallow') && current) {
      lastWasAgent = false
      if (value) current.rules.push({ allow: key === 'allow', path: value })
    } else {
      lastWasAgent = false
    }
  }
  const group = groups.find((g) => g.agents.some((a) => a !== '*' && agent.includes(a))) ?? groups.find((g) => g.agents.includes('*'))
  if (!group) return true
  let best: { allow: boolean; path: string } | null = null
  for (const rule of group.rules) {
    const prefix = rule.path.replace(/\*.*$/, '').replace(/\$$/, '')
    if (path.startsWith(prefix) && (!best || prefix.length > best.path.length)) best = { ...rule, path: prefix }
  }
  return best ? best.allow : true
}

async function allowedByRobots(url: URL): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${url.origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, timeoutMs: 5000 })
    if (!res.ok) return true
    return robotsAllows(await res.text(), url.pathname)
  } catch {
    return true
  }
}

export async function scrapeSource(source: SourceConfig): Promise<ScrapedItem[]> {
  const url = new URL(source.url)
  if (!(await allowedByRobots(url))) throw new Error('robots.txt disallows this path')
  const res = await fetchWithTimeout(source.url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, timeoutMs: 10000, retries: 1 })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.text()

  if (source.kind === 'rss') {
    const feed = await new Parser().parseString(body)
    return (feed.items ?? [])
      .filter((i) => i.link && i.title)
      .slice(0, 30)
      .map((i) => ({
        title: (i.title ?? '').trim(),
        url: new URL(i.link as string, source.url).toString(),
        published_at: i.isoDate ?? null,
        content_text: (i.contentSnippet ?? i.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 2000),
      }))
  }

  const $ = cheerio.load(body)
  const items: ScrapedItem[] = []
  const seen = new Set<string>()
  $(source.selector || 'a').each((_, el) => {
    const node = $(el)
    const link = node.is('a') ? node : node.find('a').first()
    const href = link.attr('href')
    const title = (node.text() || link.text()).replace(/\s+/g, ' ').trim()
    if (!href || title.length < 12) return
    const abs = new URL(href, source.url).toString()
    if (seen.has(abs)) return
    seen.add(abs)
    items.push({ title: title.slice(0, 300), url: abs, published_at: null, content_text: title })
  })
  return items.slice(0, 40)
}
