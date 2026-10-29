import { describe, expect, it, vi } from 'vitest'
import { runPipeline, type PipelineDeps } from '../engine/pipeline'
import { memoryStore } from '../engine/memoryStore'
import { readConfig } from '../engine/config'
import { localEmbedder } from '../engine/adapters'
import { cannedLlm } from '../engine/adapters/llm'
import { cannedOcr } from '../engine/adapters/vision'
import { cannedFactCheck } from '../engine/adapters/factcheck'
import { cannedWebSearch } from '../engine/adapters/brave'
import { parseKeyword } from '../engine/intake'
import type { Translator } from '../engine/ports'

const translator: Translator = {
  live: true,
  detect: async (t) => (/eggandaalo|Mmande/.test(t) ? 'lug' : 'eng'),
  translate: async (t, from, to) => (from === 'lug' && to === 'eng' ? 'Monday is a public holiday, the ministry announced.' : `[${to}] ${t}`),
}

function deps(overrides: Partial<PipelineDeps> = {}): PipelineDeps & { store: ReturnType<typeof memoryStore> } {
  const store = memoryStore()
  return {
    config: readConfig({ DEMO_MODE: 'true', RISING_THRESHOLD: '3' }),
    translator,
    llm: cannedLlm,
    ocr: cannedOcr,
    factcheck: cannedFactCheck,
    web: cannedWebSearch,
    embedder: localEmbedder,
    store,
    log: { info: vi.fn(), error: vi.fn() },
    now: () => new Date(),
    ...overrides,
  } as PipelineDeps & { store: ReturnType<typeof memoryStore> }
}

describe('runPipeline in demo mode', () => {
  it('assesses a Luganda claim, replies in Luganda with a ticket, and queues it', async () => {
    const d = deps()
    const claim = await d.store.createClaim({ channel: 'whatsapp', sender_hash: 'h1', is_demo: false })
    const r = await runPipeline({ claimId: claim.id, text: 'Mmande lunaku lwa eggandaalo', image: null, languageHint: null, replyLanguage: null, isDemo: false }, d)
    expect(r.replyLanguage).toBe('lug')
    expect(r.reply.startsWith('[lug] ')).toBe(true)
    expect(r.reply).toContain(r.ticket)
    expect(r.evidence.length).toBeGreaterThan(0)
    expect(r.evidence.every((e) => e.demo)).toBe(true)
    const saved = d.store.state.claims.get(claim.id)!
    expect(saved).toMatchObject({ original_language: 'lug', progress: 'done', cluster_id: r.clusterId })
    expect(['queued', 'assessed']).toContain(saved.status)
  })

  it('clusters repeat reports and fires the rising hook once at the threshold', async () => {
    const onRising = vi.fn(async () => {})
    const d = deps({ onRising })
    const ids: string[] = []
    for (let i = 0; i < 4; i++) {
      const c = await d.store.createClaim({ channel: 'web', sender_hash: `h${i}`, is_demo: false })
      const r = await runPipeline({ claimId: c.id, text: 'Free bus fares across the city from Friday, register at the link', image: null, languageHint: 'eng', replyLanguage: 'eng', isDemo: false }, d)
      ids.push(r.clusterId)
    }
    expect(new Set(ids).size).toBe(1)
    expect(d.store.state.clusters.get(ids[0])?.report_count).toBe(4)
    expect(onRising).toHaveBeenCalledTimes(1)
  })

  it('answers instantly from the verified library when the cluster has a verdict', async () => {
    const d = deps()
    const first = await d.store.createClaim({ channel: 'web', sender_hash: 'a', is_demo: false })
    const r1 = await runPipeline({ claimId: first.id, text: 'Exam results leaked online before the release', image: null, languageHint: 'eng', replyLanguage: 'eng', isDemo: false }, d)
    d.store.state.verdicts.set(r1.clusterId, {
      id: 'v1',
      cluster_id: r1.clusterId,
      label: 'likely_false',
      explanation_en: 'The screenshots do not match the official format.',
      explanation_lug: null,
      explanation_swa: null,
      source_url: 'https://example.org/v',
      journalist_id: null,
      published_at: new Date().toISOString(),
    })
    const second = await d.store.createClaim({ channel: 'web', sender_hash: 'b', is_demo: false })
    const r2 = await runPipeline({ claimId: second.id, text: 'Exam results leaked online before the release!', image: null, languageHint: 'eng', replyLanguage: 'eng', isDemo: false }, d)
    expect(r2.fromLibrary).toBe(true)
    expect(r2.reply).toContain('LIKELY FALSE')
    expect(r2.reply).toContain('https://example.org/v')
  })

  it('handles an image with no readable text without crashing', async () => {
    const d = deps({ hashImage: async () => 'ffffffffffffffff' })
    const c = await d.store.createClaim({ channel: 'web', sender_hash: 'img', is_demo: false })
    const r = await runPipeline({ claimId: c.id, text: null, image: new Uint8Array([1, 2, 3]), languageHint: null, replyLanguage: null, isDemo: false }, d)
    expect(r.assessment?.label).toBe('under_investigation')
    expect(d.store.state.claims.get(c.id)?.image_phash).toBe('ffffffffffffffff')
  })
})

describe('intake', () => {
  it('recognises keywords', () => {
    expect(parseKeyword('STOP')).toEqual({ kind: 'stop' })
    expect(parseKeyword(' delete ')).toEqual({ kind: 'delete' })
    expect(parseKeyword('MYDATA')).toEqual({ kind: 'mydata' })
    expect(parseKeyword('2')).toEqual({ kind: 'language', lang: 'lug' })
    expect(parseKeyword('Hi Sherlock')).toEqual({ kind: 'greeting' })
    expect(parseKeyword('Monday is a holiday')).toBeNull()
  })
})
