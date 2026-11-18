import { desktopBridge } from "./desktop";

/** Photos saved by the desktop app are references, not inline bytes. */
export const PHOTO_REF_PREFIX = "file:";

const MISSING_PHOTO =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#141418"/><path d="M11 12h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" fill="none" stroke="#5b5b66" stroke-width="1.6"/><circle cx="16" cy="18" r="3" fill="#5b5b66"/><path d="M13 12l1.4-2h3.2l1.4 2" fill="none" stroke="#5b5b66" stroke-width="1.6"/></svg>',
  );

export function isStoredPhoto(photo: string): boolean {
  return typeof photo === "string" && photo.startsWith(PHOTO_REF_PREFIX);
}

export function photoFileName(photo: string): string | null {
  if (!isStoredPhoto(photo)) return null;
  const name = photo.slice(PHOTO_REF_PREFIX.length);
  return name && !name.includes("/") && !name.includes("\\") ? name : null;
}

/**
 * What an <img src> should be: inline data URLs pass through, files saved by
 * the desktop app are served from the chosen folder. A reference without the
 * desktop bridge (e.g. a native backup opened in the browser) shows a
 * placeholder instead of a broken image.
 */
export function photoSrc(photo: string): string {
  if (!photo) return MISSING_PHOTO;
  if (!isStoredPhoto(photo)) return photo;
  const bridge = desktopBridge();
  const name = photoFileName(photo);
  if (!bridge || !name) return MISSING_PHOTO;
  return `doughlab-media://photos/${encodeURIComponent(name)}`;
}

export function countInlinePhotos(photos: string[]): number {
  return photos.filter((photo) => photo.startsWith("data:")).length;
}

/**
 * Moves freshly resized photos into the chosen folder. Any single failure keeps
 * that photo inline, so a save never loses the picture.
 */
export async function materializePhotos(photos: string[]): Promise<string[]> {
  const bridge = desktopBridge();
  if (!bridge) return photos;
  const next: string[] = [];
  for (const photo of photos) {
    if (!photo.startsWith("data:")) {
      next.push(photo);
      continue;
    }
    try {
      const saved = await bridge.savePhoto(photo);
      next.push(saved?.ref ?? photo);
    } catch {
      next.push(photo);
    }
  }
  return next;
}

/** Reads file-backed photos back into a backup so the JSON stays portable. */
export async function inlinePhotos(photos: string[]): Promise<string[]> {
  const bridge = desktopBridge();
  if (!bridge) return photos;
  const next: string[] = [];
  for (const photo of photos) {
    if (!isStoredPhoto(photo)) {
      next.push(photo);
      continue;
    }
    try {
      const file = await bridge.readPhoto(photo);
      next.push(file?.dataUrl ?? photo);
    } catch {
      next.push(photo);
    }
  }
  return next;
}
