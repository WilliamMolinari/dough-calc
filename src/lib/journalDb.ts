import { normalizeBakes, stripBakePhotos } from "./storage";
import type { BakeEntry } from "./types";

/**
 * Journal storage in IndexedDB.
 *
 * v2 keeps one record per bake instead of one blob for the whole journal, so
 * editing a note no longer rewrites every other bake's photos. The ordered id
 * list lives in `meta` because an object store returns records sorted by key,
 * and bake ids are random UUIDs. v1 journals are migrated inside the upgrade
 * transaction, so a reader never sees a half-moved journal.
 *
 * localStorage keeps a photo-stripped mirror for the first paint and the AI
 * context; it is never the source of truth once the database answers.
 */
const DB_NAME = "doughlab";
const DB_VERSION = 2;
const LEGACY_STORE = "journal";
const BAKES_STORE = "bakes";
const META_STORE = "meta";
const SNAPSHOTS_STORE = "snapshots";
const LEGACY_KEY = "bakes";
const ORDER_KEY = "order";

/** Restore points kept on this device. Old ones are pruned on every snapshot. */
export const MAX_SNAPSHOTS = 5;

export type JournalDbFailure = "unavailable" | "quota" | "blocked" | "unknown";

export type JournalDbLoad =
  | { ok: true; bakes: BakeEntry[] | null }
  | { ok: false; reason: JournalDbFailure };

