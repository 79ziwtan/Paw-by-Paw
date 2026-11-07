import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Signed-out client for the public owner pages (/o/…, /u/…). It never reads the staff login
 * stored in this browser, so anything an owner does through their link is done as the owner
 * (anonymous + token), not as whichever staff member happens to be signed in here.
 */
export const publicSupabase = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'paw-owner-link' },
})
