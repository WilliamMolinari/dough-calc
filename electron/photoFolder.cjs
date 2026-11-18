"use strict";

/**
 * Photo files on disk. The renderer hands over the already-resized data URLs
 * it produced for the journal, and these helpers turn them into ordinary image
 * files inside the folder the baker picked. Kept dependency-free so it can be
 * exercised without launching Electron.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const REF_PREFIX = "file:";

const DATA_URL = /^data:(image\/(?:png|jpeg|jpg|webp|heic|heif));base64,([A-Za-z0-9+/=\r\n]+)$/;
const MAX_BASE64_CHARS = 28 * 1024 * 1024;

function extensionForMime(mime) {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
    case "image/heif":
      return "heic";
    default:
      return "jpg";
  }
}

function mimeForName(name) {
  switch (path.extname(String(name)).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".heic":
    case ".heif":
      return "image/heic";
    default:
      return "image/jpeg";
  }
}

/** True only for filenames this app creates, so cleanup can never touch anything else. */
function isOwnPhotoName(name) {
  return (
    typeof name === "string" &&
    name.startsWith("doughlab-") &&
    name.length <= 120 &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("..")
  );
}

/** "file:abc.jpg" → "abc.jpg", rejecting anything that could escape the folder. */
function fileNameFromRef(ref) {
  if (typeof ref !== "string" || !ref.startsWith(REF_PREFIX)) return null;
  const raw = ref.slice(REF_PREFIX.length);
  if (!raw || raw.includes("/") || raw.includes("\\") || raw.includes("..")) return null;
  const base = path.basename(raw);
  return base === raw && base.length <= 120 ? base : null;
}

function stamp(date = new Date()) {
  const iso = date.toISOString().replace(/[-:]/g, "").replace("T", "-");
  return `${iso.slice(0, 8)}-${iso.slice(9, 15)}`;
}

/**
 * Writes one data URL into the folder and returns the reference the journal
 * should store. Throws on an unreadable payload so the caller can fall back to
 * keeping the photo inline.
 */
async function savePhotoDataUrl(folder, dataUrl, date = new Date()) {
  if (typeof folder !== "string" || !folder.trim()) throw new Error("No photo folder chosen");
  const match = typeof dataUrl === "string" ? DATA_URL.exec(dataUrl) : null;
  if (!match) throw new Error("Only JPEG, PNG, WebP or HEIC photos can be saved");

  const base64 = match[2].replace(/\s+/g, "");
  if (base64.length === 0 || base64.length > MAX_BASE64_CHARS) {
    throw new Error("That photo is too large to save");
  }

  const name = `doughlab-${stamp(date)}-${crypto.randomBytes(3).toString("hex")}.${extensionForMime(match[1])}`;
  await fs.promises.mkdir(folder, { recursive: true });
  await fs.promises.writeFile(path.join(folder, name), Buffer.from(base64, "base64"));
  return { ref: `${REF_PREFIX}${name}`, name };
}

/**
 * Copies DoughLab's own photo files into a newly chosen folder, so the journal's
 * existing references keep resolving after the baker changes location. Copies
 * rather than moves: the previous folder is never damaged.
 */
async function carryPhotoFiles(from, to) {
  if (typeof from !== "string" || typeof to !== "string" || !from || !to) return 0;
  if (path.resolve(from) === path.resolve(to)) return 0;
  let names = [];
  try {
    names = await fs.promises.readdir(from);
  } catch {
    return 0;
  }
  await fs.promises.mkdir(to, { recursive: true });
  let copied = 0;
  for (const name of names) {
    if (!name.startsWith("doughlab-") || name.includes("/") || name.includes("\\")) continue;
    const target = path.join(to, name);
    try {
      await fs.promises.access(target);
      continue;
    } catch {
      /* not there yet */
    }
    try {
      await fs.promises.copyFile(path.join(from, name), target);
      copied += 1;
    } catch {
      /* a single unreadable file must not block the folder change */
    }
  }
  return copied;
}

async function readPhotoAsDataUrl(folder, ref) {
  const name = fileNameFromRef(ref);
  if (!name || typeof folder !== "string") return null;
  try {
    const buffer = await fs.promises.readFile(path.join(folder, name));
    return `data:${mimeForName(name)};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

module.exports = {
  REF_PREFIX,
  carryPhotoFiles,
  extensionForMime,
  fileNameFromRef,
  isOwnPhotoName,
  mimeForName,
  readPhotoAsDataUrl,
  savePhotoDataUrl,
};
