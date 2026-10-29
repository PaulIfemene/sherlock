// Local demo only: the replies the canned WhatsApp adapter would have sent. Lets you rehearse the
// WhatsApp flow without Green API credentials. Recipients are masked; nothing is stored on disk.
import { buildDeps } from '../../engine/adapters'
import { demoOutbox } from '../../engine/adapters/greenapi'
import { error, isLocal, json } from '../lib/http'

export default async (req: Request): Promise<Response> => {
  const deps = buildDeps()
  if (!deps.config.demoMode || deps.whatsapp.live || !isLocal(req)) return error(404, 'Not found')
  return json({ simulated: true, messages: demoOutbox })
}
