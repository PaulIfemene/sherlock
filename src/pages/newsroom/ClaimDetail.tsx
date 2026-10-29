import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useNewsroom } from '../../lib/newsroom'
import { api, type EvidenceItem } from '../../lib/api'
import { dateTime, hostOf, LABEL_NAME, langName, pct, ticketFor, timeAgo, type Label } from '../../lib/format'
import { useNow } from '../../lib/hooks'
import type { EventRow, Verdict } from '../../lib/types'
import { Empty, Panel } from '../../components/Card'
import { DemoTag, LabelBadge, LangChip, StatusPill } from '../../components/Pill'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'

const KIND_ORDER: EvidenceItem['kind'][] = ['official', 'factcheck', 'web', 'image']
const KIND_NAME: Record<EvidenceItem['kind'], string> = { official: 'Official sources', factcheck: 'Fact-check archive', web: 'Web', image: 'Image history' }
const VERDICT_LABELS: Label[] = ['likely_false', 'likely_true', 'missing_context', 'unverified']
const LABEL_HELP: Record<string, string> = {
  likely_false: 'An official source or fact-check contradicts it.',
  likely_true: 'An official source confirms it.',
  missing_context: 'Partly true, but misleading as stated.',
  unverified: 'Could not be matched to the official record.',
}

