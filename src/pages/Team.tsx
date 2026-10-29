import { useState } from 'react'
import { Link } from 'react-router'

// Photos: drop a portrait at public/team/<slug>.jpg (about 800×1000, 4:5) and it replaces the
// placeholder automatically. Until then the card shows a labelled placeholder.
const TEAM = [
  { slug: 'othieno-kemuel-samuel', name: 'Othieno Kemuel Samuel', role: 'Journalist' },
  { slug: 'thembo-kennedy', name: 'Thembo Kennedy', role: 'Journalist' },
  { slug: 'ivana-nyokabi-chihi', name: 'Ivana Nyokabi Chihi', role: 'Journalist' },
  { slug: 'paul-ifemene', name: 'Paul Ifemene', role: 'Developer' },
]

function initials(name: string): string {
  const parts = name.split(' ')
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function Portrait({ slug, name }: { slug: string; name: string }) {
  const [missing, setMissing] = useState(false)
  if (missing) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#e9e9e6] text-ink-mute" role="img" aria-label={`Photo of ${name} coming soon`}>
        <svg viewBox="0 0 120 120" className="h-24 w-24" aria-hidden>
          <circle cx="60" cy="44" r="22" fill="#d2d2ce" />
          <path d="M18 112c4-24 22-38 42-38s38 14 42 38" fill="#d2d2ce" />
        </svg>
        <span className="text-[13px] font-semibold tracking-[.02em]">{initials(name)} · Photo coming soon</span>
      </div>
    )
  }
  return <img src={`/team/${slug}.jpg`} alt={`Portrait of ${name}`} loading="lazy" onError={() => setMissing(true)} className="h-full w-full object-cover" />
}

export default function Team() {
  return (
    <section className="bg-surface pb-20 pt-10 md:pb-28 md:pt-14">
      <div className="container-x">
        <nav aria-label="Breadcrumb" className="text-[13px] text-ink-mute">
          <Link to="/" className="text-ink-mute no-underline hover:underline">
            Home
          </Link>{' '}
          / Team
        </nav>
        <h1 className="mt-4 text-[clamp(48px,8vw,96px)] font-medium leading-[1] tracking-[-0.045em]">Meet our team</h1>
        <p className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-ink-mute">
          Meet Team Sherlock, built for the AI in Journalism Hackathon. Three journalists and a developer, combining newsroom judgement with careful engineering to help Ugandans check what they hear.
        </p>
      </div>

      {/* Scrolls sideways on small screens like the reference; a grid of four on desktop. */}
      <div className="mt-12 md:mt-16">
        <ul className="container-x flex snap-x snap-mandatory scroll-px-4 md:scroll-px-8 gap-5 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0" aria-label="Team members">
          {TEAM.map((m) => (
            <li key={m.slug} className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-auto">
              <div className="aspect-[4/5] overflow-hidden rounded-[16px]">
                <Portrait slug={m.slug} name={m.name} />
              </div>
              <h2 className="mt-5 text-[22px] font-medium tracking-[-0.02em]">{m.name}</h2>
              <p className="mt-1 text-[16px] text-ink-mute">{m.role}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
