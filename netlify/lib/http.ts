// Shared helpers for Netlify Functions: JSON responses, journalist auth and internal calls.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })
}

export function error(status: number, message: string): Response {
  return json({ error: message }, status)
}

export interface Journalist {
  id: string
  display_name: string
  newsroom: string
  email: string
}

/** Verify the Supabase JWT and that the user is a journalist. */
export async function requireJournalist(req: Request, db: SupabaseClient | null): Promise<Journalist | Response> {
  if (!db) return error(503, 'Supabase is not configured')
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return error(401, 'Sign in required')
  const { data, error: authError } = await db.auth.getUser(token)
  if (authError || !data.user) return error(401, 'Session expired, sign in again')
  const { data: journalist } = await db.from('journalists').select('id,display_name,newsroom,email').eq('id', data.user.id).maybeSingle()
  if (!journalist) return error(403, 'This account is not a newsroom journalist')
  return journalist as Journalist
}

// Without PHONE_HASH_SECRET, a random per-process secret: fine for `npm run dev` (one process),
// but separate Netlify functions would not match, so production must set the secret.
const devSecret = randomBytes(32).toString('hex')

/** Secret for function-to-function calls. Derived from PHONE_HASH_SECRET unless set explicitly. */
export function internalSecret(env = process.env): string {
  if (env.INTERNAL_FUNCTION_SECRET) return env.INTERNAL_FUNCTION_SECRET
  if (!env.PHONE_HASH_SECRET) return devSecret
  return createHmac('sha256', env.PHONE_HASH_SECRET).update('internal-functions').digest('hex')
}

export function isInternal(req: Request): boolean {
  const given = Buffer.from(req.headers.get('x-sherlock-internal') ?? '')
  const expected = Buffer.from(internalSecret())
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Fire the background processor. Netlify answers 202 straight away. */
export async function triggerBackground(origin: string, payload: unknown): Promise<void> {
  const res = await fetch(`${origin}/.netlify/functions/process-message-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sherlock-internal': internalSecret() },
    body: JSON.stringify(payload),
  })
  if (res.status >= 400) throw new Error(`background trigger failed: HTTP ${res.status}`)
}

/** Public site origin: Netlify's URL in production, the request origin elsewhere. */
export function siteOrigin(req: Request): string {
  return process.env.URL && process.env.CONTEXT === 'production' ? process.env.URL : new URL(req.url).origin
}

/** True for requests to a local dev server. Never true on Netlify. */
export function isLocal(req: Request): boolean {
  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) return false
  return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(req.url).hostname)
}
