import type { Report, Template } from './types';

// Reports can carry images, so they live in IndexedDB rather than localStorage.
// If the database cannot be opened (private mode, blocked storage) the app keeps
// working from memory and tells the user.

const DB_NAME = 'yk-reunion-reports';
const DB_VERSION = 1;

export type StoreName = 'reports' | 'templates';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('reports')) db.createObjectStore('reports', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
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

export async function loadAll(): Promise<{ reports: Report[]; templates: Template[]; ok: boolean }> {
  const db = await open();
  if (!db) return { reports: [], templates: [], ok: false };
  try {
    const [reports, templates] = await Promise.all([
      getAll<Report>(db, 'reports'),
      getAll<Template>(db, 'templates'),
    ]);
    return { reports, templates, ok: true };
  } catch {
    return { reports: [], templates: [], ok: false };
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
