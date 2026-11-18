import {
  journalDbSupported,
  listSnapshots,
  loadJournalFromDb,
  saveJournalToDb,
  saveSnapshot,
  type JournalDbFailure,
  type SnapshotMeta,
  type SnapshotReason,
} from "./journalDb";
import { STORAGE_KEYS, loadBakes, stripBakePhotos, writeStored } from "./storage";
import type { BakeEntry } from "./types";

/**
 * The journal's read/write path, kept out of the component so the ordering
 * rules that protect a baker's notes can be tested directly:
 *
 *   1. IndexedDB is the source of truth once it answers.
 *   2. The localStorage mirror is only written after the database accepted the
 *      batch, and only then loses its photo bytes.
 *   3. A failed database write keeps the whole journal in localStorage as the
 *      fallback it has always been.
 */

export type JournalSource = "db" | "mirror" | "none";

export interface HydratedJournal {
  bakes: BakeEntry[];
  source: JournalSource;
  /** The mirror was copied into the database on this run. */
  migrated: boolean;
  dbAvailable: boolean;
  /** Present when the database refused the read. */
  reason?: JournalDbFailure;
}

export async function hydrateJournal(): Promise<HydratedJournal> {
  const mirror = loadBakes();

  if (!journalDbSupported()) {
    return {
      bakes: mirror,
      source: mirror.length ? "mirror" : "none",
      migrated: false,
      dbAvailable: false,
    };
  }

  const loaded = await loadJournalFromDb();

  if (!loaded.ok) {
    return {
      bakes: mirror,
      source: mirror.length ? "mirror" : "none",
      migrated: false,
      dbAvailable: false,
      reason: loaded.reason,
    };
  }

  if (loaded.bakes !== null) {
    return { bakes: loaded.bakes, source: "db", migrated: false, dbAvailable: true };
  }

  if (mirror.length) {
    const saved = await saveJournalToDb(mirror);
    if (saved.ok) {
      return { bakes: mirror, source: "mirror", migrated: true, dbAvailable: true };
    }
    return {
      bakes: mirror,
      source: "mirror",
      migrated: false,
      dbAvailable: false,
      reason: saved.reason,
    };
  }

  return { bakes: [], source: "db", migrated: false, dbAvailable: true };
}

export interface PersistResult {
  dbSaved: boolean;
  mirrorOk: boolean;
  mirrorError?: string;
  /** The browser refused a write because the origin is full. */
  quota: boolean;
  reason?: JournalDbFailure;
}

export async function persistJournal(bakes: BakeEntry[]): Promise<PersistResult> {
  const saved = await saveJournalToDb(bakes);
  const inDatabase = saved.ok;

  const mirror = writeStored(
    STORAGE_KEYS.bakes,
    inDatabase ? stripBakePhotos(bakes) : bakes,
  );

  return {
    dbSaved: inDatabase,
    mirrorOk: mirror.ok,
    mirrorError: mirror.error,
    quota: !inDatabase && saved.reason === "quota",
    reason: saved.reason,
  };
}

/* ------------------------------------------------------------------ */
/* Snapshots                                                           */
/* ------------------------------------------------------------------ */

/** At most one automatic restore point per half hour of editing. */
export const SNAPSHOT_INTERVAL_MS = 30 * 60_000;

/**
 * A deletion is the one change a time-based rule would miss: the journal can
 * shrink seconds after a snapshot, so losing bakes forces a new one.
 */
export function shouldSnapshot({
  lastAt,
  now,
  previousCount,
  nextCount,
  force = false,
}: {
  lastAt: string | null;
  now: number;
  previousCount: number;
  nextCount: number;
  force?: boolean;
}): boolean {
  if (force) return true;
  if (!lastAt) return true;
  if (nextCount < previousCount) return true;
  const last = new Date(lastAt).getTime();
  if (!Number.isFinite(last)) return true;
  return now - last >= SNAPSHOT_INTERVAL_MS;
}

/** Takes a restore point when due. Never throws; a missing snapshot is fine. */
export async function maybeSnapshot(
  bakes: BakeEntry[],
  previousCount: number,
  now = Date.now(),
): Promise<SnapshotMeta | null> {
  if (!journalDbSupported() || bakes.length === 0) return null;
  const existing = await listSnapshots();
  const lastAt = existing[0]?.at ?? null;
  if (!shouldSnapshot({ lastAt, now, previousCount, nextCount: bakes.length })) {
    return null;
  }
  return saveSnapshot(bakes, "auto", now);
}

export async function takeSnapshot(
  bakes: BakeEntry[],
  reason: SnapshotReason = "manual",
): Promise<SnapshotMeta | null> {
  if (!journalDbSupported() || bakes.length === 0) return null;
  return saveSnapshot(bakes, reason);
}
