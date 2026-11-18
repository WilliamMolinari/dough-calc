"use strict";

/**
 * DoughLab desktop shell. The whole app is the existing Vite renderer; this
 * process only supplies the native window, the photo folder picker and a
 * protocol that serves saved photos from whatever folder the baker chose.
 */

const { app, BrowserWindow, dialog, ipcMain, protocol, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const {
  carryPhotoFiles,
  fileNameFromRef,
  isOwnPhotoName,
  readPhotoAsDataUrl,
  savePhotoDataUrl,
} = require("./photoFolder.cjs");

const DEV = process.argv.includes("--dev");
const DEV_URL = process.env.DOUGHLAB_DEV_URL || "http://localhost:3000";
const MEDIA_SCHEME = "doughlab-media";

let photoFolder = "";
let windowRef = null;

function settingsFile() {
  return path.join(app.getPath("userData"), "settings.json");
}

function defaultPhotoFolder() {
  return path.join(app.getPath("pictures"), "DoughLab Photos");
}

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), "utf8"));
    if (typeof raw.photoFolder === "string" && raw.photoFolder.trim()) {
      photoFolder = raw.photoFolder;
    }
  } catch {
    /* first launch, or an unreadable settings file: fall back to the default */
  }
  if (!photoFolder) photoFolder = defaultPhotoFolder();
}

function saveSettings() {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify({ photoFolder }, null, 2));
  } catch (error) {
    console.warn("DoughLab could not save its settings:", error);
  }
}

function folderInfo() {
  return { path: photoFolder, name: path.basename(photoFolder) || photoFolder };
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function registerMediaProtocol() {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const name = path.basename(decodeURIComponent(new URL(request.url).pathname));
      if (!name || name.includes("..")) return new Response("Not found", { status: 404 });
      const file = path.join(photoFolder, name);
      const data = await fs.promises.readFile(file);
      const type = name.toLowerCase().endsWith(".png")
        ? "image/png"
        : name.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : name.toLowerCase().endsWith(".heic")
            ? "image/heic"
            : "image/jpeg";
      return new Response(data, {
        headers: { "content-type": type, "cache-control": "no-cache" },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

function registerIpc() {
  ipcMain.handle("photos:folder", () => folderInfo());

  ipcMain.handle("photos:chooseFolder", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? windowRef ?? null;
    const options = {
      title: "Choose where DoughLab stores photos",
      message: "New bake photos are saved into this folder.",
      defaultPath: photoFolder,
      buttonLabel: "Use this folder",
      properties: ["openDirectory", "createDirectory"],
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const chosen = result.filePaths[0];
    // Existing journal references are filenames, so bring the files along to
    // the new folder before switching. The old folder is left untouched.
    const copied = await carryPhotoFiles(photoFolder, chosen);
    photoFolder = chosen;
    saveSettings();
    return { ...folderInfo(), copied };
  });

  ipcMain.handle("photos:reveal", async () => {
    await fs.promises.mkdir(photoFolder, { recursive: true });
    await shell.openPath(photoFolder);
  });

  ipcMain.handle("photos:save", async (_event, payload) => {
    const dataUrl = payload && typeof payload.dataUrl === "string" ? payload.dataUrl : "";
    return savePhotoDataUrl(photoFolder, dataUrl);
  });

  ipcMain.handle("photos:read", async (_event, ref) => {
    const dataUrl = await readPhotoAsDataUrl(photoFolder, ref);
    return dataUrl ? { dataUrl } : null;
  });

  // Only this app's own files, so a cleanup can never touch anything the baker
  // put in the folder themselves.
  ipcMain.handle("photos:list", async () => {
    const files = [];
    try {
      await fs.promises.mkdir(photoFolder, { recursive: true });
      const names = await fs.promises.readdir(photoFolder);
      for (const name of names) {
        if (!isOwnPhotoName(name)) continue;
        try {
          const stat = await fs.promises.stat(path.join(photoFolder, name));
          if (stat.isFile()) {
            files.push({ name, size: stat.size, modifiedAt: stat.mtimeMs });
          }
        } catch {
          /* a vanished file is not an error */
        }
      }
    } catch {
      /* an unreadable folder just reports nothing */
    }
    return files;
  });

  ipcMain.handle("photos:trash", async (_event, names) => {
    const requested = Array.isArray(names) ? names : [];
    let trashed = 0;
    let failed = 0;
    for (const name of requested) {
      if (!isOwnPhotoName(name)) {
        failed += 1;
        continue;
      }
      try {
        await shell.trashItem(path.join(photoFolder, name));
        trashed += 1;
      } catch {
        failed += 1;
      }
    }
    return { trashed, failed };
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 380,
    minHeight: 540,
    show: false,
    title: "DoughLab",
    backgroundColor: "#08080b",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  windowRef = win;
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    windowRef = null;
  });

  // Links in recipes or AI replies open in the real browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  if (DEV) void win.loadURL(DEV_URL);
  else void win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  loadSettings();
  registerMediaProtocol();
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
