import { getClient } from './client';

// Publishing a künye: its PNG goes into the public "kunye" bucket, in the player's
// own folder, and the forum signature links to it. Who may write there is decided
// by supabase/schema.sql, not here.

export const KUNYE_BUCKET = 'kunye';
/** The bucket refuses larger files too; checking first gives a clear message. */
export const MAX_KUNYE_BYTES = 1_048_576;
/** Seconds the CDN and browsers keep a picture: a re-published künye shows on the forum within this time. */
const CACHE_SECONDS = '300';

export type PublishErrorCode = 'not-ready' | 'not-allowed' | 'too-large' | 'offline' | 'failed';

export class PublishError extends Error {
  constructor(public code: PublishErrorCode) {
    super(code);
  }
}

/** Reads a Storage error. A failed connection has no status at all. */
export function publishErrorCode(error: unknown): PublishErrorCode {
  const e = (error ?? {}) as { message?: unknown; statusCode?: unknown; status?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  const status = String(e.statusCode ?? e.status ?? '');
  if (/bucket not found/i.test(message) || status === '404') return 'not-ready';
  if (status === '401' || status === '403' || /row-level security|unauthori[sz]ed|permission/i.test(message)) {
    return 'not-allowed';
  }
  if (status === '413' || /too large|exceeded the maximum/i.test(message)) return 'too-large';
  if (!status) return 'offline';
  return 'failed';
}

/** Uploads the picture, replacing the one at the same path, and returns its public address. */
export async function publishKunye(path: string, png: Blob): Promise<string> {
  const client = getClient();
  if (!client) throw new PublishError('not-ready');
  if (png.size > MAX_KUNYE_BYTES) throw new PublishError('too-large');
  const bucket = client.storage.from(KUNYE_BUCKET);
  const { error } = await bucket.upload(path, png, { upsert: true, contentType: 'image/png', cacheControl: CACHE_SECONDS });
  if (error) throw new PublishError(publishErrorCode(error));
  return bucket.getPublicUrl(path).data.publicUrl;
}

/** Takes a published picture down. False if it could not be removed, or was not this account's. */
export async function unpublishKunye(path: string): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  const { data, error } = await client.storage.from(KUNYE_BUCKET).remove([path]);
  return !error && (data?.length ?? 0) > 0;
}
