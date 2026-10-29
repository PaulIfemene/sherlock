import { useEffect, useState, type FormEvent } from 'react'
import { useNewsroom } from '../../lib/newsroom'
import { supabase } from '../../lib/supabase'
import type { Journalist } from '../../lib/types'
import { OFFLINE_JOURNALIST } from '../../lib/offline'
import { Panel } from '../../components/Card'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'

const INTEGRATIONS: [keyof NonNullable<ReturnType<typeof useNewsroom>['status']>, string, string][] = [
  ['supabase', 'Supabase', 'Database, Realtime, sign-in'],
  ['whatsapp', 'WhatsApp', 'Receive and reply'],
  ['sunbird', 'Sunbird AI', 'Luganda and Kiswahili translation'],
  ['llm', 'LLM (Groq)', 'Claim extraction and assessment'],
  ['vision', 'Google Cloud Vision', 'Text in screenshots'],
  ['factcheck', 'Google Fact Check', 'Published fact-checks'],
  ['brave', 'Brave Search', 'Web evidence'],
  ['email', 'Gmail SMTP', 'Rising-claim alerts'],
  ['privacy_keys', 'Privacy keys', 'Sender hashing and encryption'],
]

export default function Settings() {
  const { threshold, setThreshold, offline, status, journalist } = useNewsroom()
  const toast = useToast()
  const [value, setValue] = useState(String(threshold))
  const [journalists, setJournalists] = useState<Journalist[]>(offline ? [OFFLINE_JOURNALIST] : [])
  const [invites, setInvites] = useState<{ email: string; display_name: string; newsroom: string }[]>([])
  const [extra, setExtra] = useState<string[]>([])
  const [newInvite, setNewInvite] = useState('')
  const [newExtra, setNewExtra] = useState('')

  useEffect(() => setValue(String(threshold)), [threshold])

  useEffect(() => {
    if (!supabase) return
    const db = supabase
    Promise.all([
      db.from('journalists').select('id,display_name,newsroom,email,receives_alerts').order('display_name'),
      db.from('journalist_invites').select('email,display_name,newsroom').order('created_at'),
      db.from('settings').select('value').eq('key', 'alert_emails').maybeSingle(),
    ]).then(([j, i, s]) => {
      setJournalists((j.data as Journalist[]) ?? [])
      setInvites(i.data ?? [])
      setExtra(Array.isArray(s.data?.value) ? (s.data.value as string[]) : [])
    })
  }, [])

  async function saveThreshold(e: FormEvent) {
    e.preventDefault()
    const n = Number(value)
    if (!Number.isInteger(n) || n < 2 || n > 10000) return toast('Use a whole number between 2 and 10,000.', 'error')
    try {
      await setThreshold(n)
      toast(`Rising threshold set to ${n} reports.`, 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  async function toggleAlerts(j: Journalist) {
    if (!supabase || j.id !== journalist?.id) return
    const { error } = await supabase.from('journalists').update({ receives_alerts: !j.receives_alerts }).eq('id', j.id)
    if (error) return toast(error.message, 'error')
    setJournalists((list) => list.map((x) => (x.id === j.id ? { ...x, receives_alerts: !x.receives_alerts } : x)))
  }

  async function saveExtra(next: string[]) {
    if (supabase) {
      const { error } = await supabase.from('settings').update({ value: next, updated_at: new Date().toISOString() }).eq('key', 'alert_emails')
      if (error) return toast(error.message, 'error')
    }
    setExtra(next)
  }

  async function invite(e: FormEvent) {
    e.preventDefault()
    const email = newInvite.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email.', 'error')
    if (supabase) {
      const { error } = await supabase.from('journalist_invites').upsert({ email })
      if (error) return toast(error.message, 'error')
    }
    setInvites((l) => [...l.filter((i) => i.email !== email), { email, display_name: 'Demo Reporter', newsroom: 'Sample Newsroom' }])
    setNewInvite('')
    toast(`${email} can now sign in with a magic link.`, 'success')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display-md">Settings</h1>
        <p className="text-[14px] text-ink-mute">Newsroom-wide settings. Changes apply to everyone on the desk.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Rising threshold" subtitle="A claim is “rising” at this many reports when the last hour beats the hour before.">
          <form onSubmit={saveThreshold} className="flex flex-wrap items-end gap-3 p-5">
            <div className="w-40">
              <label htmlFor="thr" className="field-label">
                Reports
              </label>
              <input id="thr" type="number" min={2} max={10000} className="field" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Panel>

        <Panel title="Integrations" subtitle={status?.demo_mode || offline ? 'Demo mode is on. Services without keys use labelled demo fallbacks.' : 'Live mode.'}>
          <ul className="grid gap-x-6 px-5 py-3 sm:grid-cols-2">
            {INTEGRATIONS.map(([key, name, what]) => {
              const on = Boolean(status?.[key])
              return (
                <li key={key} className="flex items-start gap-3 border-b border-hairline py-3">
                  <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${on ? 'bg-success' : 'bg-gold'}`} />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold">
                      {name} <span className="font-normal text-ink-mute">· {status ? (on ? 'Live' : 'Demo fallback') : 'Unknown'}</span>
                    </span>
                    <span className="block text-[13px] text-ink-mute">{what}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="Journalist accounts" subtitle="Signed-in journalists and pending invites.">
          <ul className="px-5 py-2">
            {journalists.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline py-3 last:border-0">
                <span>
                  <span className="block font-semibold">
                    {j.display_name}
                    {j.id === journalist?.id && <span className="font-normal text-ink-mute"> (you)</span>}
                  </span>
                  <span className="block text-[13px] text-ink-mute">
                    {j.newsroom} · {j.email}
                  </span>
                </span>
                <label className={`flex min-h-[44px] items-center gap-2 text-[14px] ${j.id === journalist?.id && !offline ? '' : 'opacity-60'}`}>
                  <input type="checkbox" className="h-5 w-5 accent-[#181818]" checked={j.receives_alerts} disabled={j.id !== journalist?.id || offline} onChange={() => toggleAlerts(j)} />
                  Alerts
                </label>
              </li>
            ))}
            {invites
              .filter((i) => !journalists.some((j) => j.email.toLowerCase() === i.email))
              .map((i) => (
                <li key={i.email} className="flex items-center justify-between gap-3 border-b border-hairline py-3 text-[14px] last:border-0">
                  <span>{i.email}</span>
                  <span className="text-ink-mute">Invited</span>
                </li>
              ))}
          </ul>
          <form onSubmit={invite} className="flex flex-wrap items-end gap-3 border-t border-hairline p-5">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="inv" className="field-label">
                Invite by email
              </label>
              <input id="inv" type="email" className="field" value={newInvite} onChange={(e) => setNewInvite(e.target.value)} placeholder="colleague@newsroom.example" />
            </div>
            <Button type="submit" variant="outline">
              Invite
            </Button>
          </form>
        </Panel>

        <Panel title="Extra alert recipients" subtitle="People outside the dashboard who should get rising-claim emails.">
          <ul className="px-5 py-2">
            {extra.length === 0 && <li className="py-3 text-[14px] text-ink-mute">None. Journalists with alerts on receive them automatically.</li>}
            {extra.map((e) => (
              <li key={e} className="flex items-center justify-between gap-3 border-b border-hairline py-2 text-[14px] last:border-0">
                {e}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => saveExtra(extra.filter((x) => x !== e))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(ev) => {
              ev.preventDefault()
              const email = newExtra.trim().toLowerCase()
              if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Enter a valid email.', 'error')
              saveExtra([...new Set([...extra, email])])
              setNewExtra('')
            }}
            className="flex flex-wrap items-end gap-3 border-t border-hairline p-5"
          >
            <div className="min-w-[220px] flex-1">
              <label htmlFor="extra" className="field-label">
                Email
              </label>
              <input id="extra" type="email" className="field" value={newExtra} onChange={(e) => setNewExtra(e.target.value)} placeholder="editor@newsroom.example" />
            </div>
            <Button type="submit" variant="outline">
              Add
            </Button>
          </form>
        </Panel>
      </div>
    </div>
  )
}
