// DEMO DATA. Fictional claims, fictional newsroom and fictional ministry notice. Every cluster is
// seeded with is_demo = true and labelled "demo" in the UI. Pure data: used by `npm run demo:reset`
// and by the dashboard's offline fallback.

export type SeedLang = 'eng' | 'lug' | 'swa'
export type SeedLabel = 'likely_false' | 'likely_true' | 'missing_context' | 'under_investigation' | 'unverified'

export interface SeedEvidence {
  id: string
  kind: 'official' | 'factcheck' | 'web' | 'image'
  title: string
  url: string
  snippet: string
  published_at: string | null
  source?: string
  demo?: boolean
}

export interface SeedClaim {
  original_text: string
  original_language: SeedLang
  text_en: string
  minutes_ago: number
  ai_label: SeedLabel
  ai_confidence: number
  ai_rationale: string
  status: 'received' | 'assessed' | 'queued' | 'published'
  channel: 'whatsapp' | 'web'
}

export interface SeedCluster {
  key: string
  text_en: string
  /** Reports per 5-minute bucket, oldest first, ending at the current bucket (24 buckets = 2 hours). */
  buckets: number[]
  first_seen_minutes_ago: number
  evidence: SeedEvidence[]
  claims: SeedClaim[]
  verdict?: {
    label: SeedLabel
    explanation_en: string
    source_url: string
    published_minutes_ago: number
  }
}

const demoNote = '(Demo data.)'

const holidayEvidence: SeedEvidence[] = [
  {
    id: 'e1',
    kind: 'official',
    title: 'Demo ministry notices (fictional): public holidays for the year',
    url: 'https://example.org/demo/ministry/public-holidays',
    snippet: 'The fictional demo notice lists the year’s public holidays. No holiday is listed for the coming Monday.',
    published_at: null,
    source: 'Demo ministry notices (fictional)',
    demo: true,
  },
  {
    id: 'e2',
    kind: 'factcheck',
    title: 'Demo fact-check archive: rated "False" (simulated)',
    url: 'https://example.org/demo/factcheck/public-holiday',
    snippet: 'A similar message about an unannounced public holiday was rated false. (Simulated result.)',
    published_at: null,
    source: 'Demo archive',
    demo: true,
  },
]