export interface JournalDbSave {
  ok: boolean;
  reason?: JournalDbFailure;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Serialized records already in the database, so a save only writes changes. */
let savedRecords = new Map<string, string>();

export function journalDbSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

export function failureReason(error: unknown): JournalDbFailure {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const text = `${name} ${message}`.toLowerCase();
  if (text.includes("quota")) return "quota";
  if (text.includes("blocked")) return "blocked";
  if (text.includes("unavailable") || text.includes("not supported")) return "unavailable";
  return "unknown";
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
        const tx = request.transaction;

        if (!db.objectStoreNames.contains(BAKES_STORE)) {
          db.createObjectStore(BAKES_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
        if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
          db.createObjectStore(SNAPSHOTS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(LEGACY_STORE)) db.createObjectStore(LEGACY_STORE);

        // v1 → v2: split the single blob into per-bake records while the
        // version-change transaction is still open. A failed migration leaves
        // the old blob untouched, and load() falls back to it.
        if (!tx) return;
        const legacy = tx.objectStore(LEGACY_STORE);
        const requestLegacy = legacy.get(LEGACY_KEY);
        requestLegacy.onsuccess = () => {
          const raw = requestLegacy.result;
          if (!Array.isArray(raw) || raw.length === 0) return;
          const bakes = normalizeBakes(raw);
          const store = tx.objectStore(BAKES_STORE);
          for (const bake of bakes) store.put(bake);
          tx.objectStore(META_STORE).put(
            bakes.map((bake) => bake.id),
            ORDER_KEY,
          );
        };
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

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function orderBakes(records: BakeEntry[], order: unknown): BakeEntry[] {
  const byId = new Map(records.map((bake) => [bake.id, bake]));
  const ordered: BakeEntry[] = [];
  if (Array.isArray(order)) {
    for (const id of order) {
      const bake = typeof id === "string" ? byId.get(id) : undefined;
      if (bake) {
        ordered.push(bake);
        byId.delete(bake.id);
      }
    }
  }
  // Anything the order list missed still belongs in the journal.
  return [...ordered, ...byId.values()];
}

/** Primes the write cache so the first save after a load is a no-op. */
function primeCache(bakes: BakeEntry[]): void {
  savedRecords = new Map(bakes.map((bake) => [bake.id, JSON.stringify(bake)]));
}

export async function loadJournalFromDb(): Promise<JournalDbLoad> {
  try {
    const db = await openDb();
    const tx = db.transaction([BAKES_STORE, META_STORE], "readonly");
    const records = await requestResult(tx.objectStore(BAKES_STORE).getAll() as IDBRequest<unknown[]>);
    const order = await requestResult(tx.objectStore(META_STORE).get(ORDER_KEY));
    const bakes = normalizeBakes(records);

    if (bakes.length) {
      const ordered = orderBakes(bakes, order);
      primeCache(ordered);
      return { ok: true, bakes: ordered };
    }

    // Nothing in the new store: either a fresh journal or a v1 blob that the
    // upgrade handler could not move. Either way, report it as empty and let
    // the caller decide whether the localStorage mirror should migrate.
    return { ok: true, bakes: null };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }
}

/**
 * Writes only the bakes that changed since the last successful save, and
 * removes records for bakes that are gone. Returns a reason instead of a bare
 * boolean so the UI can tell "full disk" apart from "database unavailable".
 */
export async function saveJournalToDb(bakes: BakeEntry[]): Promise<JournalDbSave> {
  try {
    const db = await openDb();
    const tx = db.transaction([BAKES_STORE, META_STORE], "readwrite");
    const store = tx.objectStore(BAKES_STORE);
    const previousKeys = await requestResult(store.getAllKeys() as IDBRequest<IDBValidKey[]>);
    const liveIds = new Set(bakes.map((bake) => bake.id));

    for (const bake of bakes) {
      const serialized = JSON.stringify(bake);
      if (savedRecords.get(bake.id) === serialized) continue;
      store.put(bake);
      savedRecords.set(bake.id, serialized);
    }

    for (const key of previousKeys) {
      if (typeof key === "string" && !liveIds.has(key)) {
        store.delete(key);
        savedRecords.delete(key);
      }
    }

    tx.objectStore(META_STORE).put(
      bakes.map((bake) => bake.id),
      ORDER_KEY,
    );

    await transactionDone(tx);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Local snapshots                                                     */
/* ------------------------------------------------------------------ */

export type SnapshotReason = "auto" | "manual";

export interface SnapshotMeta {
  id: string;
  at: string;
  /** Bakes in this snapshot. */
  count: number;
  /** Rough UTF-16 size of the stored JSON. */
  bytes: number;
  /** False when photos were dropped to fit in the browser's allowance. */
  photos: boolean;
  reason: SnapshotReason;
}

interface SnapshotRecord extends SnapshotMeta {
  bakes: BakeEntry[];
  app: "DoughLab";
}

function snapshotBytes(bakes: BakeEntry[]): number {
  try {
    return JSON.stringify(bakes).length * 2;
  } catch {
    return 0;
  }
}

function snapshotId(now: number): string {
  return `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function saveSnapshot(
  bakes: BakeEntry[],
  reason: SnapshotReason = "auto",
  now = Date.now(),
): Promise<SnapshotMeta | null> {
  try {
    const db = await openDb();
    const id = snapshotId(now);
    const withPhotos = bakes.some((bake) => bake.photos.length > 0);
    const record: SnapshotRecord = {
      id,
      app: "DoughLab",
      at: new Date(now).toISOString(),
      count: bakes.length,
      bytes: snapshotBytes(bakes),
      photos: withPhotos,
      reason,
      bakes,
    };

    const write = async (payload: SnapshotRecord) => {
      const tx = db.transaction(SNAPSHOTS_STORE, "readwrite");
      tx.objectStore(SNAPSHOTS_STORE).put(payload);
      await transactionDone(tx);
    };

    try {
      await write(record);
    } catch (error) {
      if (failureReason(error) !== "quota" || !withPhotos) throw error;
      // A photo-less snapshot still restores every formula, rating and note.
      const lighter: SnapshotRecord = {
        ...record,
        bakes: stripBakePhotos(bakes),
        photos: false,
        bytes: snapshotBytes(stripBakePhotos(bakes)),
      };
      await write(lighter);
    }

    await pruneSnapshots();
    return {
      id: record.id,
      at: record.at,
      count: record.count,
      bytes: record.bytes,
      photos: record.photos,
      reason: record.reason,
    };
  } catch {
    return null;
  }
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(SNAPSHOTS_STORE, "readonly");
    const records = await requestResult(
      tx.objectStore(SNAPSHOTS_STORE).getAll() as IDBRequest<SnapshotRecord[]>,
    );
    if (!Array.isArray(records)) return [];
    return records
      .filter((record) => record && typeof record.id === "string")
      .map(({ bakes: _bakes, app: _app, ...meta }) => meta)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  } catch {
    return [];
  }
}

export async function loadSnapshot(id: string): Promise<BakeEntry[] | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(SNAPSHOTS_STORE, "readonly");
    const record = await requestResult(
      tx.objectStore(SNAPSHOTS_STORE).get(id) as IDBRequest<SnapshotRecord | undefined>,
    );
    if (!record || !Array.isArray(record.bakes)) return null;
    return normalizeBakes(record.bakes);
  } catch {
    return null;
  }
}

export async function deleteSnapshot(id: string): Promise<boolean> {
  try {
    const db = await openDb();
    const tx = db.transaction(SNAPSHOTS_STORE, "readwrite");
    tx.objectStore(SNAPSHOTS_STORE).delete(id);
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  }
}

async function pruneSnapshots(keep = MAX_SNAPSHOTS): Promise<void> {
  const metas = await listSnapshots();
  const extra = metas.slice(keep);
  if (!extra.length) return;
  try {
    const db = await openDb();
    const tx = db.transaction(SNAPSHOTS_STORE, "readwrite");
    for (const meta of extra) tx.objectStore(SNAPSHOTS_STORE).delete(meta.id);
    await transactionDone(tx);
  } catch {
    /* pruning is housekeeping, never a reason to fail a save */
  }
}

/** Empties every store (bakes, order, snapshots) and forgets the write cache. */
export async function clearJournalDb(): Promise<boolean> {
  try {
    const db = await openDb();
    const names = Array.from(db.objectStoreNames);
    if (names.length) {
      const tx = db.transaction(names, "readwrite");
      for (const name of names) tx.objectStore(name).clear();
      await transactionDone(tx);
    }
    savedRecords = new Map();
    return true;
  } catch {
    return false;
  }
}

/** Test hook: close the cached connection and forget what is on disk. */
export function resetJournalDbCache(): void {
  if (dbPromise) {
    void dbPromise.then((db) => db.close()).catch(() => undefined);
  }
  savedRecords = new Map();
  dbPromise = null;
}
