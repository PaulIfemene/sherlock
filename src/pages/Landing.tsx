import { Link } from 'react-router'
import { ButtonLink } from '../components/Button'
import { Eyebrow, LabelBadge, LangChip } from '../components/Pill'
import { Sparkline } from '../components/Sparkline'
import { whatsappLink } from '../lib/api'

/** Illustrative WhatsApp exchange. Fictional claim, labelled as an illustration. */
function ChatMockup() {
  return (
    <figure className="w-full max-w-[380px] rounded-[20px] border border-white/15 bg-white p-4 text-ink" aria-label="Illustration of a conversation with Sherlock on WhatsApp">
      <div className="flex items-center gap-3 border-b border-hairline pb-3">
        <img src="/sherlock-logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
        <div>
          <p className="text-[15px] font-bold leading-tight">Sherlock</p>
          <p className="text-[12px] text-ink-mute">Fact-check assistant</p>
        </div>
        <span className="ml-auto rounded-full bg-gold-cream px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.08em]">Illustration</span>
      </div>
      <div className="space-y-3 py-4 text-[14px] leading-snug">
        <p className="ml-auto w-[85%] rounded-[14px] rounded-br-[4px] bg-[#e9e9e6] px-3 py-2">
          Is it true that Monday is a public holiday? A ministry notice is going round.
        </p>
        <div className="w-[88%] rounded-[14px] rounded-bl-[4px] border border-hairline px-3 py-2">
          <p>
            Received. Our check so far suggests this is <b>likely false</b>: the ministry’s published holiday list has no holiday on Monday. A fact-checker is reviewing it. Ticket <span className="mono whitespace-nowrap">#SH-4F2A</span>
          </p>
        </div>
        <div className="w-[88%] rounded-[14px] rounded-bl-[4px] bg-primary px-3 py-2 text-white">
          <p className="micro-cap text-gold">Verdict · checked by a journalist</p>
          <p className="mt-1.5">Likely false. No holiday has been declared. Holidays are announced by official notice only.</p>
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3 text-[12px] text-ink-mute">
        Replies in <LangChip lang="eng" full /> <LangChip lang="lug" full /> <LangChip lang="swa" full />
      </figcaption>
    </figure>
  )
}

