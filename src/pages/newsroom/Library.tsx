import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useNewsroom } from '../../lib/newsroom'
import { dateTime, hostOf, LABEL_NAME, type Label } from '../../lib/format'
import { Empty } from '../../components/Card'
import { DemoTag, LabelBadge } from '../../components/Pill'

export default function Library() {
  const { verdicts, clusters, claims, loading } = useNewsroom()
  const [q, setQ] = useState('')
  const [label, setLabel] = useState('')
  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters])
  const firstClaim = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of [...claims].sort((a, b) => a.received_at.localeCompare(b.received_at))) if (c.cluster_id && !m.has(c.cluster_id)) m.set(c.cluster_id, c.id)
    return m
  }, [claims])

  const rows = verdicts
    .filter((v) => !label || v.label === label)
    .filter((v) => !q || `${clusterById.get(v.cluster_id)?.canonical_text_en ?? ''} ${v.explanation_en}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.published_at.localeCompare(a.published_at))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="display-md">Verified library</h1>
        <p className="text-[14px] text-ink-mute">Published verdicts. New reports that match one get the verdict instantly, without waiting for review.</p>
      </div>
      <div className="card grid gap-3 p-4 md:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="lq" className="field-label">
            Search
          </label>
          <input id="lq" type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Claim or explanation" />
        </div>
        <div>
          <label htmlFor="ll" className="field-label">
            Label
          </label>
          <select id="ll" className="field" value={label} onChange={(e) => setLabel(e.target.value)}>
            <option value="">All</option>
            {(['likely_false', 'likely_true', 'missing_context', 'unverified'] as Label[]).map((l) => (
              <option key={l} value={l}>
                {LABEL_NAME[l]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {loading ? (
        <p className="text-ink-mute">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty title={verdicts.length ? 'No verdicts match' : 'No verdicts published yet'}>Publish a verdict from a claim’s case page and it appears here.</Empty>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((v) => {
            const c = clusterById.get(v.cluster_id)
            const caseId = firstClaim.get(v.cluster_id)
            return (
              <li key={v.id} className="card flex flex-col p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <LabelBadge label={v.label} />
                  {c?.is_demo && <DemoTag />}
                  <span className="ml-auto text-[13px] text-ink-mute">{dateTime(v.published_at)}</span>
                </div>
                <h2 className="heading-sm mt-4">{c?.canonical_text_en ?? 'Claim'}</h2>
                <p className="mt-2 text-[15px] text-ink-mute">{v.explanation_en}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-4 text-[13px]">
                  <span>
                    <b className="tabular-nums">{c?.report_count ?? 0}</b> report{c?.report_count === 1 ? '' : 's'}
                  </span>
                  <span className="text-ink-mute">
                    Translations: {[v.explanation_lug && 'Luganda', v.explanation_swa && 'Kiswahili'].filter(Boolean).join(', ') || 'English only'}
                  </span>
                  {v.source_url && (
                    <a href={v.source_url} target="_blank" rel="noopener noreferrer">
                      {hostOf(v.source_url)}
                    </a>
                  )}
                  {caseId && (
                    <Link to={`/newsroom/claims/${caseId}`} className="ml-auto font-semibold">
                      Open case
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
