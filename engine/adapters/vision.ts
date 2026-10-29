// Google Cloud Vision TEXT_DETECTION for screenshots.
import { z } from 'zod'
import type { Ocr } from '../ports'
import { fetchJson } from './http'

const VisionResponse = z.object({
  responses: z.array(
    z.object({
      fullTextAnnotation: z.object({ text: z.string() }).optional(),
      textAnnotations: z.array(z.object({ description: z.string() })).optional(),
      error: z.object({ message: z.string() }).optional(),
    }),
  ),
})

export function googleVisionOcr(apiKey: string): Ocr {
  return {
    live: true,
    async extractText(image) {
      const json = await fetchJson(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{ image: { content: Buffer.from(image).toString('base64') }, features: [{ type: 'TEXT_DETECTION' }] }],
        }),
        timeoutMs: 10000,
        retries: 1,
      })
      const r = VisionResponse.parse(json).responses[0]
      if (r?.error) throw new Error(`Vision: ${r.error.message}`)
      return (r?.fullTextAnnotation?.text ?? r?.textAnnotations?.[0]?.description ?? '').trim()
    },
  }
}

/** Fallback without a Vision key: no text is read, and the claim relies on the caption. */
export const cannedOcr: Ocr = {
  live: false,
  async extractText() {
    return ''
  },
}
