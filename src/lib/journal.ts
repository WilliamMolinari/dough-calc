import type { BakeEntry, Ratings } from "./types";

const EMPTY_RATINGS: Ratings = { crust: 0, crumb: 0, extensibility: 0, flavor: 0, overall: 0 };

const TRIAL_SUFFIX = /\s*·\s*trial\s+\d+\s*$/i;
const COPY_SUFFIX = /\s*\(copy(?:\s+\d+)?\)\s*$/i;

/** "Friday · trial 2 (copy)" → "Friday", so trial names never stack up. */
export function familyName(name: string): string {
  const trimmed = name.trim();
  // Strip a legacy "(copy)" first so "Friday · trial 2 (copy)" loses both suffixes.
  return trimmed.replace(COPY_SUFFIX, "").replace(TRIAL_SUFFIX, "").trimEnd() || trimmed;
}

function createdAtMs(bake: BakeEntry): number {
  const time = new Date(bake.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

/** The original bake at the head of this experiment's family. */
export function rootIdOf(bake: BakeEntry): string {
  return bake.rootId || bake.parentId || bake.id;
}

/**
 * Every bake in the same trial family, oldest first. `bake` must be part of
 * `bakes`; a stale root simply makes the family smaller, never bigger.
 */
export function bakeFamily(bakes: BakeEntry[], bake: BakeEntry): BakeEntry[] {
  const root = rootIdOf(bake);
  return bakes
    .filter((item) => item.id === bake.id || item.id === root || rootIdOf(item) === root)
    .sort((a, b) => createdAtMs(a) - createdAtMs(b) || a.id.localeCompare(b.id));
}

export interface BakeLineage {
  family: BakeEntry[];
  /** 1-based position within the family. */
  trial: number;
  total: number;
  /** The trial this one was forked from, when it still exists. */
  parent: BakeEntry | null;
}

export function lineageOf(bake: BakeEntry, bakes: BakeEntry[]): BakeLineage {
  const family = bakeFamily(bakes, bake);
  const index = family.findIndex((item) => item.id === bake.id);
  const parent =
    bake.parentId && bake.parentId !== bake.id
      ? bakes.find((item) => item.id === bake.parentId) ?? null
      : null;
  return { family, trial: index + 1, total: family.length, parent };
}

/** "" for a one-off bake, "Trial 2 of 3" inside a family. */
export function trialLabel(lineage: BakeLineage): string {
  return lineage.total > 1 ? `Trial ${lineage.trial} of ${lineage.total}` : "";
}

/** Name for the next experiment in this family: "Friday · trial 2". */
export function nextTrialName(bake: BakeEntry, bakes: BakeEntry[]): string {
  const family = bakeFamily(bakes, bake);
  const base = familyName(family[0]?.name ?? bake.name);
  return `${base} · trial ${family.length + 1}`;
}

/**
 * The bake a fresh diff should point at: the parent trial when there is one,
 * otherwise the nearest trial in the family, otherwise the newest other bake.
 */
export function comparisonTarget(bake: BakeEntry, bakes: BakeEntry[]): BakeEntry | null {
  const { family, parent, trial } = lineageOf(bake, bakes);
  if (parent) return parent;
  return (
    family[trial - 2] ??
    family[trial] ??
    bakes
      .filter((item) => item.id !== bake.id)
      .sort((a, b) => createdAtMs(b) - createdAtMs(a))[0] ??
    null
  );
}

/**
 * A forked trial that is unrated and has not been confirmed as baked is treated
 * as planned, so duplicating a formula does not inflate the journal's "dough
 * made" stat. Marking it baked (or scoring it) counts the dough again.
 */
export function isPlannedTrial(bake: BakeEntry): boolean {
  return !!bake.parentId && bake.ratings.overall <= 0 && !bake.bakedAt;
}

export function doughMadeGrams(bakes: BakeEntry[]): number {
  return bakes.reduce((sum, bake) => sum + (isPlannedTrial(bake) ? 0 : bake.totalDough || 0), 0);
}

/**
 * Drop dangling or self-referential parents, then rebuild each root from the
 * parent chain so the journal cannot point at bakes that are gone.
 */
export function repairLineage(bakes: BakeEntry[]): BakeEntry[] {
  const resolved = bakes.map((bake) => ({ ...bake }));
  const byId = new Map(resolved.map((bake) => [bake.id, bake]));

  for (const bake of resolved) {
    if (bake.parentId === bake.id) bake.parentId = undefined;
    else if (bake.parentId && !byId.has(bake.parentId)) bake.parentId = undefined;
  }

  for (const bake of resolved) {
    let current = bake;
    const seen = new Set<string>([bake.id]);
    while (current.parentId) {
      const parent = byId.get(current.parentId);
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      current = parent;
    }
    bake.rootId = current.id;
  }

  return resolved;
}

/**
 * Remove a bake and fix the surviving trial links in the same pass. Children are
 * reparented to the deleted bake's parent, or detached when it was the family
 * root, and the roots are rebuilt so nothing points at a bake that is gone.
 */
export function deleteBakeEntry(bakes: BakeEntry[], id: string): BakeEntry[] {
  const removed = bakes.find((bake) => bake.id === id);
  if (!removed) return bakes;

  const remaining = bakes.filter((bake) => bake.id !== id);
  const parentId =
    removed.parentId && remaining.some((bake) => bake.id === removed.parentId)
      ? removed.parentId
      : undefined;

  return repairLineage(
    remaining.map((bake) => (bake.parentId === id ? { ...bake, parentId } : bake)),
  );
}

/**
 * Copy a bake into a fresh journal entry without sharing mutable state with the
 * original. The formula, tags and next-bake plan carry over so the next trial
 * starts from the same dough, while ratings and the "what happened" notes start
 * empty because this is a new experiment. Photos are intentionally left behind
 * because they dominate the localStorage budget.
 */
export function duplicateBakeEntry(
  bake: BakeEntry,
  id: string,
  createdAt = new Date().toISOString(),
  name = `${familyName(bake.name)} (copy)`,
): BakeEntry {
  return {
    ...bake,
    id,
    name,
    createdAt,
    updatedAt: undefined,
    parentId: bake.id,
    rootId: rootIdOf(bake),
    formula: { ...bake.formula },
    ratings: { ...EMPTY_RATINGS },
    notes: "",
    nextTimeNotes: bake.nextTimeNotes,
    bakedAt: undefined,
    tags: [...bake.tags],
    photos: [],
  };
}
