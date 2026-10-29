// Debug helper: run evidence + the raw LLM assessment call for several claims and show why parsing fails.
import 'dotenv/config'
import { buildDeps } from '../engine/adapters'
import { gatherEvidence } from '../engine/evidence'
import { buildAssessUser, parseAssessment } from '../engine/assess'
import { loadPrompt } from '../engine/prompts'

const claims = process.argv.slice(2)
const deps = buildDeps()
const quiet = { info: () => {}, error: () => {} }
for (const claim of claims) {
  const evidence = await gatherEvidence({ claimEn: claim, embedding: await deps.embedder.embed(claim), phash: null, claimId: 'probe' }, { ...deps, log: quiet })
  for (let i = 0; i < 2; i++) {
    let raw = ''
    try {
      raw = await deps.llm.complete({ system: loadPrompt('assess.system.md'), user: buildAssessUser({ claim_en: claim, original_language: 'eng', evidence }), json: true, maxTokens: 1200 })
    } catch (err) {
      console.log(`\n[${claim.slice(0, 40)}] try ${i + 1}: THROW ${(err as Error).message.slice(0, 300)}`)
      continue
    }
    const parsed = parseAssessment(raw, evidence)
    console.log(`\n[${claim.slice(0, 40)}] try ${i + 1}: ${parsed ? `OK ${parsed.label} ${parsed.confidence}` : 'PARSE FAIL'} raw(${raw.length}): ${raw.slice(0, 400)}`)
  }
}
