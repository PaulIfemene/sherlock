import { useMemo } from 'react'
import { useNewsroom } from '../../lib/newsroom'
import { dateTime, timeAgo } from '../../lib/format'
import { Table } from '../../components/Table'
import { Empty, Panel } from '../../components/Card'
import { DemoTag } from '../../components/Pill'

const DELIVERY: Record<string, string> = { sent: 'Sent', simulated: 'Simulated (SMTP off)', failed: 'Failed' }

export default function Alerts() {
  const { alerts, clusters, outbound } = useNewsroom()
  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters])
  const delivery = outbound.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }), {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-md">Alerts</h1>
        <p className="text-[14px] text-ink-mute">Rising-claim emails sent to the desk, and delivery of published verdicts back to the public.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Verdict messages sent', delivery.sent ?? 0],
          ['Need a WhatsApp template', delivery.needs_template ?? 0],
          ['Failed', delivery.failed ?? 0],
          ['Pending', delivery.pending ?? 0],
        ].map(([label, n]) => (
          <div key={label} className={`rounded-[16px] border p-4 ${label === 'Need a WhatsApp template' && Number(n) > 0 ? 'border-gold bg-gold-cream' : 'border-hairline bg-white'}`}>
            <dt className="text-[13px] text-ink-mute">{label}</dt>
            <dd className="mt-1 text-[24px] font-bold tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>
      {(delivery.needs_template ?? 0) > 0 && (
        <p className="text-[14px]">Messages outside WhatsApp’s 24-hour window need a Meta-approved utility template before they can be sent.</p>
      )}

      <Panel title="Rising-claim emails" subtitle={`${alerts.length} sent`} className="overflow-hidden">
        {alerts.length === 0 ? (
          <Empty title="No alerts yet">An email goes to the desk when a claim crosses the rising threshold.</Empty>
        ) : (
          <Table label="Alerts" minWidth={860}>
            <thead>
              <tr>
                <th>Sent</th>
                <th>Claim</th>
                <th>Recipients</th>
                <th>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap" title={dateTime(a.sent_at)}>
                    {timeAgo(a.sent_at)}
                  </td>
                  <td className="max-w-[420px]">
                    {clusterById.get(a.cluster_id)?.canonical_text_en ?? 'Claim'}
                    {a.is_demo && (
                      <span className="ml-2">
                        <DemoTag />
                      </span>
                    )}
                  </td>
                  <td className="text-[13px]">
                    <b>{a.sent_to.length}</b>
                    <span className="block max-w-[240px] truncate text-ink-mute">{a.sent_to.join(', ')}</span>
                  </td>
                  <td>
                    <span className={`font-semibold ${a.delivery === 'failed' ? 'text-error' : ''}`}>{DELIVERY[a.delivery] ?? a.delivery}</span>
                    {a.error && <p className="max-w-[240px] text-[12px] text-error">{a.error}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
