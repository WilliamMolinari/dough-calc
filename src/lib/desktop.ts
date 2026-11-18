export interface PhotoFolderInfo {
  /** Absolute folder path on this Mac. */
  path: string;
  /** Last path segment, for compact display. */
  name: string;
  /** Photos carried over from the previous folder when the folder changed. */
  copied?: number;
}

export interface DesktopBridge {
  platform: string;
  getPhotoFolder: () => Promise<PhotoFolderInfo>;
  choosePhotoFolder: () => Promise<PhotoFolderInfo | null>;
  revealPhotoFolder: () => Promise<void>;
  /** Writes a resized data URL into the photo folder. */
  savePhoto: (dataUrl: string) => Promise<{ ref: string; name: string }>;
  readPhoto: (ref: string) => Promise<{ dataUrl: string } | null>;
  /** Every DoughLab photo file in the folder, with sizes. */
  listPhotos: () => Promise<Array<{ name: string; size: number; modifiedAt?: number }>>;
  /** Moves named files to the OS Trash; never an unreferenced path. */
  trashPhotos: (names: string[]) => Promise<{ trashed: number; failed: number }>;
}

declare global {
  interface Window {
    doughlabDesktop?: DesktopBridge;
  }
}

/** Undefined in the browser build, where photos stay in IndexedDB. */
export function desktopBridge(): DesktopBridge | undefined {
  return typeof window === "undefined" ? undefined : window.doughlabDesktop;
}

export function isDesktopApp(): boolean {
  return desktopBridge() !== undefined;
}
