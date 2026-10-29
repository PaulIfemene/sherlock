// Meta WhatsApp Cloud API (official). Test number for the demo. No unofficial clients.
import { z } from 'zod'
import { fetchJson, fetchWithTimeout, HttpError } from './http'

interface WhatsAppEnv {
  WHATSAPP_PHONE_NUMBER_ID?: string
  WHATSAPP_ACCESS_TOKEN?: string
  GRAPH_API_VERSION?: string
}

export interface WhatsApp {
  readonly live: boolean
  /** Free-form text, allowed within 24 hours of the user's last message. */
  sendText(to: string, body: string): Promise<void>
  downloadMedia(mediaId: string): Promise<{ bytes: Uint8Array; mimeType: string }>
}

/** Meta error 131047: the 24-hour window has closed and a template is needed. */
export class WindowClosedError extends Error {}

export function cloudApi(env: WhatsAppEnv): WhatsApp {
  const version = env.GRAPH_API_VERSION || 'v21.0'
  const auth = { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
  return {
    live: true,
    async sendText(to, body) {
      const res = await fetchWithTimeout(`https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/^\+/, ''), type: 'text', text: { preview_url: true, body } }),
        timeoutMs: 8000,
      })
      if (!res.ok) {
        const text = await res.text()
        if (text.includes('131047')) throw new WindowClosedError('24-hour window closed')
        throw new HttpError(res.status, `WhatsApp send failed: HTTP ${res.status} ${text.slice(0, 200)}`)
      }
    },
    async downloadMedia(mediaId) {
      const meta = z
        .object({ url: z.string(), mime_type: z.string() })
        .parse(await fetchJson(`https://graph.facebook.com/${version}/${mediaId}`, { headers: auth, timeoutMs: 6000, retries: 1 }))
      const res = await fetchWithTimeout(meta.url, { headers: auth, timeoutMs: 10000, retries: 1 })
      if (!res.ok) throw new HttpError(res.status, `media download failed: HTTP ${res.status}`)
      return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType: meta.mime_type }
    },
  }
}

/** Demo fallback: nothing is sent. The caller logs a "simulated send" event instead. */
export const cannedWhatsApp: WhatsApp = {
  live: false,
  async sendText() {
    // Intentionally a no-op. Never log the recipient.
  },
  async downloadMedia() {
    throw new Error('media download unavailable (demo mode, no WhatsApp token)')
  },
}
