import { normalizeBakes } from "./storage";
import type { BakeEntry } from "./types";

/**
 * Full journal storage in IndexedDB. localStorage keeps a metadata mirror so
 * the first paint and the AI context stay synchronous; photos (the part that
 * does not fit in 5 MB) live here.
 */
const DB_NAME = "doughlab";
const DB_VERSION = 1;
const STORE = "journal";
const JOURNAL_KEY = "bakes";

export type JournalDbLoad =
  | { ok: true; bakes: BakeEntry[] | null }
  | { ok: false };

let dbPromise: Promise<IDBDatabase> | null = null;

export function journalDbSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (!journalDbSupported()) return Promise.reject(new Error("IndexedDB is unavailable"));

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn: (value: IDBDatabase) => void, value: IDBDatabase) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        fn(value);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        dbPromise = null;
        reject(error instanceof Error ? error : new Error("IndexedDB could not be opened"));
      };

      const timer = window.setTimeout(() => fail(new Error("IndexedDB timed out")), 5000);
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        finish(resolve, db);
      };
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error("IndexedDB is blocked by another tab"));
    });
  }

  return dbPromise;
}

export async function loadJournalFromDb(): Promise<JournalDbLoad> {
  try {
    const db = await openDb();
    const raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(JOURNAL_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (raw === undefined) return { ok: true, bakes: null };
    return { ok: true, bakes: normalizeBakes(raw) };
  } catch {
    return { ok: false };
  }
}

export async function saveJournalToDb(bakes: BakeEntry[]): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(bakes, JOURNAL_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}
