import { create } from 'zustand';
import { normalizeReport } from '../store';
import type { Report } from '../types';
import { getClient } from './client';
import { LOGIN_MAILBOX, cloudEnabled } from './config';
import { loginEmail, loginName, nameFromEmail } from './login';

// State for the personal archive: who is signed in, and which reports they keep there.
// Everything here is optional — with no archive configured, none of it runs.

export type Status = 'draft' | 'final';

/** What the archive list shows. The report itself is fetched only when opened. */
export interface ArchiveEntry {
  id: string;
  /** The report's id in the library it was saved from. */
  localId: string;
  status: Status;
  title: string;
  docNo: string;
  templateName: string;
  classification: string;
  accent: string;
  createdAt: string;
  updatedAt: string;
}

const TABLE = 'archived_reports';
const COLUMNS = 'id, local_id, status, title, doc_no, template_name, classification, accent, created_at, updated_at';

/** Rows above this are refused by the database too; checking first gives a clear message. */
const MAX_REPORT_BYTES = 3_500_000;

type Row = Record<string, unknown>;
const s = (v: unknown): string => (typeof v === 'string' ? v : '');

function toEntry(row: Row): ArchiveEntry {
  return {
    id: s(row.id),
    localId: s(row.local_id),
    status: row.status === 'final' ? 'final' : 'draft',
    title: s(row.title),
    docNo: s(row.doc_no),
    templateName: s(row.template_name),
    classification: s(row.classification) || 'none',
    accent: /^#[0-9a-f]{6}$/i.test(s(row.accent)) ? s(row.accent) : '#3fd0c9',
    createdAt: s(row.created_at),
    updatedAt: s(row.updated_at),
  };
}

export class CloudError extends Error {
  constructor(public code: 'offline' | 'too-large' | 'not-allowed' | 'failed') {
    super(code);
  }
}

/** How signing in or making an account ended. `detail` is the service's own wording, for the cases we do not know. */
export interface LoginResult {
  code: 'ok' | 'bad-name' | 'bad-login' | 'taken' | 'weak' | 'unconfirmed' | 'bad-code' | 'failed';
  detail?: string;
}

interface CloudState {
  /** True once we know whether someone is signed in. */
  ready: boolean;
  user: { id: string; name: string } | null;
  /** Whether the account has entered the campaign code. Null until it is known. */
  member: boolean | null;
  /** The signed-in user's archived reports, newest first. */
  list: ArchiveEntry[];
  listState: 'idle' | 'loading' | 'ready' | 'error';

  init: () => void;
  signIn: (name: string, password: string) => Promise<LoginResult>;
  /** Makes the account and, with the campaign code, lets it save. */
  signUp: (name: string, password: string, code: string) => Promise<LoginResult>;
  signOut: () => Promise<void>;
  changePassword: (password: string) => Promise<boolean>;
  join: (code: string) => Promise<boolean>;
  refreshList: () => Promise<void>;
  fetchReport: (id: string) => Promise<{ entry: ArchiveEntry; report: Report } | null>;
  save: (report: Report, status: Status) => Promise<ArchiveEntry>;
  remove: (id: string) => Promise<boolean>;
}

let started = false;