function Hero() {
  return (
    <header className="relative isolate overflow-hidden bg-primary text-white">
      <img src="/hero-journalism.jpg" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-[#181818]/80" aria-hidden />
      <div className="container-x grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <Eyebrow tone="gold">Misinformation checker for Uganda and East Africa</Eyebrow>
          <h1 className="display-xxl mt-6 text-white">Heard it on WhatsApp? Ask Sherlock before you share.</h1>
          <p className="body-lg mt-6 max-w-xl text-white/90">
            Send a message or a screenshot in English, Luganda or Kiswahili. Sherlock checks it against official sources and published fact-checks, replies in your language, and passes anything uncertain to a journalist.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to={whatsappLink} variant="secondary" external>
              Chat on WhatsApp
            </ButtonLink>
            <ButtonLink to="/check" variant="outline-light">
              Check a claim on the web
            </ButtonLink>
          </div>
          <p className="mt-6 text-[14px] text-on-dark-mute">Free for citizens. Your number is never shown to anyone.</p>
        </div>
        <div className="flex justify-center lg:justify-end">
          <ChatMockup />
        </div>
      </div>
    </header>
  )
}

const FACTS = [
  ['3 languages', 'English, Luganda and Kiswahili, through Sunbird AI'],
  ['Text and screenshots', 'We read the text in images and check the claim'],
  ['Journalist reviewed', 'Only a journalist’s verdict is final'],
  ['No numbers stored', 'Senders are kept as scrambled, keyed IDs'],
] as const

function FactStrip() {
  return (
    <section aria-label="Key facts" className="border-b border-hairline">
      <dl className="container-x grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {FACTS.map(([t, d]) => (
          <div key={t} className="py-6 sm:px-0 lg:px-6 lg:first:pl-0">
            <dt className="heading-sm">{t}</dt>
            <dd className="mt-1 text-[14px] text-ink-mute">{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const STEPS = [
  {
    n: '01',
    title: 'Send',
    body: 'Forward the message, or send a screenshot, to Sherlock on WhatsApp. Or paste it on the web checker.',
    detail: 'Type STOP, DELETE or MYDATA at any time.',
  },
  {
    n: '02',
    title: 'Check',
    body: 'Sherlock translates the claim, searches official sources, fact-check archives and the web, and suggests an assessment in plain words.',
    detail: 'Usually under 30 seconds. Instant when a journalist has already ruled on it.',
  },
  {
    n: '03',
    title: 'Confirm',
    body: 'Uncertain claims go to a journalist. When they publish a verdict, everyone who asked gets it, in their own language.',
    detail: 'The AI suggests. Journalists decide.',
  },
]

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 py-20 md:py-28">
      <div className="container-x">
        <div className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="display-xl mt-4">Send. Check. Confirm.</h2>
          <p className="body-lg mt-4 text-ink-mute">One conversation from a forwarded rumour to a checked answer, with a person accountable for the final word.</p>
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.n} className={`${i === 2 ? 'card-dark' : 'card-cream'} flex flex-col p-7 md:p-8`}>
              <span className={`mono text-[14px] font-bold ${i === 2 ? 'text-gold' : 'text-link'}`}>{s.n}</span>
              <h3 className="display-md mt-8">{s.title}</h3>
              <p className={`mt-3 ${i === 2 ? 'text-white/90' : ''}`}>{s.body}</p>
              <p className={`mt-auto pt-8 text-[14px] ${i === 2 ? 'text-on-dark-mute' : 'text-ink-mute'}`}>{s.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const LANGS = [
  { code: 'eng', name: 'English', greet: 'Hello', note: 'Official sources and most fact-checks are in English.' },
  { code: 'lug', name: 'Luganda', greet: 'Oli otya', note: 'Spoken by millions in central Uganda, where many rumours start.' },
  { code: 'swa', name: 'Kiswahili', greet: 'Habari', note: 'Reaches across Uganda, Kenya, Tanzania and the region.' },
]

function Languages() {
  return (
    <section aria-labelledby="langs" className="bg-gold">
      <div className="container-x grid gap-10 py-16 md:py-20 lg:grid-cols-[1fr_2fr] lg:items-center">
        <div>
          <p className="micro-cap">Multilingual by design</p>
          <h2 id="langs" className="display-md mt-3">Ask in the language you think in. Get the answer in it too.</h2>
          <p className="mt-3">Translation by Sunbird AI, built for Ugandan languages.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {LANGS.map((l) => (
            <li key={l.code} className="rounded-[16px] bg-white p-6">
              <p className="text-[28px] font-bold tracking-[-0.02em]">{l.greet}</p>
              <p className="mt-1 font-semibold">{l.name}</p>
              <p className="mt-3 text-[14px] text-ink-mute">{l.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const DISORDERS = [
  {
    name: 'Misinformation',
    def: 'False, shared without intent to harm.',
    example: 'An honest mistake about clinic opening hours.',
    response: 'A friendly correction in your language, no blame, and a card you can forward to the group.',
  },
  {
    name: 'Disinformation',
    def: 'False, and made or spread to mislead.',
    example: 'A notice made to look official, spreading in coordinated bursts.',
    response: '“Likely false”, the official source that contradicts it, and an alert to journalists when it spreads.',
  },
  {
    name: 'Malinformation',
    def: 'True, but used to cause harm.',
    example: 'A real document shared to expose someone’s private details.',
    response: '“True but misleading”, personal data held back, and a journalist reviews the harm.',
  },
]

function Disorders() {
  return (
    <section aria-labelledby="disorders" className="py-20 md:py-28">
      <div className="container-x">
        <div className="max-w-2xl">
          <Eyebrow>Not all false news is the same</Eyebrow>
          <h2 id="disorders" className="display-xl mt-4">Three kinds of information disorder, handled differently.</h2>
          <p className="body-lg mt-4 text-ink-mute">Sherlock never claims to know why someone shared something. It describes patterns, like a forged notice or coordinated spread, and says so.</p>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {DISORDERS.map((d) => (
            <article key={d.name} className="card flex flex-col p-7 md:p-8">
              <h3 className="heading-lg">{d.name}</h3>
              <p className="mt-2 font-semibold">{d.def}</p>
              <p className="mt-4 text-[14px] text-ink-mute">For example: {d.example}</p>
              <div className="mt-auto pt-6">
                <div className="rounded-[12px] bg-gold-cream p-4">
                  <p className="micro-cap text-ink-mute">What Sherlock does</p>
                  <p className="mt-2 text-[15px]">{d.response}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const PREVIEW_ROWS = [
  { text: 'A new national ID will be required to buy mobile data', lang: 'lug', count: 100, delta: 61, spark: [2, 3, 5, 6, 9, 14, 20, 28, 41, 58, 79, 100], rising: true },
  { text: 'Bus fares are free from Friday, sign-up link circulating', lang: 'eng', count: 15, delta: 4, spark: [3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15], rising: false },
  { text: 'Vaccination centres are closed this week', lang: 'lug', count: 7, delta: 2, spark: [1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7], rising: false },
]

function NewsroomPreview() {
  return (
    <section aria-labelledby="newsroom" className="bg-primary text-white">
      <div className="container-x grid gap-12 py-20 md:py-28 lg:grid-cols-[1fr_1.25fr] lg:items-center">
        <div>
          <Eyebrow tone="gold">For newsrooms</Eyebrow>
          <h2 id="newsroom" className="display-xl mt-4 text-white">See what your audience is asking about, as it rises.</h2>
          <p className="body-lg mt-4 text-white/85">Sherlock groups the same claim arriving from hundreds of people, ranks it by how fast it is spreading, and gathers the evidence. Your desk writes one verdict and Sherlock sends it back to every person who asked.</p>
          <ul className="mt-8 space-y-3">
            {['Rising-claims board with live counts', 'Evidence from official sources, fact-checks and the web', 'One verdict, delivered in three languages', 'Email alerts when a claim crosses your threshold'].map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/newsroom" variant="gold">
              Open the newsroom
            </ButtonLink>
            <ButtonLink to="/pricing" variant="outline-light">
              See newsroom pricing
            </ButtonLink>
          </div>
        </div>
        <figure className="overflow-hidden rounded-[16px] bg-white text-ink" aria-label="Illustration of the rising-claims board">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <div>
              <p className="heading-sm">Rising claims</p>
              <p className="text-[13px] text-ink-mute">Ranked by velocity</p>
            </div>
            <span className="rounded-full bg-gold-cream px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em]">Demo data</span>
          </div>
          <ol>
            {PREVIEW_ROWS.map((r, i) => (
              <li key={r.text} className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-5 py-4 last:border-0 ${i === 0 ? 'bg-gold-cream' : ''}`}>
                <span className="mono w-5 text-ink-mute">{i + 1}</span>
                <span className="min-w-0 flex-1 basis-[60%] text-[15px] font-medium sm:basis-0">{r.text}</span>
                <LangChip lang={r.lang} />
                <span className="w-9 text-right font-bold tabular-nums">{r.count}</span>
                <Sparkline values={r.spark} rising={r.rising} width={80} height={28} />
                <span className={`w-14 text-right text-[13px] font-bold tabular-nums ${r.rising ? 'text-success' : 'text-ink-mute'}`}>▲ +{r.delta}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-5 py-4 text-[13px]">
            <span className="text-ink-mute">Published today:</span>
            <LabelBadge label="likely_false" size="sm" />
            <LabelBadge label="missing_context" size="sm" />
          </div>
        </figure>
      </div>
    </section>
  )
}

const TRUST = [
  {
    title: 'Official sources, watched openly',
    body: 'A public list of ministry, regulator and parliament sites, each with a note on why it is trusted and when it was last checked. Newsrooms can see and change it.',
  },
  {
    title: 'People make the final call',
    body: 'The AI only suggests, in careful language. Anything uncertain goes to a journalist, and only their published verdict is called a verdict.',
  },
  {
    title: 'Privacy by design',
    body: 'Phone numbers are replaced by keyed scrambled IDs, reply addresses are encrypted, images are deleted within 24 hours, and you can erase your data with one word.',
  },
]

function Trust() {
  return (
    <section aria-labelledby="trust" className="py-20 md:py-28">
      <div className="container-x">
        <div className="max-w-2xl">
          <Eyebrow>Why you can trust it</Eyebrow>
          <h2 id="trust" className="display-xl mt-4">Transparent sources. Human judgement. Your data protected.</h2>
        </div>
        <div className="mt-12 grid gap-10 border-t border-ink pt-10 md:grid-cols-3">
          {TRUST.map((t) => (
            <div key={t.title}>
              <h3 className="heading-md">{t.title}</h3>
              <p className="mt-3 text-ink-mute">{t.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-[14px]">
          Read how we handle data in our <Link to="/privacy">privacy notice</Link>.
        </p>
      </div>
    </section>
  )
}

function PricingTeaser() {
  const tiers = [
    { name: 'Citizens', price: 'Free', body: 'Check anything on WhatsApp or the web, in three languages.', dark: false },
    { name: 'Newsrooms', price: 'Subscription', body: 'Rising-claims board, alerts and publishing tools.', dark: true },
    { name: 'Platforms and researchers', price: 'Data licence', body: 'Aggregated, anonymised trend data. Never individual messages.', dark: false },
  ]
  return (
    <section aria-labelledby="pricing" className="bg-surface py-20 md:py-24">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <Eyebrow>Pricing</Eyebrow>
            <h2 id="pricing" className="display-md mt-4">Free for citizens. Newsrooms keep it running.</h2>
          </div>
          <ButtonLink to="/pricing" variant="outline">
            Compare plans
          </ButtonLink>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.name} className={t.dark ? 'card-dark p-7' : 'card p-7'}>
              <p className={`micro-cap ${t.dark ? 'text-on-dark-mute' : 'text-ink-mute'}`}>{t.name}</p>
              <p className="heading-lg mt-3">{t.price}</p>
              <p className={`mt-2 text-[15px] ${t.dark ? 'text-white/85' : 'text-ink-mute'}`}>{t.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ClosingCta() {
  return (
    <section className="py-16 md:py-20">
      <div className="container-x">
        <div className="card-gold flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center md:p-12">
          <div className="max-w-xl">
            <h2 className="display-md">Not sure about a message? Don’t forward it yet.</h2>
            <p className="mt-2">Send it to Sherlock first. It takes less time than reading it twice.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink to={whatsappLink} external>
              Chat on WhatsApp
            </ButtonLink>
            <ButtonLink to="/check" variant="outline">
              Check on the web
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <>
      <Hero />
      <FactStrip />
      <HowItWorks />
      <Languages />
      <Disorders />
      <NewsroomPreview />
      <Trust />
      <PricingTeaser />
      <ClosingCta />
    </>
  )
}
