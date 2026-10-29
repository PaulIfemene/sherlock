// Stage 7: rising-claim email to journalists, logged in `alerts`.
import type { ServerDeps } from '../../engine/adapters'

const LANG_NAME: Record<string, string> = { eng: 'English', lug: 'Luganda', swa: 'Kiswahili' }

export async function sendRisingAlert(deps: ServerDeps, clusterId: string, count: number, origin: string): Promise<void> {
  const db = deps.db
  if (!db) return
  const [{ data: cluster }, { data: journalists }, { data: extra }, { data: firstClaim }] = await Promise.all([
    db.from('clusters').select('canonical_text_en,is_demo,simulated_reports').eq('id', clusterId).single(),
    db.from('journalists').select('email').eq('receives_alerts', true),
    db.from('settings').select('value').eq('key', 'alert_emails').maybeSingle(),
    db.from('claims').select('id,original_language').eq('cluster_id', clusterId).order('received_at', { ascending: true }).limit(1).maybeSingle(),
  ])
  if (!cluster) return
  const extraEmails = Array.isArray(extra?.value) ? (extra.value as unknown[]).filter((e): e is string => typeof e === 'string') : []
  const to = [...new Set([...(journalists ?? []).map((j) => j.email as string), ...extraEmails])]
  const v = await deps.store.clusterVelocity(clusterId, deps.now())
  const isDemo = Boolean(cluster.is_demo) || (cluster.simulated_reports ?? 0) > 0
  const caseUrl = firstClaim ? `${origin}/newsroom/claims/${firstClaim.id}` : `${origin}/newsroom`
  let delivery: 'sent' | 'simulated' | 'failed' = deps.mailer.live ? 'sent' : 'simulated'
  let errorText: string | null = null
  try {
    await deps.mailer.sendRisingAlert(to, {
      claimText: cluster.canonical_text_en,
      count,
      delta: Math.max(0, v.lastHour - v.prevHour),
      language: LANG_NAME[firstClaim?.original_language ?? 'eng'] ?? 'English',
      dashboardUrl: caseUrl,
      isDemo,
    })
  } catch (err) {
    delivery = 'failed'
    errorText = (err as Error).message.slice(0, 300)
    deps.log.error({ stage: 'newsroom', event: 'alert_email_failed', cluster_id: clusterId, message: errorText })
  }
  await db.from('alerts').insert({ cluster_id: clusterId, sent_to: to, delivery, error: errorText, is_demo: isDemo })
  await deps.store.addEvent({
    cluster_id: clusterId,
    kind: 'alert',
    detail: `Rising-claim email ${delivery === 'simulated' ? 'simulated (SMTP not configured)' : delivery} to ${to.length} recipient(s) at ${count} reports.`,
  })
}
