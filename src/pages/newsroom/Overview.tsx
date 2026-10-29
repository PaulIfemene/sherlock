import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNewsroom } from '../../lib/newsroom'
import { kpis, type ClusterStats } from '../../lib/derive'
import { useClusterStats, useDemoMode, useNow } from '../../lib/hooks'
import { duration, timeAgo } from '../../lib/format'
import { Kpi } from '../../components/Kpi'
import { Empty, Panel, Skeleton } from '../../components/Card'
import { DemoTag, LabelBadge, LangChip } from '../../components/Pill'
import { Sparkline } from '../../components/Sparkline'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'

const BUCKET_MS = 5 * 60 * 1000

/** First claim of each cluster, so board rows can open a case. */
function useCaseLinks() {
  const { claims } = useNewsroom()
  return useMemo(() => {
    const m = new Map<string, string>()
    for (const c of [...claims].sort((a, b) => a.received_at.localeCompare(b.received_at))) if (c.cluster_id && !m.has(c.cluster_id)) m.set(c.cluster_id, c.id)
    return m
  }, [claims])
}

function Delta({ s }: { s: ClusterStats }) {
  if (s.delta > 0) return <span className={`whitespace-nowrap text-[13px] font-bold tabular-nums ${s.rising ? 'text-success' : 'text-ink'}`}>▲ +{s.delta}</span>
  if (s.delta < 0) return <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-ink-mute">▼ {s.delta}</span>
  return <span className="text-[13px] text-ink-mute">–</span>
}

