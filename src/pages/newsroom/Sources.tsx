import { useState, type FormEvent } from 'react'
import { useNewsroom } from '../../lib/newsroom'
import { api } from '../../lib/api'
import { hostOf, timeAgo } from '../../lib/format'
import { useNow } from '../../lib/hooks'
import type { Source } from '../../lib/types'
import { Table } from '../../components/Table'
import { Drawer } from '../../components/Drawer'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'

type Health = 'healthy' | 'stale' | 'broken' | 'unchecked' | 'disabled'

function health(s: Source, now: number): Health {
  if (!s.enabled) return 'disabled'
  if (s.last_error) return 'broken'
  if (!s.last_success_at) return 'unchecked'
  return now - new Date(s.last_success_at).getTime() <= s.interval_minutes * 2 * 60_000 ? 'healthy' : 'stale'
}

const HEALTH: Record<Health, { label: string; dot: string }> = {
  healthy: { label: 'Healthy', dot: 'bg-success' },
  stale: { label: 'Stale', dot: 'bg-gold' },
  broken: { label: 'Broken', dot: 'bg-error' },
  unchecked: { label: 'Not checked yet', dot: 'bg-[#9a9a9a]' },
  disabled: { label: 'Disabled', dot: 'border border-ink/40 bg-white' },
}

const EMPTY: Partial<Source> = { name: '', url: '', kind: 'page', selector: 'a', interval_minutes: 60, trusted_because: '', enabled: false }

