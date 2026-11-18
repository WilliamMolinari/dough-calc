import { photoFileName } from "./photoFiles";

/**
 * Desktop photo-folder housekeeping. Deleting a bake has always left its JPEG
 * behind; over a year of weekly pizzas that is hundreds of orphans in
 * ~/Pictures/DoughLab Photos with nothing in the app pointing at them.
 *
 * Everything here is a pure decision — the actual move to the trash happens in
 * the Electron main process, and only for names this module approved.
 */

export interface PhotoFileInfo {
  name: string;
  /** Bytes on disk. */
  size: number;
  /** Epoch milliseconds from the filesystem, when available. */
  modifiedAt?: number;
}

export interface UnusedPhotos {
  files: PhotoFileInfo[];
  count: number;
  bytes: number;
}

/** Names the journal still references, e.g. `file:doughlab-…jpg` → `…jpg`. */
export function referencedPhotoNames(photoRefs: Iterable<string>): Set<string> {
  const names = new Set<string>();
  for (const ref of photoRefs) {
    const name = photoFileName(ref);
    if (name) names.add(name);
  }
  return names;
}

/**
 * Files in the folder that no bake points at. Only files this app created are
 * candidates: anything else the baker keeps there is never proposed.
 */
export function unusedPhotos(
  files: PhotoFileInfo[],
  referenced: Set<string>,
): UnusedPhotos {
  const candidates = files.filter(
    (file) =>
      typeof file?.name === "string" &&
      file.name.startsWith("doughlab-") &&
      /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) &&
      !referenced.has(file.name),
  );
  return {
    files: candidates,
    count: candidates.length,
    bytes: candidates.reduce((sum, file) => sum + Math.max(0, file.size || 0), 0),
  };
}

/** Guards the trash call: identical rules to the app's own file naming. */
export function canTrashPhoto(name: string): boolean {
  return (
    typeof name === "string" &&
    name.startsWith("doughlab-") &&
    name.length <= 120 &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("..")
  );
}
