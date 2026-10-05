import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL, cloudEnabled } from './config';

let client: SupabaseClient | null = null;

/** The archive connection, or null when the app is not configured for one. */
export function getClient(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
