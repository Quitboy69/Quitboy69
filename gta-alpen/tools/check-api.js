#!/usr/bin/env node
'use strict';
/* ============================================================
   check-api.js — findet Aufrufe wie GTA.Items.hintFor(...), die
   von keinem Modul bereitgestellt werden.

   Rein textuell, ohne Browser: sammelt je Datei alle
   "GTA.Modul.funktion(" Aufrufe und vergleicht sie mit dem, was
   die Moduldatei nach außen sichtbar setzt ("X.funktion =").

   Aufruf:  node tools/check-api.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'src', 'js');

// Welche Datei definiert welchen Namensraum?
const NS_DATEI = {
  CFG: 'config.js', U: 'util.js', TEX: 'textures.js', Chars: 'characters.js',
  Vehicles: 'vehicles.js', Interiors: 'interiors.js', Buildings: 'buildings.js',
  World: 'world.js', Traffic: 'traffic.js', Items: 'items.js',
  Weapons: 'weapons.js', NPCs: 'npcs.js', Audio: 'audio.js',
  Player: 'player.js', Missions: 'missions.js', UI: 'ui.js',
  Input: 'input.js', Game: 'main.js'
};

const quelle = {};
for (const f of fs.readdirSync(jsDir).filter(f => f.endsWith('.js'))) {
  quelle[f] = fs.readFileSync(path.join(jsDir, f), 'utf8');
}

/* --- 1. Was bietet jedes Modul an? --- */
const bietet = {};
for (const [ns, datei] of Object.entries(NS_DATEI)) {
  bietet[ns] = new Set();
  const src = quelle[datei];
  if (!src) continue;

  // a) Kurzname innerhalb der IIFE ermitteln:  GTA.Items = (function(){ var I = {};  ... return I; })
  const kurz = new Set();
  const retM = src.match(/return\s+([A-Za-z_$][\w$]*)\s*;\s*\}\s*\)\s*\(\s*\)\s*;?\s*$/m);
  if (retM) kurz.add(retM[1]);
  // gängige Kurznamen zusätzlich zulassen
  const varM = src.matchAll(/\bvar\s+([A-Z][\w$]?)\s*=\s*\{\s*\}/g);
  for (const m of varM) kurz.add(m[1]);

  for (const k of kurz) {
    const re = new RegExp('\\b' + k.replace(/\$/g, '\\$') + '\\.([A-Za-z_$][\\w$]*)\\s*=', 'g');
    for (const m of src.matchAll(re)) bietet[ns].add(m[1]);
  }
  // b) direkt gesetzte Felder:  GTA.Items.foo = ...
  for (const m of src.matchAll(new RegExp('GTA\\.' + ns + '\\.([A-Za-z_$][\\w$]*)\\s*=', 'g'))) {
    bietet[ns].add(m[1]);
  }
  // c) Objektliteral-Schlüssel im return-Block:  return { foo: foo, bar: bar }
  const litM = src.match(/return\s*\{([\s\S]{0,4000}?)\}\s*;\s*\}\s*\)\s*\(\s*\)/m);
  if (litM) {
    for (const m of litM[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) bietet[ns].add(m[1]);
  }
  // d) Objektliteral direkt zugewiesen:  GTA.Interiors = { KINDS: [...], build: function(){} }
  const direct = src.match(new RegExp('GTA\\.' + ns + '\\s*=\\s*\\{([\\s\\S]*)$'));
  if (direct) {
    for (const m of direct[1].matchAll(/^\s{2,4}([A-Za-z_$][\w$]*)\s*:/gm)) bietet[ns].add(m[1]);
  }
}

/* --- 2. Was ruft wer auf? --- */
const fehlend = [];
for (const [datei, src] of Object.entries(quelle)) {
  for (const m of src.matchAll(/GTA\.([A-Z][\w$]*)\.([A-Za-z_$][\w$]*)/g)) {
    const [, ns, fn] = m;
    if (!NS_DATEI[ns]) continue;
    if (NS_DATEI[ns] === datei) continue;           // eigenes Modul
    if (!quelle[NS_DATEI[ns]]) continue;            // Modul fehlt noch ganz
    if (bietet[ns].has(fn)) continue;
    const zeile = src.slice(0, m.index).split('\n').length;
    fehlend.push({ datei, zeile, ruf: `GTA.${ns}.${fn}`, ziel: NS_DATEI[ns] });
  }
}

/* --- 3. Bericht --- */
const nachModul = {};
for (const f of fehlend) {
  const k = `${f.ziel}  (${f.ruf.split('.')[1]})`;
  (nachModul[k] = nachModul[k] || []).push(f);
}

console.log('=== ANGEBOTENE SCHNITTSTELLEN ===');
for (const ns of Object.keys(NS_DATEI)) {
  if (!quelle[NS_DATEI[ns]]) { console.log(`  ${ns.padEnd(10)} — Datei fehlt noch`); continue; }
  const list = [...bietet[ns]].sort();
  console.log(`  ${ns.padEnd(10)} ${list.length.toString().padStart(3)} : ${list.join(', ').slice(0, 150)}`);
}

console.log('\n=== FEHLENDE FUNKTIONEN ===');
if (!fehlend.length) {
  console.log('  keine — alle Aufrufe sind gedeckt');
} else {
  const eindeutig = new Map();
  for (const f of fehlend) {
    if (!eindeutig.has(f.ruf)) eindeutig.set(f.ruf, []);
    eindeutig.get(f.ruf).push(`${f.datei}:${f.zeile}`);
  }
  for (const [ruf, orte] of [...eindeutig].sort()) {
    console.log(`  ✗ ${ruf.padEnd(34)} fehlt in ${NS_DATEI[ruf.split('.')[1]].padEnd(14)} — gerufen von ${orte.slice(0, 3).join(', ')}`);
  }
  console.log(`\n  ${eindeutig.size} verschiedene fehlende Funktionen, ${fehlend.length} Aufrufstellen`);
}

process.exit(0);
