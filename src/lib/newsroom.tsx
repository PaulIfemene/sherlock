// Newsroom state: journalist session, initial load, Supabase Realtime, and actions. Falls back to
// the offline demo dataset when Supabase is not configured.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { api, type DeliveryCounts, type IntegrationStatus } from './api'
import { buildOfflineData } from './offline'
import type { Alert, Claim, Cluster, CountPoint, EventRow, Journalist, Outbound, Source, Verdict } from './types'

const BUCKET_MS = 5 * 60 * 1000
const CLAIM_COLUMNS = 'id,cluster_id,sender_hash,channel,original_text,original_language,text_en,image_path,ocr_text,ai_label,ai_confidence,ai_rationale,evidence,status,progress,received_at,is_demo'
const CLUSTER_COLUMNS = 'id,canonical_text_en,report_count,simulated_reports,first_seen,last_seen,status,is_demo'

export interface PublishInput {
  cluster_id: string
  label: string
  explanation_en: string
  explanation_lug?: string | null
  explanation_swa?: string | null
  source_url?: string | null
}

interface NewsroomState {
  offline: boolean
  loading: boolean
  error: string | null
  live: boolean
  clusters: Cluster[]
  claims: Claim[]
  counts: CountPoint[]
  verdicts: Verdict[]
  alerts: Alert[]
  sources: Source[]
  outbound: Outbound[]
  events: EventRow[]
  threshold: number
  status: IntegrationStatus | null
  freshClaimIds: Set<string>
  journalist: Journalist | null
  simulate(clusterId: string, target?: number): Promise<{ from: number; to: number }>
  publish(input: PublishInput): Promise<DeliveryCounts>
  refresh(): Promise<void>
  setThreshold(n: number): Promise<void>
  saveSource(s: Partial<Source> & { name: string; url: string }): Promise<void>
  loadEvents(clusterId: string): Promise<EventRow[]>
}

const Ctx = createContext<NewsroomState | null>(null)

// oxlint-disable-next-line react/only-export-components
export function useNewsroom(): NewsroomState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNewsroom outside NewsroomProvider')
  return v
}

/** Supabase session and journalist row. `undefined` while loading. */
// oxlint-disable-next-line react/only-export-components
export function useJournalistSession() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  const [journalist, setJournalist] = useState<Journalist | null | undefined>(supabase ? undefined : null)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase || session === undefined) return
    if (!session) {
      setJournalist(null)
      return
    }
    setJournalist(undefined)
    supabase
      .from('journalists')
      .select('id,display_name,newsroom,email,receives_alerts')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setJournalist((data as Journalist | null) ?? null))
  }, [session])
  return { session, journalist }
}

function upsert<T extends { id: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id)
  if (i === -1) return [row, ...list]
  const next = [...list]
  next[i] = { ...next[i], ...row }
  return next
}