function SourceForm({ initial, onDone }: { initial: Partial<Source>; onDone: () => void }) {
  const { saveSource } = useNewsroom()
  const toast = useToast()
  const [s, setS] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Source>(k: K, v: Source[K]) => setS((x) => ({ ...x, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!s.name?.trim()) return setError('Give the source a name.')
    if (!/^https?:\/\/\S+$/.test(s.url ?? '')) return setError('Enter the full URL, starting with https://')
    setSaving(true)
    try {
      await saveSource({ ...s, name: s.name.trim(), url: (s.url ?? '').trim() } as Source)
      toast(initial.id ? 'Source updated.' : 'Source added.', 'success')
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="source-form" onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="sn" className="field-label">
          Name
        </label>
        <input id="sn" className="field" value={s.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Ministry of …" />
      </div>
      <div>
        <label htmlFor="su" className="field-label">
          URL
        </label>
        <input id="su" type="url" className="field" value={s.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="https://…/press-releases" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="sk" className="field-label">
            Type
          </label>
          <select id="sk" className="field" value={s.kind} onChange={(e) => set('kind', e.target.value as Source['kind'])}>
            <option value="rss">RSS feed</option>
            <option value="page">Web page</option>
          </select>
        </div>
        <div>
          <label htmlFor="si" className="field-label">
            Check every (minutes)
          </label>
          <input id="si" type="number" min={15} max={1440} className="field" value={s.interval_minutes ?? 60} onChange={(e) => set('interval_minutes', Number(e.target.value))} />
        </div>
      </div>
      {s.kind === 'page' && (
        <div>
          <label htmlFor="ss" className="field-label">
            CSS selector for item links
          </label>
          <input id="ss" className="field mono" value={s.selector ?? ''} onChange={(e) => set('selector', e.target.value)} placeholder=".news-list a" />
          <p className="mt-1 text-[12px] text-ink-mute">Pick the links to press releases or notices. “a” takes every link on the page.</p>
        </div>
      )}
      <div>
        <label htmlFor="st" className="field-label">
          Why trusted
        </label>
        <textarea id="st" rows={3} className="field" value={s.trusted_because ?? ''} onChange={(e) => set('trusted_because', e.target.value)} placeholder="Official body responsible for …" />
      </div>
      <label className="flex min-h-[44px] items-center gap-3">
        <input type="checkbox" checked={Boolean(s.enabled)} onChange={(e) => set('enabled', e.target.checked)} className="h-5 w-5 accent-[#181818]" />
        <span>
          <span className="font-semibold">Enabled</span>
          <span className="block text-[13px] text-ink-mute">Check the site’s robots.txt and terms before enabling.</span>
        </span>
      </label>
      {error && (
        <p role="alert" className="text-[14px] font-medium text-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? 'Saving…' : initial.id ? 'Save changes' : 'Add source'}
      </Button>
    </form>
  )
}

export default function Sources() {
  const { sources, saveSource, offline } = useNewsroom()
  const toast = useToast()
  const now = useNow(60000)
  const [editing, setEditing] = useState<Partial<Source> | null>(null)
  const [checking, setChecking] = useState<string | null>(null)
  const counts = sources.reduce<Record<Health, number>>((acc, s) => ({ ...acc, [health(s, now)]: acc[health(s, now)] + 1 }), { healthy: 0, stale: 0, broken: 0, unchecked: 0, disabled: 0 })

  async function toggle(s: Source) {
    try {
      await saveSource({ ...s, enabled: !s.enabled })
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  async function checkNow(s: Source) {
    if (offline) return toast('Checking a source needs the server and Supabase (offline demo).', 'info')
    setChecking(s.id)
    try {
      const r = await api.scrapeSource(s.id)
      toast(r.ok ? `${s.name}: ${r.items} items fetched.` : `${s.name}: ${r.error}`, r.ok ? 'success' : 'error')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setChecking(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="display-md">Official sources</h1>
          <p className="max-w-2xl text-[14px] text-ink-mute">The registry Sherlock watches for notices and statements. Every source says why it is trusted, so the list can be published and challenged.</p>
        </div>
        <Button onClick={() => setEditing(EMPTY)}>Add source</Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(Object.keys(HEALTH) as Health[]).map((h) => (
          <div key={h} className="card p-4">
            <dt className="flex items-center gap-2 text-[13px] text-ink-mute">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${HEALTH[h].dot}`} />
              {HEALTH[h].label}
            </dt>
            <dd className="mt-1 text-[24px] font-bold tabular-nums">{counts[h]}</dd>
          </div>
        ))}
      </dl>

      <div className="card overflow-hidden">
        <Table label="Official sources" minWidth={1100}>
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th>Selector</th>
              <th>Interval</th>
              <th>Last success</th>
              <th>Status</th>
              <th>Why trusted</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const h = health(s, now)
              return (
                <tr key={s.id}>
                  <td className="min-w-[200px]">
                    <p className="font-semibold">{s.name}</p>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[13px]">
                      {hostOf(s.url)}
                    </a>
                  </td>
                  <td className="uppercase text-[12px] font-bold tracking-[.06em]">{s.kind}</td>
                  <td className="mono text-ink-mute">{s.kind === 'page' ? s.selector || '–' : '–'}</td>
                  <td className="whitespace-nowrap">{s.interval_minutes} min</td>
                  <td className="whitespace-nowrap text-ink-mute">{s.last_success_at ? timeAgo(s.last_success_at) : 'Never'}</td>
                  <td>
                    <span className="inline-flex items-center gap-2 whitespace-nowrap font-semibold">
                      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${HEALTH[h].dot}`} />
                      {HEALTH[h].label}
                    </span>
                    {s.last_error && <p className="mt-1 max-w-[220px] text-[12px] text-error">{s.last_error}</p>}
                  </td>
                  <td className="max-w-[300px] text-[13px] text-ink-mute">{s.trusted_because}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(s)}>
                        {s.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => checkNow(s)} disabled={checking === s.id || !s.enabled}>
                        {checking === s.id ? 'Checking…' : 'Check now'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </div>
      <p className="text-[13px] text-ink-mute">Proposed sources are seeded disabled. Enable each one only after checking its robots.txt and terms of use.</p>

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit source' : 'Add source'}>
        {editing && <SourceForm key={editing.id ?? 'new'} initial={editing} onDone={() => setEditing(null)} />}
      </Drawer>
    </div>
  )
}
