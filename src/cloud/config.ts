// Connection to the shared campaign archive (a Supabase project).
//
// Paste the two values from the Supabase dashboard (Project Settings → API)
// between the quotes below. Both are public by design: they only say which
// project to talk to. What anyone may read or write is decided by the access
// rules in supabase/schema.sql, not by keeping these values secret.
//
// While they are empty the app works exactly as before, with no archive.

const PROJECT_URL = 'https://bgaymjxpzalukzryptwu.supabase.co';
const PUBLIC_KEY = 'sb_publishable_HQ5QBskDym4E6b9qMkFmpQ_qm7A8ikW'; // publishable key — never the secret / service_role key

/** Set to true after enabling the Discord provider in Supabase (Authentication → Providers). */
export const DISCORD_LOGIN = false;

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || PROJECT_URL;
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY || PUBLIC_KEY;

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);
