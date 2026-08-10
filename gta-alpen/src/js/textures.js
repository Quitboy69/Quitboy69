'use strict';
/* ============================================================
   textures.js — prozedurale Canvas-Texturen und geteilte Materialien
   Abhängig von: three.js, config.js, util.js. Definiert GTA.TEX.
   GTA.TEX.init(renderer, gfx) muss einmal vor dem Weltbau laufen.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.TEX = (function () {
  var TEX = { ready: false, maxAniso: 1 };
  var U = null;

  function canvasTex(size, draw, repX, repY) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    draw(cv.getContext('2d'), size);
    var tx = new THREE.CanvasTexture(cv);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(repX || 1, repY || 1);
    tx.anisotropy = TEX.maxAniso;
    return tx;
  }
  TEX.canvasTex = canvasTex;

  // Feines Rauschen als Grundlage vieler Oberflächen
  function speckle(c, s, count, base, spread, alphaLo, alphaHi, w, h) {
    for (var i = 0; i < count; i++) {
      var v = base + Math.random() * spread | 0;
      c.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' +
        (alphaLo + Math.random() * (alphaHi - alphaLo)) + ')';
      c.fillRect(Math.random() * s, Math.random() * s, w || 2, h || 2);
    }
  }

  TEX.init = function (renderer, gfx) {
    if (TEX.ready) return TEX;
    U = GTA.U;
    TEX.maxAniso = Math.min(gfx.aniso, renderer.capabilities.getMaxAnisotropy());

    // ---------- Außenwelt ----------
    TEX.asphalt = canvasTex(512, function (c, s) {
      c.fillStyle = '#3a3f46'; c.fillRect(0, 0, s, s);
      for (var i = 0; i < 11000; i++) {
        var v = 40 + Math.random() * 48 | 0;
        c.fillStyle = 'rgba(' + v + ',' + (v + 3) + ',' + (v + 8) + ',' + (0.25 + Math.random() * 0.5) + ')';
        c.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5);
      }
      c.strokeStyle = 'rgba(20,22,26,0.35)'; c.lineWidth = 1;
      for (var k = 0; k < 30; k++) {
        c.beginPath();
        var x = Math.random() * s, y = Math.random() * s;
        c.moveTo(x, y);
        for (var j = 0; j < 5; j++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; c.lineTo(x, y); }
        c.stroke();
      }
      // Ölflecken
      for (var o = 0; o < 6; o++) {
        var g = c.createRadialGradient(Math.random() * s, Math.random() * s, 2, Math.random() * s, Math.random() * s, 40);
        g.addColorStop(0, 'rgba(15,15,18,0.35)'); g.addColorStop(1, 'rgba(15,15,18,0)');
        c.fillStyle = g; c.fillRect(0, 0, s, s);
      }
    }, 26, 26);

    TEX.grass = canvasTex(512, function (c, s) {
      c.fillStyle = '#67a84e'; c.fillRect(0, 0, s, s);
      for (var i = 0; i < 9000; i++) {
        var g = 130 + Math.random() * 70 | 0;
        c.fillStyle = 'rgba(' + (g * 0.55 | 0) + ',' + g + ',' + (g * 0.4 | 0) + ',' + (0.3 + Math.random() * 0.45) + ')';
        c.fillRect(Math.random() * s, Math.random() * s, 1.6, 3.2 + Math.random() * 3);
      }
      for (var f = 0; f < 60; f++) {
        c.fillStyle = 'rgba(240,225,120,' + (0.25 + Math.random() * 0.3) + ')';
        c.beginPath(); c.arc(Math.random() * s, Math.random() * s, 1.6, 0, 7); c.fill();
      }
    }, 90, 90);

    TEX.dirt = canvasTex(256, function (c, s) {
      c.fillStyle = '#8a6b46'; c.fillRect(0, 0, s, s);
      speckle(c, s, 4000, 90, 70, 0.2, 0.5, 2, 2);
    }, 20, 20);

    TEX.plaster = canvasTex(256, function (c, s) {
      c.fillStyle = '#f2ecdf'; c.fillRect(0, 0, s, s);
      for (var i = 0; i < 3200; i++) {
        var v = 215 + Math.random() * 35 | 0;
        c.fillStyle = 'rgba(' + v + ',' + (v - 4) + ',' + (v - 16) + ',' + (0.3 + Math.random() * 0.4) + ')';
        c.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
    }, 2, 2);

    TEX.roof = canvasTex(256, function (c, s) {
      c.fillStyle = '#8f4437'; c.fillRect(0, 0, s, s);
      var rows = 8, cols = 6;
      for (var r = 0; r < rows; r++) {
        for (var q = 0; q < cols; q++) {
          var x = q * (s / cols) + (r % 2 ? s / cols / 2 : 0), y = r * (s / rows);
          c.fillStyle = 'rgba(0,0,0,0.22)';
          c.fillRect(x - 1, y + s / rows - 3, s / cols, 3);
          c.fillStyle = 'rgba(255,190,160,' + (0.05 + Math.random() * 0.1) + ')';
          c.fillRect(x, y, s / cols - 2, s / rows - 3);
        }
      }
    }, 3, 3);

    TEX.water = canvasTex(256, function (c, s) {
      c.fillStyle = '#3d7dc8'; c.fillRect(0, 0, s, s);
      for (var i = 0; i < 1100; i++) {
        c.fillStyle = 'rgba(255,255,255,' + (0.04 + Math.random() * 0.1) + ')';
        c.fillRect(Math.random() * s, Math.random() * s, 3 + Math.random() * 8, 1.2);
      }
    }, 6, 6);

    // ---------- Innenräume / Möbel ----------
    TEX.wood = canvasTex(256, function (c, s) {
      c.fillStyle = '#9a6b3f'; c.fillRect(0, 0, s, s);
      for (var i = 0; i < 90; i++) {
        c.strokeStyle = 'rgba(' + (90 + Math.random() * 60 | 0) + ',' + (60 + Math.random() * 40 | 0) + ',30,' + (0.12 + Math.random() * 0.3) + ')';
        c.lineWidth = 0.6 + Math.random() * 2.2;
        c.beginPath();
        var y = Math.random() * s;
        c.moveTo(0, y);
        for (var x = 0; x <= s; x += 16) c.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
        c.stroke();
      }
      // Astlöcher
      for (var k = 0; k < 4; k++) {
        var ax = Math.random() * s, ay = Math.random() * s;
        c.strokeStyle = 'rgba(70,45,22,0.45)';
        for (var rr = 2; rr < 10; rr += 2) { c.lineWidth = 1; c.beginPath(); c.ellipse(ax, ay, rr, rr * 0.6, 0.4, 0, 7); c.stroke(); }
      }
    }, 2, 2);

    TEX.parkett = canvasTex(256, function (c, s) {
      c.fillStyle = '#a97a4a'; c.fillRect(0, 0, s, s);
      var pw = s / 4, ph = s / 8;
      for (var r = 0; r < 8; r++) {
        for (var q = 0; q < 4; q++) {
          var x = q * pw + (r % 2 ? pw / 2 : 0), y = r * ph;
          var v = 150 + Math.random() * 55 | 0;
          c.fillStyle = 'rgb(' + v + ',' + (v * 0.72 | 0) + ',' + (v * 0.45 | 0) + ')';
          c.fillRect(x + 1, y + 1, pw - 2, ph - 2);
          c.strokeStyle = 'rgba(70,45,25,0.5)'; c.lineWidth = 1;
          c.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
        }
      }
    }, 5, 5);

    TEX.carpet = canvasTex(128, function (c, s) {
      c.fillStyle = '#8d4a4a'; c.fillRect(0, 0, s, s);
      for (var i = 0; i < 5000; i++) {
        var v = 100 + Math.random() * 70 | 0;
        c.fillStyle = 'rgba(' + v + ',' + (v * 0.5 | 0) + ',' + (v * 0.5 | 0) + ',0.4)';
        c.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      c.strokeStyle = 'rgba(240,220,180,0.35)'; c.lineWidth = 4;
      c.strokeRect(8, 8, s - 16, s - 16);
    }, 1, 1);

    TEX.tile = canvasTex(256, function (c, s) {
      c.fillStyle = '#e9edf1'; c.fillRect(0, 0, s, s);
      var n = 4, t = s / n;
      for (var r = 0; r < n; r++) for (var q = 0; q < n; q++) {
        var v = 225 + Math.random() * 25 | 0;
        c.fillStyle = 'rgb(' + v + ',' + (v + 2) + ',' + (v + 6) + ')';
        c.fillRect(q * t + 2, r * t + 2, t - 4, t - 4);
      }
      c.strokeStyle = 'rgba(150,160,170,0.8)'; c.lineWidth = 2;
      for (var i = 0; i <= n; i++) {
        c.beginPath(); c.moveTo(i * t, 0); c.lineTo(i * t, s); c.stroke();
        c.beginPath(); c.moveTo(0, i * t); c.lineTo(s, i * t); c.stroke();
      }
    }, 4, 4);

    TEX.brick = canvasTex(256, function (c, s) {
      c.fillStyle = '#8d5a48'; c.fillRect(0, 0, s, s);
      var rows = 10, bw = s / 4, bh = s / rows;
      for (var r = 0; r < rows; r++) {
        for (var q = -1; q < 5; q++) {
          var x = q * bw + (r % 2 ? bw / 2 : 0), y = r * bh;
          var v = 130 + Math.random() * 45 | 0;
          c.fillStyle = 'rgb(' + v + ',' + (v * 0.6 | 0) + ',' + (v * 0.5 | 0) + ')';
          c.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        }
      }
    }, 4, 4);

    TEX.fabric = canvasTex(128, function (c, s) {
      c.fillStyle = '#4a5a72'; c.fillRect(0, 0, s, s);
      for (var i = 0; i < s; i += 3) {
        c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(i, 0, 1.4, s);
        c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(0, i, s, 1.4);
      }
      speckle(c, s, 1500, 90, 60, 0.08, 0.2, 2, 2);
    }, 2, 2);

    TEX.paper = canvasTex(128, function (c, s) {
      c.fillStyle = '#f6f2e6'; c.fillRect(0, 0, s, s);
      c.strokeStyle = 'rgba(80,90,120,0.35)'; c.lineWidth = 1;
      for (var y = 10; y < s; y += 11) { c.beginPath(); c.moveTo(6, y); c.lineTo(s - 6, y); c.stroke(); }
    }, 1, 1);

    TEX.metal = canvasTex(128, function (c, s) {
      c.fillStyle = '#9fa6ad'; c.fillRect(0, 0, s, s);
      for (var i = 0; i < 400; i++) {
        c.strokeStyle = 'rgba(255,255,255,' + (0.03 + Math.random() * 0.08) + ')';
        c.lineWidth = 0.7;
        var y = Math.random() * s;
        c.beginPath(); c.moveTo(0, y); c.lineTo(s, y + (Math.random() - 0.5) * 4); c.stroke();
      }
    }, 2, 2);

    // ---------- Geteilte Materialien ----------
    var M = GTA.U.mat;
    TEX.M = {
      asphalt:  M(0xffffff, 0.95, 0, { map: TEX.asphalt }),
      grass:    M(0xffffff, 1.0,  0, { map: TEX.grass }),
      dirt:     M(0xffffff, 1.0,  0, { map: TEX.dirt }),
      plaster:  M(0xffffff, 0.9,  0, { map: TEX.plaster }),
      roof:     M(0xffffff, 0.85, 0, { map: TEX.roof }),
      water:    M(0xffffff, 0.1,  0.3, { map: TEX.water }),
      wood:     M(0xffffff, 0.72, 0, { map: TEX.wood }),
      woodDark: M(0x6b4527, 0.75, 0),
      parkett:  M(0xffffff, 0.55, 0.05, { map: TEX.parkett }),
      carpet:   M(0xffffff, 0.95, 0, { map: TEX.carpet }),
      tile:     M(0xffffff, 0.28, 0.08, { map: TEX.tile }),
      brick:    M(0xffffff, 0.9,  0, { map: TEX.brick }),
      fabric:   M(0xffffff, 0.88, 0, { map: TEX.fabric }),
      paper:    M(0xffffff, 0.9,  0, { map: TEX.paper }),
      metal:    M(0xffffff, 0.35, 0.85, { map: TEX.metal }),
      chrome:   M(0xe8ecf0, 0.08, 1.0, { envMapIntensity: 1.6 }),
      glass:    M(0xbcd4e6, 0.05, 0.5, { transparent: true, opacity: 0.32 }),
      darkGlass:M(0x0d1420, 0.05, 0.9, { envMapIntensity: 1.5 }),
      dark:     M(0x181b20, 0.85, 0.1),
      white:    M(0xf4f6f8, 0.7,  0),
      screen:   M(0x0a0d12, 0.2, 0.4, { emissive: 0x2a5c8a, emissiveIntensity: 0.7 })
    };

    TEX.ready = true;
    return TEX;
  };

  // Anisotropie nach einem Grafikwechsel neu setzen
  TEX.applyAniso = function (renderer, gfx) {
    if (!TEX.ready) return;
    var a = Math.min(gfx.aniso, renderer.capabilities.getMaxAnisotropy());
    TEX.maxAniso = a;
    ['asphalt', 'grass', 'dirt', 'plaster', 'roof', 'water', 'wood', 'parkett',
     'carpet', 'tile', 'brick', 'fabric', 'paper', 'metal'].forEach(function (k) {
      if (TEX[k]) { TEX[k].anisotropy = a; TEX[k].needsUpdate = true; }
    });
  };

  return TEX;
})();
