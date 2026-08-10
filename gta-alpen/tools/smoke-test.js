#!/usr/bin/env node
'use strict';
/* ============================================================
   smoke-test.js — startet das Spiel in einem echten Browser,
   sammelt Fehler und macht Bildschirmfotos.

   Aufruf:  node tools/smoke-test.js [--shots ORDNER] [--seconds N]
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'src');
const PORT = 8137;

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}
const SHOT_DIR = arg('--shots', path.join(__dirname, '..', 'shots'));
const SECONDS = parseFloat(arg('--seconds', '6'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png'
};

function startServer() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const file = path.join(ROOT, path.normalize(rel));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404).end('nicht gefunden'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const srv = await startServer();

  const browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
      '--disable-dev-shm-usage'
    ]
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });

  const errors = [];
  const warnings = [];
  const logs = [];

  page.on('console', msg => {
    const t = msg.type();
    const txt = msg.text();
    if (t === 'error') errors.push(txt);
    else if (t === 'warning') warnings.push(txt);
    else logs.push(txt);
  });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + (err.stack || err.message)));
  page.on('requestfailed', r => errors.push('LADEFEHLER: ' + r.url() + ' — ' + (r.failure() || {}).errorText));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 45000 });

  // Auf den Weltaufbau warten
  let ready = false;
  try {
    await page.waitForFunction(
      () => window.GTA && GTA.Game && GTA.Game.getCtx && GTA.Game.getCtx() && GTA.Game.getCtx().player,
      { timeout: 60000 }
    );
    ready = true;
  } catch (e) {
    errors.push('ZEITÜBERSCHREITUNG: Spiel wurde nicht fertig aufgebaut.');
  }

  await page.screenshot({ path: path.join(SHOT_DIR, '01-startbildschirm.png') });

  // Spiel starten
  if (ready) {
    await page.click('#splashStart').catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOT_DIR, '02-spiel.png') });

    // Ein Stück laufen
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1400);
    await page.keyboard.up('KeyW');
    await page.screenshot({ path: path.join(SHOT_DIR, '03-gelaufen.png') });

    // Ins Auto steigen
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1800);
    await page.keyboard.up('KeyW');
    await page.screenshot({ path: path.join(SHOT_DIR, '04-fahren.png') });

    // Garage öffnen
    await page.keyboard.press('KeyG');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(SHOT_DIR, '05-garage.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Karte
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SHOT_DIR, '06-karte.png') });
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(300);

    await page.waitForTimeout(SECONDS * 1000);
  }

  // Laufzeit-Kennzahlen einsammeln
  const stats = await page.evaluate(() => {
    if (!window.GTA || !GTA.Game || !GTA.Game.getCtx) return null;
    const c = GTA.Game.getCtx();
    if (!c) return null;
    return {
      npcs: c.npcs.length,
      items: c.items.length,
      worldCars: c.worldCars.length,
      interiors: c.interiors.length,
      obstacles: c.obstacles.length,
      walls: c.walls.length,
      copCars: c.copCars.length,
      sceneChildren: c.scene.children.length,
      elapsed: Math.round(c.elapsed * 10) / 10,
      player: c.player ? {
        x: Math.round(c.player.x), z: Math.round(c.player.z),
        hp: Math.round(c.player.hp), money: c.player.money,
        inCar: !!c.player.car, interior: c.player.interiorId,
        weapon: c.player.weapon
      } : null,
      catalog: {
        vehicles: (GTA.Vehicles && GTA.Vehicles.CATALOG) ? GTA.Vehicles.CATALOG.length : 0,
        bikes: (GTA.Vehicles && GTA.Vehicles.CATALOG)
          ? GTA.Vehicles.CATALOG.filter(v => v.cls === 'bike').length : 0,
        weapons: (GTA.Weapons && GTA.Weapons.CATALOG) ? GTA.Weapons.CATALOG.length : 0,
        itemTypes: (GTA.Items && GTA.Items.TYPES) ? Object.keys(GTA.Items.TYPES).length : 0,
        missions: (GTA.Missions && GTA.Missions.LIST) ? GTA.Missions.LIST.length : 0,
        interiorKinds: (GTA.Interiors && GTA.Interiors.KINDS) ? GTA.Interiors.KINDS.length : 0,
        npcArchetypes: (GTA.NPCs && GTA.NPCs.ARCHETYPES) ? GTA.NPCs.ARCHETYPES.length : 0
      },
      modules: ['CFG','U','TEX','Chars','Vehicles','Interiors','Buildings','World','Traffic',
                'Items','Weapons','NPCs','Audio','Player','Missions','UI','Input','Game']
        .filter(k => !window.GTA[k])
    };
  });

  await browser.close();
  srv.close();

  const bericht = { ready, fehler: errors, warnungen: warnings.slice(0, 30), stats };
  fs.writeFileSync(path.join(SHOT_DIR, 'bericht.json'), JSON.stringify(bericht, null, 2));

  console.log('\n================ SMOKE-TEST ================');
  console.log('Aufbau fertig :', ready ? 'JA' : 'NEIN');
  if (stats) {
    console.log('Fehlende Module:', stats.modules.length ? stats.modules.join(', ') : 'keine');
    console.log('Kataloge      :', JSON.stringify(stats.catalog));
    console.log('Welt          : npcs=' + stats.npcs + ' items=' + stats.items +
                ' autos=' + stats.worldCars + ' innenraeume=' + stats.interiors +
                ' hindernisse=' + stats.obstacles + ' waende=' + stats.walls);
    console.log('Spieler       :', JSON.stringify(stats.player));
    console.log('Laufzeit      :', stats.elapsed + ' s');
  }
  console.log('\nFEHLER (' + errors.length + '):');
  errors.slice(0, 40).forEach(e => console.log('  ✗ ' + e.slice(0, 400)));
  if (warnings.length) {
    console.log('\nWarnungen (' + warnings.length + ', erste 10):');
    warnings.slice(0, 10).forEach(w => console.log('  ⚠ ' + w.slice(0, 240)));
  }
  console.log('\nBildschirmfotos:', SHOT_DIR);
  console.log('============================================\n');

  process.exit(errors.length ? 1 : 0);
})().catch(e => {
  console.error('Smoke-Test abgebrochen:', e);
  process.exit(2);
});
