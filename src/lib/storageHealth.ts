export type PersistenceState = "granted" | "best-effort" | "unsupported";

type StorageManager = {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

function storageManager(): StorageManager | null {
  if (typeof navigator === "undefined") return null;
  const storage = (navigator as Navigator & { storage?: StorageManager }).storage;
  return storage && typeof storage.persist === "function" ? storage : null;
}

/**
 * Whether the browser has promised to keep this origin's journal. "best-effort"
 * means it can still clear the data when storage runs low or the site goes
 * unused, which is the default for sites nobody has installed.
 */
export async function readPersistence(): Promise<PersistenceState> {
  const storage = storageManager();
  if (!storage?.persisted) return "unsupported";
  try {
    return (await storage.persisted()) ? "granted" : "best-effort";
  } catch {
    return "best-effort";
  }
}

/** Ask the browser to protect the journal. Safe to call again if it says no. */
export async function requestPersistence(): Promise<PersistenceState> {
  const storage = storageManager();
  if (!storage?.persist) return "unsupported";
  try {
    return (await storage.persist()) ? "granted" : "best-effort";
  } catch {
    return "best-effort";
  }
}

/** Whole days since the last exported backup, or null when none was ever taken. */
export function backupAgeDays(lastBackup: unknown, now: number = Date.now()): number | null {
  if (typeof lastBackup !== "string" || !lastBackup.trim()) return null;
  const time = new Date(lastBackup).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((now - time) / 86_400_000));
}
