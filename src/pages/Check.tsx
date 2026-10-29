import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'
import { api, ApiError, webClientId, whatsappLink, type CheckResult, type EvidenceItem } from '../lib/api'
import { hostOf, langName, LABEL_NAME, pct } from '../lib/format'
import { Button } from '../components/Button'
import { DemoTag, Eyebrow, LabelBadge } from '../components/Pill'

const STAGES: { key: CheckResult['progress']; label: string }[] = [
  { key: 'normalise', label: 'Reading and translating' },
  { key: 'quick_check', label: 'Matching earlier reports and verdicts' },
  { key: 'evidence', label: 'Searching official sources, fact-checks and the web' },
  { key: 'assess', label: 'Weighing the evidence' },
  { key: 'reply', label: 'Writing the answer' },
]
const ORDER = ['received', 'normalise', 'quick_check', 'evidence', 'assess', 'reply', 'done']
const MAX_IMAGE = 4 * 1024 * 1024
const KIND_NAME: Record<EvidenceItem['kind'], string> = { official: 'Official source', factcheck: 'Fact-check', web: 'Web', image: 'Image match' }

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function Progress({ progress }: { progress: CheckResult['progress'] }) {
  const at = ORDER.indexOf(progress)
  return (
    <ol className="space-y-3" aria-label="Check progress">
      {STAGES.map((s) => {
        const idx = ORDER.indexOf(s.key)
        const state = progress === 'done' || at > idx ? 'done' : at === idx ? 'active' : 'waiting'
        return (
          <li key={s.key} className="flex items-center gap-3 text-[15px]">
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${state === 'done' ? 'bg-success text-white' : state === 'active' ? 'live-dot bg-gold text-ink' : 'border border-hairline bg-white text-ink-mute'}`}
            >
              {state === 'done' ? '✓' : ''}
            </span>
            <span className={state === 'waiting' ? 'text-ink-mute' : 'font-medium'}>{s.label}</span>
            <span className="sr-only">{state}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Evidence({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) return <p className="text-[14px] text-ink-mute">No evidence item addressed this claim yet. A journalist will look further.</p>
  return (
    <ul className="divide-y divide-hairline">
      {items.map((e) => (
        <li key={e.id} className="py-4 first:pt-0">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="mono text-ink-mute">{e.id}</span>
            <span className="font-bold uppercase tracking-[.06em]">{KIND_NAME[e.kind]}</span>
            {e.demo && <DemoTag>Simulated</DemoTag>}
          </div>
          {e.url.startsWith('http') ? (
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-1 block font-semibold">
              {e.title}
            </a>
          ) : (
            <p className="mt-1 font-semibold">{e.title}</p>
          )}
          {e.snippet && <p className="mt-1 text-[14px] text-ink-mute">{e.snippet}</p>}
          {e.url.startsWith('http') && <p className="mt-1 text-[12px] text-ink-mute">{hostOf(e.url)}</p>}
        </li>
      ))}
    </ul>
  )
}

function Result({ r }: { r: CheckResult }) {
  const queued = r.status === 'queued'
  return (
    <div className="space-y-5">
      {r.verdict ? (
        <div className="card-dark p-6">
          <p className="micro-cap text-gold">Verdict · checked by a journalist</p>
          <div className="mt-3">
            <LabelBadge label={r.verdict.label} />
          </div>
          <p className="mt-3 text-white/90">{r.verdict.explanation_en}</p>
          {r.verdict.source_url && (
            <a href={r.verdict.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-on-dark-mute">
              Source: {hostOf(r.verdict.source_url)}
            </a>
          )}
        </div>
      ) : (
        <div className="card p-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="micro-cap text-ink-mute">Sherlock’s suggestion</p>
            <LabelBadge label={r.label} />
            {r.confidence !== null && r.label !== 'under_investigation' && <span className="text-[13px] text-ink-mute">confidence {pct(r.confidence)}</span>}
          </div>
          {r.reply && <p className="mt-4 whitespace-pre-line text-[17px] leading-relaxed">{r.reply.replace(/\nSource: \S+$/, '')}</p>}
          <p className="mt-4 text-[13px] text-ink-mute">This is a suggestion based on the evidence found, not a final verdict.</p>
          {r.evidence.some((e) => e.demo) && <p className="mt-2 text-[13px] font-semibold">Demo mode: this result uses simulated evidence, not live searches.</p>}
        </div>
      )}
      {queued && !r.verdict && (
        <div className="rounded-[12px] border border-gold bg-gold-cream p-4">
          <p className="font-semibold">A journalist will review this.</p>
          <p className="mt-1 text-[14px]">
            Your ticket is <span className="mono font-bold">#{r.ticket}</span>. Keep this page open, or come back to it, to see the verdict when it is published. On WhatsApp we message you automatically.
          </p>
        </div>
      )}
      {r.text_en && (
        <div className="text-[14px]">
          <p className="micro-cap text-ink-mute">Claim we checked{r.original_language && r.original_language !== 'eng' ? ` (translated from ${langName(r.original_language)})` : ''}</p>
          <p className="mt-2">{r.text_en}</p>
        </div>
      )}
      <div>
        <h3 className="heading-sm mb-3">Evidence</h3>
        <Evidence items={r.evidence} />
      </div>
    </div>
  )
}

export default function Check() {
  const [text, setText] = useState('')
  const [language, setLanguage] = useState('auto')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [job, setJob] = useState<{ id: string; token: string; ticket: string } | null>(null)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!image) return
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  // Poll for progress; slow down once the engine is done but a journalist may still publish.
  useEffect(() => {
    if (!job) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const r = await api.checkResult(job.id, job.token)
        if (stopped) return
        setResult(r)
        const finished = r.progress === 'done' || r.progress === 'failed'
        // Done and answered: stop. Done but queued: keep checking for a journalist's verdict.
        if (r.verdict || (finished && r.status !== 'queued')) return
        timer = setTimeout(tick, finished ? 10000 : 1200)
      } catch (err) {
        if (!stopped) setError((err as Error).message)
      }
    }
    tick()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [job])

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setError(null)
    if (f && !['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setError('Please choose a JPEG, PNG or WebP image.')
    if (f && f.size > MAX_IMAGE) return setError('That image is larger than 4 MB. Try a smaller screenshot.')
    if (!f) setPreview(null)
    setImage(f)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (text.trim().length < 8 && !image) return setError('Paste at least a sentence, or add a screenshot.')
    setSubmitting(true)
    setResult(null)
    try {
      const started = await api.startCheck({
        text,
        language,
        client_id: webClientId(),
        ...(image ? { image_base64: await readAsBase64(image), image_type: image.type } : {}),
      })
      setJob(started)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setJob(null)
    setResult(null)
    setText('')
    setImage(null)
    setPreview(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const running = job !== null && (!result || (result.progress !== 'done' && result.progress !== 'failed'))

  return (
    <section className="bg-surface py-12 md:py-16">
      <div className="container-x grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <Eyebrow>Web checker</Eyebrow>
          <h1 className="display-lg mt-4">Check a claim</h1>
          <p className="body-lg mt-3 max-w-lg text-ink-mute">Paste the message or add a screenshot. Same checks as on WhatsApp. Don’t include your own name or number.</p>

          <form onSubmit={submit} className="card mt-8 space-y-5 p-6">
            <div>
              <label htmlFor="claim" className="field-label">
                Message or claim
              </label>
              <textarea id="claim" rows={6} maxLength={4000} className="field resize-y" value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: Monday has been declared a public holiday, says a ministry notice." disabled={running} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="image" className="field-label">
                  Screenshot (optional)
                </label>
                <input ref={fileInput} id="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={running} className="block w-full text-[14px] file:mr-3 file:min-h-[44px] file:cursor-pointer file:rounded-full file:border-0 file:bg-gold-soft file:px-4 file:font-bold file:text-ink" />
              </div>
              <div>
                <label htmlFor="lang" className="field-label">
                  Language
                </label>
                <select id="lang" className="field" value={language} onChange={(e) => setLanguage(e.target.value)} disabled={running}>
                  <option value="auto">Detect automatically</option>
                  <option value="eng">English</option>
                  <option value="lug">Luganda</option>
                  <option value="swa">Kiswahili</option>
                </select>
              </div>
            </div>
            {preview && <img src={preview} alt="Screenshot to check" className="max-h-56 rounded-[8px] border border-hairline object-contain" />}
            {error && (
              <p role="alert" className="text-[14px] font-medium text-error">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting || running}>
                {submitting ? 'Sending…' : running ? 'Checking…' : 'Check this claim'}
              </Button>
              {job && !running && (
                <Button variant="ghost" onClick={reset}>
                  Check another
                </Button>
              )}
            </div>
            <p className="text-[13px] text-ink-mute">
              We remove phone numbers, emails and names before using any outside service, and delete images within 24 hours. <Link to="/privacy">Privacy notice</Link>.
            </p>
          </form>
        </div>

        <div aria-live="polite">
          {!job ? (
            <div className="card flex h-full min-h-[320px] flex-col justify-between p-6 md:p-8">
              <div>
                <h2 className="heading-lg">What you’ll get</h2>
                <ul className="mt-5 space-y-4">
                  {[
                    ['A suggested label', Object.values(LABEL_NAME).slice(0, 3).join(', ') + ' and more, in careful language.'],
                    ['The evidence', 'Official sources, published fact-checks and web results, with links.'],
                    ['A ticket', 'If it’s uncertain, a journalist reviews it and the verdict appears here.'],
                  ].map(([t, d]) => (
                    <li key={t}>
                      <p className="font-semibold">{t}</p>
                      <p className="text-[14px] text-ink-mute">{d}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 rounded-[12px] bg-gold-cream p-4 text-[14px]">
                Prefer WhatsApp? <a href={whatsappLink}>Send it to Sherlock</a> and get the answer in your language.
              </div>
            </div>
          ) : (
            <div className="card p-6 md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="heading-lg">{running ? 'Checking…' : result?.progress === 'failed' ? 'Sent to a journalist' : 'Result'}</h2>
                <span className="mono text-[13px] text-ink-mute">Ticket #{job.ticket}</span>
              </div>
              <div className="mt-6">{running || !result ? <Progress progress={result?.progress ?? 'received'} /> : result.progress === 'failed' ? <p>Something went wrong during the automatic check, so a fact-checker will review it by hand. Keep your ticket number.</p> : <Result r={result} />}</div>
            </div>
          )}
        </div>
      </div>
      <p className="container-x mt-8 text-[12px] text-ink-mute">Web results by Brave Search. Translation by Sunbird AI. Results marked “Simulated” come from demo fallbacks, not live searches.</p>
    </section>
  )
}

