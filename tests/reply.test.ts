import { describe, expect, it, vi } from 'vitest'
import { compose, formatAssessmentReply, formatVerdictReply, MAX_REPLY, ticketFor } from '../engine/reply'
import { localise, verdictMessage } from '../engine/feedback'
import type { Assessment, Evidence } from '../engine/types'
import type { Translator } from '../engine/ports'

const evidence: Evidence[] = [{ id: 'e1', kind: 'official', title: 'Notice', url: 'https://example.org/notice', snippet: '', published_at: null }]
const assessment: Assessment = {
  label: 'likely_false',
  confidence: 0.6,
  evidence_ids: ['e1'],
  disorder_hint: 'unknown',
  rationale: '',
  reply_text: 'The evidence we found suggests this is not accurate.',
  missing_evidence: '',
}
const log = { info: vi.fn(), error: vi.fn() }

describe('ticketFor', () => {
  it('is short and stable', () => {
    expect(ticketFor('4f2a9c00-1111-2222-3333-444455556666')).toBe('SH-4F2A')
  })
})

describe('formatAssessmentReply', () => {
  it('queued replies give the ticket and hedge the label', () => {
    const parts = formatAssessmentReply({ assessment, evidence, ticket: 'SH-1', queued: true })
    expect(parts.body).toContain('Our check so far suggests this is likely false')
    expect(parts.body).toContain('Ticket #SH-1')
    expect(parts.url).toBe('https://example.org/notice')
  })

  it('under_investigation says a fact-checker is reviewing', () => {
    const parts = formatAssessmentReply({ assessment: { ...assessment, label: 'under_investigation', evidence_ids: [] }, evidence, ticket: 'SH-2', queued: true })
    expect(parts.body).toMatch(/fact-checker is reviewing/)
    expect(parts.url).toBeNull()
  })

  it('confident replies say they are a suggestion, not a verdict', () => {
    expect(formatAssessmentReply({ assessment, evidence, ticket: 'SH-3', queued: false }).body).toMatch(/not a final verdict/)
  })
})

describe('compose', () => {
  it('stays under 600 characters with the link intact and only one link', () => {
    const text = compose({ body: 'x'.repeat(2000), url: 'https://example.org/notice' })
    expect(text.length).toBeLessThanOrEqual(MAX_REPLY)
    expect(text.endsWith('https://example.org/notice')).toBe(true)
    expect(text.match(/https?:\/\//g)).toHaveLength(1)
  })
})

describe('localise', () => {
  const ok: Translator = { live: true, detect: async () => null, translate: async (t) => `[lug] ${t}` }
  const broken: Translator = { live: true, detect: async () => null, translate: async () => Promise.reject(new Error('down')) }

  it('translates only the body, keeping the URL out of the translator', async () => {
    const spy = vi.fn(ok.translate)
    const out = await localise({ body: 'Hello', url: 'https://example.org/x' }, 'lug', { ...ok, translate: spy }, log)
    expect(out).toBe('[lug] Hello\nSource: https://example.org/x')
    expect(spy.mock.calls[0][0]).not.toContain('example.org')
  })

  it('falls back to English with a note when translation fails', async () => {
    const out = await localise({ body: 'Hello', url: null }, 'swa', broken, log)
    expect(out).toMatch(/^\(Translation unavailable, replying in English\.\) Hello$/)
  })

  it('verdict messages prefer the journalist-reviewed explanation', async () => {
    const v = { label: 'likely_false' as const, explanation_en: 'English text', explanation_lug: 'Ennyinyonnyola', explanation_swa: null, source_url: 'https://example.org/v' }
    const out = await verdictMessage(v, 'lug', 'SH-9', ok, log)
    expect(out).toContain('Ennyinyonnyola')
    expect(out).not.toContain('English text')
    expect(formatVerdictReply(v, 'SH-9').body).toContain('LIKELY FALSE')
  })
})