function EvidencePanel({ items }: { items: EvidenceItem[] }) {
  const groups = KIND_ORDER.map((k) => [k, items.filter((e) => e.kind === k)] as const).filter(([, list]) => list.length > 0)
  return (
    <Panel title="Evidence" subtitle={`${items.length} item${items.length === 1 ? '' : 's'} gathered automatically`}>
      {groups.length === 0 ? (
        <Empty title="No evidence found">No official source, fact-check or web result addressed this claim. Search further, or record what you find in your verdict.</Empty>
      ) : (
        <div className="divide-y divide-hairline">
          {groups.map(([kind, list]) => (
            <section key={kind} className="px-5 py-4">
              <h3 className="micro-cap text-ink-mute">{KIND_NAME[kind]}</h3>
              <ul className="mt-3 space-y-4">
                {list.map((e) => (
                  <li key={e.id} className="grid grid-cols-[32px_1fr] gap-2">
                    <span className="mono pt-0.5 text-ink-mute">{e.id}</span>
                    <div className="min-w-0">
                      {e.url.startsWith('http') ? (
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-semibold break-words">
                          {e.title}
                        </a>
                      ) : (
                        <Link to={e.url} className="font-semibold">
                          {e.title}
                        </Link>
                      )}
                      {e.snippet && <p className="mt-1 text-[14px] text-ink-mute">{e.snippet}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-mute">
                        {e.url.startsWith('http') && <span>{hostOf(e.url)}</span>}
                        {e.published_at && <span>· {dateTime(e.published_at)}</span>}
                        {e.demo && <DemoTag>Simulated</DemoTag>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  )
}

function ImagePanel({ claimId, ocr }: { claimId: string; ocr: string | null }) {
  const { offline } = useNewsroom()
  const [media, setMedia] = useState<{ url: string | null; reverse: { name: string; url: string }[] } | null>(null)
  useEffect(() => {
    if (offline) return
    api.claimMedia(claimId).then(setMedia).catch(() => setMedia({ url: null, reverse: [] }))
  }, [claimId, offline])
  return (
    <Panel title="Image" subtitle="Deleted within 24 hours of receipt. Text and fingerprint are kept.">
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {media?.url ? <img src={media.url} alt="Screenshot sent by the reporter" className="max-h-80 w-full rounded-[8px] border border-hairline object-contain" /> : <p className="text-[14px] text-ink-mute">The image has been deleted or is not available.</p>}
        <div>
          <p className="micro-cap text-ink-mute">Text read from the image</p>
          <p className="mt-2 whitespace-pre-line text-[14px]">{ocr || '–'}</p>
          {media && media.reverse.length > 0 && (
            <>
              <p className="micro-cap mt-5 text-ink-mute">Reverse image search</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {media.reverse.map((r) => (
                  <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    {r.name}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Panel>
  )
}

function PublishedVerdict({ v }: { v: Verdict }) {
  return (
    <Panel title="Published verdict" subtitle={`Published ${dateTime(v.published_at)}`} action={<LabelBadge label={v.label} />}>
      <div className="space-y-4 p-5">
        {[
          ['English', v.explanation_en],
          ['Luganda', v.explanation_lug],
          ['Kiswahili', v.explanation_swa],
        ].map(([lang, text]) => (
          <div key={lang}>
            <p className="micro-cap text-ink-mute">{lang}</p>
            <p className="mt-1 text-[15px]">{text || <span className="text-ink-mute">Not translated (machine translation was unavailable). Readers get the English text with a note.</span>}</p>
          </div>
        ))}
        {v.source_url && (
          <p className="text-[14px]">
            Source:{' '}
            <a href={v.source_url} target="_blank" rel="noopener noreferrer">
              {v.source_url}
            </a>
          </p>
        )}
      </div>
    </Panel>
  )
}

function VerdictEditor({ clusterId, suggested, reports }: { clusterId: string; suggested: Label | null; reports: number }) {
  const { publish, offline } = useNewsroom()
  const toast = useToast()
  const [label, setLabel] = useState<Label | ''>(suggested && suggested !== 'under_investigation' ? suggested : '')
  const [text, setText] = useState('')
  const [lug, setLug] = useState('')
  const [swa, setSwa] = useState('')
  const [url, setUrl] = useState('')
  const [translating, setTranslating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function preview() {
    if (text.trim().length < 20) return setError('Write the English explanation first.')
    setError(null)
    if (offline) return toast('Translation preview needs the server and Sunbird (offline demo).', 'info')
    setTranslating(true)
    try {
      const [l, s] = await Promise.all([api.translate(text, 'lug'), api.translate(text, 'swa')])
      if (!l.live) toast(l.note ?? 'Sunbird is not configured (demo).', 'info')
      setLug(l.text ?? '')
      setSwa(s.text ?? '')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setTranslating(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!label) return setError('Pick a label.')
    if (text.trim().length < 20) return setError('Write at least a sentence explaining the verdict.')
    if (url && !/^https?:\/\/\S+$/.test(url.trim())) return setError('The source must be a full URL starting with http.')
    setError(null)
    setPublishing(true)
    try {
      const d = await publish({ cluster_id: clusterId, label, explanation_en: text.trim(), explanation_lug: lug.trim() || null, explanation_swa: swa.trim() || null, source_url: url.trim() || null })
      const parts = [d.sent && `${d.sent} sent`, d.simulated && `${d.simulated} simulated`, d.needs_template && `${d.needs_template} need a template`, d.failed && `${d.failed} failed`, d.web && `${d.web} on the web`].filter(Boolean)
      toast(`Published. Delivery: ${parts.join(', ') || 'no recipients'}.`, 'success')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Panel title="Your verdict" subtitle={reports === 1 ? 'Goes to the person who reported this claim, in their language.' : `Goes to all ${reports} people who reported this claim, in their language.`}>
      <form onSubmit={submit} className="space-y-5 p-5">
        <fieldset>
          <legend className="field-label">Label</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {VERDICT_LABELS.map((l) => (
              <label key={l} className={`flex min-h-[44px] cursor-pointer gap-3 rounded-[10px] border p-3 ${label === l ? 'border-ink bg-gold-cream' : 'border-hairline'}`}>
                <input type="radio" name="label" value={l} checked={label === l} onChange={() => setLabel(l)} className="mt-1 accent-[#181818]" />
                <span>
                  <span className="block font-semibold">{LABEL_NAME[l]}</span>
                  <span className="block text-[13px] text-ink-mute">{LABEL_HELP[l]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="expl" className="field-label">
            Explanation (English)
          </label>
          <textarea id="expl" rows={4} maxLength={1200} className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="What the evidence shows, in plain words. Avoid “fake” or “lie”; say what is and is not supported." />
          <p className="mt-1 text-[12px] text-ink-mute">{text.length}/1200 · Citizens see this, so keep it short and friendly.</p>
        </div>
        <div className="rounded-[12px] bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] font-semibold">Luganda and Kiswahili</p>
            <Button variant="outline" size="sm" onClick={preview} disabled={translating}>
              {translating ? 'Translating…' : 'Translate preview'}
            </Button>
          </div>
          <p className="mt-1 text-[13px] text-ink-mute">Machine translation by Sunbird AI. Edit before publishing; leave blank to translate on publish.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="lug" className="field-label">
                Luganda
              </label>
              <textarea id="lug" rows={3} className="field" value={lug} onChange={(e) => setLug(e.target.value)} />
            </div>
            <div>
              <label htmlFor="swa" className="field-label">
                Kiswahili
              </label>
              <textarea id="swa" rows={3} className="field" value={swa} onChange={(e) => setSwa(e.target.value)} />
            </div>
          </div>
        </div>
        <div>
          <label htmlFor="src" className="field-label">
            Source URL
          </label>
          <input id="src" type="url" inputMode="url" className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… official notice or published fact-check" />
        </div>
        {error && (
          <p role="alert" className="text-[14px] font-medium text-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
          <Button type="submit" disabled={publishing}>
            {publishing ? 'Publishing…' : 'Publish verdict'}
          </Button>
          <p className="text-[13px] text-ink-mute">Publishing adds it to the verified library and messages everyone who asked.</p>
        </div>
      </form>
    </Panel>
  )
}

function History({ clusterId }: { clusterId: string }) {
  const { loadEvents, events } = useNewsroom()
  const [rows, setRows] = useState<EventRow[]>([])
  useNow(30000)
  // Reload when Realtime brings a new event for this cluster.
  const latestForCluster = events.filter((e) => e.cluster_id === clusterId).length
  useEffect(() => {
    loadEvents(clusterId).then(setRows)
  }, [clusterId, loadEvents, latestForCluster])
  return (
    <Panel title="History">
      {rows.length === 0 ? (
        <Empty title="No actions yet" />
      ) : (
        <ol className="px-5 py-4">
          {rows.map((e) => (
            <li key={e.id} className="relative border-l border-hairline pb-4 pl-5 last:pb-0">
              <span aria-hidden className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${e.kind === 'published' ? 'bg-success' : e.kind === 'alert' || e.kind === 'simulated' ? 'bg-gold' : 'bg-ink'}`} />
              <p className="text-[14px]">{e.detail}</p>
              <p className="text-[12px] text-ink-mute">
                {timeAgo(e.created_at)}
                {e.actor && ` · ${e.actor}`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

export default function ClaimDetail() {
  const { id = '' } = useParams()
  const { claims, clusters, verdicts, loading } = useNewsroom()
  const claim = claims.find((c) => c.id === id)
  const cluster = claim?.cluster_id ? clusters.find((c) => c.id === claim.cluster_id) : undefined
  const verdict = cluster ? verdicts.find((v) => v.cluster_id === cluster.id) : undefined
  const siblings = useMemo(() => (cluster ? claims.filter((c) => c.cluster_id === cluster.id && c.id !== id).sort((a, b) => b.received_at.localeCompare(a.received_at)) : []), [claims, cluster, id])

  if (loading) return <p className="text-ink-mute">Loading case…</p>
  if (!claim) {
    return (
      <div className="card p-8">
        <h1 className="heading-lg">Claim not found</h1>
        <p className="mt-2 text-ink-mute">It may have been erased at the sender’s request.</p>
        <Link to="/newsroom/claims" className="mt-4 inline-block font-semibold">
          Back to the claims database
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/newsroom/claims" className="text-[14px] font-semibold">
          ← Claims database
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="display-md">Case {ticketFor(claim.id)}</h1>
          <StatusPill status={claim.status} />
          {claim.is_demo && <DemoTag />}
        </div>
        <p className="mt-1 text-[14px] text-ink-mute">
          {claim.channel === 'whatsapp' ? 'WhatsApp' : 'Web checker'} · received {dateTime(claim.received_at)} · sender <span className="mono">{claim.sender_hash ? `${claim.sender_hash.slice(0, 8)}…` : '–'}</span>
          {cluster && (
            <>
              {' '}
              · <b className="text-ink">{cluster.report_count}</b> report{cluster.report_count === 1 ? '' : 's'} in this cluster
              {cluster.simulated_reports > 0 && ` (${cluster.simulated_reports} simulated)`}
            </>
          )}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-6">
          <section className="card grid overflow-hidden md:grid-cols-2">
            <div className="border-b border-hairline p-5 md:border-r md:border-b-0">
              <p className="micro-cap flex items-center gap-2 text-ink-mute">
                Original <LangChip lang={claim.original_language} full />
              </p>
              <p className="mt-3 text-[16px] leading-relaxed">{claim.original_text ?? <span className="text-ink-mute">Image only</span>}</p>
            </div>
            <div className="bg-gold-cream p-5">
              <p className="micro-cap text-ink-mute">English {claim.original_language && claim.original_language !== 'eng' ? '(translated)' : ''}</p>
              <p className="mt-3 text-[16px] font-medium leading-relaxed">{claim.text_en ?? <span className="text-ink-mute">Processing…</span>}</p>
            </div>
          </section>

          {(claim.image_path || claim.ocr_text) && <ImagePanel claimId={claim.id} ocr={claim.ocr_text} />}

          <EvidencePanel items={claim.evidence ?? []} />

          {siblings.length > 0 && (
            <Panel title="Other reports in this cluster" subtitle={`${siblings.length} shown of ${(cluster?.report_count ?? 1) - 1}`}>
              <ul>
                {siblings.slice(0, 8).map((s) => (
                  <li key={s.id}>
                    <Link to={`/newsroom/claims/${s.id}`} className="flex items-center gap-3 border-b border-hairline px-5 py-3 text-ink no-underline last:border-0 hover:bg-gold-cream">
                      <LangChip lang={s.original_language} />
                      <span className="min-w-0 flex-1 truncate text-[14px]">{s.original_text ?? s.text_en}</span>
                      <span className="shrink-0 text-[12px] text-ink-mute">{timeAgo(s.received_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="AI suggestion" subtitle="Suggestive only. Your published verdict is final." action={<LabelBadge label={claim.ai_label} />}>
            <dl className="space-y-3 p-5 text-[14px]">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">Confidence</dt>
                <dd className="font-semibold tabular-nums">{pct(claim.ai_confidence)}</dd>
              </div>
              <div>
                <dt className="text-ink-mute">Rationale</dt>
                <dd className="mt-1">{claim.ai_rationale ?? '–'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-mute">Reply language</dt>
                <dd className="font-semibold">{langName(claim.original_language)}</dd>
              </div>
            </dl>
          </Panel>

          {verdict ? <PublishedVerdict v={verdict} /> : cluster ? <VerdictEditor key={cluster.id} clusterId={cluster.id} suggested={claim.ai_label} reports={cluster.report_count} /> : <Panel title="Your verdict"><Empty title="Still processing">The claim has not been assigned to a cluster yet.</Empty></Panel>}

          {cluster && <History clusterId={cluster.id} />}
        </aside>
      </div>
    </div>
  )
}
