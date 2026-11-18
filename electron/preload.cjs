"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/**
 * The only native surface the renderer can touch. Keeping it this small means
 * the web build keeps working with no bridge at all.
 */
contextBridge.exposeInMainWorld("doughlabDesktop", {
  platform: process.platform,
  getPhotoFolder: () => ipcRenderer.invoke("photos:folder"),
  choosePhotoFolder: () => ipcRenderer.invoke("photos:chooseFolder"),
  revealPhotoFolder: () => ipcRenderer.invoke("photos:reveal"),
  savePhoto: (dataUrl) => ipcRenderer.invoke("photos:save", { dataUrl }),
  readPhoto: (ref) => ipcRenderer.invoke("photos:read", ref),
});
