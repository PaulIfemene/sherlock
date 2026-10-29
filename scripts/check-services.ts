// Smoke-test each configured external service with one small real call. Prints results, never keys.
//   npm run check:services
import 'dotenv/config'
import { integrationStatus } from '../engine/adapters'
import { sunbirdTranslator } from '../engine/adapters/sunbird'
import { openAiCompatibleLlm } from '../engine/adapters/llm'
import { braveSearch } from '../engine/adapters/brave'
import { googleFactCheck } from '../engine/adapters/factcheck'

const env = process.env
const status = integrationStatus(env)
console.log('Configured:', Object.entries(status).filter(([, v]) => v).map(([k]) => k).join(', '))

async function step(name: string, fn: () => Promise<string>) {
  const t = Date.now()
  try {
    console.log(`\n[ok]   ${name} (${Date.now() - t} ms before call)\n       ${await fn()}  [${Date.now() - t} ms]`)
  } catch (err) {
    console.log(`\n[FAIL] ${name}: ${(err as Error).message.slice(0, 300)}`)
  }
}

if (status.sunbird) {
  const sb = sunbirdTranslator(env)
  await step('Sunbird language ID', async () => `"Mmande lunaku lwa luwummula" -> ${await sb.detect('Mmande lunaku lwa luwummula, gavumenti erangiridde')}`)
  await step('Sunbird translate eng->lug', async () => sb.translate('Monday is a public holiday, the government has announced.', 'eng', 'lug'))
  await step('Sunbird translate lug->eng', async () => sb.translate('Gavumenti erangiridde nti Mmande lunaku lwa luwummula.', 'lug', 'eng'))
}
if (status.llm) {
  await step('Groq chat (JSON mode)', async () => openAiCompatibleLlm(env).complete({ system: 'Reply with JSON {"ok": true, "model_says": "<three words>"}', user: 'Say hello.', json: true, maxTokens: 300 }))
}
if (status.brave) {
  await step('Brave web search', async () => {
    const r = await braveSearch(env.BRAVE_SEARCH_API_KEY as string).search('Uganda public holidays 2026')
    return `${r.length} results; first: ${r[0]?.title} (${r[0]?.url})`
  })
}
if (status.factcheck) {
  await step('Google Fact Check', async () => {
    const r = await googleFactCheck(env.GOOGLE_FACTCHECK_API_KEY as string).search('public holiday declared')
    return `${r.length} results; first: ${r[0]?.title}`
  })
}
if (status.whatsapp) {
  await step('Green API instance state', async () => {
    const res = await fetch(`${env.GREENAPI_URL}/waInstance${env.GREENAPI_ID_INSTANCE}/getStateInstance/${env.GREENAPI_API_TOKEN_INSTANCE}`)
    return `HTTP ${res.status}: ${await res.text()}`
  })
}
