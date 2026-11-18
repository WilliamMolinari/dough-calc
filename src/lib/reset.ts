import { clearJournalDb } from "./journalDb";

/**
 * "Clear all data" means everything this app put on this device: the journal
 * database (bakes, photos, restore points and the old v1 blob) and every
 * `doughlab.*` preference. Keys belonging to anything else are left alone.
 */
export const STORAGE_PREFIX = "doughlab.";

export interface ClearAllResult {
  /** The journal database was emptied. */
  database: boolean;
  /** Preference keys removed from localStorage. */
  keysRemoved: number;
}

export async function clearAllData(): Promise<ClearAllResult> {
  const database = await clearJournalDb();

  let keysRemoved = 0;
  try {
    // Collect first: removing while walking localStorage skips entries.
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      localStorage.removeItem(key);
      keysRemoved += 1;
    }
  } catch {
    /* a blocked localStorage still leaves the database wipe in place */
  }

  return { database, keysRemoved };
}

/** True when the value is one of DoughLab's own preference keys. */
export function isAppStorageKey(key: string): boolean {
  return typeof key === "string" && key.startsWith(STORAGE_PREFIX);
}