function RisingBoard({ stats }: { stats: ClusterStats[] }) {
  const links = useCaseLinks()
  const navigate = useNavigate()
  const { threshold } = useNewsroom()
  const open = (s: ClusterStats) => {
    const id = links.get(s.cluster.id)
    if (id) navigate(`/newsroom/claims/${id}`)
  }
  return (
    <Panel title="Rising claims" subtitle={`Ranked by velocity · rising at ${threshold}+ reports and climbing`} className="min-w-0 overflow-hidden">
      {stats.length === 0 ? (
        <Empty title="No claims yet">When people send claims on WhatsApp or the web checker, they appear here grouped by topic.</Empty>
      ) : (
        <ol>
          {stats.slice(0, 10).map((s, i) => (
            <li key={s.cluster.id}>
              <button
                type="button"
                onClick={() => open(s)}
                className={`grid w-full grid-cols-[24px_1fr] items-center gap-x-3 gap-y-2 border-b border-hairline px-5 py-4 text-left last:border-0 hover:bg-gold-cream md:grid-cols-[24px_1fr_auto_56px_96px_64px] ${s.rising ? 'bg-gold-cream/60' : ''}`}
              >
                <span className="mono text-ink-mute">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block font-medium leading-snug">{s.cluster.canonical_text_en}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-mute">
                    {s.rising && <span className="rounded-full bg-gold px-2 py-0.5 font-bold uppercase tracking-[.06em] text-ink">Rising</span>}
                    {s.verdict ? <LabelBadge label={s.verdict.label} size="sm" /> : <span>Open case</span>}
                    <span>· last report {timeAgo(s.cluster.last_seen)}</span>
                    {s.cluster.simulated_reports > 0 && <DemoTag>{`${s.cluster.simulated_reports} simulated`}</DemoTag>}
                    {s.cluster.is_demo && <DemoTag />}
                  </span>
                </span>
                <span className="col-start-2 flex items-center gap-3 md:col-start-auto md:contents">
                  <LangChip lang={s.language} />
                  <span className="text-right text-[20px] font-bold tabular-nums" aria-label={`${s.cluster.report_count} reports`}>
                    {s.cluster.report_count}
                  </span>
                  <Sparkline values={s.spark} rising={s.rising} width={96} height={30} label={`Report trend for this claim, now ${s.cluster.report_count}`} />
                  <span className="text-right">
                    <Delta s={s} />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function LiveFeed() {
  const { claims, freshClaimIds, live, offline } = useNewsroom()
  useNow(30000)
  const latest = useMemo(() => [...claims].sort((a, b) => b.received_at.localeCompare(a.received_at)).slice(0, 10), [claims])
  return (
    <Panel
      title="Live feed"
      subtitle="Newest reports first"
      action={
        <span className="inline-flex items-center gap-2 text-[12px] font-semibold">
          <span className={`h-2 w-2 rounded-full ${live ? 'live-dot bg-success' : 'bg-[#9a9a9a]'}`} aria-hidden />
          {live ? 'Live' : offline ? 'Local' : 'Connecting'}
        </span>
      }
    >
      {latest.length === 0 ? (
        <Empty title="Waiting for reports" />
      ) : (
        <ul>
          {latest.map((c) => (
            <li key={c.id} className={freshClaimIds.has(c.id) ? 'row-new' : ''}>
              <Link to={`/newsroom/claims/${c.id}`} className="block border-b border-hairline px-5 py-3 text-ink no-underline last:border-0 hover:bg-gold-cream">
                <span className="flex items-center gap-2 text-[12px] text-ink-mute">
                  <LangChip lang={c.original_language} />
                  <span>{c.channel === 'whatsapp' ? 'WhatsApp' : 'Web'}</span>
                  <span>·</span>
                  <span>{timeAgo(c.received_at)}</span>
                  {c.progress !== 'done' && c.progress !== 'failed' && <span className="font-semibold text-ink">· checking…</span>}
                </span>
                <span className="mt-1 line-clamp-2 block text-[14px] leading-snug">{c.text_en ?? c.original_text ?? 'Image report'}</span>
                <span className="mt-2 block">
                  <LabelBadge label={c.ai_label} size="sm" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function ReportsChart() {
  const { counts } = useNewsroom()
  const now = useNow(60000)
  const data = useMemo(() => {
    const end = Math.floor(now / BUCKET_MS) * BUCKET_MS
    const rows = Array.from({ length: 24 }, (_, i) => {
      const t = end - (23 - i) * BUCKET_MS
      return { t, label: new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), reports: 0 }
    })
    for (const p of counts) {
      const idx = 23 - Math.round((end - new Date(p.bucket).getTime()) / BUCKET_MS)
      if (idx >= 0 && idx < 24) rows[idx].reports += p.count
    }
    return rows
  }, [counts, now])
  return (
    <Panel title="Reports, last 2 hours" subtitle="All claims, per 5 minutes" className="min-w-0">
      <div className="h-[200px] px-2 py-4" role="img" aria-label={`Bar chart of reports per 5 minutes. Latest bucket: ${data[23].reports} reports.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#e6e6e6' }} tick={{ fontSize: 11, fill: '#5f5f5f' }} interval={5} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#5f5f5f' }} width={40} />
            <Tooltip cursor={{ fill: '#fbf6e6' }} contentStyle={{ borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 13 }} formatter={(v) => [v, 'Reports']} />
            <Bar dataKey="reports" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.t} fill={i === data.length - 1 ? '#e0b008' : '#181818'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

function ReviewQueue({ stats }: { stats: ClusterStats[] }) {
  const links = useCaseLinks()
  const queue = stats.filter((s) => s.cluster.status === 'open').sort((a, b) => b.cluster.report_count - a.cluster.report_count)
  return (
    <Panel title="Needs a verdict" subtitle={`${queue.length} open case${queue.length === 1 ? '' : 's'}, most reported first`}>
      {queue.length === 0 ? (
        <Empty title="Inbox zero">Every claim has a published verdict.</Empty>
      ) : (
        <ul>
          {queue.slice(0, 6).map((s) => (
            <li key={s.cluster.id} className="flex items-center gap-3 border-b border-hairline px-5 py-3 last:border-0">
              <span className="w-10 shrink-0 text-right font-bold tabular-nums">{s.cluster.report_count}</span>
              <span className="min-w-0 flex-1 truncate text-[14px]">{s.cluster.canonical_text_en}</span>
              {links.get(s.cluster.id) && (
                <Link to={`/newsroom/claims/${links.get(s.cluster.id)}`} className="shrink-0 text-[14px] font-semibold">
                  Review
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function SimulateControl({ stats }: { stats: ClusterStats[] }) {
  const { simulate } = useNewsroom()
  const toast = useToast()
  const open = useMemo(() => [...stats].filter((s) => s.cluster.status === 'open').sort((a, b) => b.cluster.last_seen.localeCompare(a.cluster.last_seen)), [stats])
  const [picked, setPicked] = useState<string>('')
  const [running, setRunning] = useState(false)
  const target = picked || open[0]?.cluster.id || ''
  if (open.length === 0) return null

  async function run() {
    setRunning(true)
    try {
      const r = await simulate(target, 100)
      toast(`Demo: simulated spread from ${r.from} to ${r.to} reports.`, 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-dashed border-ink/30 bg-white p-4 md:flex-row md:items-end">
      <div className="min-w-0 flex-1">
        <label htmlFor="sim-cluster" className="field-label">
          <span className="mr-2 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.08em]">Demo</span>
          Simulate spread on
        </label>
        <select id="sim-cluster" className="field" value={target} onChange={(e) => setPicked(e.target.value)} disabled={running}>
          {open.map((s) => (
            <option key={s.cluster.id} value={s.cluster.id}>
              {s.cluster.report_count} · {s.cluster.canonical_text_en.slice(0, 90)}
            </option>
          ))}
        </select>
      </div>
      <Button onClick={run} disabled={running || !target}>
        {running ? 'Simulating…' : 'Simulate spread (demo)'}
      </Button>
    </div>
  )
}

export default function Overview() {
  const { counts, verdicts, outbound, loading, journalist } = useNewsroom()
  const stats = useClusterStats()
  const demo = useDemoMode()
  const now = useNow(60000)
  const k = useMemo(() => kpis(stats, counts, verdicts), [stats, counts, verdicts])
  const needsTemplate = outbound.filter((o) => o.status === 'needs_template').length

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[108px]" />
          ))}
        </div>
        <Skeleton className="h-[420px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <p className="text-[14px] text-ink-mute">{new Date(now).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="display-md">Good to see you, {journalist?.display_name.split(' ')[0]}</h1>
        </div>
        {needsTemplate > 0 && (
          <Link to="/newsroom/alerts" className="text-[14px] font-semibold">
            {needsTemplate} verdict message{needsTemplate === 1 ? '' : 's'} need a WhatsApp template
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Reports this week" value={k.reportsThisWeek} hint="All channels" />
        <Kpi label="Rising now" value={k.risingNow} tone="gold" hint="Above threshold and climbing" />
        <Kpi label="Open cases" value={k.openCases} hint="Awaiting a verdict" />
        <Kpi label="Published" value={k.published} hint="Verified library" />
        <Kpi label="Median to verdict" value={duration(k.medianToVerdictMs)} hint="First report to publish" />
      </div>

      {demo && <SimulateControl stats={stats} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <RisingBoard stats={stats} />
        <LiveFeed />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <ReportsChart />
        <ReviewQueue stats={stats} />
      </div>
    </div>
  )
}
