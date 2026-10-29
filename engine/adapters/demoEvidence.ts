// Canned evidence for demo mode only. Every item is fictional, says so in its title, and uses
// example.org URLs, so it can never be mistaken for a live search result.
import type { Evidence } from '../types'

type Item = Omit<Evidence, 'id'>

const DEMO: { match: RegExp; items: Item[] }[] = [
  {
    match: /public holiday|holiday|day off/i,
    items: [
      {
        kind: 'factcheck',
        title: 'Demo fact-check archive: rated "False" (simulated)',
        url: 'https://example.org/demo/factcheck/public-holiday',
        snippet: 'A similar message about an unannounced public holiday was rated false. No ministry notice was published. (Simulated result.)',
        published_at: null,
        source: 'Demo archive',
        demo: true,
      },
      {
        kind: 'web',
        title: 'Demo web result: public holiday calendar (simulated)',
        url: 'https://example.org/demo/holiday-calendar',
        snippet: 'The published calendar lists no public holiday on the date in the message. (Simulated result.)',
        published_at: null,
        source: 'example.org',
        demo: true,
      },
    ],
  },
  {
    match: /bus|fare|transport/i,
    items: [
      {
        kind: 'web',
        title: 'Demo web result: transport authority notices (simulated)',
        url: 'https://example.org/demo/transport-notices',
        snippet: 'No fare change appears in the notices list. (Simulated result.)',
        published_at: null,
        source: 'example.org',
        demo: true,
      },
    ],
  },
]

export function demoEvidenceFor(query: string): Item[] {
  return DEMO.filter((d) => d.match.test(query)).flatMap((d) => d.items)
}
