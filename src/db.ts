import type { Kunye, Report, Template } from './types';

// Reports can carry images, so they live in IndexedDB rather than localStorage.
// If the database cannot be opened (private mode, blocked storage) the app keeps
// working from memory and tells the user.

const DB_NAME = 'yk-reunion-reports';
/** 1: reports and templates. 2: künyeler. */
const DB_VERSION = 2;

export type StoreName = 'reports' | 'templates' | 'kunyeler';
const STORES: StoreName[] = ['reports', 'templates', 'kunyeler'];

let dbPromise: Promise<IDBDatabase | null> | null = null;
let blocked: (() => void) | null = null;
let replaced: (() => void) | null = null;

/** Called while an older version of the app, open in another tab, holds up the upgrade. */
export function onBlocked(listener: () => void): void {
  blocked = listener;
}

/** Called when a newer version, opened in another tab, took the database over from this tab. */
export function onReplaced(listener: () => void): void {
  replaced = listener;
}

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        // A newer version wants to upgrade: step aside rather than hold it up.
        // Anything written here after that would be lost, so the user is told to reload.
        db.onversionchange = () => {
          db.close();
          dbPromise = Promise.resolve(null);
          replaced?.();
        };
        resolve(db);
      };
      req.onerror = () => resolve(null);
      // An older version is open in another tab and does not step aside. Keep
      // waiting: success follows as soon as that tab is closed or reloaded.
      req.onblocked = () => blocked?.();
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function getAll<T>(db: IDBDatabase, store: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAll(): Promise<{ reports: Report[]; templates: Template[]; kunyeler: Kunye[]; ok: boolean }> {
  const db = await open();
  if (!db) return { reports: [], templates: [], kunyeler: [], ok: false };
  try {
    const [reports, templates, kunyeler] = await Promise.all([
      getAll<Report>(db, 'reports'),
      getAll<Template>(db, 'templates'),
      getAll<Kunye>(db, 'kunyeler'),
    ]);
    return { reports, templates, kunyeler, ok: true };
  } catch {
    return { reports: [], templates: [], kunyeler: [], ok: false };
  }
}

export async function put(store: StoreName, record: { id: string }): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

export async function del(store: StoreName, id: string): Promise<void> {
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}
