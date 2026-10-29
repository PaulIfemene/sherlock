// Short-lived signed URL for a claim image, for the journalist's case view and reverse search.
import { buildDeps } from '../../engine/adapters'
import { reverseSearchLinks } from '../../engine/evidence'
import { error, json, requireJournalist } from '../lib/http'

export default async (req: Request): Promise<Response> => {
  const deps = buildDeps()
  const journalist = await requireJournalist(req, deps.db)
  if (journalist instanceof Response) return journalist
  const id = new URL(req.url).searchParams.get('claim_id') ?? ''
  const { data: claim } = await deps.db!.from('claims').select('image_path').eq('id', id).maybeSingle()
  if (!claim?.image_path) return json({ url: null, reverse: [] })
  const { data, error: signError } = await deps.db!.storage.from('claim-media').createSignedUrl(claim.image_path as string, 60 * 60)
  if (signError || !data) return error(500, 'Could not sign the image URL')
  return json({ url: data.signedUrl, reverse: reverseSearchLinks(data.signedUrl) })
}