export const useCloud = create<CloudState>((set, get) => {
  async function loadAccount(userId: string) {
    const client = getClient();
    if (!client) return;
    set({ listState: get().list.length ? 'ready' : 'loading' });
    const [profile, list] = await Promise.all([
      client.from('profiles').select('is_member').eq('id', userId).maybeSingle(),
      client.from(TABLE).select(COLUMNS).eq('author_id', userId).order('updated_at', { ascending: false }).limit(1000),
    ]);
    // Ignore the answer if the user signed out or changed while we were asking.
    if (get().user?.id !== userId) return;
    set({
      member: profile.error ? get().member : profile.data?.is_member === true,
      ...(list.error ? { listState: 'error' } : { list: (list.data ?? []).map(toEntry), listState: 'ready' }),
    });
  }

  return {
    ready: !cloudEnabled,
    user: null,
    member: null,
    list: [],
    listState: 'idle',

    init() {
      const client = getClient();
      if (!client || started) return;
      started = true;

      client.auth.onAuthStateChange((_event, session) => {
        // The shared archive this replaced gave each browser a nameless identity. One of
        // those may still be stored here; it owns nothing in the personal archive.
        if (session?.user?.is_anonymous) {
          setTimeout(() => void client.auth.signOut({ scope: 'local' }), 0);
          set({ ready: true });
          return;
        }
        const previous = get().user?.id ?? null;
        const user = session?.user ? { id: session.user.id, name: nameFromEmail(session.user.email ?? '') } : null;
        set({ ready: true, user, ...(user ? {} : { member: null, list: [], listState: 'idle' }) });
        if (!user || user.id === previous) return;
        // The client must not be called from inside its own auth callback.
        setTimeout(() => void loadAccount(user.id), 0);
      });
    },

    async signIn(name, password) {
      const client = getClient();
      const login = loginName(name);
      if (!client) return { code: 'failed' };
      if (!login) return { code: 'bad-name' };
      const { error } = await client.auth.signInWithPassword({ email: loginEmail(login, LOGIN_MAILBOX), password });
      if (!error) return { code: 'ok' };
      if (error.code === 'email_not_confirmed') return { code: 'unconfirmed' };
      if (error.code === 'invalid_credentials' || /invalid login/i.test(error.message)) return { code: 'bad-login' };
      return { code: 'failed', detail: error.message };
    },

    async signUp(name, password, code) {
      const client = getClient();
      const login = loginName(name);
      if (!client) return { code: 'failed' };
      if (!login) return { code: 'bad-name' };
      const { data, error } = await client.auth.signUp({
        email: loginEmail(login, LOGIN_MAILBOX),
        password,
        options: { data: { display_name: name.trim().slice(0, 60) } },
      });
      if (error) {
        if (error.code === 'user_already_exists' || /already registered/i.test(error.message)) return { code: 'taken' };
        if (error.code === 'weak_password') return { code: 'weak' };
        // The project tried to mail a confirmation and could not: the same dashboard setting as below.
        if (/confirmation (e-?mail|mail)/i.test(error.message)) return { code: 'unconfirmed' };
        return { code: 'failed', detail: error.message };
      }
      // No session means the project still wants the address confirmed by mail: a
      // dashboard setting, not something the person signing up can fix.
      if (!data.session || !data.user) return { code: 'unconfirmed' };
      const userId = data.user.id;
      if (get().user?.id !== userId) set({ ready: true, user: { id: userId, name: login } });
      const joined = await client.rpc('join_campaign', { code });
      await loadAccount(userId);
      return joined.data === true ? { code: 'ok' } : { code: 'bad-code' };
    },

    async signOut() {
      // "local" ends the session in this browser only, and works even when offline.
      await getClient()?.auth.signOut({ scope: 'local' });
    },

    async changePassword(password) {
      const client = getClient();
      if (!client || !get().user) return false;
      const { error } = await client.auth.updateUser({ password });
      return !error;
    },

    async join(code) {
      const client = getClient();
      const user = get().user;
      if (!client || !user) return false;
      const { data, error } = await client.rpc('join_campaign', { code });
      if (error || data !== true) return false;
      set({ member: true });
      return true;
    },

    async refreshList() {
      const user = get().user;
      if (user) await loadAccount(user.id);
    },

    async fetchReport(id) {
      const client = getClient();
      if (!client) return null;
      const { data, error } = await client.from(TABLE).select(`${COLUMNS}, report`).eq('id', id).maybeSingle();
      if (error) throw new CloudError('offline');
      if (!data) return null;
      // Check what comes back like an imported file: it has been outside this app.
      const report = normalizeReport(data.report);
      return report ? { entry: toEntry(data), report } : null;
    },

    async save(report, status) {
      const client = getClient();
      const user = get().user;
      if (!client || !user) throw new CloudError('not-allowed');
      if (new Blob([JSON.stringify(report)]).size > MAX_REPORT_BYTES) throw new CloudError('too-large');
      const { data, error } = await client
        .from(TABLE)
        .upsert(
          {
            // The database sets the real owner from the login; this only lets it
            // find the row this report was saved to before.
            author_id: user.id,
            local_id: report.id,
            status,
            title: report.title,
            doc_no: report.docNo,
            template_name: report.template.name,
            classification: report.classification,
            accent: report.template.accent,
            report,
          },
          { onConflict: 'author_id,local_id' },
        )
        .select(COLUMNS)
        .single();
      if (error || !data) {
        // 42501: refused by the access rules (no campaign code yet, or signed out meanwhile).
        throw new CloudError(error?.code === '42501' ? 'not-allowed' : error?.code === '23514' ? 'too-large' : 'failed');
      }
      const entry = toEntry(data);
      set({ list: [entry, ...get().list.filter((e) => e.id !== entry.id)], listState: 'ready' });
      return entry;
    },

    async remove(id) {
      const client = getClient();
      if (!client) return false;
      // Ask for the removed row back: the access rules silently skip rows that
      // are not ours to remove, and an empty answer is how that shows.
      const { data, error } = await client.from(TABLE).delete().eq('id', id).select('id');
      if (error || !data?.length) return false;
      set({ list: get().list.filter((e) => e.id !== id) });
      return true;
    },
  };
});

/** True when the library's copy has been edited since it was last saved to the archive. */
export function isStale(entry: ArchiveEntry, report: Report): boolean {
  const saved = Date.parse(entry.updatedAt);
  // A few seconds of slack: the two times come from different clocks.
  return Number.isFinite(saved) && report.updatedAt > saved + 5000;
}
