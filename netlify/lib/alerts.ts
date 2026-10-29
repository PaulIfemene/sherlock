// Stage 7: rising-claim email to journalists, logged in `alerts`. Store-only, like publish.
import type { ServerDeps } from '../../engine/adapters'

const LANG_NAME: Record<string, string> = { eng: 'English', lug: 'Luganda', swa: 'Kiswahili' }

export async function sendRisingAlert(deps: ServerDeps, clusterId: string, count: number, origin: string): Promise<void> {
  const { store, log } = deps
  const [cluster, to, claims] = await Promise.all([store.getCluster(clusterId), store.alertRecipients(), store.claimsInCluster(clusterId)])
  if (!cluster) return
  const first = claims[0]
  const v = await store.clusterVelocity(clusterId, deps.now())
  const isDemo = cluster.is_demo || cluster.simulated_reports > 0
  let delivery: 'sent' | 'simulated' | 'failed' = deps.mailer.live ? 'sent' : 'simulated'
  let error: string | null = null
  if (to.length === 0) {
    delivery = 'failed'
    error = 'no recipients: turn on alerts for a journalist or add an email in Settings'
  } else {
    try {
      await deps.mailer.sendRisingAlert(to, {
        claimText: cluster.canonical_text_en,
        count,
        delta: Math.max(0, v.lastHour - v.prevHour),
        language: LANG_NAME[first?.original_language ?? 'eng'] ?? 'English',
        dashboardUrl: first ? `${origin}/newsroom/claims/${first.id}` : `${origin}/newsroom`,
        isDemo,
      })
    } catch (err) {
      delivery = 'failed'
      error = (err as Error).message.slice(0, 300)
      log.error({ stage: 'newsroom', event: 'alert_email_failed', cluster_id: clusterId, message: error })
    }
  }
  await store.logAlert({ cluster_id: clusterId, sent_to: to, delivery, error, is_demo: isDemo })
  await store.addEvent({
    cluster_id: clusterId,
    kind: 'alert',
    detail: `Rising-claim email ${delivery === 'simulated' ? 'simulated (SMTP not configured)' : delivery} to ${to.length} recipient(s) at ${count} reports.`,
  })
}
