// Local dev only: render the rising-claim email with fictional demo values, to check the design.
import { risingAlertHtml } from '../../engine/adapters/email'
import { isLocal } from '../lib/http'

export default async (req: Request): Promise<Response> => {
  if (!isLocal(req)) return new Response('Not found', { status: 404 })
  const html = risingAlertHtml({
    claimText: 'Monday is an official public holiday, according to a ministry notice.',
    count: 100,
    delta: 99,
    language: 'Luganda',
    dashboardUrl: 'http://localhost:5173/newsroom',
    isDemo: true,
  })
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
