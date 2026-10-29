import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useNewsroom } from '../../lib/newsroom'
import { dateTime, LABEL_NAME, LANG_NAME, STATUS_NAME, ticketFor, timeAgo } from '../../lib/format'
import { useNow } from '../../lib/hooks'
import { Table } from '../../components/Table'
import { Empty } from '../../components/Card'
import { DemoTag, LabelBadge, LangChip, StatusPill } from '../../components/Pill'
import { Button } from '../../components/Button'

const PAGE = 50

function Filter({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function Claims() {
  const { claims, clusters, loading } = useNewsroom()
  const [params, setParams] = useSearchParams()
  const [limit, setLimit] = useState(PAGE)
  const navigate = useNavigate()
  useNow(60000)

  const get = (k: string) => params.get(k) ?? ''
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
    setLimit(PAGE)
  }

  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters])
  const q = get('q').toLowerCase()
  // Up to ~1,000 rows: filtering on each render is cheap and keeps the URL as the only state.
  const rows = (() => {
    const from = get('from') ? new Date(get('from')).getTime() : null
    const to = get('to') ? new Date(get('to')).getTime() + 86_400_000 : null
    return [...claims]
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .filter((c) => {
        if (get('cluster') && c.cluster_id !== get('cluster')) return false
        if (get('status') && c.status !== get('status')) return false
        if (get('lang') && c.original_language !== get('lang')) return false
        if (get('label') && c.ai_label !== get('label')) return false
        const t = new Date(c.received_at).getTime()
        if (from && t < from) return false
        if (to && t >= to) return false
        if (q && !`${c.text_en ?? ''} ${c.original_text ?? ''} ${ticketFor(c.id)}`.toLowerCase().includes(q)) return false
        return true
      })
  })()

  const filtered = ['q', 'status', 'lang', 'label', 'from', 'to', 'cluster'].some((k) => get(k))
  const clusterFilter = get('cluster') ? clusterById.get(get('cluster')) : null

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <h1 className="display-md">Claims database</h1>
          <p className="text-[14px] text-ink-mute">Every report received. Senders appear only as the first 8 characters of a keyed hash.</p>
        </div>
        <p className="text-[14px] font-semibold tabular-nums">
          {rows.length} of {claims.length} claims
        </p>
      </div>

      <div className="card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_repeat(5,1fr)]">
          <div>
            <label htmlFor="q" className="field-label">
              Search
            </label>
            <input id="q" type="search" className="field" placeholder="Claim text or ticket, e.g. SH-4F2A" value={get('q')} onChange={(e) => set('q', e.target.value)} />
          </div>
          <Filter id="status" label="Status" value={get('status')} onChange={(v) => set('status', v)} options={Object.entries(STATUS_NAME)} />
          <Filter id="lang" label="Language" value={get('lang')} onChange={(v) => set('lang', v)} options={Object.entries(LANG_NAME)} />
          <Filter id="label" label="AI label" value={get('label')} onChange={(v) => set('label', v)} options={Object.entries(LABEL_NAME)} />
          <div>
            <label htmlFor="from" className="field-label">
              From
            </label>
            <input id="from" type="date" className="field" value={get('from')} onChange={(e) => set('from', e.target.value)} />
          </div>
          <div>
            <label htmlFor="to" className="field-label">
              To
            </label>
            <input id="to" type="date" className="field" value={get('to')} onChange={(e) => set('to', e.target.value)} />
          </div>
        </div>
        {(filtered || clusterFilter) && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px]">
            {clusterFilter && (
              <span className="rounded-full bg-gold-cream px-3 py-1">
                Cluster: <b>{clusterFilter.canonical_text_en.slice(0, 60)}</b>
              </span>
            )}
            <button type="button" className="min-h-[44px] font-semibold text-link underline" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-6 text-ink-mute">Loading claims…</p>
        ) : rows.length === 0 ? (
          <Empty title={filtered ? 'No claims match these filters' : 'No claims yet'}>{filtered ? 'Try clearing a filter.' : 'Reports from WhatsApp and the web checker will appear here.'}</Empty>
        ) : (
          <Table label="Claims" minWidth={1040}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Claim (English)</th>
                <th>Language</th>
                <th className="text-right">Cluster</th>
                <th>AI label</th>
                <th>Status</th>
                <th>First seen</th>
                <th>Last seen</th>
                <th>Sender</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((c) => {
                const cluster = c.cluster_id ? clusterById.get(c.cluster_id) : undefined
                return (
                  <tr key={c.id} className="row-link" onClick={() => navigate(`/newsroom/claims/${c.id}`)}>
                    <td className="mono whitespace-nowrap">
                      <a href={`/newsroom/claims/${c.id}`} onClick={(e) => e.preventDefault()} className="text-ink no-underline">
                        {ticketFor(c.id)}
                      </a>
                    </td>
                    <td className="min-w-[260px] max-w-[380px]">
                      <span className="line-clamp-2">{c.text_en ?? c.original_text ?? <i className="text-ink-mute">Processing…</i>}</span>
                      {c.is_demo && (
                        <span className="mt-1 inline-block">
                          <DemoTag />
                        </span>
                      )}
                    </td>
                    <td>
                      <LangChip lang={c.original_language} />
                    </td>
                    <td className="text-right font-bold tabular-nums">{cluster?.report_count ?? '–'}</td>
                    <td>
                      <LabelBadge label={c.ai_label} size="sm" />
                    </td>
                    <td>
                      <StatusPill status={c.status} />
                    </td>
                    <td className="whitespace-nowrap text-ink-mute" title={dateTime(cluster?.first_seen ?? c.received_at)}>
                      {timeAgo(cluster?.first_seen ?? c.received_at)}
                    </td>
                    <td className="whitespace-nowrap text-ink-mute" title={dateTime(cluster?.last_seen ?? c.received_at)}>
                      {timeAgo(cluster?.last_seen ?? c.received_at)}
                    </td>
                    <td className="mono text-ink-mute" title="Keyed hash of the sender. The phone number is never stored here.">
                      {c.sender_hash ? `${c.sender_hash.slice(0, 8)}…` : '–'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </div>
      {rows.length > limit && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, rows.length - limit)} more
          </Button>
        </div>
      )}
    </div>
  )
}
