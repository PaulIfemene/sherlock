import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { supabase } from '../../lib/supabase'
import { NewsroomProvider, useJournalistSession, useNewsroom } from '../../lib/newsroom'
import { OFFLINE_JOURNALIST } from '../../lib/offline'
import { Logo } from '../../components/Navbar'
import { Button } from '../../components/Button'

const NAV = [
  { to: '/newsroom', label: 'Overview', end: true },
  { to: '/newsroom/claims', label: 'Claims database' },
  { to: '/newsroom/library', label: 'Verified library' },
  { to: '/newsroom/sources', label: 'Sources' },
  { to: '/newsroom/alerts', label: 'Alerts' },
  { to: '/newsroom/settings', label: 'Settings' },
]

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-surface p-6">{children}</div>
}

export default function NewsroomLayout() {
  const { session, journalist } = useJournalistSession()
  if (!supabase) {
    return (
      <NewsroomProvider journalist={OFFLINE_JOURNALIST}>
        <Shell />
      </NewsroomProvider>
    )
  }
  if (session === undefined || (session && journalist === undefined)) {
    return (
      <Centered>
        <p className="text-ink-mute">Loading the newsroom…</p>
      </Centered>
    )
  }
  if (!session) return <Navigate to="/newsroom/login" replace />
  if (!journalist) {
    return (
      <Centered>
        <div className="card card-pad max-w-md text-center">
          <h1 className="heading-lg">This account is not in a newsroom yet</h1>
          <p className="mt-3 text-ink-mute">
            You are signed in as <b className="text-ink">{session.user.email}</b>, but no journalist profile is linked to it. Ask a colleague to invite this email under Settings, then sign in again.
          </p>
          <Button className="mt-6" variant="outline" onClick={() => supabase?.auth.signOut()}>
            Sign out
          </Button>
        </div>
      </Centered>
    )
  }
  return (
    <NewsroomProvider journalist={journalist}>
      <Shell />
    </NewsroomProvider>
  )
}

function Shell() {
  const { offline, live, journalist, status, error } = useNewsroom()
  const { pathname } = useLocation()
  const [menuOn, setMenuOn] = useState<string | null>(null)
  const menu = menuOn === pathname
  const setMenu = (fn: (m: boolean) => boolean) => setMenuOn(fn(menu) ? pathname : null)
  const demo = offline || status?.demo_mode

  const nav = (
    <ul className="flex flex-col gap-1">
      {NAV.map((n) => (
        <li key={n.to}>
          <NavLink
            to={n.to}
            end={n.end}
            className={({ isActive }) => `flex min-h-[44px] items-center rounded-[10px] px-3 text-[15px] font-medium no-underline ${isActive ? 'bg-primary text-white' : 'text-ink hover:bg-white'}`}
          >
            {n.label}
          </NavLink>
        </li>
      ))}
    </ul>
  )

  const account = (
    <div className="border-t border-hairline pt-4">
      <p className="text-[14px] font-semibold">{journalist?.display_name}</p>
      <p className="text-[13px] text-ink-mute">{journalist?.newsroom}</p>
      {supabase && (
        <button type="button" className="mt-2 min-h-[44px] text-[14px] font-semibold text-link underline" onClick={() => supabase?.auth.signOut()}>
          Sign out
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-hairline bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:p-5">
        <div>
          <Logo size={32} />
          <p className="mt-1 pl-[42px] text-[12px] font-bold uppercase tracking-[.08em] text-ink-mute">Newsroom</p>
          <div className="mt-8">{nav}</div>
        </div>
        {account}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-hairline bg-white">
          <div className="flex h-[60px] items-center justify-between gap-3 px-4 md:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Logo size={28} />
            </div>
            <div className="hidden items-center gap-2 text-[13px] lg:flex">
              <span className="font-semibold">{journalist?.newsroom}</span>
              <span className="text-ink-mute">· Rising claims and verification desk</span>
            </div>
            <div className="flex items-center gap-2">
              {demo && <span className="whitespace-nowrap rounded-full bg-gold px-3 py-1 text-[12px] font-bold uppercase tracking-[.08em] text-ink"><span className="sm:hidden">Demo</span><span className="hidden sm:inline">{offline ? 'Offline demo data' : 'Demo mode'}</span></span>}
              <span className="hidden items-center gap-2 rounded-full border border-hairline px-3 py-1 text-[12px] font-semibold sm:inline-flex" title={live ? 'Receiving live updates' : 'Not connected to live updates'}>
                <span className={`h-2 w-2 rounded-full ${live ? 'live-dot bg-success' : 'bg-[#9a9a9a]'}`} aria-hidden />
                {live ? 'Live' : offline ? 'Local' : 'Connecting'}
              </span>
              <button type="button" className="btn btn-ghost btn-sm lg:hidden" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                {menu ? 'Close' : 'Menu'}
              </button>
            </div>
          </div>
          {menu && (
            <div className="border-t border-hairline bg-surface p-4 lg:hidden">
              {nav}
              <div className="mt-4">{account}</div>
            </div>
          )}
        </header>
        {offline && (
          <div className="border-b border-gold bg-gold-cream px-4 py-2 text-[13px] md:px-8">
            Supabase is not configured, so this dashboard shows the fictional demo seed held in your browser. Changes are not saved.
          </div>
        )}
        {error && <div className="border-b border-error bg-white px-4 py-2 text-[13px] text-error md:px-8">Could not load some data: {error}</div>}
        <main className="mx-auto max-w-[1360px] px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
