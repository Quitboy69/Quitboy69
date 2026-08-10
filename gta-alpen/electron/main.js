'use strict';
/* Grand Theft Alpen — Electron-Hauptprozess (nativer Linux-Desktop-Build) */

const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.argv.includes('--dev');

// Auf Linux laufen viele Setups (Wayland, VM, alte Treiber) ohne stabile
// GPU-Beschleunigung. Diese Schalter halten WebGL auch dort am Leben.
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-zero-copy');
if (process.env.GTA_SOFTWARE_GL === '1') {
  app.commandLine.appendSwitch('use-gl', 'swiftshader');
  app.disableHardwareAcceleration();
}

// Spielstand liegt im Nutzerprofil, nicht im Installationsverzeichnis.
const saveDir = app.getPath('userData');
const savePath = path.join(saveDir, 'savegame.json');

function readSave() {
  try {
    if (!fs.existsSync(savePath)) return null;
    return JSON.parse(fs.readFileSync(savePath, 'utf8'));
  } catch (err) {
    console.error('[GTA] Spielstand konnte nicht gelesen werden:', err.message);
    return null;
  }
}

function writeSave(data) {
  try {
    fs.mkdirSync(saveDir, { recursive: true });
    fs.writeFileSync(savePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[GTA] Spielstand konnte nicht geschrieben werden:', err.message);
    return false;
  }
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0c111a',
    title: 'Grand Theft Alpen',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  win.once('ready-to-show', function () {
    win.show();
    if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // Selbsttest: mit GTA_SELFTEST=1 startet das Spiel, meldet seinen
  // Zustand auf der Konsole und beendet sich wieder. Damit laesst sich
  // der native Build pruefen, ohne jemanden davorzusetzen.
  if (process.env.GTA_SELFTEST === '1') {
    win.webContents.on('did-finish-load', function () {
      var fehler = [];
      win.webContents.on('console-message', function (_e, level, message) {
        if (level >= 2) fehler.push(message);
      });
      setTimeout(function () {
        win.webContents.executeJavaScript(
          '(function(){' +
          ' if(!window.GTA||!GTA.Game||!GTA.Game.getCtx()) return {bereit:false};' +
          ' var c=GTA.Game.getCtx();' +
          ' return {bereit:!!c.player, npcs:c.npcs.length, items:c.items.length,' +
          '  autos:c.worldCars.length, haeuser:c.interiors.length,' +
          '  fahrzeuge:GTA.Vehicles.CATALOG.length, waffen:GTA.Weapons.CATALOG.length,' +
          '  auftraege:GTA.Missions.LIST.length, dreiecke:c.renderer.info.render.triangles,' +
          '  calls:c.renderer.info.render.calls, gfx:c.gfx.name};})()'
        ).then(function (res) {
          console.log('SELFTEST ' + JSON.stringify(res));
          console.log('SELFTEST_FEHLER ' + JSON.stringify(fehler.slice(0, 10)));
          app.exit(res && res.bereit && fehler.length === 0 ? 0 : 1);
        }).catch(function (err) {
          console.log('SELFTEST_ABBRUCH ' + err.message);
          app.exit(2);
        });
      }, 12000);
    });
  }

  // Externe Links im System-Browser statt im Spielfenster oeffnen.
  win.webContents.setWindowOpenHandler(function (details) {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  win.webContents.on('render-process-gone', function (_e, details) {
    dialog.showErrorBox(
      'Grand Theft Alpen',
      'Der Grafikprozess ist abgestuerzt (' + details.reason + ').\n\n' +
      'Starte das Spiel mit  GTA_SOFTWARE_GL=1 grand-theft-alpen  um auf\n' +
      'Software-Rendering auszuweichen.'
    );
  });

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: 'Spiel',
      submenu: [
        {
          label: 'Vollbild umschalten',
          accelerator: 'F11',
          click: function () { if (win) win.setFullScreen(!win.isFullScreen()); }
        },
        {
          label: 'Neu laden',
          accelerator: 'F5',
          click: function () { if (win) win.reload(); }
        },
        { type: 'separator' },
        {
          label: 'Spielstand-Ordner oeffnen',
          click: function () { shell.openPath(saveDir); }
        },
        {
          label: 'Spielstand loeschen',
          click: async function () {
            const res = await dialog.showMessageBox(win, {
              type: 'warning',
              buttons: ['Abbrechen', 'Loeschen'],
              defaultId: 0,
              cancelId: 0,
              message: 'Spielstand wirklich loeschen?',
              detail: 'Geld, Fahrzeuge, Waffen und Missionsfortschritt gehen verloren.'
            });
            if (res.response === 1) {
              try { fs.unlinkSync(savePath); } catch (e) {}
              if (win) win.reload();
            }
          }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Beenden' }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Entwicklerwerkzeuge' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('gta:load', function () { return readSave(); });
ipcMain.handle('gta:save', function (_e, data) { return writeSave(data); });
ipcMain.handle('gta:clear', function () {
  try { fs.unlinkSync(savePath); return true; } catch (e) { return false; }
});
ipcMain.handle('gta:fullscreen', function () {
  if (!win) return false;
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
