// Display helpers for labels, languages, dates and numbers.

export type Lang = 'eng' | 'lug' | 'swa'
export type Label = 'likely_false' | 'likely_true' | 'missing_context' | 'under_investigation' | 'unverified'
export type ClaimStatus = 'received' | 'assessed' | 'queued' | 'published'

export const LANG_NAME: Record<Lang, string> = { eng: 'English', lug: 'Luganda', swa: 'Kiswahili' }
export const LANG_SHORT: Record<Lang, string> = { eng: 'EN', lug: 'LG', swa: 'SW' }

export const LABEL_NAME: Record<Label, string> = {
  likely_false: 'Likely false',
  likely_true: 'Likely true',
  missing_context: 'Missing context',
  under_investigation: 'Under investigation',
  unverified: 'Unverified',
}

export const STATUS_NAME: Record<ClaimStatus, string> = {
  received: 'Received',
  assessed: 'Assessed',
  queued: 'Queued for review',
  published: 'Published',
}

export function langName(code: string | null | undefined): string {
  return code && code in LANG_NAME ? LANG_NAME[code as Lang] : 'Unknown'
}

export function ticketFor(id: string): string {
  return `SH-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' })

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '–'
  const diff = (new Date(iso).getTime() - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function duration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '–'
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? '–' : `${Math.round(n * 100)}%`
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
