import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

// Server-side Supabase client using the service-role key. Never expose this
// key to the browser — it bypasses RLS. Only the API (this folder) imports it.
export function db(): SupabaseClient {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tidak ditetapkan (env var).',
    )
  }
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}
