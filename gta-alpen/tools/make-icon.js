#!/usr/bin/env node
'use strict';
/* Erzeugt build/icon.png (512×512) ohne externe Bibliotheken.
   Motiv: Alpengipfel über der rot-weiß-roten Flagge.
   Aufruf:  node tools/make-icon.js                                    */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const S = 512;
const px = Buffer.alloc(S * S * 4);

function set(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  const na = a / 255;
  px[i]     = Math.round(px[i]     * (1 - na) + r * na);
  px[i + 1] = Math.round(px[i + 1] * (1 - na) + g * na);
  px[i + 2] = Math.round(px[i + 2] * (1 - na) + b * na);
  px[i + 3] = Math.max(px[i + 3], a);
}

// --- Hintergrund: Himmelsverlauf mit abgerundeten Ecken ---
const R = 96;
function insideRounded(x, y) {
  const cx = Math.min(Math.max(x, R), S - R);
  const cy = Math.min(Math.max(y, R), S - R);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= R * R;
}

for (let y = 0; y < S; y++) {
  const t = y / S;
  const r = Math.round(42 + (188 - 42) * Math.pow(t, 0.7));
  const g = Math.round(114 + (222 - 114) * Math.pow(t, 0.7));
  const b = Math.round(196 + (240 - 196) * Math.pow(t, 0.7));
  for (let x = 0; x < S; x++) {
    if (insideRounded(x, y)) set(x, y, r, g, b, 255);
  }
}

// --- Sonne ---
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - 372, y - 132);
    if (d < 46 && insideRounded(x, y)) set(x, y, 255, 243, 196, 255);
    else if (d < 78 && insideRounded(x, y)) set(x, y, 255, 240, 190, Math.round(120 * (1 - (d - 46) / 32)));
  }
}

// --- Berge ---
function mountain(peakX, peakY, halfW, baseY, cr, cg, cb, snowLine) {
  for (let y = peakY; y < baseY; y++) {
    const f = (y - peakY) / (baseY - peakY);
    const w = Math.round(halfW * f);
    for (let x = peakX - w; x <= peakX + w; x++) {
      if (!insideRounded(x, y)) continue;
      const shade = x < peakX ? 1.0 : 0.82;   // rechte Flanke im Schatten
      if (snowLine && y < snowLine) {
        const s = 244;
        set(x, y, Math.round(s * shade), Math.round((s + 3) * shade), Math.round((s + 6) * shade), 255);
      } else {
        set(x, y, Math.round(cr * shade), Math.round(cg * shade), Math.round(cb * shade), 255);
      }
    }
  }
}

mountain(126, 196, 150, 392, 95, 116, 100, 236);
mountain(392, 168, 168, 392, 84, 104, 90, 214);
mountain(258, 122, 196, 392, 108, 128, 110, 186);

// --- Wiese ---
for (let y = 372; y < S; y++) {
  for (let x = 0; x < S; x++) {
    if (!insideRounded(x, y)) continue;
    const t = (y - 372) / (S - 372);
    set(x, y, Math.round(103 - 18 * t), Math.round(168 - 26 * t), Math.round(78 - 16 * t), 255);
  }
}

// --- Straße ---
for (let y = 372; y < S; y++) {
  const t = (y - 372) / (S - 372);
  const half = Math.round(18 + 96 * t);
  for (let x = 256 - half; x <= 256 + half; x++) {
    if (insideRounded(x, y)) set(x, y, 58, 63, 70, 255);
  }
  // Mittelstreifen
  if (Math.floor((y - 372) / 26) % 2 === 0) {
    const sw = Math.round(2 + 7 * t);
    for (let x = 256 - sw; x <= 256 + sw; x++) {
      if (insideRounded(x, y)) set(x, y, 242, 243, 239, 255);
    }
  }
}

// --- Flaggenband unten ---
const bandTop = S - 74, bandH = 74;
for (let y = bandTop; y < S; y++) {
  for (let x = 0; x < S; x++) {
    if (!insideRounded(x, y)) continue;
    const seg = Math.floor((y - bandTop) / (bandH / 3));
    if (seg === 1) set(x, y, 255, 255, 255, 255);
    else set(x, y, 237, 41, 57, 255);
  }
}

// --- PNG schreiben ---
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;                                  // Filter: none
  px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0, 0);
  return Buffer.concat([len, td, crc]);
}

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;    // Bittiefe
ihdr[9] = 6;    // RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('Symbol geschrieben:', out, '(' + png.length + ' Bytes)');
