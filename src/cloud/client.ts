import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL, cloudEnabled } from './config';

let client: SupabaseClient | null = null;

/** The archive connection, or null when the app is not configured for one. */
export function getClient(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

/** Where a sign-in link should bring the user back to. A page opened from disk
 *  has no address to return to, so there the emailed code is used instead. */
export function returnUrl(): string | undefined {
  if (window.location.protocol === 'file:') return undefined;
  return window.location.origin + window.location.pathname;
}
