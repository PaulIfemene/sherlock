// fetch with a timeout and optional retries. Retries only for idempotent calls.

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface FetchOptions extends RequestInit {
  timeoutMs?: number
  retries?: number
}

export async function fetchWithTimeout(url: string, { timeoutMs = 8000, retries = 0, ...init }: FetchOptions = {}): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      if (res.status >= 500 && attempt < retries) {
        lastError = new HttpError(res.status, `HTTP ${res.status}`)
      } else {
        return res
      }
    } catch (err) {
      lastError = err
    } finally {
      clearTimeout(timer)
    }
    await new Promise((r) => setTimeout(r, 300 * 2 ** attempt))
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export async function fetchJson(url: string, options: FetchOptions = {}): Promise<unknown> {
  const res = await fetchWithTimeout(url, options)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new HttpError(res.status, `HTTP ${res.status} from ${new URL(url).host}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}
