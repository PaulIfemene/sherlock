import { Eyebrow } from '../components/Pill'

// Photos to be provided by the team; initials avatars until then.
const TEAM = [
  { name: 'Chihi Ivana Nyokabi', role: 'Team Lead', field: 'Journalism', bio: 'Leads the editorial direction and the newsroom workflow.' },
  { name: 'Odeke Harry Victor', role: 'Journalist', field: 'Journalism', bio: 'Shapes verification practice and the verdict format.' },
  { name: 'Paul Ifemene Chukwumaobim', role: 'Engineer', field: 'IT, system design and development', bio: 'Designs and builds the engine, bot and dashboard.' },
  { name: 'Tumwine Edward', role: 'Supervisor', field: 'Supervision', bio: 'Guides the project and its academic and ethical standards.' },
]

function initials(name: string): string {
  const parts = name.split(' ')
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default function Team() {
  return (
    <>
      <section className="py-16 md:py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <Eyebrow>Team Sherlock</Eyebrow>
            <h1 className="display-xl mt-4">Journalists and engineers, building for Ugandan audiences.</h1>
            <p className="body-lg mt-4 text-ink-mute">Built for the AI in Journalism Hackathon, by a team that pairs newsroom judgement with careful engineering.</p>
          </div>
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((m, i) => (
              <li key={m.name} className="card flex flex-col p-6">
                <div aria-hidden className={`flex h-20 w-20 items-center justify-center rounded-full text-[26px] font-bold tracking-[-0.02em] ${i === 0 ? 'bg-gold text-ink' : i === 3 ? 'bg-primary text-white' : 'bg-gold-cream text-ink'}`}>
                  {initials(m.name)}
                </div>
                <p className="micro-cap mt-6 text-ink-mute">{m.role}</p>
                <h2 className="heading-md mt-2">{m.name}</h2>
                <p className="mt-1 text-[14px] font-semibold">{m.field}</p>
                <p className="mt-3 text-[14px] text-ink-mute">{m.bio}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="pb-20">
        <div className="container-x">
          <div className="card-cream p-8 md:p-12">
            <h2 className="display-md">Work with us</h2>
            <p className="mt-3 max-w-2xl">We are looking for partner newsrooms to pilot the dashboard, and for advice on Ugandan official sources worth watching. Talk to any of us at the hackathon.</p>
          </div>
        </div>
      </section>
    </>
  )
}
