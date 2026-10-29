import { describe, expect, it, vi } from 'vitest'
import { assess, cannedAssessment, needsJournalist, parseAssessment, soften } from '../engine/assess'
import { LlmRateLimitError, type ChatLLM } from '../engine/ports'
import type { Evidence } from '../engine/types'

const evidence: Evidence[] = [
  { id: 'e1', kind: 'official', title: 'Ministry notice', url: 'https://example.org/a', snippet: 'No holiday on Monday', published_at: null },
  { id: 'e2', kind: 'web', title: 'News', url: 'https://example.org/b', snippet: '…', published_at: null },
]
const log = { info: vi.fn(), error: vi.fn() }

const good = JSON.stringify({
  label: 'likely_false',
  confidence: 0.86,
  evidence_ids: ['e1'],
  disorder_hint: 'misinformation',
  rationale: 'The official notice lists no holiday.',
  reply_text: 'The evidence we found suggests this is not accurate.',
  missing_evidence: '',
})

describe('parseAssessment', () => {
  it('accepts the contract shape, including inside a code fence', () => {
    const a = parseAssessment('```json\n' + good + '\n```', evidence)
    expect(a?.label).toBe('likely_false')
    expect(a?.confidence).toBe(0.86)
  })

  it('returns null on invalid JSON or a missing field', () => {
    expect(parseAssessment('not json', evidence)).toBeNull()
    expect(parseAssessment(JSON.stringify({ label: 'likely_false' }), evidence)).toBeNull()
    expect(parseAssessment(JSON.stringify({ ...JSON.parse(good), label: 'definitely_fake' }), evidence)).toBeNull()
  })

  it('drops evidence IDs that do not exist, and with none left falls back to under_investigation', () => {
    const a = parseAssessment(JSON.stringify({ ...JSON.parse(good), evidence_ids: ['e9'] }), evidence)
    expect(a?.label).toBe('under_investigation')
    expect(a?.evidence_ids).toEqual([])
  })

  it('removes banned words and caps reply length', () => {
    const a = parseAssessment(JSON.stringify({ ...JSON.parse(good), reply_text: `This is FAKE and a hoax. ${'x'.repeat(500)}` }), evidence)
    expect(a?.reply_text).not.toMatch(/fake|hoax/i)
    expect(a!.reply_text.length).toBeLessThanOrEqual(400)
  })

  it('soften keeps sentences readable', () => {
    expect(soften('That is a lie.')).toBe('That is a not supported by the evidence.')
  })
})

describe('assess', () => {
  const llm = (replies: (string | Error)[]): ChatLLM => {
    const queue = [...replies]
    return {
      live: true,
      complete: vi.fn(async () => {
        const next = queue.shift()
        if (next instanceof Error) throw next
        return next ?? ''
      }),
    }
  }

  it('retries once after a parse failure', async () => {
    const model = llm(['oops', good])
    const a = await assess({ claim_en: 'Monday is a holiday', original_language: 'lug', evidence }, model, log)
    expect(a.label).toBe('likely_false')
    expect(model.complete).toHaveBeenCalledTimes(2)
  })

  it('falls back to under_investigation after two parse failures', async () => {
    const a = await assess({ claim_en: 'x', original_language: 'eng', evidence }, llm(['bad', 'worse']), log)
    expect(a).toMatchObject({ label: 'under_investigation', fallback: 'parse_failure' })
  })

  it('falls back with a clear reason when the free tier is rate limited', async () => {
    const a = await assess({ claim_en: 'x', original_language: 'eng', evidence }, llm([new LlmRateLimitError()]), log)
    expect(a).toMatchObject({ label: 'under_investigation', fallback: 'rate_limited' })
  })

  it('never calls the LLM when there is no evidence', async () => {
    const model = llm([good])
    const a = await assess({ claim_en: 'x', original_language: 'eng', evidence: [] }, model, log)
    expect(a.label).toBe('under_investigation')
    expect(model.complete).not.toHaveBeenCalled()
  })

  it('uses the labelled rule-based stand-in when no LLM is configured', () => {
    const a = cannedAssessment({ claim_en: 'x', original_language: 'eng', evidence: [{ ...evidence[1], kind: 'factcheck', title: 'Rated False' }] })
    expect(a.label).toBe('likely_false')
    expect(a.rationale).toMatch(/^Demo assessment/)
  })
})

describe('needsJournalist', () => {
  it('queues low confidence, under_investigation and unverified', () => {
    const base = { evidence_ids: ['e1'], disorder_hint: 'unknown' as const, rationale: '', reply_text: '', missing_evidence: '' }
    expect(needsJournalist({ ...base, label: 'likely_false', confidence: 0.9 }, 0.75)).toBe(false)
    expect(needsJournalist({ ...base, label: 'likely_false', confidence: 0.6 }, 0.75)).toBe(true)
    expect(needsJournalist({ ...base, label: 'unverified', confidence: 0.9 }, 0.75)).toBe(true)
  })
})

describe('format drift from the model', () => {
  it('accepts spaced labels, numeric ids and percentage confidence', async () => {
    const { parseAssessmentDetailed } = await import('../engine/assess')
    const raw = JSON.stringify({ label: 'Likely False', confidence: '82%', evidence_ids: [1], reply_text: 'The evidence we found suggests otherwise.' })
    const r = parseAssessmentDetailed(raw, evidence)
    expect(r.assessment).toMatchObject({ label: 'likely_false', confidence: 0.82, evidence_ids: ['e1'] })
  })

  it('explains rejections without echoing content', async () => {
    const { parseAssessmentDetailed } = await import('../engine/assess')
    expect(parseAssessmentDetailed('', evidence).reason).toBe('empty reply')
    expect(parseAssessmentDetailed('{"label":"maybe","reply_text":"x","confidence":0.5}', evidence).reason).toMatch(/^label:/)
  })
})

describe('LLM rate-limit fallback', () => {
  it('retries once on the smaller model after a 429', async () => {
    const { openAiCompatibleLlm } = await import('../engine/adapters/llm')
    const models: string[] = []
    const original = globalThis.fetch
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model as string
      models.push(model)
      if (model === 'openai/gpt-oss-120b') return new Response('{}', { status: 429 })
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { status: 200 })
    }) as typeof fetch
    try {
      const out = await openAiCompatibleLlm({ LLM_API_KEY: 'k' }).complete({ system: 's', user: 'u', json: true })
      expect(out).toBe('{"ok":true}')
      expect(models).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
    } finally {
      globalThis.fetch = original
    }
  })
})
