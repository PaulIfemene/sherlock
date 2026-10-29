import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { whatsappLink } from '../lib/api'
import { ButtonLink } from './Button'

export function Logo({ dark = false, size = 36 }: { dark?: boolean; size?: number }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 no-underline ${dark ? 'text-white' : 'text-ink'}`} aria-label="Sherlock home">
      <img src="/sherlock-logo.png" alt="" width={size} height={size} className="rounded-[6px] object-cover" style={{ width: size, height: size }} />
      <span className="text-[20px] font-bold tracking-[-0.02em]">Sherlock</span>
    </Link>
  )
}

const LINKS = [
  { to: '/#how', label: 'How it works' },
  { to: '/check', label: 'Check a claim' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/team', label: 'Team' },
]

export function Navbar() {
  // The menu belongs to the page it was opened on, so navigating closes it.
  const location = useLocation()
  const here = location.pathname + location.hash
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === here
  const setOpen = (fn: (o: boolean) => boolean) => setOpenOn(fn(open) ? here : null)

  return (
    <nav className="sticky top-0 z-40 border-b border-hairline bg-white" aria-label="Main">
      <div className="container-x flex h-[72px] items-center justify-between gap-4">
        <Logo />
        <ul className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} className={({ isActive }) => `text-[15px] font-medium text-ink no-underline hover:underline ${isActive && !l.to.includes('#') ? 'underline' : ''}`}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-3 md:flex">
          <ButtonLink to="/newsroom" variant="secondary" size="sm">
            Newsroom
          </ButtonLink>
          <ButtonLink to={whatsappLink} variant="primary" size="sm" external>
            Chat on WhatsApp
          </ButtonLink>
        </div>
        <button type="button" className="btn btn-ghost btn-sm md:hidden" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Menu'}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="border-t border-hairline bg-white md:hidden">
          <ul className="container-x flex flex-col py-3">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="block py-3 text-[17px] font-semibold text-ink no-underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="container-x flex flex-col gap-3 pb-5">
            <ButtonLink to="/newsroom" variant="secondary">
              Newsroom
            </ButtonLink>
            <ButtonLink to={whatsappLink} variant="primary" external>
              Chat on WhatsApp
            </ButtonLink>
          </div>
        </div>
      )}
    </nav>
  )
}
