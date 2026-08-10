#!/usr/bin/env node
'use strict';
/* Prüft alle Spielskripte auf Syntaxfehler und verbotene Sprachmittel.
   Aufruf:  npm run lint                                              */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const jsDir = path.join(__dirname, '..', 'src', 'js');
const htmlPath = path.join(__dirname, '..', 'src', 'index.html');

// Diese Konstrukte brechen in älteren Chromium-Versionen (VMs, alte Treiber).
const VERBOTEN = [
  { re: /\?\./g, name: 'optionale Verkettung ?.' },
  { re: /\?\?[^=]/g, name: 'Nullish-Operator ??' },
  { re: /^\s*import\s/m, name: 'import' },
  { re: /^\s*export\s/m, name: 'export' }
];

let fehler = 0;
let warnungen = 0;

const dateien = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();

for (const f of dateien) {
  const p = path.join(jsDir, f);
  const src = fs.readFileSync(p, 'utf8');
  const zeilen = src.split('\n').length;

  try {
    new vm.Script(src, { filename: f });
  } catch (e) {
    console.error(`✗ ${f}: SYNTAXFEHLER — ${e.message}`);
    fehler++;
    continue;
  }

  const probleme = [];
  for (const v of VERBOTEN) {
    v.re.lastIndex = 0;
    if (v.re.test(src)) probleme.push(v.name);
  }
  if (!/^'use strict';/m.test(src)) probleme.push("fehlendes 'use strict'");

  if (probleme.length) {
    console.warn(`⚠ ${f} (${zeilen} Zeilen): ${probleme.join(', ')}`);
    warnungen++;
  } else {
    console.log(`✓ ${f} (${zeilen} Zeilen)`);
  }
}

// Werden alle Dateien auch eingebunden?
const html = fs.readFileSync(htmlPath, 'utf8');
const eingebunden = [...html.matchAll(/src="js\/([^"]+)"/g)].map(m => m[1]);
const fehlend = dateien.filter(f => !eingebunden.includes(f));
const zuviel = eingebunden.filter(f => !dateien.includes(f));

if (fehlend.length) {
  console.error(`✗ Nicht in index.html eingebunden: ${fehlend.join(', ')}`);
  fehler++;
}
if (zuviel.length) {
  console.error(`✗ In index.html eingebunden, aber nicht vorhanden: ${zuviel.join(', ')}`);
  fehler++;
}

console.log(`\n${dateien.length} Dateien · ${fehler} Fehler · ${warnungen} Warnungen`);
process.exit(fehler ? 1 : 0);
