import { ButtonLink } from '../components/Button'
import { Eyebrow } from '../components/Pill'
import { whatsappLink } from '../lib/api'

const TIERS = [
  {
    id: 'citizens',
    name: 'Citizens',
    price: 'Free',
    note: 'Always',
    body: 'Check what you receive before you share it.',
    features: ['WhatsApp and web checker', 'English, Luganda and Kiswahili', 'Text and screenshots', 'Verdicts sent back to you', 'STOP, DELETE and MYDATA at any time'],
    cta: { label: 'Chat on WhatsApp', to: whatsappLink, external: true },
    featured: false,
  },
  {
    id: 'newsrooms',
    name: 'Newsrooms',
    price: 'Subscription',
    note: 'Per newsroom, monthly',
    body: 'Know what the public is asking about, and answer it at scale.',
    features: ['Rising-claims board with live counts', 'Claims database and evidence panel', 'Verdict editor with Luganda and Kiswahili translation', 'One-click delivery to everyone who asked', 'Rising-claim email alerts', 'Configurable official-source watch'],
    cta: { label: 'Open the newsroom', to: '/newsroom', external: false },
    featured: true,
  },
  {
    id: 'data',
    name: 'Platforms and researchers',
    price: 'Data licence',
    note: 'API or bulk export',
    body: 'Understand rumour trends across languages and regions.',
    features: ['Aggregated, anonymised trend data', 'Topics, languages and velocity over time', 'Published verdicts as a dataset', 'Never individual messages or identities'],
    cta: { label: 'Ask about a licence', to: '/team', external: false },
    featured: false,
  },
]

const FAQ = [
  ['Why is it free for citizens?', 'Checking a rumour should never depend on whether you can pay. Newsroom subscriptions and data licences fund the service.'],
  ['What exactly do data licensees get?', 'Aggregated counts by topic, language and time, and published verdicts. Never message text from individuals, phone numbers or anything that identifies a sender.'],
  ['Does the AI decide what is true?', 'No. The AI suggests, in careful language, and shows its evidence. Only a journalist’s published verdict is final.'],
  ['Can a newsroom use its own sources?', 'Yes. The official-source registry is configurable, and every source shows why it is trusted and whether it is working.'],
  ['Which languages are supported?', 'English, Luganda and Kiswahili today, with translation by Sunbird AI. More Ugandan languages can follow.'],
  ['Is pricing final?', 'Not yet. This is a hackathon build, and prices will be set with partner newsrooms.'],
]

export default function Pricing() {
  return (
    <>
      <section className="py-16 md:py-24">
        <div className="container-x">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Pricing</Eyebrow>
            <h1 className="display-xl mt-4">Free for citizens. Built to sustain itself.</h1>
            <p className="body-lg mt-4 text-ink-mute">Citizens never pay. Newsrooms subscribe for the tools that show what the public is asking. Platforms and researchers can license aggregated trends.</p>
          </div>
          <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:items-stretch">
            {TIERS.map((t) => (
              <article key={t.id} id={t.id} className={`flex scroll-mt-24 flex-col p-7 md:p-8 ${t.featured ? 'card-dark' : 'card'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="heading-lg">{t.name}</h2>
                  {t.featured && <span className="pill-cap shrink-0 whitespace-nowrap bg-gold text-ink">For journalists</span>}
                </div>
                <p className="display-md mt-6">{t.price}</p>
                <p className={`text-[14px] ${t.featured ? 'text-on-dark-mute' : 'text-ink-mute'}`}>{t.note}</p>
                <p className={`mt-4 ${t.featured ? 'text-white/90' : ''}`}>{t.body}</p>
                <ul className={`mt-6 space-y-3 border-t pt-6 text-[15px] ${t.featured ? 'border-white/15' : 'border-hairline'}`}>
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <span aria-hidden className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${t.featured ? 'bg-gold' : 'bg-ink'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <ButtonLink to={t.cta.to} external={t.cta.external} variant={t.featured ? 'gold' : 'primary'} className="w-full">
                    {t.cta.label}
                  </ButtonLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="border-t border-hairline bg-surface py-16 md:py-20">
        <div className="container-x grid gap-10 lg:grid-cols-[1fr_2fr]">
          <h2 className="display-md">Questions</h2>
          <div className="divide-y divide-hairline border-y border-hairline">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 heading-sm">
                  {q}
                  <span aria-hidden className="text-[22px] leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 max-w-2xl text-ink-mute">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
