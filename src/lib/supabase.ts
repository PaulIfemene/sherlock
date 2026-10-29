// Browser Supabase client (anon key + journalist session). Null when not configured, in which
// case the dashboard runs on the offline demo dataset.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true } }) : null

export const isOffline = supabase === null