export const DEMO_CLUSTERS: SeedCluster[] = [
  {
    key: 'holiday',
    text_en: 'Monday is an official public holiday, according to a ministry notice.',
    buckets: [...new Array(23).fill(0), 1],
    first_seen_minutes_ago: 3,
    evidence: holidayEvidence,
    claims: [
      {
        original_text: 'Monday is a public holiday, the ministry has announced it. Share with everyone! (demo claim)',
        original_language: 'eng',
        text_en: 'Monday is an official public holiday, according to a ministry notice.',
        minutes_ago: 3,
        ai_label: 'under_investigation',
        ai_confidence: 0.55,
        ai_rationale: `The fictional ministry calendar lists no holiday that day, but no notice addresses the claim directly. ${demoNote}`,
        status: 'queued',
        channel: 'whatsapp',
      },
    ],
  },
  {
    key: 'id-data',
    text_en: 'A new national ID will be required to buy mobile data from next month.',
    buckets: [0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 2, 1, 2, 2, 3, 2, 3, 4, 3, 5, 6],
    first_seen_minutes_ago: 118,
    evidence: [
      {
        id: 'e1',
        kind: 'web',
        title: 'Demo web result: SIM registration rules explained (simulated)',
        url: 'https://example.org/demo/sim-registration',
        snippet: 'Existing SIM registration rules already require an ID; no new rule for data purchases was found. (Simulated result.)',
        published_at: null,
        source: 'example.org',
        demo: true,
      },
    ],
    claims: [
      {
        original_text: 'Kitandika omwezi ogujja, toligula data nga tolina ndagamuntu empya. (demo claim)',
        original_language: 'lug',
        text_en: 'From next month you will not buy data without the new national ID.',
        minutes_ago: 6,
        ai_label: 'missing_context',
        ai_confidence: 0.62,
        ai_rationale: `SIM registration already needs an ID, but nothing found ties data purchases to a new ID. ${demoNote}`,
        status: 'queued',
        channel: 'whatsapp',
      },
      {
        original_text: 'Kuanzia mwezi ujao kitambulisho kipya kitahitajika kununua data. (demo claim)',
        original_language: 'swa',
        text_en: 'From next month a new ID will be required to buy data.',
        minutes_ago: 41,
        ai_label: 'missing_context',
        ai_confidence: 0.6,
        ai_rationale: `Same pattern as other reports in this cluster. ${demoNote}`,
        status: 'queued',
        channel: 'whatsapp',
      },
    ],
  },
  {
    key: 'bus-fares',
    text_en: 'Bus fares across the city are free from Friday, and a sign-up link is circulating.',
    buckets: [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1, 2, 1, 1, 2],
    first_seen_minutes_ago: 104,
    evidence: [
      {
        id: 'e1',
        kind: 'web',
        title: 'Demo web result: transport authority notices (simulated)',
        url: 'https://example.org/demo/transport-notices',
        snippet: 'No fare change appears in the notices list. (Simulated result.)',
        published_at: null,
        source: 'example.org',
        demo: true,
      },
    ],
    claims: [
      {
        original_text: 'Free bus rides from Friday! Register at the link to get your pass. (demo claim, link removed)',
        original_language: 'eng',
        text_en: 'Bus fares across the city are free from Friday, and a sign-up link is circulating.',
        minutes_ago: 9,
        ai_label: 'under_investigation',
        ai_confidence: 0.4,
        ai_rationale: `No official notice found. The sign-up link pattern is common in phishing, so a journalist should review. ${demoNote}`,
        status: 'queued',
        channel: 'whatsapp',
      },
    ],
  },
  {
    key: 'vaccination',
    text_en: 'Vaccination centres are closed this week.',
    buckets: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    first_seen_minutes_ago: 110,
    evidence: [],
    claims: [
      {
        original_text: 'Amalwaliro agagema endwadde gaggaddwa wiiki eno. (demo claim)',
        original_language: 'lug',
        text_en: 'Vaccination centres are closed this week.',
        minutes_ago: 18,
        ai_label: 'under_investigation',
        ai_confidence: 0,
        ai_rationale: `No evidence item addressed the claim. ${demoNote}`,
        status: 'queued',
        channel: 'whatsapp',
      },
    ],
  },
  {
    key: 'exam-leak',
    text_en: 'National exam results were posted online before the official release.',
    buckets: [1, 1, 2, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    first_seen_minutes_ago: 120,
    evidence: [
      {
        id: 'e1',
        kind: 'factcheck',
        title: 'Demo fact-check archive: rated "False" (simulated)',
        url: 'https://example.org/demo/factcheck/exam-results',
        snippet: 'Screenshots of "early results" did not match the format of the official release. (Simulated result.)',
        published_at: null,
        source: 'Demo archive',
        demo: true,
      },
    ],
    claims: [
      {
        original_text: 'Matokeo ya mitihani yamevuja mtandaoni kabla ya kutangazwa rasmi. (demo claim)',
        original_language: 'swa',
        text_en: 'National exam results were posted online before the official release.',
        minutes_ago: 95,
        ai_label: 'likely_false',
        ai_confidence: 0.7,
        ai_rationale: `A simulated fact-check found the screenshots did not match the official format. ${demoNote}`,
        status: 'published',
        channel: 'whatsapp',
      },
    ],
    verdict: {
      label: 'likely_false',
      explanation_en:
        'The screenshots do not match the format of the official results release, and the examinations body has not published results yet. Wait for the official release. (Demo verdict.)',
      source_url: 'https://example.org/demo/exams/notice',
      published_minutes_ago: 30,
    },
  },
  {
    key: 'tap-water',
    text_en: 'Tap water across the city is contaminated and residents must boil all water.',
    buckets: [2, 2, 3, 2, 2, 1, 2, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0],
    first_seen_minutes_ago: 120,
    evidence: [
      {
        id: 'e1',
        kind: 'official',
        title: 'Demo utility notice (fictional): advisory for two parishes',
        url: 'https://example.org/demo/utility/advisory',
        snippet: 'A boil-water advisory applies to two named parishes after a pipe repair, not the whole city. (Fictional demo notice.)',
        published_at: null,
        source: 'Demo utility notices (fictional)',
        demo: true,
      },
    ],
    claims: [
      {
        original_text: 'All tap water in the city is contaminated. Boil everything! (demo claim)',
        original_language: 'eng',
        text_en: 'Tap water across the city is contaminated and residents must boil all water.',
        minutes_ago: 70,
        ai_label: 'missing_context',
        ai_confidence: 0.82,
        ai_rationale: `A fictional utility notice limits the advisory to two parishes. ${demoNote}`,
        status: 'published',
        channel: 'web',
      },
    ],
    verdict: {
      label: 'missing_context',
      explanation_en:
        'A boil-water advisory is real but covers two parishes after a pipe repair, not the whole city. Check the utility notice for your area. (Demo verdict.)',
      source_url: 'https://example.org/demo/utility/advisory',
      published_minutes_ago: 50,
    },
  },
]

/**
 * Proposed official-source registry. Real Ugandan public bodies, all seeded DISABLED: the team must
 * check each site's robots.txt and terms before enabling, and set a precise selector.
 */
export const SOURCE_REGISTRY = [
  { name: 'Ministry of Health Uganda', url: 'https://www.health.go.ug/', kind: 'page', selector: 'a', trusted_because: 'Official ministry site: health notices, outbreaks, vaccination campaigns.' },
  { name: 'Uganda Media Centre', url: 'https://www.mediacentre.go.ug/', kind: 'page', selector: 'a', trusted_because: 'Government communication office: official statements and press releases.' },
  { name: 'Parliament of Uganda', url: 'https://www.parliament.go.ug/', kind: 'page', selector: 'a', trusted_because: 'Official record of bills, acts and House business.' },
  { name: 'Electoral Commission Uganda', url: 'https://www.ec.or.ug/', kind: 'page', selector: 'a', trusted_because: 'Constitutional body: election timetables, results and voter notices.' },
  { name: 'Uganda Communications Commission', url: 'https://www.ucc.co.ug/', kind: 'page', selector: 'a', trusted_because: 'Communications regulator: SIM registration, telecom and broadcast rules.' },
  { name: 'Bank of Uganda', url: 'https://www.bou.or.ug/', kind: 'page', selector: 'a', trusted_because: 'Central bank: currency, rates and financial-sector notices.' },
  { name: 'Uganda National Examinations Board', url: 'https://uneb.ac.ug/', kind: 'page', selector: 'a', trusted_because: 'Examinations body: official exam timetables and results releases.' },
  { name: 'Uganda Revenue Authority', url: 'https://www.ura.go.ug/', kind: 'page', selector: 'a', trusted_because: 'Tax authority: official tax and customs notices, often impersonated in scams.' },
] as const

/** Fictional source used only so the demo claim can show an "official" evidence match. */
export const DEMO_SOURCE = {
  name: 'Demo ministry notices (fictional)',
  url: 'https://example.org/demo/ministry/',
  kind: 'page',
  selector: 'a',
  trusted_because: 'Fictional demo source for the hackathon. Not a real ministry.',
  items: [
    {
      title: 'Public holidays for the year (fictional demo notice)',
      url: 'https://example.org/demo/ministry/public-holidays',
      content_text: 'Fictional demo notice: the list of public holidays for the year. No public holiday is declared for Monday. Holidays are announced by official notice only.',
    },
  ],
} as const
