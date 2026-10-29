import { useMemo } from 'react'
import { Link } from 'react-router'
import { useNewsroom } from '../../lib/newsroom'
import { clusterStats, kpis, rankByVelocity } from '../../lib/derive'
import { duration } from '../../lib/format'
import { Kpi } from '../../components/Kpi'
import { Panel } from '../../components/Card'
import { LangChip } from '../../components/Pill'
import { Sparkline } from '../../components/Sparkline'

// M1 overview: KPIs and the rising board from seeded data. M3 adds the live feed and simulate.
export default function Overview() {
  const { clusters, counts, claims, verdicts, threshold, loading } = useNewsroom()
  const stats = useMemo(() => rankByVelocity(clusterStats(clusters, counts, claims, verdicts, threshold)), [clusters, counts, claims, verdicts, threshold])
  const k = useMemo(() => kpis(stats, counts, verdicts), [stats, counts, verdicts])
  if (loading) return <p className="text-ink-mute">Loading…</p>
  return (
    <div className="space-y-6">
      <h1 className="display-md">Overview</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Reports this week" value={k.reportsThisWeek} />
        <Kpi label="Rising now" value={k.risingNow} tone="gold" />
        <Kpi label="Open cases" value={k.openCases} />
        <Kpi label="Published" value={k.published} />
        <Kpi label="Median to verdict" value={duration(k.medianToVerdictMs)} />
      </div>
      <Panel title="Rising claims" subtitle={`Ranked by velocity · rising at ${threshold}+ reports`}>
        <ol>
          {stats.map((s) => (
            <li key={s.cluster.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-5 py-3 last:border-0">
              <span className="min-w-0 basis-full font-medium md:basis-0 md:flex-1 md:truncate">
                <Link to={`/newsroom/claims?cluster=${s.cluster.id}`} className="text-ink no-underline hover:underline">
                  {s.cluster.canonical_text_en}
                </Link>
              </span>
              <LangChip lang={s.language} />
              <span className="w-10 text-right font-bold tabular-nums">{s.cluster.report_count}</span>
              <Sparkline values={s.spark} rising={s.rising} width={96} />
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  )
}
