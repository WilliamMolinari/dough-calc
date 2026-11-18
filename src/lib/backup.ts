import { sanitizeFormula } from "./formula";
import { normalizeBakes } from "./storage";
import type { BakeEntry, Formula, Unit } from "./types";

export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: "DoughLab";
  kind: "backup";
  version: number;
  exportedAt: string;
  bakes: BakeEntry[];
  formula?: Formula;
  unit?: Unit;
}

export function createBackup(bakes: BakeEntry[], formula?: Formula, unit?: Unit): BackupFile {
  return {
    app: "DoughLab",
    kind: "backup",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    bakes,
    formula,
    unit,
  };
}

export type ParseBackupResult =
  | { ok: true; data: BackupFile; bakes: BakeEntry[] }
  | { ok: false; error: string };

export function parseBackup(text: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "That file does not look like a DoughLab backup." };
  }

  const record = parsed as Partial<BackupFile> & { bakes?: unknown };
  if (!Array.isArray(record.bakes)) {
    return { ok: false, error: "The backup has no bakes array." };
  }
  if (record.bakes.length > 5000) {
    return { ok: false, error: "That backup is too large to import safely." };
  }

  const bakes = normalizeBakes(record.bakes);
  if (record.bakes.length > 0 && bakes.length === 0) {
    return { ok: false, error: "None of the bakes in that file could be read." };
  }

  return {
    ok: true,
    bakes,
    data: {
      app: "DoughLab",
      kind: "backup",
      version: Number(record.version) || BACKUP_VERSION,
      exportedAt:
        typeof record.exportedAt === "string" ? record.exportedAt : new Date().toISOString(),
      bakes,
      formula: record.formula ? sanitizeFormula(record.formula) : undefined,
      unit: record.unit === "oz" ? "oz" : record.unit === "g" ? "g" : undefined,
    },
  };
}

export function mergeBakes(
  current: BakeEntry[],
  incoming: BakeEntry[],
  mode: "merge" | "replace",
): BakeEntry[] {
  if (mode === "replace") {
    return [...incoming].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  const byId = new Map(current.map((bake) => [bake.id, bake]));
  for (const bake of incoming) {
    const existing = byId.get(bake.id);
    if (!existing) {
      byId.set(bake.id, bake);
      continue;
    }
    const existingTime = new Date(existing.updatedAt ?? existing.createdAt).getTime();
    const incomingTime = new Date(bake.updatedAt ?? bake.createdAt).getTime();
    if (incomingTime >= existingTime) byId.set(bake.id, bake);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
