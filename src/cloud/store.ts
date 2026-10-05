import { create } from 'zustand';
import { normalizeReport } from '../store';
import type { Report } from '../types';
import { getClient } from './client';
import { cloudEnabled } from './config';

// State for the shared archive: who is signed in, and what has been published.
// Everything here is optional — with no archive configured, none of it runs.

export type Visibility = 'everyone' | 'gms';

/** What the archive list shows. The report itself is fetched only when opened. */
export interface ArchiveEntry {
  id: string;
  localId: string;
  authorId: string;
  authorName: string;
  visibility: Visibility;
  title: string;
  docNo: string;
  templateName: string;
  classification: string;
  accent: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  displayName: string;
  isGm: boolean;
  isMember: boolean;
}

const COLUMNS =
  'id, local_id, author_id, author_name, visibility, title, doc_no, template_name, classification, accent, created_at, updated_at';

/** Rows above this are refused by the database too; checking first gives a clear message. */
const MAX_REPORT_BYTES = 3_500_000;

type Row = Record<string, unknown>;
const s = (v: unknown): string => (typeof v === 'string' ? v : '');

function toEntry(row: Row): ArchiveEntry {
  return {
    id: s(row.id),
    localId: s(row.local_id),
    authorId: s(row.author_id),
    authorName: s(row.author_name),
    visibility: row.visibility === 'gms' ? 'gms' : 'everyone',
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

interface CloudState {
  /** True once we know whether someone is signed in. */
  ready: boolean;
  /** This browser's identity in the archive. There are no accounts behind it. */
  user: { id: string } | null;
  profile: Profile | null;
  list: ArchiveEntry[];
  listState: 'idle' | 'loading' | 'ready' | 'error';
  /** The signed-in user's own published reports. */
  mine: ArchiveEntry[];

  init: () => void;
  /** Joins with a name and a campaign code, creating this browser's identity if it has none. */
  enter: (name: string, code: string) => Promise<'ok' | 'bad-code' | 'failed'>;
  signOut: () => Promise<void>;
  rename: (name: string) => Promise<boolean>;
  join: (code: string) => Promise<boolean>;
  refreshList: () => Promise<void>;
  fetchReport: (id: string) => Promise<{ entry: ArchiveEntry; report: Report } | null>;
  publish: (report: Report, visibility: Visibility) => Promise<ArchiveEntry>;
  unpublish: (id: string) => Promise<boolean>;
}

let started = false;

export const useCloud = create<CloudState>((set, get) => {
  async function loadAccount(userId: string) {
    const client = getClient();
    if (!client) return;
    const [profile, mine] = await Promise.all([
      client.from('profiles').select('display_name, is_gm, is_member').eq('id', userId).maybeSingle(),
      client.from('published_reports').select(COLUMNS).eq('author_id', userId).order('updated_at', { ascending: false }),
    ]);
    // Ignore the answer if the user signed out or changed while we were asking.
    if (get().user?.id !== userId) return;
    set({
      profile: profile.data
        ? {
            displayName: s(profile.data.display_name),
            isGm: profile.data.is_gm === true,
            isMember: profile.data.is_member === true,
          }
        : null,
      mine: (mine.data ?? []).map(toEntry),
    });
  }

  return {
    ready: !cloudEnabled,
    user: null,
    profile: null,
    list: [],
    listState: 'idle',
    mine: [],

    init() {
      const client = getClient();
      if (!client || started) return;
      started = true;

      client.auth.onAuthStateChange((_event, session) => {
        const previous = get().user?.id ?? null;
        const user = session?.user ? { id: session.user.id } : null;
        set({ ready: true, user, ...(user ? {} : { profile: null, mine: [] }) });
        if (user?.id === previous) return;
        // The client must not be called from inside its own auth callback.
        setTimeout(() => {
          if (user) void loadAccount(user.id);
          // What a visitor may see depends on who they are, so reload the list.
          if (get().listState !== 'idle') void get().refreshList();
        }, 0);
      });
    },

    async enter(name, code) {
      const client = getClient();
      if (!client) return 'failed';
      let userId = get().user?.id;
      if (!userId) {
        // No email and no password: the browser gets an identity of its own.
        const { data, error } = await client.auth.signInAnonymously();
        if (error || !data.user) return 'failed';
        userId = data.user.id;
        if (get().user?.id !== userId) set({ ready: true, user: { id: userId } });
      }
      const displayName = name.trim().slice(0, 60);
      const renamed = await client.from('profiles').update({ display_name: displayName }).eq('id', userId);
      const joined = await client.rpc('join_campaign', { code });
      await loadAccount(userId);
      if (renamed.error || joined.error) return 'failed';
      return joined.data === true ? 'ok' : 'bad-code';
    },

    async signOut() {
      // "local" ends the session in this browser only, and works even when offline.
      await getClient()?.auth.signOut({ scope: 'local' });
    },

    async rename(name) {
      const client = getClient();
      const user = get().user;
      if (!client || !user) return false;
      const displayName = name.trim().slice(0, 60);
      const { error } = await client.from('profiles').update({ display_name: displayName }).eq('id', user.id);
      if (error) return false;
      const profile = get().profile;
      if (profile) set({ profile: { ...profile, displayName } });
      return true;
    },

    async join(code) {
      const client = getClient();
      const user = get().user;
      if (!client || !user) return false;
      const { data, error } = await client.rpc('join_campaign', { code });
      if (error || data !== true) return false;
      await loadAccount(user.id);
      return true;
    },

    async refreshList() {
      const client = getClient();
      if (!client) return;
      set({ listState: get().list.length ? 'ready' : 'loading' });
      const { data, error } = await client
        .from('published_reports')
        .select(COLUMNS)
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) set({ listState: 'error' });
      else set({ list: (data ?? []).map(toEntry), listState: 'ready' });
    },

    async fetchReport(id) {
      const client = getClient();
      if (!client) return null;
      const { data, error } = await client
        .from('published_reports')
        .select(`${COLUMNS}, report`)
        .eq('id', id)
        .maybeSingle();
      if (error) throw new CloudError('offline');
      if (!data) return null;
      // Whatever is in the archive was written by someone else: check it like an imported file.
      const report = normalizeReport(data.report);
      return report ? { entry: toEntry(data), report } : null;
    },

    async publish(report, visibility) {
      const client = getClient();
      const user = get().user;
      if (!client || !user) throw new CloudError('not-allowed');
      if (new Blob([JSON.stringify(report)]).size > MAX_REPORT_BYTES) throw new CloudError('too-large');
      const { data, error } = await client
        .from('published_reports')
        .upsert(
          {
            // The database sets the real author from the login; this only lets
            // it match an earlier publication of the same report.
            author_id: user.id,
            local_id: report.id,
            visibility,
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
        // 42501: refused by the access rules (not a member, or signed out meanwhile).
        throw new CloudError(error?.code === '42501' ? 'not-allowed' : error?.code === '23514' ? 'too-large' : 'failed');
      }
      const entry = toEntry(data);
      set({
        mine: [entry, ...get().mine.filter((e) => e.id !== entry.id)],
        list: get().listState === 'idle' ? get().list : [entry, ...get().list.filter((e) => e.id !== entry.id)],
      });
      return entry;
    },

    async unpublish(id) {
      const client = getClient();
      if (!client) return false;
      // Ask for the removed row back: the access rules silently skip rows that
      // are not ours to remove, and an empty answer is how that shows.
      const { data, error } = await client.from('published_reports').delete().eq('id', id).select('id');
      if (error || !data?.length) return false;
      set({ mine: get().mine.filter((e) => e.id !== id), list: get().list.filter((e) => e.id !== id) });
      return true;
    },
  };
});
