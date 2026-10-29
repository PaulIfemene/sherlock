import { Link } from 'react-router'
import { Logo } from './Navbar'

const COLUMNS = [
  { title: 'Product', links: [['Check a claim', '/check'], ['How it works', '/#how'], ['Pricing', '/pricing']] },
  { title: 'Newsrooms', links: [['Newsroom sign in', '/newsroom/login'], ['Data licence', '/pricing#data']] },
  { title: 'About', links: [['Team', '/team'], ['Privacy', '/privacy'], ['Terms', '/terms']] },
] as const

export function Footer() {
  return (
    <footer className="bg-primary text-white">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo dark />
          <p className="mt-4 max-w-xs text-[14px] text-on-dark-mute">
            Checks claims in English, Luganda and Kiswahili against official sources and published fact-checks. Journalists make the final call.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="micro-cap text-on-dark-mute">{col.title}</p>
            <ul className="mt-4 space-y-3">
              {col.links.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className="text-[15px] text-white no-underline hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/15">
        <div className="container-x flex flex-col gap-2 py-5 text-[13px] text-on-dark-mute md:flex-row md:items-center md:justify-between">
          <span>Team Sherlock · AI in Journalism Hackathon · Hackathon demo build</span>
          <span>Translation by Sunbird AI · Web results by Brave Search</span>
        </div>
      </div>
    </footer>
  )
}
