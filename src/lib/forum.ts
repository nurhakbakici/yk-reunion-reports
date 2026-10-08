// "Foruma gönder": the board list from kulesakinleri.org, and the hand-over to the forum's New Topic tab.
// The forum side is kule-ankha.js in the Kule theme (repo Zamir-00/kulesakinleri-tema); both follow
// docs/superpowers/specs/2026-10-08-ankha-forum-design.md there. The player always posts the topic themselves.
import type { Classification } from '../types';

export const FORUM_ORIGIN = 'https://kulesakinleri.org';
export const BOARDS_URL = `${FORUM_ORIGIN}/reunion-bolumler.php`;
/** The forum tab's name. It survives the forum's login redirect, which is how kule-ankha.js knows the tab. */
export const FORUM_WINDOW = 'ankha-forum';
/** Without an answer from the forum tab for this long, the dialog says what to check. */
export const HANDOFF_TIMEOUT_MS = 120_000;

export const postUrl = (board: number) => `${FORUM_ORIGIN}/forum/index.php?action=post;board=${board}.0`;

export interface ForumBoard {
  id: number;
  ad: string;
}

export interface ForumBoards {
  bolumler: ForumBoard[];
  varsayilan: { acik: number; diger: number };
  /** ileti: characters; dosya_kb and ileti_kb: kilobytes; 0 means no limit */
  sinirlar: { ileti: number; dosya_kb: number; ileti_kb: number; dosya_sayisi: number };
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** The endpoint's answer, or null when it is not one (forum error page, "hata", no boards). */
export function parseBoards(data: unknown): ForumBoards | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, any>;
  if (!Array.isArray(d.bolumler) || d.bolumler.length === 0) return null;
  const bolumler = d.bolumler.filter((b: any) => isCount(b?.id) && b.id > 0 && typeof b.ad === 'string' && b.ad.trim());
  if (bolumler.length !== d.bolumler.length) return null;
  const v = d.varsayilan ?? {};
  const s = d.sinirlar ?? {};
  if (![v.acik, v.diger, s.ileti, s.dosya_kb, s.ileti_kb, s.dosya_sayisi].every(isCount)) return null;
  return {
    bolumler: bolumler.map((b: any) => ({ id: b.id, ad: b.ad.trim() })),
    varsayilan: { acik: v.acik, diger: v.diger },
    sinirlar: { ileti: s.ileti, dosya_kb: s.dosya_kb, ileti_kb: s.ileti_kb, dosya_sayisi: s.dosya_sayisi },
  };
}

/** The board list, or null when the forum does not answer properly within `timeoutMs`. */
export async function fetchBoards(fetchFn: typeof fetch = fetch, timeoutMs = 5000): Promise<ForumBoards | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(BOARDS_URL, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) return null;
    return parseBoards(JSON.parse(await response.text()));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Open reports go to the open board, every classified one to the other; a board that is gone falls back to the first. */
export function defaultBoard(boards: ForumBoards, classification: Classification): number {
  const wanted = classification === 'none' || classification === 'acik' ? boards.varsayilan.acik : boards.varsayilan.diger;
  return boards.bolumler.some((b) => b.id === wanted) ? wanted : boards.bolumler[0].id;
}

export interface ForumFile {
  ad: string;
  tur: 'application/pdf' | 'image/png';
  veri: Blob;
}

export interface ForumReport {
  kaynak: 'ankha';
  tur: 'rapor';
  surum: 1;
  konu: string;
  metin: string;
  dosyalar: ForumFile[];
}

/**
 * The files that fit the forum's limits, in order of importance (PDF, then preview): each under the per-file limit,
 * and together within the post's total and file count. 0 means no limit.
 */
export function fitFiles(files: ForumFile[], limits: ForumBoards['sinirlar']): ForumFile[] {
  const perFile = limits.dosya_kb * 1024;
  const perPost = limits.ileti_kb * 1024;
  const fitting = files.filter((f) => !perFile || f.veri.size <= perFile);
  const kept: ForumFile[] = [];
  let total = 0;
  for (const file of fitting) {
    if (limits.dosya_sayisi && kept.length >= limits.dosya_sayisi) break;
    if (perPost && total + file.veri.size > perPost) continue;
    kept.push(file);
    total += file.veri.size;
  }
  return kept;
}

/** A file name the forum accepts: ASCII letters, digits, dot, dash and underscore. */
export function forumFileName(base: string, suffix: string, ext: 'pdf' | 'png'): string {
  const tr: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' };
  const clean = `${base}${suffix}`
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => tr[c])
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 76);
  return `${clean || 'rapor'}.${ext}`;
}

export type HandoffStatus =
  | { tur: 'bekliyor' }
  | { tur: 'gonderildi' }
  | { tur: 'alindi'; eklenen: number; ekIzniYok: boolean }
  | { tur: 'hata'; neden: string }
  | { tur: 'zaman-asimi' };

export interface Handoff {
  /** The report is ready: send it now if the forum tab has said it is ready, else when it does. */
  setReport(report: ForumReport): void;
  /** A message event from the window (the caller passes them all; only the forum tab's count). */
  receive(event: { origin: string; source: unknown; data: unknown }): void;
  /** Called on a timer: reports the time-out once. */
  tick(): void;
  readonly done: boolean;
}

/**
 * The hand-over to the forum tab. The tab says "hazir" each time a New Topic page loads in it (again after a
 * login), and the report goes out on every "hazir" until the tab answers "alindi" or "hata".
 */
export function createHandoff(
  tab: { postMessage(message: unknown, targetOrigin: string): void },
  onStatus: (status: HandoffStatus) => void,
  now: () => number = Date.now,
): Handoff {
  const started = now();
  let ready = false;
  let report: ForumReport | null = null;
  let done = false;

  const send = () => {
    if (!ready || !report || done) return;
    tab.postMessage(report, FORUM_ORIGIN);
    onStatus({ tur: 'gonderildi' });
  };

  onStatus({ tur: 'bekliyor' });
  return {
    setReport(next) {
      report = next;
      send();
    },
    receive(event) {
      if (done || event.origin !== FORUM_ORIGIN || event.source !== tab) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.kaynak !== 'kule-forum' || data.surum !== 1) return;
      if (data.tur === 'hazir') {
        ready = true;
        send();
      } else if (data.tur === 'alindi') {
        done = true;
        onStatus({ tur: 'alindi', eklenen: Number(data.eklenen) || 0, ekIzniYok: data.ek === 'izin-yok' });
      } else if (data.tur === 'hata') {
        done = true;
        onStatus({ tur: 'hata', neden: typeof data.neden === 'string' ? data.neden : 'gecersiz' });
      }
    },
    tick() {
      if (done || now() - started < HANDOFF_TIMEOUT_MS) return;
      done = true;
      onStatus({ tur: 'zaman-asimi' });
    },
    get done() {
      return done;
    },
  };
}
