'use strict';
/* Bruecke zwischen Electron und Spiel — nur diese vier Aufrufe sind erlaubt. */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gtaNative', {
  isNative: true,
  platform: process.platform,
  load: function () { return ipcRenderer.invoke('gta:load'); },
  save: function (data) { return ipcRenderer.invoke('gta:save', data); },
  clear: function () { return ipcRenderer.invoke('gta:clear'); },
  toggleFullscreen: function () { return ipcRenderer.invoke('gta:fullscreen'); }
});
