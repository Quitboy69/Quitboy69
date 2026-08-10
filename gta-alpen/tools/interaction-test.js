#!/usr/bin/env node
'use strict';
/* ============================================================
   interaction-test.js — prüft die Kernhandlungen wirklich durch:
   Einsteigen, Fahren, Aussteigen, Haus betreten, Gegenstand
   aufheben, Waffe wechseln und schießen, NPC ansprechen.

   Aufruf:  node tools/interaction-test.js
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'src');
const SHOTS = path.join(__dirname, '..', 'shots');
const PORT = 8141;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

function server() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let rel = decodeURIComponent(q.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const f = path.join(ROOT, path.normalize(rel));
      if (!f.startsWith(ROOT)) { r.writeHead(403).end(); return; }
      fs.readFile(f, (e, d) => {
        if (e) { r.writeHead(404).end('nf'); return; }
        r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
        r.end(d);
      });
    });
    s.listen(PORT, () => res(s));
  });
}

const pruefungen = [];
function pruefe(name, ok, detail) {
  pruefungen.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
}

async function foto(page, name) {
  // Im Software-Rendering dauert ein Bild manchmal sehr lange —
  // ein misslungenes Foto darf den Test nicht scheitern lassen.
  try {
    await page.screenshot({ path: path.join(SHOTS, name), timeout: 20000, animations: 'disabled' });
  } catch (e) {
    console.log('  (Bild ' + name + ' übersprungen: ' + e.name + ')');
  }
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const srv = await server();
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage']
  });
  // Kleines Bild + niedrigste Stufe: der Test soll Spiellogik prüfen,
  // nicht die Rasterleistung des Software-Renderers.
  const page = await browser.newPage({ viewport: { width: 640, height: 380 } });
  const fehler = [];
  page.on('pageerror', e => fehler.push('PAGEERROR: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(() => window.GTA && GTA.Game.getCtx() && GTA.Game.getCtx().player, { timeout: 60000 });
  await page.evaluate(() => GTA.Game.setGfx(3, true));
  await page.click('#splashStart');
  await page.waitForTimeout(700);

  // Wartet auf eine Anzahl tatsächlich gezeichneter Bilder statt auf Uhrzeit.
  const frames = (n) => page.evaluate((n) => new Promise(res => {
    let k = 0;
    (function tick() { k++; k >= n ? res(k) : requestAnimationFrame(tick); })();
  }), n);

  // Hilfsfunktion: Spieler an eine Stelle setzen
  const setze = (x, z, h) => page.evaluate(([x, z, h]) => {
    const c = GTA.Game.getCtx();
    c.player.x = x; c.player.z = z;
    if (h !== undefined) { c.player.heading = h; GTA.Input.lookYaw = h; }
    c.player.speed = 0;
  }, [x, z, h]);

  const lies = () => page.evaluate(() => {
    const c = GTA.Game.getCtx();
    const p = c.player;
    return {
      x: Math.round(p.x), z: Math.round(p.z), hp: Math.round(p.hp), money: p.money,
      inCar: !!p.car, carName: p.car ? (p.car.params.name || p.car.params.id) : null,
      speed: Math.round(p.speed * 10) / 10,
      interior: p.interiorId, weapon: p.weapon,
      items: c.items.filter(i => !i.taken).length,
      npcs: c.npcs.length, heat: Math.round(c.heat * 10) / 10,
      prompt: (document.getElementById('prompt').className.indexOf('on') >= 0)
        ? document.getElementById('prompt').textContent : null,
      mission: c.mission ? c.mission.def.id : null
    };
  });

  /* ---------- 1. Einsteigen ---------- */
  const autoPos = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    const own = c.worldCars.find(v => v.isOwn);
    return own ? { x: own.mesh.position.x, z: own.mesh.position.z } : null;
  });
  pruefe('Eigenes Fahrzeug in der Welt', !!autoPos, JSON.stringify(autoPos));

  if (autoPos) {
    await setze(autoPos.x + 1.6, autoPos.z, 0);
    await frames(4);
    const vorher = await lies();
    pruefe('Hinweis "einsteigen" erscheint',
      vorher.prompt && /einsteigen/i.test(vorher.prompt), vorher.prompt);

    await page.keyboard.press('KeyE');
    await frames(4);
    const drin = await lies();
    pruefe('Einsteigen mit [E] funktioniert', drin.inCar, drin.carName);

    /* ---------- 2. Fahren ---------- */
    await page.keyboard.down('KeyW');
    await frames(70);
    const faehrt = await lies();
    await page.keyboard.up('KeyW');
    pruefe('Fahrzeug beschleunigt', faehrt.speed > 4, 'Tempo ' + faehrt.speed + ' m/s');
    await foto(page, 'i1-fahren.png');

    /* ---------- 3. Aussteigen ---------- */
    await frames(6);
    await page.keyboard.press('KeyE');
    await frames(5);
    const raus = await lies();
    pruefe('Aussteigen mit [E] funktioniert', !raus.inCar);
  }

  /* ---------- 4. Haus betreten ---------- */
  const hausInfo = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    const it = c.interiors[0];
    return it ? { id: it.id, name: it.name, doorX: it.doorX, doorZ: it.doorZ, x: it.x, z: it.z } : null;
  });
  pruefe('Häuser vorhanden', !!hausInfo, hausInfo ? hausInfo.name : '');

  if (hausInfo) {
    await setze(hausInfo.doorX, hausInfo.doorZ, 0);
    await frames(5);
    const anTuer = await lies();
    pruefe('Hinweis "betreten" an der Tür',
      anTuer.prompt && /betreten|verlassen/i.test(anTuer.prompt), anTuer.prompt);

    await page.keyboard.press('KeyE');
    await frames(6);
    const innen = await lies();
    pruefe('Haus betreten', innen.interior === hausInfo.id,
      'interior=' + innen.interior + ' erwartet=' + hausInfo.id);
    await foto(page, 'i2-innenraum.png');

    const dachWeg = await page.evaluate(() => {
      const c = GTA.Game.getCtx();
      const it = c.interiors.find(i => i.id === c.player.interiorId);
      if (!it || !it.roof) return null;
      return it.roof.visible === false;
    });
    pruefe('Dach wird beim Betreten ausgeblendet', dachWeg !== false, 'roofVisible=' + (dachWeg === null ? 'kein Dach' : !dachWeg));
  }

  /* ---------- 5. Gegenstand aufheben ---------- */
  const itemPos = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    const it = c.items.find(i => !i.taken && i.def.kind === 'cash');
    return it ? { x: it.x, z: it.z, name: it.def.name } : null;
  });
  pruefe('Gegenstände in der Welt', !!itemPos, itemPos ? itemPos.name : '');

  if (itemPos) {
    const geldVorher = (await lies()).money;
    await setze(itemPos.x + 0.6, itemPos.z, 0);
    await frames(8);
    const nachher = await lies();
    pruefe('Gegenstand wird beim Drüberlaufen aufgehoben',
      nachher.money > geldVorher, geldVorher + ' → ' + nachher.money);
  }

  /* ---------- 6. Waffe kaufen, wechseln, schießen ---------- */
  await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    c.player.money = 20000;
    GTA.Player.giveWeapon(c, 'pistole');
    GTA.Player.giveAmmo(c, 'pistole', 90);
    GTA.Weapons.select(c, 'pistole');
  });
  await page.waitForTimeout(200);
  const mitWaffe = await lies();
  pruefe('Waffe ausgerüstet', mitWaffe.weapon === 'pistole', mitWaffe.weapon);

  const npcNah = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    const n = c.npcs.find(x => x.kind === 'civ' && x.state !== 'down');
    if (!n) return null;
    // Spieler vor den NPC stellen und hinsehen
    c.player.x = n.x; c.player.z = n.z - 4;
    c.player.heading = 0; GTA.Input.lookYaw = 0;
    return { hp: n.hp, name: n.displayName };
  });
  if (npcNah) {
    await page.waitForTimeout(200);
    await page.keyboard.press('Space');
    await frames(6);
    const danach = await page.evaluate(() => {
      const c = GTA.Game.getCtx();
      return { heat: c.heat, munition: c.player.ammo.pistole, magazin: (c.player.magazin || {}).pistole };
    });
    pruefe('Schuss verbraucht Munition', danach.magazin !== undefined && danach.magazin < 12,
      'Magazin ' + danach.magazin);
    pruefe('Schuss erzeugt Fahndung', danach.heat > 0, 'heat=' + Math.round(danach.heat * 10) / 10);
  }

  /* ---------- 7. NPC ansprechen ---------- */
  const redeOk = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    const n = c.npcs.find(x => x.kind === 'civ' && x.state !== 'down' && x.talk && x.talk.length);
    if (!n) return null;
    c.player.x = n.x + 1.5; c.player.z = n.z;
    c.heat = 0;
    return n.displayName;
  });
  if (redeOk) {
    await frames(4);
    const p1 = await lies();
    await page.keyboard.press('KeyE');
    await frames(5);
    const blase = await page.evaluate(() =>
      document.getElementById('speech').className.indexOf('on') >= 0
        ? document.getElementById('speech').textContent : null);
    pruefe('Mit [E] reden zeigt Sprechblase', !!blase, blase ? blase.slice(0, 60) : p1.prompt);
  }

  /* ---------- 8. Garage und Fahrzeugkauf ---------- */
  await page.keyboard.press('KeyG');
  await frames(5);
  const garageOffen = await page.evaluate(() =>
    document.getElementById('garage').className.indexOf('on') >= 0);
  pruefe('Garage öffnet mit [G]', garageOffen);
  await foto(page, 'i3-garage.png');

  const kauf = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    c.player.money = 40000;
    GTA.UI.pickVehicle(c, 'superbike');
    return { gewaehlt: c.player.ownedVehicle, besitzt: !!c.player.owned.superbike };
  });
  pruefe('Motorrad kaufbar und auswählbar', kauf.besitzt && kauf.gewaehlt === 'superbike', JSON.stringify(kauf));

  // Charakter ändern
  const charOk = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    c.player.style.build = 'kraeftig';
    c.player.style.hat = 'trachtenhut';
    c.player.style.beard = true;
    GTA.Player.rebuildMesh(c);
    return !!c.player.mesh;
  });
  pruefe('Charakter lässt sich neu aufbauen', charOk);
  await page.keyboard.press('Escape');
  await frames(5);

  /* ---------- 9. Auf das neue Motorrad steigen ---------- */
  const bikePos = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    const own = c.worldCars.find(v => v.isOwn);
    if (!own) return null;
    // Auf die freie Ringstrasse stellen, damit der Fahrtest nicht an
    // einem Zaun scheitert.
    own.mesh.position.set(0, 0, 120);
    own.mesh.rotation.y = 0;
    c.player.x = 1.4; c.player.z = 120;
    c.player.heading = 0; GTA.Input.lookYaw = 0;
    return { name: own.params.name, bike: !!own.params.bike };
  });
  if (bikePos) {
    await frames(4);
    await page.keyboard.press('KeyE');
    await frames(5);
    const aufBike = await lies();
    pruefe('Motorrad besteigbar', aufBike.inCar, bikePos.name);
    if (aufBike.inCar) {
      await page.keyboard.down('KeyW');
      await frames(60);
      await foto(page, 'i4-motorrad.png');
      await page.keyboard.up('KeyW');
      const bikeFahrt = await lies();
      pruefe('Motorrad fährt', bikeFahrt.speed > 4, 'Tempo ' + bikeFahrt.speed);
      await page.keyboard.press('KeyE');
      await frames(4);
    }
  }

  /* ---------- 10. Mission starten ---------- */
  const missionOk = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    const def = GTA.Missions.byId('eintreiber');
    if (!def) return null;
    c.player.x = def.spot[0]; c.player.z = def.spot[1];
    GTA.Missions.start(c, def);
    return c.mission ? c.mission.def.id : null;
  });
  pruefe('Auftrag startbar', missionOk === 'eintreiber', missionOk);
  await frames(5);
  const zielAktiv = await page.evaluate(() => !!GTA.Missions.targetPos);
  pruefe('Zielmarkierung gesetzt', zielAktiv);

  await page.evaluate(() => GTA.Missions.fail(GTA.Game.getCtx(), 'Test'));
  await frames(5);
  const aufgeraeumt = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    return { mission: c.mission, gegner: c.npcs.filter(n => n.kind === 'enemy').length };
  });
  pruefe('Auftrag räumt Gegner auf', aufgeraeumt.mission === null && aufgeraeumt.gegner === 0,
    JSON.stringify(aufgeraeumt));

  /* ---------- 11. Karte ---------- */
  // Falls noch ein Fenster offen ist, erst schliessen — sonst blockiert es die Tasten.
  await page.evaluate(() => {
    if (GTA.UI.isModalOpen()) { GTA.UI.hideBriefing(); GTA.UI.closeGarage(); }
  });
  await frames(3);
  await page.keyboard.press('KeyM');
  await frames(5);
  const karteOffen = await page.evaluate(() =>
    document.getElementById('mapOverlay').className.indexOf('on') >= 0);
  pruefe('Karte öffnet mit [M]', karteOffen);
  await foto(page, 'i5-karte.png');
  await page.keyboard.press('KeyM');
  await frames(5);

  /* ---------- 12. Laufen im Freien ---------- */
  await setze(0, 60, 0);
  await frames(4);
  const vorLauf = await lies();
  await page.keyboard.down('KeyW');
  await frames(50);
  await page.keyboard.up('KeyW');
  const nachLauf = await lies();
  const gelaufen = Math.hypot(nachLauf.x - vorLauf.x, nachLauf.z - vorLauf.z);
  pruefe('Spieler bewegt sich zu Fuß', gelaufen > 3, Math.round(gelaufen) + ' m');

  /* ---------- 13. Speichern / Laden ---------- */
  const gespeichert = await page.evaluate(() => {
    const c = GTA.Game.getCtx();
    c.player.money = 7777;
    GTA.Player.saveNow(c);
    const roh = localStorage.getItem('gta_alpen_save');
    return roh ? JSON.parse(roh).money : null;
  });
  pruefe('Spielstand wird geschrieben', gespeichert === 7777, gespeichert);

  await frames(6);
  const ende = await lies();
  await foto(page, 'i6-ende.png');

  await browser.close();
  srv.close();

  /* ---------- Bericht ---------- */
  const misslungen = pruefungen.filter(p => !p.ok);
  console.log('\n============ INTERAKTIONSTEST ============');
  pruefungen.forEach(p => {
    console.log((p.ok ? '  ✓ ' : '  ✗ ') + p.name.padEnd(46) + (p.detail ? ' — ' + p.detail : ''));
  });
  console.log('\n' + (pruefungen.length - misslungen.length) + '/' + pruefungen.length + ' bestanden');
  console.log('Laufzeitfehler: ' + fehler.length);
  fehler.slice(0, 15).forEach(e => console.log('  ! ' + e.slice(0, 300)));
  console.log('Endzustand: ' + JSON.stringify(ende));
  console.log('=========================================\n');

  fs.writeFileSync(path.join(SHOTS, 'interaktion.json'),
    JSON.stringify({ pruefungen, fehler, ende }, null, 2));
  process.exit(misslungen.length || fehler.length ? 1 : 0);
})().catch(e => { console.error('Test abgebrochen:', e); process.exit(2); });