export function NewsroomProvider({ journalist, children }: { journalist: Journalist | null; children: ReactNode }) {
  const offline = supabase === null
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [counts, setCounts] = useState<CountPoint[]>([])
  const [verdicts, setVerdicts] = useState<Verdict[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [outbound, setOutbound] = useState<Outbound[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [threshold, setThresholdState] = useState(20)
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [freshClaimIds, setFresh] = useState<Set<string>>(new Set())
  const offlineEvents = useRef<EventRow[]>([])

  const markFresh = useCallback((id: string) => {
    setFresh((s) => new Set(s).add(id))
    setTimeout(() => setFresh((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    }), 3000)
  }, [])

  const refresh = useCallback(async () => {
    setError(null)
    if (!supabase) {
      const d = buildOfflineData()
      setClusters(d.clusters)
      setClaims(d.claims)
      setCounts(d.counts)
      setVerdicts(d.verdicts)
      setAlerts(d.alerts)
      setSources(d.sources)
      setEvents(d.events)
      offlineEvents.current = d.events
      setLoading(false)
      return
    }
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
    const [cl, cm, ct, vd, al, so, ob, st] = await Promise.all([
      supabase.from('clusters').select(CLUSTER_COLUMNS).order('last_seen', { ascending: false }).limit(300),
      supabase.from('claims').select(CLAIM_COLUMNS).order('received_at', { ascending: false }).limit(1000),
      supabase.from('cluster_counts').select('cluster_id,bucket,count').gte('bucket', since).limit(10000),
      supabase.from('verdicts').select('*').order('published_at', { ascending: false }),
      supabase.from('alerts').select('*').order('sent_at', { ascending: false }).limit(200),
      supabase.from('sources').select('*').order('name'),
      supabase.from('outbound_queue').select('id,claim_id,status').limit(5000),
      supabase.from('settings').select('key,value'),
    ])
    const firstError = [cl, cm, ct, vd, al, so, ob, st].find((r) => r.error)?.error
    if (firstError) setError(firstError.message)
    setClusters((cl.data as Cluster[]) ?? [])
    setClaims((cm.data as Claim[]) ?? [])
    setCounts((ct.data as CountPoint[]) ?? [])
    setVerdicts((vd.data as Verdict[]) ?? [])
    setAlerts((al.data as Alert[]) ?? [])
    setSources((so.data as Source[]) ?? [])
    setOutbound((ob.data as Outbound[]) ?? [])
    const t = Number((st.data ?? []).find((r) => r.key === 'rising_threshold')?.value)
    if (Number.isFinite(t) && t > 0) setThresholdState(t)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    api.status().then(setStatus).catch(() => setStatus(null))
  }, [refresh])

  // Realtime: apply row changes as they happen.
  useEffect(() => {
    if (!supabase) return
    const db = supabase
    const channel = db
      .channel('newsroom-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clusters' }, (p) => {
        if (p.eventType === 'DELETE') setClusters((l) => l.filter((c) => c.id !== (p.old as Cluster).id))
        else {
          const { embedding: _e, ...row } = p.new as Cluster & { embedding?: unknown }
          setClusters((l) => upsert(l, row as Cluster))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, (p) => {
        if (p.eventType === 'DELETE') return setClaims((l) => l.filter((c) => c.id !== (p.old as Claim).id))
        const row = p.new as Claim
        setClaims((l) => upsert(l, row))
        if (p.eventType === 'INSERT') markFresh(row.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cluster_counts' }, (p) => {
        if (p.eventType === 'DELETE') return
        const row = p.new as CountPoint
        setCounts((l) => [...l.filter((c) => !(c.cluster_id === row.cluster_id && c.bucket === row.bucket)), row])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'verdicts' }, (p) => p.eventType !== 'DELETE' && setVerdicts((l) => upsert(l, p.new as Verdict)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (p) => setAlerts((l) => upsert(l, p.new as Alert)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outbound_queue' }, (p) => p.eventType !== 'DELETE' && setOutbound((l) => upsert(l, p.new as Outbound)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sources' }, (p) => p.eventType !== 'DELETE' && setSources((l) => upsert(l, p.new as Source)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (p) => setEvents((l) => upsert(l, p.new as EventRow)))
      .subscribe((s) => setLive(s === 'SUBSCRIBED'))
    return () => {
      db.removeChannel(channel)
    }
  }, [markFresh])

  const addOfflineEvent = useCallback((e: Omit<EventRow, 'id' | 'created_at'>) => {
    const row = { ...e, id: crypto.randomUUID(), created_at: new Date().toISOString() }
    offlineEvents.current = [row, ...offlineEvents.current]
    setEvents(offlineEvents.current)
  }, [])

  const simulate = useCallback(
    async (clusterId: string, target = 100) => {
      if (supabase) return api.simulate(clusterId, target)
      // Offline: same ease-in climb, all counted as simulated.
      const start = clusters.find((c) => c.id === clusterId)?.report_count ?? 0
      let current = start
      for (let i = 1; i <= 12; i++) {
        const next = Math.round(start + (target - start) * (i / 12) ** 1.6)
        const by = next - current
        current = next
        const bucket = new Date(Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS).toISOString()
        setClusters((l) => l.map((c) => (c.id === clusterId ? { ...c, report_count: c.report_count + by, simulated_reports: c.simulated_reports + by, last_seen: new Date().toISOString() } : c)))
        setCounts((l) => {
          const hit = l.find((p) => p.cluster_id === clusterId && p.bucket === bucket)
          return hit ? l.map((p) => (p === hit ? { ...p, count: p.count + by } : p)) : [...l, { cluster_id: clusterId, bucket, count: by }]
        })
        if (start < threshold && current >= threshold && current - by < threshold) {
          setAlerts((l) => [{ id: crypto.randomUUID(), cluster_id: clusterId, sent_to: ['demo.reporter@example.org'], sent_at: new Date().toISOString(), delivery: 'simulated', error: null, is_demo: true }, ...l])
        }
        await new Promise((r) => setTimeout(r, 450))
      }
      addOfflineEvent({ cluster_id: clusterId, claim_id: null, kind: 'simulated', detail: `Simulated spread (demo): ${start} to ${current} reports.`, actor: 'Demo Reporter' })
      return { from: start, to: current }
    },
    [clusters, threshold, addOfflineEvent],
  )

  const publish = useCallback(
    async (input: PublishInput): Promise<DeliveryCounts> => {
      if (supabase) {
        const r = await api.publish(input)
        await refresh()
        return r.delivery
      }
      const verdict: Verdict = {
        id: crypto.randomUUID(),
        cluster_id: input.cluster_id,
        label: input.label as Verdict['label'],
        explanation_en: input.explanation_en,
        explanation_lug: input.explanation_lug ?? null,
        explanation_swa: input.explanation_swa ?? null,
        source_url: input.source_url ?? null,
        journalist_id: null,
        published_at: new Date().toISOString(),
      }
      setVerdicts((l) => [verdict, ...l.filter((v) => v.cluster_id !== input.cluster_id)])
      setClusters((l) => l.map((c) => (c.id === input.cluster_id ? { ...c, status: 'published' } : c)))
      const affected = claims.filter((c) => c.cluster_id === input.cluster_id)
      setClaims((l) => l.map((c) => (c.cluster_id === input.cluster_id ? { ...c, status: 'published' } : c)))
      addOfflineEvent({ cluster_id: input.cluster_id, claim_id: null, kind: 'published', detail: `Verdict published: ${input.label}. Offline demo, nothing sent.`, actor: 'Demo Reporter' })
      return { sent: 0, simulated: affected.length, needs_template: 0, failed: 0, web: 0 }
    },
    [claims, refresh, addOfflineEvent],
  )

  const setThreshold = useCallback(async (n: number) => {
    setThresholdState(n)
    if (supabase) {
      const { error: e } = await supabase.from('settings').update({ value: n, updated_at: new Date().toISOString() }).eq('key', 'rising_threshold')
      if (e) throw new Error(e.message)
    }
  }, [])

  const saveSource = useCallback(async (s: Partial<Source> & { name: string; url: string }) => {
    if (!supabase) {
      setSources((l) => upsert(l, { id: s.id ?? crypto.randomUUID(), kind: 'page', selector: null, interval_minutes: 60, trusted_because: null, enabled: false, last_success_at: null, last_error: null, last_checked_at: null, ...s } as Source))
      return
    }
    const { id, ...fields } = s
    const res = id ? await supabase.from('sources').update(fields).eq('id', id).select('*').single() : await supabase.from('sources').insert(fields).select('*').single()
    if (res.error) throw new Error(res.error.message)
    setSources((l) => upsert(l, res.data as Source))
  }, [])

  const loadEvents = useCallback(
    async (clusterId: string) => {
      if (!supabase) return offlineEvents.current.filter((e) => e.cluster_id === clusterId)
      const { data } = await supabase.from('events').select('*').eq('cluster_id', clusterId).order('created_at', { ascending: false }).limit(100)
      return (data as EventRow[]) ?? []
    },
    [],
  )

  const value = useMemo<NewsroomState>(
    () => ({ offline, loading, error, live, clusters, claims, counts, verdicts, alerts, sources, outbound, events, threshold, status, freshClaimIds, journalist, simulate, publish, refresh, setThreshold, saveSource, loadEvents }),
    [offline, loading, error, live, clusters, claims, counts, verdicts, alerts, sources, outbound, events, threshold, status, freshClaimIds, journalist, simulate, publish, refresh, setThreshold, saveSource, loadEvents],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

