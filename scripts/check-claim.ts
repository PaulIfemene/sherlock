// Run one claim through the full engine with the real services in .env and print every stage.
// Nothing is sent on WhatsApp. Uses the in-memory store unless Supabase is configured.
//   npm run check:claim -- "Monday has been declared a public holiday"
//   npm run check:claim -- --lang lug "Gavumenti erangiridde nti Mmande lunaku lwa luwummula"
import 'dotenv/config'
import { buildDeps } from '../engine/adapters'
import { runPipeline } from '../engine/pipeline'
import type { Lang } from '../engine/types'

const args = process.argv.slice(2)
const li = args.indexOf('--lang')
const lang = li >= 0 ? (args.splice(li, 2)[1] as Lang) : null
const text = args.join(' ').trim()
if (!text) {
  console.error('Usage: npm run check:claim -- [--lang eng|lug|swa] "claim text"')
  process.exit(1)
}

const deps = buildDeps()
const quiet = { info: () => {}, error: (e: Record<string, unknown>) => console.error('  ! ', JSON.stringify(e)) }
console.log('Live:', Object.entries(deps.status).filter(([k, v]) => v && k !== 'demo_mode').map(([k]) => k).join(', '))
const started = Date.now()
const claim = await deps.store.createClaim({ channel: 'web', sender_hash: 'cli-test', is_demo: false })
const result = await runPipeline(
  { claimId: claim.id, text, image: null, languageHint: null, replyLanguage: lang, isDemo: false },
  { ...deps, log: quiet, onStage: (s) => console.log(`  ${((Date.now() - started) / 1000).toFixed(1)}s  ${s}`) },
)
const saved = await deps.store.getClaim(claim.id)
console.log(`\nDetected language: ${saved?.original_language}   Claim (English): ${saved?.text_en}`)
console.log('\nEvidence:')
for (const e of result.evidence) console.log(`  ${e.id} [${e.kind}] ${e.title}\n      ${e.url}`)
const a = result.assessment
console.log(`\nAssessment: ${a?.label}  confidence ${a?.confidence}  cites ${a?.evidence_ids.join(', ') || '-'}${a?.fallback ? `  (fallback: ${a.fallback})` : ''}`)
console.log(`Rationale: ${a?.rationale}`)
console.log(`Status: ${result.status}\n\nReply (${result.replyLanguage}, ${result.reply.length} chars):\n${result.reply}`)
console.log(`\nTotal ${((Date.now() - started) / 1000).toFixed(1)} s`)
