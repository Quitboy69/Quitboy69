'use strict';
/* ============================================================
   interiors.js — Innenräume, Möbel, Beute
   Abhängig von: three.js (r128, global THREE), config.js, util.js,
   textures.js, characters.js. Definiert GTA.Interiors.

   Abschnitt B des Modul-Vertrags.

   Beim Laden entsteht NICHTS ausser reinen Datentabellen.
   Der komplette Weltbau passiert in GTA.Interiors.build(ctx).

   ctx erwartet:
     ctx.scene      THREE.Scene
     ctx.obstacles  Array von Kreisen { x, z, r }
     ctx.walls      Array von Rechtecken { x0, z0, x1, z1, interiorId }

   build(ctx) liefert ein Array von Raum-Datensätzen:
     {
       id, index, kind, title, hint,
       x, z, rot, w, d, h,          Weltmitte + Maße (lokal)
       bounds  {x0,x1,z0,z1},       Weltachsen-Rechteck des Raums
       group   THREE.Group,
       ceiling THREE.Mesh,
       door    {x, z, heading},     Türmitte, heading zeigt hinein
       spawn   {x, z},              Standpunkt innen
       exit    {x, z},              Standpunkt draussen
       loot    [ {id, name, value, x, y, z, taken, mesh} ],
       lamps   [ THREE.PointLight ],
       colliders [ {x,z,w,d} ],
       active  bool
     }

   Lokale Raumkoordinaten: X nach rechts, Z nach hinten,
   die Tür liegt immer bei lokal (0, -d/2). Die Gruppe wird um
   rot * 90 Grad gedreht, damit alle Wände achsenparallel bleiben.
   heading = atan2(dx, dz); vorwärts = (sin h, cos h). Y = 0 ist Boden.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Interiors = (function () {

  var API = {};
  var HALFPI = Math.PI / 2;

  /* ============================================================
     1. MATERIAL-HILFEN
     Nichts davon wird beim Laden ausgeführt — erst beim Bau.
     ============================================================ */

  var _mcache = {};

  function cached(key, make) {
    if (!_mcache[key]) _mcache[key] = make();
    return _mcache[key];
  }

  function sharedM(name) {
    if (GTA.TEX && GTA.TEX.M && GTA.TEX.M[name]) return GTA.TEX.M[name];
    return null;
  }

  function texMap(name) {
    if (GTA.TEX && GTA.TEX[name]) return GTA.TEX[name];
    return null;
  }

  // Eingefärbtes Holz — nutzt die Holztextur aus GTA.TEX als Maserung.
  function woodM(col) {
    return cached('holz_' + col, function () {
      return GTA.U.mat(col, 0.72, 0, { map: texMap('wood') });
    });
  }

  // Eingefärbter Stoff — nutzt die Gewebetextur.
  function clothM(col) {
    return cached('stoff_' + col, function () {
      return GTA.U.mat(col, 0.9, 0, { map: texMap('fabric') });
    });
  }

  // Schlichte Farbe ohne Textur.
  function flatM(col, rough, metal) {
    var r = rough === undefined ? 0.8 : rough;
    var mt = metal === undefined ? 0 : metal;
    return cached('flach_' + col + '_' + r + '_' + mt, function () {
      return GTA.U.mat(col, r, mt);
    });
  }

  // Metall mit Kratztextur.
  function metalM(col) {
    return cached('metall_' + col, function () {
      return GTA.U.mat(col, 0.34, 0.85, { map: texMap('metal') });
    });
  }

  // Leuchtendes Material für Lampenschirme, Displays, Glut.
  function glowM(col, strength) {
    var s = strength === undefined ? 0.9 : strength;
    return cached('glut_' + col + '_' + s, function () {
      return GTA.U.mat(col, 0.5, 0, { emissive: col, emissiveIntensity: s });
    });
  }

  function glassM() {
    return sharedM('glass') || cached('glas', function () {
      return GTA.U.mat(0xbcd4e6, 0.05, 0.4, { transparent: true, opacity: 0.32 });
    });
  }

  function paperM() {
    return sharedM('paper') || flatM(0xf6f2e6, 0.9, 0);
  }

  // Bodenmaterial nach Name aus der Raumtabelle.
  function floorM(name) {
    var m = sharedM(name);
    if (m) return m;
    if (name === 'tile') return flatM(0xe9edf1, 0.3, 0.08);
    if (name === 'carpet') return flatM(0x8d4a4a, 0.95, 0);
    if (name === 'dirt') return flatM(0x8a6b46, 1.0, 0);
    if (name === 'brick') return flatM(0x8d5a48, 0.9, 0);
    if (name === 'wood') return woodM(0xffffff);
    return flatM(0xa97a4a, 0.6, 0.05);
  }

  /* ============================================================
     2. MÖBEL-BAUSTEINE
     Jede Funktion liefert eine THREE.Group, deren Unterkante auf
     y = 0 steht. Grösse und Farbe sind immer Parameter, damit
     dasselbe Möbel in jedem Raum anders aussieht.
     ============================================================ */

  // ---- Tisch: Platte, Zarge, vier Beine ----
  function mkTisch(w, d, h, col, beinCol) {
    var U = GTA.U, g = new THREE.Group();
    var pm = woodM(col), bm = woodM(beinCol === undefined ? col : beinCol);
    var top = U.box(w, 0.07, d, pm);
    top.position.y = h;
    g.add(top);
    var kante = U.box(w + 0.04, 0.03, d + 0.04, woodM(0x7a5230));
    kante.position.y = h - 0.05;
    g.add(kante);
    var z1 = U.box(w - 0.22, 0.1, 0.05, bm);
    z1.position.set(0, h - 0.13, d / 2 - 0.09);
    g.add(z1);
    var z2 = z1.clone(); z2.position.z = -(d / 2 - 0.09); g.add(z2);
    var ox = w / 2 - 0.1, oz = d / 2 - 0.1;
    var sx = [ox, -ox, ox, -ox], sz = [oz, oz, -oz, -oz];
    for (var i = 0; i < 4; i++) {
      var bein = U.box(0.09, h - 0.04, 0.09, bm);
      bein.position.set(sx[i], (h - 0.04) / 2, sz[i]);
      g.add(bein);
    }
    return g;
  }

  // ---- Runder Tisch mit Mittelsäule ----
  function mkRundtisch(r, h, col) {
    var U = GTA.U, g = new THREE.Group();
    var top = U.cyl(r, r, 0.07, 20, woodM(col));
    top.position.y = h;
    g.add(top);
    var saeule = U.cyl(0.1, 0.13, h - 0.1, 12, woodM(col));
    saeule.position.y = (h - 0.1) / 2 + 0.05;
    g.add(saeule);
    var fuss = U.cyl(r * 0.55, r * 0.62, 0.08, 16, woodM(0x6b4527));
    fuss.position.y = 0.04;
    g.add(fuss);
    for (var i = 0; i < 3; i++) {
      var arm = U.box(r * 0.9, 0.06, 0.1, woodM(0x6b4527));
      arm.position.y = 0.06;
      arm.rotation.y = i * Math.PI * 2 / 3;
      g.add(arm);
    }
    return g;
  }

  // ---- Stuhl: Sitz, Lehne mit Sprossen, vier Beine ----
  function mkStuhl(col, sitzCol, hoehe) {
    var U = GTA.U, g = new THREE.Group();
    var h = hoehe === undefined ? 0.46 : hoehe;
    var hm = woodM(col);
    var sitz = U.box(0.44, 0.06, 0.42, sitzCol === undefined ? hm : clothM(sitzCol));
    sitz.position.y = h;
    g.add(sitz);
    var ox = 0.18, oz = 0.17;
    var sx = [ox, -ox, ox, -ox], sz = [oz, oz, -oz, -oz];
    for (var i = 0; i < 4; i++) {
      var bein = U.box(0.055, h, 0.055, hm);
      bein.position.set(sx[i], h / 2, sz[i]);
      g.add(bein);
    }
    var pf1 = U.box(0.055, 0.56, 0.055, hm);
    pf1.position.set(ox, h + 0.28, -oz);
    g.add(pf1);
    var pf2 = pf1.clone(); pf2.position.x = -ox; g.add(pf2);
    var quer = U.box(0.4, 0.09, 0.05, hm);
    quer.position.set(0, h + 0.5, -oz);
    g.add(quer);
    for (var s = 0; s < 2; s++) {
      var spr = U.box(0.05, 0.3, 0.04, hm);
      spr.position.set(-0.08 + s * 0.16, h + 0.24, -oz);
      g.add(spr);
    }
    return g;
  }

  // ---- Hocker ----
  function mkHocker(col, r, h) {
    var U = GTA.U, g = new THREE.Group();
    var rr = r === undefined ? 0.19 : r, hh = h === undefined ? 0.46 : h;
    var top = U.cyl(rr, rr, 0.06, 14, woodM(col));
    top.position.y = hh;
    g.add(top);
    for (var i = 0; i < 3; i++) {
      var a = i * Math.PI * 2 / 3;
      var bein = U.cyl(0.028, 0.036, hh, 8, woodM(col));
      bein.position.set(Math.sin(a) * rr * 0.66, hh / 2, Math.cos(a) * rr * 0.66);
      bein.rotation.x = Math.cos(a) * 0.09;
      bein.rotation.z = -Math.sin(a) * 0.09;
      g.add(bein);
    }
    var ring = U.torus(rr * 0.7, 0.016, 6, 14, woodM(col), false);
    ring.rotation.x = HALFPI;
    ring.position.y = hh * 0.34;
    g.add(ring);
    return g;
  }

  // ---- Sitzbank mit Lehne ----
  function mkBank(w, col, polsterCol) {
    var U = GTA.U, g = new THREE.Group();
    var hm = woodM(col);
    var sitz = U.box(w, 0.08, 0.44, hm);
    sitz.position.y = 0.45;
    g.add(sitz);
    if (polsterCol !== undefined) {
      var p = U.box(w - 0.06, 0.07, 0.4, clothM(polsterCol));
      p.position.y = 0.52;
      g.add(p);
    }
    var lehne = U.box(w, 0.42, 0.07, hm);
    lehne.position.set(0, 0.72, -0.2);
    g.add(lehne);
    var n = Math.max(2, Math.round(w / 0.9));
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      var x = -w / 2 + 0.1 + t * (w - 0.2);
      var wange = U.box(0.08, 0.45, 0.4, hm);
      wange.position.set(x, 0.22, 0);
      g.add(wange);
    }
    return g;
  }

  // ---- Sofa: Korpus, Sitzkissen, Rückenkissen, Armlehnen, Füsse ----
  function mkSofa(w, col, kissenCol) {
    var U = GTA.U, g = new THREE.Group();
    var bm = clothM(col), km = clothM(kissenCol === undefined ? col : kissenCol);
    var korpus = U.box(w, 0.34, 0.88, bm);
    korpus.position.y = 0.28;
    g.add(korpus);
    var ruecken = U.box(w, 0.56, 0.2, bm);
    ruecken.position.set(0, 0.62, -0.34);
    g.add(ruecken);
    var n = Math.max(2, Math.round(w / 0.85));
    for (var i = 0; i < n; i++) {
      var cw = (w - 0.4) / n - 0.04;
      var cx = -w / 2 + 0.2 + cw / 2 + i * ((w - 0.4) / n);
      var kissen = U.box(cw, 0.16, 0.62, km);
      kissen.position.set(cx, 0.52, 0.04);
      g.add(kissen);
      var rk = U.box(cw, 0.36, 0.14, km);
      rk.position.set(cx, 0.66, -0.2);
      rk.rotation.x = 0.14;
      g.add(rk);
    }
    for (var s = 0; s < 2; s++) {
      var sgn = s === 0 ? 1 : -1;
      var arm = U.box(0.2, 0.32, 0.88, bm);
      arm.position.set(sgn * (w / 2 - 0.1), 0.6, 0);
      g.add(arm);
      var rund = U.cyl(0.1, 0.1, 0.88, 12, bm);
      rund.rotation.x = HALFPI;
      rund.position.set(sgn * (w / 2 - 0.1), 0.76, 0);
      g.add(rund);
    }
    var ox = w / 2 - 0.16;
    var fx = [ox, -ox, ox, -ox], fz = [0.36, 0.36, -0.36, -0.36];
    for (var f = 0; f < 4; f++) {
      var fuss = U.cyl(0.035, 0.045, 0.12, 8, woodM(0x5a3c22));
      fuss.position.set(fx[f], 0.06, fz[f]);
      g.add(fuss);
    }
    return g;
  }

  // ---- Sessel ----
  function mkSessel(col, kissenCol) {
    var U = GTA.U, g = new THREE.Group();
    var bm = clothM(col);
    var korpus = U.box(0.82, 0.32, 0.82, bm);
    korpus.position.y = 0.3;
    g.add(korpus);
    var kissen = U.box(0.66, 0.16, 0.62, clothM(kissenCol === undefined ? col : kissenCol));
    kissen.position.set(0, 0.54, 0.04);
    g.add(kissen);
    var lehne = U.box(0.82, 0.62, 0.18, bm);
    lehne.position.set(0, 0.7, -0.32);
    lehne.rotation.x = 0.1;
    g.add(lehne);
    for (var s = 0; s < 2; s++) {
      var sgn = s === 0 ? 1 : -1;
      var arm = U.box(0.16, 0.3, 0.78, bm);
      arm.position.set(sgn * 0.33, 0.6, 0.02);
      g.add(arm);
    }
    for (var f = 0; f < 4; f++) {
      var fuss = U.cyl(0.032, 0.042, 0.14, 8, woodM(0x5a3c22));
      fuss.position.set(f < 2 ? 0.32 : -0.32, 0.07, (f % 2) ? 0.32 : -0.32);
      g.add(fuss);
    }
    return g;
  }

  // ---- Bett: Rahmen, Matratze, Decke, Kopfteil, Kissen ----
  function mkBett(w, l, rahmenCol, deckeCol, kissenCol) {
    var U = GTA.U, g = new THREE.Group();
    var rm = woodM(rahmenCol);
    var rahmen = U.box(w, 0.28, l, rm);
    rahmen.position.y = 0.24;
    g.add(rahmen);
    var matratze = U.box(w - 0.08, 0.2, l - 0.1, flatM(0xf1ece1, 0.95, 0));
    matratze.position.y = 0.48;
    g.add(matratze);
    var decke = U.box(w - 0.04, 0.14, l * 0.66, clothM(deckeCol));
    decke.position.set(0, 0.62, l * 0.14);
    g.add(decke);
    var umschlag = U.box(w - 0.04, 0.05, 0.22, flatM(0xfaf6ee, 0.9, 0));
    umschlag.position.set(0, 0.69, -l * 0.19);
    g.add(umschlag);
    var kn = w > 1.3 ? 2 : 1;
    for (var i = 0; i < kn; i++) {
      var kissen = U.box(w * 0.42, 0.14, 0.34, clothM(kissenCol === undefined ? 0xfaf6ee : kissenCol));
      kissen.position.set(kn === 1 ? 0 : (i ? 1 : -1) * w * 0.24, 0.64, -l / 2 + 0.32);
      kissen.rotation.x = -0.08;
      g.add(kissen);
    }
    var kopf = U.box(w + 0.08, 0.72, 0.1, rm);
    kopf.position.set(0, 0.5, -l / 2 - 0.02);
    g.add(kopf);
    for (var k = 0; k < 3; k++) {
      var stab = U.cyl(0.03, 0.03, 0.5, 8, rm);
      stab.position.set(-w * 0.3 + k * w * 0.3, 0.58, -l / 2 - 0.08);
      g.add(stab);
    }
    var fuss = U.box(w + 0.08, 0.34, 0.1, rm);
    fuss.position.set(0, 0.3, l / 2 + 0.02);
    g.add(fuss);
    for (var f = 0; f < 4; f++) {
      var b = U.box(0.1, 0.12, 0.1, rm);
      b.position.set((f < 2 ? 1 : -1) * (w / 2 - 0.07), 0.06, ((f % 2) ? 1 : -1) * (l / 2 - 0.07));
      g.add(b);
    }
    return g;
  }

  // ---- Schrank mit Türen, Griffen, Gesims ----
  function mkSchrank(w, h, d, col, tueren) {
    var U = GTA.U, g = new THREE.Group();
    var km = woodM(col), tm = woodM(col === 0x6b4527 ? 0x7d5530 : col);
    var korpus = U.box(w, h, d, km);
    korpus.position.y = h / 2;
    g.add(korpus);
    var n = tueren === undefined ? 2 : tueren;
    for (var i = 0; i < n; i++) {
      var tw = (w - 0.08) / n - 0.03;
      var tx = -w / 2 + 0.04 + tw / 2 + i * ((w - 0.08) / n);
      var tuer = U.box(tw, h - 0.16, 0.04, tm);
      tuer.position.set(tx, h / 2, d / 2 + 0.02);
      g.add(tuer);
      var fuellung = U.box(tw - 0.12, h - 0.36, 0.02, woodM(0x8a5f36));
      fuellung.position.set(tx, h / 2, d / 2 + 0.05);
      g.add(fuellung);
      var griff = U.cyl(0.018, 0.018, 0.14, 8, metalM(0xb9a06a));
      griff.position.set(tx + (i === 0 ? tw / 2 - 0.06 : -tw / 2 + 0.06), h / 2, d / 2 + 0.07);
      g.add(griff);
    }
    var gesims = U.box(w + 0.1, 0.09, d + 0.08, woodM(0x6b4527));
    gesims.position.y = h + 0.04;
    g.add(gesims);
    var sockel = U.box(w + 0.04, 0.1, d + 0.03, woodM(0x6b4527));
    sockel.position.y = 0.05;
    g.add(sockel);
    return g;
  }

  // ---- Regal mit Böden und optionalen Büchern ----
  function mkRegal(w, h, d, boeden, col, buecher) {
    var U = GTA.U, g = new THREE.Group();
    var rm = woodM(col);
    for (var s = 0; s < 2; s++) {
      var seite = U.box(0.05, h, d, rm);
      seite.position.set((s ? 1 : -1) * (w / 2 - 0.025), h / 2, 0);
      g.add(seite);
    }
    var rueck = U.box(w, h, 0.02, woodM(0x6b4527));
    rueck.position.set(0, h / 2, -d / 2 + 0.01);
    g.add(rueck);
    var n = boeden === undefined ? 4 : boeden;
    for (var i = 0; i <= n; i++) {
      var y = 0.05 + i * ((h - 0.1) / n);
      var boden = U.box(w - 0.06, 0.04, d - 0.02, rm);
      boden.position.set(0, y, 0);
      g.add(boden);
      if (buecher && i < n) {
        var x = -w / 2 + 0.1;
        var limit = w / 2 - 0.1;
        var guard = 0;
        while (x < limit && guard < 60) {
          guard++;
          var bw = 0.035 + Math.random() * 0.055;
          if (x + bw > limit) break;
          var bh = 0.18 + Math.random() * 0.1;
          var farben = [0x8a3b2e, 0x2f4d78, 0x3d6b46, 0x6b4a86, 0x8a6a2a, 0x2b3242, 0xa04a5a];
          var buch = U.box(bw, bh, d - 0.1, flatM(farben[(Math.random() * farben.length) | 0], 0.85, 0));
          buch.position.set(x + bw / 2, y + 0.02 + bh / 2, 0.02);
          if (Math.random() < 0.12) { buch.rotation.z = 0.22; buch.position.y -= 0.01; }
          g.add(buch);
          x += bw + 0.006;
        }
      }
    }
    return g;
  }

  // ---- Wandregal (schwebendes Brett mit Konsolen) ----
  function mkWandregal(w, col, tiefe) {
    var U = GTA.U, g = new THREE.Group();
    var d = tiefe === undefined ? 0.24 : tiefe;
    var brett = U.box(w, 0.04, d, woodM(col));
    g.add(brett);
    for (var s = 0; s < 2; s++) {
      var kons = U.box(0.03, 0.14, d - 0.04, metalM(0x5a5f66));
      kons.position.set((s ? 1 : -1) * (w / 2 - 0.12), -0.09, -0.02);
      g.add(kons);
    }
    return g;
  }

  // ---- Kommode mit Schubladen ----
  function mkKommode(w, h, d, col, laden) {
    var U = GTA.U, g = new THREE.Group();
    var km = woodM(col);
    var korpus = U.box(w, h, d, km);
    korpus.position.y = h / 2;
    g.add(korpus);
    var n = laden === undefined ? 3 : laden;
    for (var i = 0; i < n; i++) {
      var lh = (h - 0.14) / n - 0.03;
      var ly = 0.09 + lh / 2 + i * ((h - 0.14) / n);
      var lade = U.box(w - 0.1, lh, 0.03, woodM(0x8a5f36));
      lade.position.set(0, ly, d / 2 + 0.02);
      g.add(lade);
      var griff = U.cyl(0.014, 0.014, 0.18, 8, metalM(0xb9a06a));
      griff.rotation.z = HALFPI;
      griff.position.set(0, ly, d / 2 + 0.05);
      g.add(griff);
    }
    var platte = U.box(w + 0.06, 0.05, d + 0.05, woodM(0x6b4527));
    platte.position.y = h + 0.02;
    g.add(platte);
    for (var f = 0; f < 4; f++) {
      var fuss = U.box(0.07, 0.09, 0.07, km);
      fuss.position.set((f < 2 ? 1 : -1) * (w / 2 - 0.06), 0.045, ((f % 2) ? 1 : -1) * (d / 2 - 0.06));
      g.add(fuss);
    }
    return g;
  }

  // ---- Nachtkästchen ----
  function mkNachtkasten(col) {
    var U = GTA.U, g = new THREE.Group();
    var korpus = U.box(0.42, 0.5, 0.36, woodM(col));
    korpus.position.y = 0.31;
    g.add(korpus);
    var lade = U.box(0.34, 0.16, 0.03, woodM(0x8a5f36));
    lade.position.set(0, 0.42, 0.19);
    g.add(lade);
    var griff = U.cyl(0.014, 0.014, 0.12, 8, metalM(0xb9a06a));
    griff.rotation.z = HALFPI;
    griff.position.set(0, 0.42, 0.22);
    g.add(griff);
    for (var f = 0; f < 4; f++) {
      var fuss = U.box(0.05, 0.06, 0.05, woodM(col));
      fuss.position.set((f < 2 ? 1 : -1) * 0.16, 0.03, ((f % 2) ? 1 : -1) * 0.13);
      g.add(fuss);
    }
    return g;
  }

  // ---- Stehlampe ----
  function mkStehlampe(schirmCol, hoehe) {
    var U = GTA.U, g = new THREE.Group();
    var h = hoehe === undefined ? 1.5 : hoehe;
    var fuss = U.cyl(0.2, 0.22, 0.05, 16, metalM(0x3d4148));
    fuss.position.y = 0.025;
    g.add(fuss);
    var stange = U.cyl(0.022, 0.026, h - 0.3, 10, metalM(0x6b7078));
    stange.position.y = (h - 0.3) / 2 + 0.05;
    g.add(stange);
    var schirm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 0.28, 16, 1, true),
      GTA.U.mat(schirmCol, 0.85, 0, { side: THREE.DoubleSide, emissive: schirmCol, emissiveIntensity: 0.35 })
    );
    schirm.position.y = h - 0.1;
    g.add(schirm);
    var birne = U.sph(0.07, 10, 8, glowM(0xfff0c4, 1.2), false);
    birne.position.y = h - 0.14;
    g.add(birne);
    return g;
  }

  // ---- Tischlampe ----
  function mkTischlampe(schirmCol) {
    var U = GTA.U, g = new THREE.Group();
    var fuss = U.cyl(0.09, 0.11, 0.05, 12, metalM(0x8a6a3a));
    fuss.position.y = 0.025;
    g.add(fuss);
    var hals = U.cyl(0.018, 0.022, 0.22, 8, metalM(0x8a6a3a));
    hals.position.y = 0.16;
    g.add(hals);
    var schirm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, 0.18, 14, 1, true),
      GTA.U.mat(schirmCol, 0.85, 0, { side: THREE.DoubleSide, emissive: schirmCol, emissiveIntensity: 0.4 })
    );
    schirm.position.y = 0.35;
    g.add(schirm);
    var birne = U.sph(0.05, 8, 6, glowM(0xfff0c4, 1.1), false);
    birne.position.y = 0.33;
    g.add(birne);
    return g;
  }

  // ---- Deckenlampe (hängt, Ursprung an der Decke) ----
  function mkDeckenlampe(kind, col) {
    var U = GTA.U, g = new THREE.Group();
    var rosette = U.cyl(0.07, 0.07, 0.03, 10, flatM(0xe6e2d8, 0.9, 0), false);
    g.add(rosette);
    if (kind === 'roehre') {
      var kabelR = U.box(0.03, 0.14, 0.03, metalM(0x8f959c), false);
      kabelR.position.y = -0.08;
      g.add(kabelR);
      var roehre = U.box(1.3, 0.09, 0.16, glowM(0xf2f6ff, 1.0), false);
      roehre.position.y = -0.18;
      g.add(roehre);
      var wanne = U.box(1.36, 0.06, 0.22, metalM(0xb0b6bc), false);
      wanne.position.y = -0.12;
      g.add(wanne);
    } else if (kind === 'luster') {
      var stange = U.cyl(0.012, 0.012, 0.3, 6, metalM(0xb9a06a), false);
      stange.position.y = -0.16;
      g.add(stange);
      var ring = U.torus(0.3, 0.02, 6, 18, metalM(0xb9a06a), false);
      ring.rotation.x = HALFPI;
      ring.position.y = -0.34;
      g.add(ring);
      for (var i = 0; i < 5; i++) {
        var a = i * Math.PI * 2 / 5;
        var kerze = U.cyl(0.028, 0.028, 0.14, 8, flatM(0xf4eddc, 0.9, 0), false);
        kerze.position.set(Math.sin(a) * 0.3, -0.26, Math.cos(a) * 0.3);
        g.add(kerze);
        var flamme = U.sph(0.04, 8, 6, glowM(0xffd47a, 1.4), false);
        flamme.position.set(Math.sin(a) * 0.3, -0.16, Math.cos(a) * 0.3);
        g.add(flamme);
      }
    } else {
      var kabel = U.cyl(0.008, 0.008, 0.42, 6, flatM(0x2a2d33, 0.9, 0), false);
      kabel.position.y = -0.22;
      g.add(kabel);
      var schirm = new THREE.Mesh(
        new THREE.ConeGeometry(0.26, 0.24, 16, 1, true),
        GTA.U.mat(col === undefined ? 0xf0e6cf : col, 0.85, 0,
          { side: THREE.DoubleSide, emissive: 0xffe9b8, emissiveIntensity: 0.35 })
      );
      schirm.position.y = -0.52;
      g.add(schirm);
      var b = U.sph(0.07, 10, 8, glowM(0xfff0c4, 1.3), false);
      b.position.y = -0.56;
      g.add(b);
    }
    return g;
  }

  // ---- Teppich ----
  function mkTeppich(w, d, col, rund) {
    var U = GTA.U, g = new THREE.Group();
    var m = col === undefined ? (sharedM('carpet') || flatM(0x8d4a4a, 0.95, 0)) : clothM(col);
    var t;
    if (rund) {
      t = U.cyl(w / 2, w / 2, 0.02, 24, m, false);
    } else {
      t = U.box(w, 0.02, d, m, false);
    }
    t.position.y = 0.01;
    t.receiveShadow = true;
    g.add(t);
    if (!rund) {
      var borte = U.box(w - 0.24, 0.021, d - 0.24, flatM(0xe0cfa8, 0.95, 0), false);
      borte.position.y = 0.016;
      g.add(borte);
      var innen = U.box(w - 0.4, 0.022, d - 0.4, m, false);
      innen.position.y = 0.018;
      g.add(innen);
    }
    return g;
  }

  // ---- Bild an der Wand (Ursprung = Wandebene, schaut nach +Z) ----
  function mkBild(w, h, rahmenCol, motivCol) {
    var U = GTA.U, g = new THREE.Group();
    var rahmen = U.box(w, h, 0.05, woodM(rahmenCol === undefined ? 0x6b4527 : rahmenCol), false);
    g.add(rahmen);
    var motiv = U.box(w - 0.09, h - 0.09, 0.02, flatM(motivCol === undefined ? 0x7a94a8 : motivCol, 0.85, 0), false);
    motiv.position.z = 0.03;
    g.add(motiv);
    // Zwei schlichte Farbbänder als angedeutetes Motiv
    var band1 = U.box(w - 0.14, (h - 0.09) * 0.3, 0.01, flatM(0x4f6b52, 0.9, 0), false);
    band1.position.set(0, -(h - 0.09) * 0.28, 0.045);
    g.add(band1);
    var band2 = U.box(w - 0.2, (h - 0.09) * 0.18, 0.01, flatM(0xe8e3d4, 0.9, 0), false);
    band2.position.set(0, (h - 0.09) * 0.3, 0.045);
    g.add(band2);
    return g;
  }

  // ---- Spiegel ----
  function mkSpiegel(w, h, rahmenCol) {
    var U = GTA.U, g = new THREE.Group();
    var rahmen = U.box(w, h, 0.05, woodM(rahmenCol === undefined ? 0x8a6a3a : rahmenCol), false);
    g.add(rahmen);
    var glas = U.box(w - 0.1, h - 0.1, 0.02, GTA.U.mat(0xcfe0ea, 0.06, 0.95), false);
    glas.position.z = 0.035;
    g.add(glas);
    return g;
  }

  // ---- Zimmerpflanze ----
  function mkPflanze(scale, topfCol) {
    var U = GTA.U, g = new THREE.Group();
    var s = scale === undefined ? 1 : scale;
    var topf = U.cyl(0.16 * s, 0.12 * s, 0.24 * s, 12, flatM(topfCol === undefined ? 0xa8563c : topfCol, 0.9, 0));
    topf.position.y = 0.12 * s;
    g.add(topf);
    var rand = U.cyl(0.18 * s, 0.17 * s, 0.05 * s, 12, flatM(topfCol === undefined ? 0x8e4732 : topfCol, 0.9, 0));
    rand.position.y = 0.235 * s;
    g.add(rand);
    var erde = U.cyl(0.155 * s, 0.155 * s, 0.03 * s, 12, flatM(0x40301f, 1, 0), false);
    erde.position.y = 0.245 * s;
    g.add(erde);
    var stamm = U.cyl(0.022 * s, 0.03 * s, 0.34 * s, 8, woodM(0x5c4326));
    stamm.position.y = 0.42 * s;
    g.add(stamm);
    var blattM = flatM(0x3d7a3a, 0.85, 0);
    for (var i = 0; i < 7; i++) {
      var a = i * 1.12;
      var blatt = U.sph(0.14 * s, 8, 6, blattM);
      blatt.scale.set(1.5, 0.4, 0.9);
      blatt.position.set(Math.sin(a) * 0.16 * s, (0.52 + (i % 3) * 0.09) * s, Math.cos(a) * 0.16 * s);
      blatt.rotation.y = a;
      blatt.rotation.z = 0.3;
      g.add(blatt);
    }
    return g;
  }

  // ---- Vorhang (Ursprung = Wandoberkante, hängt nach unten) ----
  function mkVorhang(w, h, col) {
    var U = GTA.U, g = new THREE.Group();
    var stange = U.cyl(0.022, 0.022, w + 0.3, 8, metalM(0x8a7a5a), false);
    stange.rotation.z = HALFPI;
    g.add(stange);
    for (var s = 0; s < 2; s++) {
      var sgn = s ? 1 : -1;
      var bahn = U.box(w * 0.32, h, 0.05, clothM(col), false);
      bahn.position.set(sgn * (w * 0.32), -h / 2 - 0.03, 0.02);
      g.add(bahn);
      for (var f = 0; f < 3; f++) {
        var falte = U.cyl(0.035, 0.035, h, 6, clothM(col), false);
        falte.position.set(sgn * (w * 0.2 + f * 0.1), -h / 2 - 0.03, 0.05);
        g.add(falte);
      }
    }
    return g;
  }

  // ---- Kiste / Truhe ----
  function mkKiste(w, h, d, col, beschlag) {
    var U = GTA.U, g = new THREE.Group();
    var km = woodM(col);
    var korpus = U.box(w, h, d, km);
    korpus.position.y = h / 2;
    g.add(korpus);
    var deckel = U.box(w + 0.03, 0.06, d + 0.03, woodM(0x6b4527));
    deckel.position.y = h + 0.02;
    g.add(deckel);
    if (beschlag) {
      var mm = metalM(0x4a4f56);
      for (var s = 0; s < 2; s++) {
        var band = U.box(0.05, h + 0.1, d + 0.05, mm, false);
        band.position.set((s ? 1 : -1) * w * 0.28, h / 2 + 0.02, 0);
        g.add(band);
      }
      var schloss = U.box(0.12, 0.1, 0.03, metalM(0xb9a06a), false);
      schloss.position.set(0, h - 0.04, d / 2 + 0.02);
      g.add(schloss);
    }
    return g;
  }

  // ---- Fass ----
  function mkFass(r, h, col) {
    var U = GTA.U, g = new THREE.Group();
    var bauch = U.cyl(r * 0.92, r * 0.92, h, 16, woodM(col));
    bauch.position.y = h / 2;
    g.add(bauch);
    var mitte = U.cyl(r, r, h * 0.5, 16, woodM(col));
    mitte.position.y = h / 2;
    g.add(mitte);
    for (var i = 0; i < 3; i++) {
      var reif = U.torus(r * (i === 1 ? 1.0 : 0.93), 0.022, 6, 18, metalM(0x5a5f66), false);
      reif.rotation.x = HALFPI;
      reif.position.y = h * (0.12 + i * 0.38);
      g.add(reif);
    }
    var deckel = U.cyl(r * 0.9, r * 0.9, 0.03, 16, woodM(0x6b4527), false);
    deckel.position.y = h + 0.01;
    g.add(deckel);
    return g;
  }

  // ---- Kachelofen ----
  function mkOfen(w, h, d, kachelCol) {
    var U = GTA.U, g = new THREE.Group();
    var km = flatM(kachelCol === undefined ? 0xe8e0cf : kachelCol, 0.55, 0.05);
    var korpus = U.box(w, h, d, km);
    korpus.position.y = h / 2;
    g.add(korpus);
    var sockel = U.box(w + 0.08, 0.16, d + 0.08, flatM(0x6f6a60, 0.85, 0));
    sockel.position.y = 0.08;
    g.add(sockel);
    var sims = U.box(w + 0.1, 0.07, d + 0.1, flatM(0x6f6a60, 0.85, 0));
    sims.position.y = h + 0.03;
    g.add(sims);
    // Kachelfugen
    var cols = Math.max(2, Math.round(w / 0.28));
    var rows = Math.max(3, Math.round(h / 0.32));
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var kachel = U.box(w / cols - 0.03, h / rows - 0.03, 0.015, flatM(kachelCol === undefined ? 0xf2ebdb : kachelCol, 0.45, 0.05), false);
        kachel.position.set(-w / 2 + w / cols * (c + 0.5), h / rows * (r + 0.5), d / 2 + 0.01);
        g.add(kachel);
      }
    }
    var tuer = U.box(0.34, 0.3, 0.05, metalM(0x2a2d33));
    tuer.position.set(0, 0.42, d / 2 + 0.03);
    g.add(tuer);
    var glut = U.box(0.26, 0.2, 0.02, glowM(0xff7a2a, 1.6), false);
    glut.position.set(0, 0.42, d / 2 + 0.06);
    g.add(glut);
    var rohr = U.cyl(0.09, 0.09, 0.5, 10, metalM(0x3d4148));
    rohr.position.set(0, h + 0.3, -d * 0.2);
    g.add(rohr);
    return g;
  }

  // ---- Wanduhr ----
  function mkUhr(r) {
    var U = GTA.U, g = new THREE.Group();
    var gehaeuse = U.cyl(r, r, 0.06, 18, woodM(0x6b4527), false);
    gehaeuse.rotation.x = HALFPI;
    g.add(gehaeuse);
    var blatt = U.cyl(r * 0.86, r * 0.86, 0.02, 18, flatM(0xf6f2e6, 0.9, 0), false);
    blatt.rotation.x = HALFPI;
    blatt.position.z = 0.04;
    g.add(blatt);
    var z1 = U.box(0.02, r * 0.6, 0.01, flatM(0x1a1c20, 0.6, 0), false);
    z1.position.set(0, r * 0.28, 0.06);
    g.add(z1);
    var z2 = U.box(r * 0.44, 0.018, 0.01, flatM(0x1a1c20, 0.6, 0), false);
    z2.position.set(r * 0.2, 0, 0.06);
    g.add(z2);
    return g;
  }

  // ---- Kleinkram: Flasche, Becher, Teller, Topf, Buchstapel ----
  function mkFlasche(col, h) {
    var U = GTA.U, g = new THREE.Group();
    var hh = h === undefined ? 0.3 : h;
    var m = GTA.U.mat(col, 0.2, 0.1, { transparent: true, opacity: 0.75 });
    var bauch = U.cyl(0.045, 0.05, hh * 0.65, 10, m);
    bauch.position.y = hh * 0.325;
    g.add(bauch);
    var hals = U.cyl(0.017, 0.038, hh * 0.35, 8, m);
    hals.position.y = hh * 0.82;
    g.add(hals);
    var kork = U.cyl(0.018, 0.018, 0.04, 8, flatM(0xc8a06a, 0.9, 0), false);
    kork.position.y = hh + 0.01;
    g.add(kork);
    var etikett = U.cyl(0.052, 0.052, 0.1, 10, paperM(), false);
    etikett.position.y = hh * 0.34;
    g.add(etikett);
    return g;
  }

  function mkBecher(col) {
    var U = GTA.U, g = new THREE.Group();
    var m = flatM(col === undefined ? 0xf0ece2 : col, 0.5, 0.05);
    var tasse = U.cyl(0.045, 0.038, 0.09, 10, m);
    tasse.position.y = 0.045;
    g.add(tasse);
    var henkel = U.torus(0.032, 0.008, 6, 10, m, false);
    henkel.position.set(0.052, 0.05, 0);
    henkel.rotation.y = HALFPI;
    g.add(henkel);
    return g;
  }

  function mkKrug(col) {
    var U = GTA.U, g = new THREE.Group();
    var m = GTA.U.mat(0xdfe8ee, 0.1, 0.2, { transparent: true, opacity: 0.55 });
    var glas = U.cyl(0.065, 0.058, 0.19, 12, m);
    glas.position.y = 0.095;
    g.add(glas);
    var bier = U.cyl(0.058, 0.052, 0.14, 12, flatM(col === undefined ? 0xd8951f : col, 0.35, 0.1), false);
    bier.position.y = 0.08;
    g.add(bier);
    var schaum = U.cyl(0.06, 0.058, 0.035, 12, flatM(0xfaf6ec, 0.9, 0), false);
    schaum.position.y = 0.165;
    g.add(schaum);
    var henkel = U.torus(0.045, 0.012, 6, 10, m, false);
    henkel.position.set(0.075, 0.1, 0);
    henkel.rotation.y = HALFPI;
    g.add(henkel);
    return g;
  }

  function mkTeller(col) {
    var U = GTA.U, g = new THREE.Group();
    var t = U.cyl(0.12, 0.09, 0.025, 16, flatM(col === undefined ? 0xf2eee4 : col, 0.4, 0.05), false);
    t.position.y = 0.012;
    g.add(t);
    var rand = U.torus(0.115, 0.012, 6, 18, flatM(col === undefined ? 0xf2eee4 : col, 0.4, 0.05), false);
    rand.rotation.x = HALFPI;
    rand.position.y = 0.022;
    g.add(rand);
    return g;
  }

  function mkTopf(r, h) {
    var U = GTA.U, g = new THREE.Group();
    var m = metalM(0xb6bcc2);
    var topf = U.cyl(r, r * 0.92, h, 14, m);
    topf.position.y = h / 2;
    g.add(topf);
    var deckel = U.cyl(r * 1.04, r * 1.04, 0.02, 14, m, false);
    deckel.position.y = h + 0.01;
    g.add(deckel);
    var knauf = U.sph(0.03, 8, 6, flatM(0x2a2d33, 0.7, 0), false);
    knauf.position.y = h + 0.04;
    g.add(knauf);
    for (var s = 0; s < 2; s++) {
      var henkel = U.torus(0.045, 0.01, 5, 10, m, false);
      henkel.position.set((s ? 1 : -1) * (r + 0.02), h * 0.72, 0);
      henkel.rotation.y = HALFPI;
      g.add(henkel);
    }
    return g;
  }

  function mkBuchstapel(n, breite) {
    var U = GTA.U, g = new THREE.Group();
    var farben = [0x8a3b2e, 0x2f4d78, 0x3d6b46, 0x6b4a86, 0x8a6a2a];
    var y = 0;
    var w = breite === undefined ? 0.2 : breite;
    for (var i = 0; i < n; i++) {
      var hh = 0.03 + Math.random() * 0.025;
      var b = U.box(w + Math.random() * 0.04, hh, w * 1.35, flatM(farben[i % farben.length], 0.85, 0));
      b.position.set((Math.random() - 0.5) * 0.03, y + hh / 2, (Math.random() - 0.5) * 0.03);
      b.rotation.y = (Math.random() - 0.5) * 0.24;
      g.add(b);
      y += hh;
    }
    return g;
  }

  // ---- Garderobe / Hakenleiste ----
  function mkGarderobe(w, col) {
    var U = GTA.U, g = new THREE.Group();
    var brett = U.box(w, 0.26, 0.05, woodM(col), false);
    g.add(brett);
    var n = Math.max(3, Math.round(w / 0.28));
    for (var i = 0; i < n; i++) {
      var x = -w / 2 + (w / (n + 1)) * (i + 1);
      var haken = U.cyl(0.012, 0.012, 0.12, 6, metalM(0x8a8f96), false);
      haken.rotation.x = HALFPI;
      haken.position.set(x, 0, 0.07);
      g.add(haken);
      var spitze = U.sph(0.022, 6, 6, metalM(0x8a8f96), false);
      spitze.position.set(x, -0.03, 0.12);
      g.add(spitze);
    }
    return g;
  }

  // ---- Waschbecken ----
  function mkWaschbecken() {
    var U = GTA.U, g = new THREE.Group();
    var wm = flatM(0xf4f6f8, 0.3, 0.05);
    var saeule = U.cyl(0.11, 0.14, 0.62, 12, wm);
    saeule.position.y = 0.31;
    g.add(saeule);
    var becken = U.box(0.52, 0.16, 0.4, wm);
    becken.position.y = 0.7;
    g.add(becken);
    var mulde = U.box(0.4, 0.08, 0.3, flatM(0xdfe6ea, 0.3, 0.05), false);
    mulde.position.y = 0.76;
    g.add(mulde);
    var hahn = U.cyl(0.018, 0.018, 0.16, 8, sharedM('chrome') || metalM(0xe8ecf0));
    hahn.position.set(0, 0.86, -0.16);
    g.add(hahn);
    var ausl = U.cyl(0.014, 0.014, 0.14, 8, sharedM('chrome') || metalM(0xe8ecf0));
    ausl.rotation.x = HALFPI;
    ausl.position.set(0, 0.93, -0.1);
    g.add(ausl);
    return g;
  }

  // ---- Küchenzeile (Unterschrank mit Arbeitsplatte) ----
  function mkKuechenzeile(w, col, plattenCol) {
    var U = GTA.U, g = new THREE.Group();
    var km = flatM(col, 0.7, 0.05);
    var korpus = U.box(w, 0.82, 0.62, km);
    korpus.position.y = 0.45;
    g.add(korpus);
    var sockel = U.box(w - 0.06, 0.1, 0.5, flatM(0x3a3f46, 0.8, 0), false);
    sockel.position.y = 0.05;
    g.add(sockel);
    var platte = U.box(w + 0.04, 0.06, 0.66, flatM(plattenCol === undefined ? 0x4a4f56 : plattenCol, 0.4, 0.15));
    platte.position.y = 0.89;
    g.add(platte);
    var n = Math.max(2, Math.round(w / 0.6));
    for (var i = 0; i < n; i++) {
      var tw = w / n - 0.04;
      var tx = -w / 2 + w / n * (i + 0.5);
      var tuer = U.box(tw, 0.66, 0.03, flatM(col, 0.65, 0.05));
      tuer.position.set(tx, 0.46, 0.32);
      g.add(tuer);
      var griff = U.cyl(0.012, 0.012, tw * 0.6, 8, sharedM('chrome') || metalM(0xe8ecf0), false);
      griff.rotation.z = HALFPI;
      griff.position.set(tx, 0.74, 0.35);
      g.add(griff);
    }
    return g;
  }

  // ---- Hängeschrank ----
  function mkHaengeschrank(w, h, col) {
    var U = GTA.U, g = new THREE.Group();
    var korpus = U.box(w, h, 0.34, flatM(col, 0.7, 0.05));
    g.add(korpus);
    var n = Math.max(2, Math.round(w / 0.55));
    for (var i = 0; i < n; i++) {
      var tw = w / n - 0.04;
      var tx = -w / 2 + w / n * (i + 0.5);
      var tuer = U.box(tw, h - 0.05, 0.03, flatM(col, 0.6, 0.08));
      tuer.position.set(tx, 0, 0.18);
      g.add(tuer);
      var griff = U.cyl(0.012, 0.012, tw * 0.5, 8, sharedM('chrome') || metalM(0xe8ecf0), false);
      griff.rotation.z = HALFPI;
      griff.position.set(tx, -h / 2 + 0.08, 0.21);
      g.add(griff);
    }
    return g;
  }

  // ---- Fenster als Wandeinsatz (Ursprung Wandebene, schaut nach +Z) ----
  function mkFenster(w, h, rahmenCol) {
    var U = GTA.U, g = new THREE.Group();
    var rm = woodM(rahmenCol === undefined ? 0xe6e0d2 : rahmenCol);
    var scheibe = U.box(w - 0.1, h - 0.1, 0.03, glassM(), false);
    g.add(scheibe);
    var oben = U.box(w, 0.09, 0.1, rm, false); oben.position.y = h / 2; g.add(oben);
    var unten = U.box(w, 0.12, 0.16, rm, false); unten.position.y = -h / 2; g.add(unten);
    var li = U.box(0.09, h, 0.1, rm, false); li.position.x = -w / 2; g.add(li);
    var re = U.box(0.09, h, 0.1, rm, false); re.position.x = w / 2; g.add(re);
    var kreuzV = U.box(0.05, h - 0.1, 0.06, rm, false); g.add(kreuzV);
    var kreuzH = U.box(w - 0.1, 0.05, 0.06, rm, false); g.add(kreuzH);
    return g;
  }

  /* ============================================================
     3. RAUMTABELLE — reine Daten, kein Code läuft beim Laden.
     w/d = lokale Innenmasse, h = Raumhöhe.
     floor = Name eines Materials aus GTA.TEX.M.
     wall  = Farbe der Innenwandschale.
     loot  = thematische Beute; lx/lz sind lokale Koordinaten.
     ============================================================ */

  var ROOMS = {
    wohnzimmer: {
      title: 'Wohnzimmer', hint: 'Gemütlich. Und jemand hat den Fernseher laufen lassen.',
      w: 9.2, d: 7.4, h: 2.9, floor: 'parkett', wall: 0xe8ded0, licht: 0xffe6bc,
      loot: [
        { id: 'fernbedienung', name: 'Fernbedienung', value: 12, lx: -2.2, lz: 1.2 },
        { id: 'muenzen', name: 'Münzschale', value: 85, lx: 3.4, lz: -1.8 },
        { id: 'schnaps', name: 'Obstler', value: 40, lx: -3.6, lz: -2.4 }
      ]
    },
    kueche: {
      title: 'Küche', hint: 'Es riecht nach Zwiebelrostbraten.',
      w: 8.4, d: 6.8, h: 2.8, floor: 'tile', wall: 0xdfe8e4, licht: 0xf2f8ff,
      loot: [
        { id: 'brot', name: 'Bauernbrot', value: 8, lx: 0.4, lz: 0.6 },
        { id: 'kaese', name: 'Bergkäse', value: 22, lx: -2.8, lz: -2.2 },
        { id: 'kuechenmesser', name: 'Küchenmesser', value: 35, lx: 2.6, lz: -2.4 },
        { id: 'haushaltsgeld', name: 'Haushaltsgeld', value: 120, lx: 3.2, lz: 1.6 }
      ]
    },
    schlafzimmer: {
      title: 'Schlafzimmer', hint: 'Das Bett ist gemacht. Verdächtig ordentlich.',
      w: 8.6, d: 7.2, h: 2.8, floor: 'carpet', wall: 0xe4dce8, licht: 0xffd8b8,
      loot: [
        { id: 'schmuck', name: 'Schmuckkästchen', value: 260, lx: -3.0, lz: -2.4 },
        { id: 'sparbuch', name: 'Sparbuch', value: 180, lx: 3.1, lz: 2.0 },
        { id: 'wecker', name: 'Reisewecker', value: 15, lx: 1.9, lz: -2.5 }
      ]
    },
    werkstatt: {
      title: 'Werkstatt', hint: 'Öl, Späne und ein Radio, das nur rauscht.',
      w: 9.6, d: 7.6, h: 3.0, floor: 'brick', wall: 0xb9bcc0, licht: 0xf4f8ff,
      loot: [
        { id: 'werkzeug', name: 'Werkzeugkoffer', value: 150, lx: -3.4, lz: 1.4 },
        { id: 'akkubohrer', name: 'Akkubohrer', value: 95, lx: 3.6, lz: -1.2 },
        { id: 'schrauben', name: 'Schraubensortiment', value: 25, lx: 0.8, lz: -2.7 },
        { id: 'schweissgeraet', name: 'Schweissgerät', value: 320, lx: -3.6, lz: -2.2 }
      ]
    },
    buero: {
      title: 'Büro', hint: 'Aktenordner bis unter die Decke. Irgendwo liegt das Wesentliche.',
      w: 8.8, d: 7.0, h: 2.9, floor: 'parkett', wall: 0xdde2e8, licht: 0xeaf2ff,
      loot: [
        { id: 'laptop', name: 'Laptop', value: 420, lx: 0.2, lz: -2.0 },
        { id: 'bargeld', name: 'Handkassa', value: 300, lx: -3.2, lz: -2.2 },
        { id: 'akte', name: 'Brisante Akte', value: 200, lx: 3.3, lz: 1.4 }
      ]
    },
    bauernstube: {
      title: 'Bauernstube', hint: 'Holz, Herrgottswinkel und ein warmer Ofen.',
      w: 9.0, d: 7.4, h: 2.7, floor: 'wood', wall: 0xd8c39a, licht: 0xffd9a0,
      loot: [
        { id: 'speck', name: 'Selchspeck', value: 30, lx: -3.4, lz: 1.8 },
        { id: 'most', name: 'Krug Most', value: 18, lx: 0.6, lz: 0.4 },
        { id: 'rosenkranz', name: 'Silberner Rosenkranz', value: 140, lx: 3.4, lz: -2.4 }
      ]
    },
    kinderzimmer: {
      title: 'Kinderzimmer', hint: 'Legosteine sind die schlimmste Falle im Alpenraum.',
      w: 8.2, d: 6.8, h: 2.7, floor: 'carpet', wall: 0xdce9f2, licht: 0xffe9c8,
      loot: [
        { id: 'spielzeugauto', name: 'Modellauto', value: 20, lx: 0.9, lz: 1.4 },
        { id: 'sparschwein', name: 'Sparschwein', value: 75, lx: -2.9, lz: -2.1 },
        { id: 'comic', name: 'Comicheft', value: 10, lx: 2.8, lz: 1.9 }
      ]
    },
    laden: {
      title: 'Dorfladen', hint: 'Selbstbedienung. Sehr selbst.',
      w: 9.8, d: 7.6, h: 3.0, floor: 'tile', wall: 0xeae6dc, licht: 0xf6faff,
      loot: [
        { id: 'kassa', name: 'Kassenlade', value: 340, lx: -3.6, lz: -2.4 },
        { id: 'zigaretten', name: 'Stange Zigaretten', value: 90, lx: -3.0, lz: 2.2 },
        { id: 'chips', name: 'Chips', value: 5, lx: 2.4, lz: 1.8 },
        { id: 'energydrink', name: 'Energydrink', value: 6, lx: 3.6, lz: -0.6 }
      ]
    },
    wirtshaus: {
      title: 'Wirtshaus', hint: 'Der Stammtisch ist reserviert. Immer.',
      w: 10.4, d: 8.2, h: 3.1, floor: 'wood', wall: 0xc9a878, licht: 0xffcf90,
      loot: [
        { id: 'bier', name: 'Frisches Bier', value: 5, lx: -0.4, lz: 1.0 },
        { id: 'schnitzel', name: 'Schnitzel', value: 14, lx: 2.2, lz: 1.4 },
        { id: 'trinkgeld', name: 'Trinkgeldkassa', value: 210, lx: -4.0, lz: -1.6 },
        { id: 'kartenspiel', name: 'Schnapskarten', value: 12, lx: 3.4, lz: -2.6 }
      ]
    },
    atelier: {
      title: 'Atelier', hint: 'Terpentin und unfertige Meisterwerke.',
      w: 9.0, d: 7.4, h: 3.2, floor: 'wood', wall: 0xf0ece2, licht: 0xf8fbff,
      loot: [
        { id: 'gemaelde', name: 'Frisches Gemälde', value: 480, lx: 0.0, lz: -1.6 },
        { id: 'pinsel', name: 'Marderhaarpinsel', value: 45, lx: -3.2, lz: 1.6 },
        { id: 'farbtube', name: 'Ultramarin', value: 28, lx: 3.2, lz: 2.0 }
      ]
    },
    jagdhuette: {
      title: 'Jagdhütte', hint: 'Zwölf Augenpaare schauen dich an. Alle aus Glas.',
      w: 8.8, d: 7.2, h: 2.8, floor: 'wood', wall: 0x8a6a45, licht: 0xffc98a,
      loot: [
        { id: 'patronen', name: 'Schachtel Patronen', value: 70, lx: -3.2, lz: -2.2 },
        { id: 'jagdmesser', name: 'Jagdmesser', value: 130, lx: 2.9, lz: -2.4 },
        { id: 'fernglas', name: 'Fernglas', value: 190, lx: 3.4, lz: 1.6 },
        { id: 'schnapsflasche', name: 'Zirbenschnaps', value: 35, lx: -0.6, lz: 0.8 }
      ]
    },
    waschkueche: {
      title: 'Waschküche', hint: 'Warm, feucht und voller Wäschekörbe.',
      w: 8.0, d: 6.4, h: 2.6, floor: 'tile', wall: 0xdce6ea, licht: 0xeef6ff,
      loot: [
        { id: 'waschmittel', name: 'Waschmittel', value: 12, lx: -2.8, lz: -1.8 },
        { id: 'wechselgeld', name: 'Vergessenes Wechselgeld', value: 60, lx: 2.9, lz: 1.4 },
        { id: 'handtuch', name: 'Frottierhandtuch', value: 9, lx: 0.6, lz: -2.2 }
      ]
    },
    musikzimmer: {
      title: 'Musikzimmer', hint: 'Das Klavier ist gestimmt. Du eher nicht.',
      w: 9.4, d: 7.6, h: 3.1, floor: 'parkett', wall: 0xdad2e4, licht: 0xffe2bc,
      loot: [
        { id: 'notenblatt', name: 'Handschriftliche Noten', value: 160, lx: 0.4, lz: -2.2 },
        { id: 'geige', name: 'Alte Geige', value: 520, lx: -3.4, lz: 1.6 },
        { id: 'metronom', name: 'Metronom', value: 40, lx: 3.2, lz: -1.2 }
      ]
    },
    bibliothek: {
      title: 'Bibliothek', hint: 'Still. Sehr still.',
      w: 9.6, d: 7.8, h: 3.3, floor: 'parkett', wall: 0xd8cdb8, licht: 0xffdfae,
      loot: [
        { id: 'erstausgabe', name: 'Erstausgabe', value: 600, lx: -3.6, lz: -2.6 },
        { id: 'landkarte', name: 'Alte Landkarte', value: 210, lx: 3.5, lz: 2.0 },
        { id: 'lupe', name: 'Messinglupe', value: 55, lx: 0.6, lz: -1.4 },
        { id: 'buch', name: 'Lederband', value: 90, lx: -1.8, lz: 2.4 }
      ]
    },
    garage: {
      title: 'Garage', hint: 'Hier verschwinden Autos schneller als Feierabende.',
      w: 11.0, d: 8.6, h: 3.4, floor: 'brick', wall: 0xa8adb4, licht: 0xf2f8ff,
      loot: [
        { id: 'benzinkanister', name: 'Benzinkanister', value: 40, lx: -4.2, lz: 2.4 },
        { id: 'zuendkerzen', name: 'Zündkerzensatz', value: 30, lx: 4.2, lz: -1.8 },
        { id: 'wagenheber', name: 'Wagenheber', value: 85, lx: -4.0, lz: -2.6 },
        { id: 'autoschluessel', name: 'Ersatzschlüssel', value: 250, lx: 3.8, lz: 2.6 }
      ]
    },
    gewaechshaus: {
      title: 'Gewächshaus', hint: 'Feucht, grün und erstaunlich profitabel.',
      w: 10.0, d: 8.0, h: 3.2, floor: 'dirt', wall: 0xbfd6c4, licht: 0xe8ffe0,
      loot: [
        { id: 'tomaten', name: 'Paradeiser', value: 10, lx: -3.4, lz: 1.6 },
        { id: 'kraeuter', name: 'Bergkräuter', value: 65, lx: 3.4, lz: -1.4 },
        { id: 'saatgut', name: 'Seltenes Saatgut', value: 175, lx: 0.4, lz: -2.6 }
      ]
    },
    fitnessraum: {
      title: 'Fitnessraum', hint: 'Der Spiegel lügt nie.',
      w: 9.6, d: 7.8, h: 3.0, floor: 'wood', wall: 0xcdd4da, licht: 0xf4f9ff,
      loot: [
        { id: 'proteinriegel', name: 'Proteinriegel', value: 7, lx: 3.4, lz: 2.2 },
        { id: 'hantel', name: 'Kurzhantel', value: 45, lx: -3.6, lz: -1.0 },
        { id: 'springseil', name: 'Springseil', value: 15, lx: 0.8, lz: 2.4 },
        { id: 'pulsuhr', name: 'Pulsuhr', value: 150, lx: -2.4, lz: 2.5 }
      ]
    },
    dachboden: {
      title: 'Dachboden', hint: 'Staub, Spinnweben und die halbe Familiengeschichte.',
      w: 9.0, d: 7.2, h: 2.6, floor: 'wood', wall: 0xb8a98e, licht: 0xffdca8,
      loot: [
        { id: 'alte_truhe', name: 'Inhalt der Truhe', value: 380, lx: -3.2, lz: -2.2 },
        { id: 'schallplatte', name: 'Schellackplatte', value: 95, lx: 3.2, lz: 1.8 },
        { id: 'omas_schmuck', name: 'Omas Brosche', value: 220, lx: 2.6, lz: -2.4 },
        { id: 'staubige_flasche', name: 'Staubige Flasche', value: 130, lx: -3.4, lz: 2.2 }
      ]
    }
  };

  API.ROOMS = ROOMS;

  // Reihenfolge, in der die Räume im Vertrag genannt sind.
  var KINDS = [
    'wohnzimmer', 'kueche', 'schlafzimmer', 'werkstatt', 'buero', 'bauernstube',
    'kinderzimmer', 'laden', 'wirtshaus', 'atelier', 'jagdhuette', 'waschkueche',
    'musikzimmer', 'bibliothek', 'garage', 'gewaechshaus', 'fitnessraum', 'dachboden'
  ];
  API.KINDS = KINDS;

  /* ============================================================
     4. RAUM-BAUKASTEN
     R kapselt die Umrechnung lokal -> Welt und das Eintragen
     der Kollisionsrechtecke.
     ============================================================ */

  function makeBuilder(ctx, rec, group) {
    var U = GTA.U;
    var rot = ((rec.rot % 4) + 4) % 4;
    var R = { ctx: ctx, rec: rec, group: group, w: rec.w, d: rec.d, h: rec.h };

    R.wx = function (lx, lz) {
      if (rot === 0) return rec.x + lx;
      if (rot === 1) return rec.x + lz;
      if (rot === 2) return rec.x - lx;
      return rec.x - lz;
    };
    R.wz = function (lx, lz) {
      if (rot === 0) return rec.z + lz;
      if (rot === 1) return rec.z - lx;
      if (rot === 2) return rec.z - lz;
      return rec.z + lx;
    };

    // Objekt an lokaler Stelle einsetzen. ry = zusätzliche Drehung um Y.
    R.add = function (obj, lx, ly, lz, ry) {
      obj.position.set(lx, ly === undefined ? 0 : ly, lz);
      if (ry) obj.rotation.y = ry;
      group.add(obj);
      return obj;
    };

    // Kollisionsrechteck in lokalen Massen. w/d müssen bereits der
    // endgültigen Ausrichtung des Möbels entsprechen.
    R.block = function (lx, lz, w, d) {
      var cx = R.wx(lx, lz), cz = R.wz(lx, lz);
      var ww = (rot % 2) ? d : w;
      var dd = (rot % 2) ? w : d;
      U.addWall(ctx, cx, cz, ww, dd, rec.id);
      rec.colliders.push({ x: cx, z: cz, w: ww, d: dd });
    };

    // Möbel setzen und in einem Rutsch blockieren.
    R.put = function (obj, lx, lz, ry, cw, cd) {
      R.add(obj, lx, 0, lz, ry);
      if (cw && cd) R.block(lx, lz, cw, cd);
      return obj;
    };

    // Deko auf Möbelhöhe — ohne Kollision.
    R.deko = function (obj, lx, ly, lz, ry) {
      return R.add(obj, lx, ly, lz, ry);
    };

    // Wandobjekt: seite 'n' (hinten, -Z-Wand? nein: +Z), 's', 'w', 'o'.
    // Die Tür liegt bei lokal -Z, deshalb ist 's' die Türwand.
    R.wand = function (obj, seite, along, hoehe) {
      var eps = 0.14;
      if (seite === 'n') { R.add(obj, along, hoehe, R.d / 2 - eps, Math.PI); }
      else if (seite === 's') { R.add(obj, along, hoehe, -R.d / 2 + eps, 0); }
      else if (seite === 'w') { R.add(obj, -R.w / 2 + eps, hoehe, along, HALFPI); }
      else { R.add(obj, R.w / 2 - eps, hoehe, along, -HALFPI); }
      return obj;
    };

    // Punktlicht — standardmässig aus, wird beim Betreten eingeschaltet.
    R.licht = function (col, intensity, dist, lx, ly, lz) {
      var l = new THREE.PointLight(col, intensity, dist);
      l.position.set(lx, ly, lz);
      l.visible = false;
      group.add(l);
      rec.lamps.push(l);
      return l;
    };

    return R;
  }

  /* ============================================================
     5. GEBÄUDEHÜLLE
     Aussen Putz + Walmdach, innen farbige Schale, Sockelleiste,
     Türöffnung in der -Z-Wand.
     ============================================================ */

  function buildShell(ctx, rec, group, def) {
    var U = GTA.U;
    var w = rec.w, d = rec.d, h = rec.h;
    var t = 0.28;                 // Wandstärke
    var tuerB = 1.7;              // Türbreite
    var putz = sharedM('plaster') || flatM(0xf2ecdf, 0.9, 0);
    var innen = flatM(def.wall, 0.92, 0);

    // ---- Boden ----
    // Etwas groesser als der Raum und minimal angehoben — sonst liegt die
    // Platte exakt auf der Wiese und beide flimmern gegeneinander.
    var boden = U.box(w + t * 2 + 0.4, 0.12, d + t * 2 + 0.4, floorM(def.floor), false);
    boden.position.y = -0.045;
    boden.receiveShadow = true;
    group.add(boden);

    // ---- Decke ----
    var decke = U.box(w + t * 2, 0.14, d + t * 2, flatM(0xf0ece2, 0.95, 0), false);
    decke.position.y = h + 0.07;
    group.add(decke);
    rec.ceiling = decke;

    // ---- Aussenwände (immer massiv, interiorId = null) ----
    function wandBox(cx, cz, ww, dd) {
      var m = U.box(ww, h, dd, putz);
      m.position.set(cx, h / 2, cz);
      m.receiveShadow = true;
      group.add(m);
      var cw = (rec.rot % 2) ? dd : ww;
      var cd = (rec.rot % 2) ? ww : dd;
      var bx = rec.rot === 0 ? rec.x + cx : (rec.rot === 1 ? rec.x + cz : (rec.rot === 2 ? rec.x - cx : rec.x - cz));
      var bz = rec.rot === 0 ? rec.z + cz : (rec.rot === 1 ? rec.z - cx : (rec.rot === 2 ? rec.z - cz : rec.z + cx));
      U.addWall(ctx, bx, bz, cw, cd, null);
    }

    // Rückwand (+Z), Seitenwände
    wandBox(0, d / 2 + t / 2, w + t * 2, t);
    wandBox(-w / 2 - t / 2, 0, t, d);
    wandBox(w / 2 + t / 2, 0, t, d);
    // Vorderwand (-Z) mit Türlücke
    var seg = (w + t * 2 - tuerB) / 2;
    wandBox(-(tuerB / 2 + seg / 2), -d / 2 - t / 2, seg, t);
    wandBox(tuerB / 2 + seg / 2, -d / 2 - t / 2, seg, t);
    // Sturz über der Tür (kein Collider, man geht darunter durch)
    var sturz = U.box(tuerB + 0.2, h - 2.2, t, putz);
    sturz.position.set(0, h - (h - 2.2) / 2, -d / 2 - t / 2);
    group.add(sturz);

    // ---- Innenschale ----
    function innenPanel(cx, cz, ww, dd) {
      var p = U.box(ww, h - 0.02, dd, innen, false);
      p.position.set(cx, (h - 0.02) / 2, cz);
      p.receiveShadow = true;
      group.add(p);
    }
    innenPanel(0, d / 2 - 0.02, w, 0.04);
    innenPanel(-w / 2 + 0.02, 0, 0.04, d);
    innenPanel(w / 2 - 0.02, 0, 0.04, d);
    innenPanel(-(tuerB / 2 + (w - tuerB) / 4), -d / 2 + 0.02, (w - tuerB) / 2, 0.04);
    innenPanel(tuerB / 2 + (w - tuerB) / 4, -d / 2 + 0.02, (w - tuerB) / 2, 0.04);

    // ---- Sockelleisten ----
    var leiste = woodM(0x7a5230);
    var sl1 = U.box(w, 0.12, 0.05, leiste, false); sl1.position.set(0, 0.06, d / 2 - 0.06); group.add(sl1);
    var sl2 = U.box(0.05, 0.12, d, leiste, false); sl2.position.set(-w / 2 + 0.06, 0.06, 0); group.add(sl2);
    var sl3 = sl2.clone(); sl3.position.x = w / 2 - 0.06; group.add(sl3);

    // ---- Türrahmen + offene Tür ----
    var rahmenM = woodM(0x7d5530);
    for (var s = 0; s < 2; s++) {
      var pf = U.box(0.12, 2.2, t + 0.06, rahmenM);
      pf.position.set((s ? 1 : -1) * (tuerB / 2 + 0.06), 1.1, -d / 2 - t / 2);
      group.add(pf);
    }
    var oben = U.box(tuerB + 0.24, 0.14, t + 0.06, rahmenM);
    oben.position.set(0, 2.27, -d / 2 - t / 2);
    group.add(oben);
    var tuer = U.box(tuerB - 0.06, 2.1, 0.06, woodM(0x6b4527));
    tuer.position.set(tuerB / 2 - 0.06, 1.05, -d / 2 - t - 0.4);
    tuer.rotation.y = -1.15;
    group.add(tuer);
    var klinke = U.cyl(0.02, 0.02, 0.12, 8, metalM(0xb9a06a), false);
    klinke.rotation.z = HALFPI;
    klinke.position.set(tuerB - 0.5, 1.05, -d / 2 - t - 0.55);
    group.add(klinke);

    // ---- Fenster in den Seitenwänden ----
    var fensterHoehe = 1.55;
    var fL = mkFenster(1.1, 1.15);
    fL.position.set(-w / 2 + 0.05, fensterHoehe, -d * 0.18);
    fL.rotation.y = HALFPI;
    group.add(fL);
    var fR = mkFenster(1.1, 1.15);
    fR.position.set(w / 2 - 0.05, fensterHoehe, d * 0.18);
    fR.rotation.y = -HALFPI;
    group.add(fR);
    var fB = mkFenster(1.3, 1.15);
    fB.position.set(w * 0.24, fensterHoehe, d / 2 - 0.05);
    fB.rotation.y = Math.PI;
    group.add(fB);

    // ---- Dach ----
    var dach = U.cone(1, 1, 4, sharedM('roof') || flatM(0x8f4437, 0.85, 0));
    dach.rotation.y = Math.PI / 4;
    var dr = Math.max(w, d) * 0.5 + t + 0.55;
    dach.scale.set(dr, 1.9, dr * (d / w));
    dach.position.y = h + 1.1;
    group.add(dach);
    rec.roofMesh = dach;

    var kamin = U.box(0.5, 1.1, 0.5, sharedM('brick') || flatM(0x8d5a48, 0.9, 0));
    kamin.position.set(w * 0.28, h + 1.3, -d * 0.18);
    group.add(kamin);
    var kaminKopf = U.box(0.62, 0.1, 0.62, flatM(0x6f6a60, 0.9, 0));
    kaminKopf.position.set(w * 0.28, h + 1.9, -d * 0.18);
    group.add(kaminKopf);

    // ---- Türschild ----
    var schild = U.box(0.5, 0.16, 0.03, woodM(0x8a5f36), false);
    schild.position.set(tuerB / 2 + 0.55, 1.9, -d / 2 - t - 0.02);
    group.add(schild);
  }

  /* ============================================================
     6. EINRICHTUNGEN — eine Funktion je Raumart.
     Ausrichtung: Möbel schauen von Haus aus nach +Z.
       Westwand  -> ry =  PI/2     Ostwand -> ry = -PI/2
       Nordwand  -> ry =  PI       Türwand -> ry =  0
     Bei ry = +-PI/2 sind Kollisionsbreite/-tiefe vertauscht.
     ============================================================ */

  var FURNISH = {};

  /* ---------- 1. WOHNZIMMER ---------- */
  FURNISH.wohnzimmer = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    R.add(mkTeppich(4.2, 3.0, 0x8a4a44), -0.4, 0, 0.2);

    var sofa = mkSofa(2.6, 0x46567a, 0x5a6c92);
    R.put(sofa, -w / 2 + 0.7, 0.3, HALFPI, 0.95, 2.7);

    var couchtisch = mkTisch(1.3, 0.7, 0.42, 0x8a5f36);
    R.put(couchtisch, -0.5, 0.3, 0, 1.35, 0.75);
    R.deko(mkBuchstapel(3, 0.16), -0.85, 0.46, 0.35);
    R.deko(mkBecher(0xe8e2d4), -0.15, 0.46, 0.1);
    R.deko(mkFlasche(0x6b3a1e, 0.24), -0.2, 0.46, 0.5);

    var s1 = mkSessel(0x6a4f7a, 0x7d5f8e);
    R.put(s1, -0.9, -2.5, 0.15, 0.9, 0.9);
    var s2 = mkSessel(0x6a4f7a, 0x7d5f8e);
    R.put(s2, 1.6, 2.6, Math.PI - 0.2, 0.9, 0.9);

    // EINZIGARTIG: Lowboard mit Flachbildfernseher
    var lowboard = mkKommode(2.2, 0.52, 0.5, 0x4a4038, 2);
    R.put(lowboard, w / 2 - 0.42, -1.4, -HALFPI, 0.56, 2.24);
    var tvRahmen = U.box(0.08, 0.78, 1.5, flatM(0x14161a, 0.5, 0.3));
    R.add(tvRahmen, w / 2 - 0.35, 1.5, -1.4);
    var tvBild = U.box(0.03, 0.66, 1.38, sharedM('screen') || glowM(0x2a5c8a, 0.7), false);
    R.add(tvBild, w / 2 - 0.42, 1.5, -1.4);
    var tvFuss = U.box(0.3, 0.06, 0.5, flatM(0x14161a, 0.5, 0.3), false);
    R.add(tvFuss, w / 2 - 0.4, 1.12, -1.4);

    // EINZIGARTIG: Hi-Fi-Turm mit Plattenspieler
    var hifi = U.box(0.5, 1.1, 0.44, flatM(0x1e2228, 0.4, 0.4));
    R.put(hifi, w / 2 - 0.45, 1.6, 0, 0.5, 0.44);
    for (var i = 0; i < 3; i++) {
      var blende = U.box(0.03, 0.16, 0.4, metalM(0x8f959c), false);
      R.add(blende, w / 2 - 0.7, 0.34 + i * 0.26, 1.6);
      var led = U.box(0.02, 0.03, 0.06, glowM(0x4affa0, 1.4), false);
      R.add(led, w / 2 - 0.72, 0.34 + i * 0.26, 1.74);
    }
    var plattenspieler = U.box(0.46, 0.1, 0.4, flatM(0x2a2d33, 0.5, 0.2));
    R.add(plattenspieler, w / 2 - 0.45, 1.15, 1.6);
    var platte = U.cyl(0.15, 0.15, 0.015, 18, flatM(0x101216, 0.4, 0.1), false);
    R.add(platte, w / 2 - 0.47, 1.21, 1.6);

    // EINZIGARTIG: Kachelofen in der Ecke
    var ofen = mkOfen(0.9, 1.9, 0.7, 0xe4d6b8);
    R.put(ofen, -w / 2 + 0.75, d / 2 - 0.65, 0, 1.0, 0.8);
    R.licht(0xff7a2a, 0.7, 4.0, -w / 2 + 0.75, 0.5, d / 2 - 1.0);

    var regal = mkRegal(1.6, 1.9, 0.34, 4, 0x7d5530, true);
    R.put(regal, 1.2, d / 2 - 0.3, Math.PI, 1.66, 0.38);

    R.put(mkStehlampe(0xf0e0c0, 1.6), -w / 2 + 0.8, -2.4, 0, 0.44, 0.44);
    R.put(mkPflanze(1.15, 0x9a5a3c), w / 2 - 0.6, d / 2 - 0.6, 0, 0.5, 0.5);

    R.wand(mkBild(1.1, 0.8, 0x6b4527, 0x7e97ad), 'n', -2.2, 1.85);
    R.wand(mkBild(0.7, 0.9, 0x8a5f36, 0x8a7a5a), 'w', 1.9, 1.9);
    R.wand(mkUhr(0.24), 's', -2.6, 2.1);
    R.wand(mkVorhang(1.5, 1.5, 0x9a5a4a), 'w', -1.35, 2.35);

    R.add(mkDeckenlampe('luster'), 0, R.h - 0.05, 0);
    R.licht(0xffe6bc, 1.05, 13, 0, R.h - 0.7, 0);
  };

  /* ---------- 2. KÜCHE ---------- */
  FURNISH.kueche = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // Küchenzeile an der Nordwand
    var zeile = mkKuechenzeile(4.4, 0xdfe4e8, 0x4a4f56);
    R.put(zeile, -1.1, d / 2 - 0.35, Math.PI, 4.44, 0.66);
    var haenge = mkHaengeschrank(4.0, 0.72, 0xdfe4e8);
    R.add(haenge, -1.1, 1.72, d / 2 - 0.24, Math.PI);

    // EINZIGARTIG: Spüle mit Armatur
    var spuele = U.box(0.7, 0.14, 0.5, sharedM('chrome') || metalM(0xe8ecf0), false);
    R.add(spuele, -2.4, 0.88, d / 2 - 0.35);
    var beckenLoch = U.box(0.58, 0.12, 0.4, flatM(0x8f959c, 0.3, 0.7), false);
    R.add(beckenLoch, -2.4, 0.86, d / 2 - 0.35);
    var armatur = U.cyl(0.02, 0.024, 0.3, 8, sharedM('chrome') || metalM(0xe8ecf0));
    R.add(armatur, -2.4, 1.05, d / 2 - 0.58);
    var auslauf = U.cyl(0.016, 0.016, 0.26, 8, sharedM('chrome') || metalM(0xe8ecf0));
    auslauf.rotation.x = HALFPI;
    R.add(auslauf, -2.4, 1.19, d / 2 - 0.46);

    // EINZIGARTIG: Herd mit vier Platten und Backrohr
    var herd = U.box(0.72, 0.9, 0.62, flatM(0x2f343a, 0.4, 0.5));
    R.put(herd, 1.6, d / 2 - 0.36, Math.PI, 0.72, 0.62);
    var herdplatte = U.box(0.72, 0.04, 0.62, flatM(0x14161a, 0.2, 0.3), false);
    R.add(herdplatte, 1.6, 0.92, d / 2 - 0.36);
    for (var p = 0; p < 4; p++) {
      var pl = U.cyl(0.11, 0.11, 0.012, 14, glowM(p < 2 ? 0xff5a2a : 0x2a2d33, p < 2 ? 1.3 : 0.0), false);
      R.add(pl, 1.6 + (p % 2 ? 0.17 : -0.17), 0.95, d / 2 - 0.36 + (p < 2 ? 0.15 : -0.15));
    }
    var rohrTuer = U.box(0.62, 0.44, 0.04, flatM(0x14161a, 0.3, 0.4), false);
    R.add(rohrTuer, 1.6, 0.5, d / 2 - 0.68);
    var rohrGlas = U.box(0.44, 0.28, 0.02, GTA.U.mat(0x2a1a0e, 0.2, 0.3, { emissive: 0xff8a3a, emissiveIntensity: 0.5 }), false);
    R.add(rohrGlas, 1.6, 0.5, d / 2 - 0.71);
    R.deko(mkTopf(0.14, 0.16), 1.43, 0.97, d / 2 - 0.21);

    // EINZIGARTIG: Kühlschrank
    var kuehl = U.box(0.72, 1.85, 0.68, flatM(0xdfe6ea, 0.35, 0.55));
    R.put(kuehl, w / 2 - 0.5, d / 2 - 0.6, 0, 0.72, 0.68);
    var kTuer = U.box(0.06, 1.2, 0.62, flatM(0xcfd8dd, 0.3, 0.6), false);
    R.add(kTuer, w / 2 - 0.85, 1.2, d / 2 - 0.6);
    var kGriff = U.cyl(0.02, 0.02, 0.6, 8, sharedM('chrome') || metalM(0xe8ecf0), false);
    R.add(kGriff, w / 2 - 0.9, 1.2, d / 2 - 0.85);
    var magnet = U.box(0.02, 0.1, 0.08, flatM(0xd94f4f, 0.8, 0), false);
    R.add(magnet, w / 2 - 0.88, 1.5, d / 2 - 0.35);

    // Esstisch mit vier Sesseln
    var tisch = mkTisch(1.9, 1.0, 0.76, 0xa8763f);
    R.put(tisch, -0.6, -1.7, 0, 1.95, 1.05);
    R.deko(mkTeller(), -1.15, 0.78, -1.45);
    R.deko(mkTeller(), -0.05, 0.78, -1.95);
    R.deko(mkBecher(0xe0e6ea), -1.15, 0.78, -1.95);
    R.deko(mkFlasche(0x3a6b3a, 0.28), -0.6, 0.78, -1.7);
    R.put(mkStuhl(0xa8763f), -1.5, -0.9, Math.PI, 0.48, 0.48);
    R.put(mkStuhl(0xa8763f), 0.3, -0.9, Math.PI, 0.48, 0.48);
    R.put(mkStuhl(0xa8763f), -1.5, -2.5, 0, 0.48, 0.48);
    R.put(mkStuhl(0xa8763f), 0.3, -2.5, 0, 0.48, 0.48);

    // Geschirrschrank an der Westwand
    var vitrine = mkSchrank(1.5, 2.0, 0.5, 0x8a5f36, 2);
    R.put(vitrine, -w / 2 + 0.45, 1.4, HALFPI, 0.56, 1.56);

    // Vorratsregal an der Ostwand
    var vorrat = mkRegal(1.4, 1.7, 0.32, 4, 0xa8763f, false);
    R.put(vorrat, w / 2 - 0.3, -1.6, -HALFPI, 0.36, 1.46);
    for (var v = 0; v < 6; v++) {
      R.deko(mkFlasche(v % 2 ? 0x8a3b2e : 0x3d6b46, 0.22), w / 2 - 0.35, 0.42 + (v % 3) * 0.42, -2.1 + (v > 2 ? 1.0 : 0) + (v % 3) * 0.02);
    }

    R.put(mkPflanze(0.8, 0x8fa87a), -w / 2 + 0.55, -2.6, 0, 0.42, 0.42);
    R.wand(mkUhr(0.2), 'w', -0.4, 2.1);
    R.wand(mkBild(0.6, 0.45, 0xa8763f, 0xd8b46a), 'o', 1.6, 1.9);
    R.add(mkDeckenlampe('roehre'), 0, R.h - 0.05, 0.4);
    R.licht(0xf2f8ff, 1.0, 12, 0, R.h - 0.6, 0);
  };

  /* ---------- 3. SCHLAFZIMMER ---------- */
  FURNISH.schlafzimmer = function (R) {
    var w = R.w, d = R.d, U = GTA.U;

    R.add(mkTeppich(3.4, 2.4, 0x6a5a7a), 0, 0, -0.6);

    var bett = mkBett(1.7, 2.1, 0x7d5530, 0x5a6c92, 0xf0ece2);
    R.put(bett, -0.2, d / 2 - 1.5, Math.PI, 1.8, 2.3);

    R.put(mkNachtkasten(0x7d5530), -1.5, d / 2 - 0.4, Math.PI, 0.44, 0.38);
    R.put(mkNachtkasten(0x7d5530), 1.1, d / 2 - 0.4, Math.PI, 0.44, 0.38);
    R.deko(mkTischlampe(0xf0d8b0), -1.5, 0.62, d / 2 - 0.4);
    R.deko(mkBuchstapel(2, 0.14), 1.1, 0.62, d / 2 - 0.4);

    var schrank = mkSchrank(2.4, 2.25, 0.62, 0x6b4527, 3);
    R.put(schrank, -w / 2 + 0.5, -0.6, HALFPI, 0.68, 2.46);

    var kommode = mkKommode(1.5, 0.9, 0.48, 0x7d5530, 4);
    R.put(kommode, w / 2 - 0.42, 1.4, -HALFPI, 0.54, 1.56);
    R.deko(mkBecher(0xe4d8c0), w / 2 - 0.42, 0.94, 1.05);

    // EINZIGARTIG: Frisiertisch mit Spiegel und Hocker
    var frisier = mkTisch(1.2, 0.5, 0.74, 0x8a5f36);
    R.put(frisier, w / 2 - 0.4, -1.9, -HALFPI, 0.55, 1.25);
    var spiegelOval = U.cyl(0.34, 0.34, 0.04, 20, GTA.U.mat(0xcfe0ea, 0.06, 0.95), false);
    spiegelOval.rotation.z = HALFPI;
    spiegelOval.scale.set(1, 1, 1.25);
    R.add(spiegelOval, w / 2 - 0.2, 1.2, -1.9);
    var spRahmen = U.torus(0.36, 0.035, 6, 20, woodM(0x8a5f36), false);
    spRahmen.rotation.y = HALFPI;
    R.add(spRahmen, w / 2 - 0.22, 1.2, -1.9);
    R.put(mkHocker(0x8a5f36, 0.17, 0.42), w / 2 - 1.25, -1.9, 0, 0.4, 0.4);
    R.deko(mkFlasche(0xd8a0c0, 0.16), w / 2 - 0.45, 0.76, -1.6);

    // EINZIGARTIG: Wäschekorb
    var korb = U.cyl(0.3, 0.26, 0.5, 14, woodM(0xc9a06a));
    R.put(korb, -w / 2 + 0.6, 2.3, 0, 0.62, 0.62);
    korb.position.y = 0.25;
    var waesche = U.sph(0.28, 10, 8, clothM(0xdfe6ea), false);
    waesche.scale.y = 0.5;
    R.add(waesche, -w / 2 + 0.6, 0.52, 2.3);

    // EINZIGARTIG: Truhe am Bettende
    R.put(mkKiste(1.3, 0.5, 0.5, 0x6b4527, true), -0.2, d / 2 - 2.9, 0, 1.36, 0.56);

    R.put(mkStehlampe(0xe8d0e8, 1.45), -w / 2 + 0.7, -2.6, 0, 0.44, 0.44);
    R.put(mkPflanze(0.9, 0xb08a6a), w / 2 - 0.55, d / 2 - 0.55, 0, 0.44, 0.44);

    R.wand(mkBild(1.4, 0.6, 0x6b4527, 0x8a7a9a), 'n', 0.6, 2.35);
    R.wand(mkSpiegel(0.6, 1.5, 0x8a5f36), 's', -2.4, 1.5);
    R.wand(mkVorhang(1.4, 1.5, 0x7a6a8a), 'o', 0.2, 2.35);

    R.add(mkDeckenlampe('haenge', 0xe8dcf0), 0, R.h - 0.05, -0.4);
    R.licht(0xffd8b8, 0.9, 12, 0, R.h - 0.9, -0.4);
  };

  /* ---------- 4. WERKSTATT ---------- */
  FURNISH.werkstatt = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // Werkbank an der Nordwand
    var bank = U.box(3.6, 0.14, 0.8, woodM(0x8a6a45));
    R.put(bank, -1.0, d / 2 - 0.5, Math.PI, 3.6, 0.8);
    bank.position.y = 0.9;
    for (var b = 0; b < 4; b++) {
      var bein = U.box(0.12, 0.9, 0.12, metalM(0x4a4f56));
      R.add(bein, -1.0 + (b < 2 ? -1.6 : 1.6), 0.45, d / 2 - 0.5 + ((b % 2) ? 0.3 : -0.3));
    }
    var unterbau = U.box(3.4, 0.6, 0.7, metalM(0x5a6068));
    R.add(unterbau, -1.0, 0.35, d / 2 - 0.55);

    // EINZIGARTIG: Schraubstock
    var stockFuss = U.cyl(0.12, 0.14, 0.1, 10, metalM(0x3d6b8a));
    R.add(stockFuss, -2.3, 1.02, d / 2 - 0.5);
    var stockKoerper = U.box(0.34, 0.16, 0.2, metalM(0x3d6b8a));
    R.add(stockKoerper, -2.3, 1.15, d / 2 - 0.5);
    var stockBacke = U.box(0.1, 0.18, 0.22, metalM(0x8f959c));
    R.add(stockBacke, -2.12, 1.16, d / 2 - 0.5);
    var stockSpindel = U.cyl(0.022, 0.022, 0.4, 8, sharedM('chrome') || metalM(0xe8ecf0));
    stockSpindel.rotation.z = HALFPI;
    R.add(stockSpindel, -2.55, 1.15, d / 2 - 0.5);
    var kurbel = U.cyl(0.018, 0.018, 0.26, 8, metalM(0x8f959c));
    R.add(kurbel, -2.75, 1.15, d / 2 - 0.5);

    // EINZIGARTIG: Werkzeugwand mit Umrissen
    var lochwand = U.box(3.4, 1.3, 0.05, flatM(0xc4b48a, 0.85, 0), false);
    R.add(lochwand, -1.0, 1.95, d / 2 - 0.08);
    var wzFarben = [0xd94f4f, 0x3a7bd5, 0xe0a132, 0x35a06b, 0x8e5bc4];
    for (var t = 0; t < 10; t++) {
      var griff = U.box(0.06, 0.3, 0.05, flatM(wzFarben[t % wzFarben.length], 0.8, 0), false);
      R.add(griff, -2.5 + t * 0.32, 2.15, d / 2 - 0.14);
      var kopf = U.box(0.16, 0.09, 0.07, metalM(0x8f959c), false);
      R.add(kopf, -2.5 + t * 0.32, 2.34, d / 2 - 0.14);
    }
    for (var z = 0; z < 6; z++) {
      var zange = U.cyl(0.02, 0.02, 0.26, 6, metalM(0x6b7078), false);
      R.add(zange, -2.3 + z * 0.42, 1.62, d / 2 - 0.14);
    }

    // EINZIGARTIG: Ständerbohrmaschine
    var bmFuss = U.box(0.5, 0.1, 0.44, metalM(0x2f6b4a));
    R.put(bmFuss, w / 2 - 0.8, 1.8, 0, 0.55, 0.5);
    bmFuss.position.y = 0.05;
    var bmSaeule = U.cyl(0.06, 0.06, 1.5, 10, metalM(0x8f959c));
    R.add(bmSaeule, w / 2 - 0.8, 0.8, 1.9);
    var bmTisch = U.box(0.36, 0.05, 0.36, metalM(0x2f6b4a));
    R.add(bmTisch, w / 2 - 0.8, 0.85, 1.72);
    var bmKopf = U.box(0.24, 0.3, 0.7, metalM(0x2f6b4a));
    R.add(bmKopf, w / 2 - 0.8, 1.62, 1.75);
    var bmSpindel = U.cyl(0.02, 0.02, 0.36, 8, sharedM('chrome') || metalM(0xe8ecf0));
    R.add(bmSpindel, w / 2 - 0.8, 1.3, 1.6);

    // EINZIGARTIG: Ölfässer und Reifenstapel
    R.put(mkFass(0.29, 0.9, 0x8a5a2a), -w / 2 + 0.65, -2.9, 0, 0.62, 0.62);
    R.put(mkFass(0.29, 0.9, 0x6b7a3a), -w / 2 + 0.65, -2.1, 0, 0.62, 0.62);
    var reifenM = flatM(0x1a1c20, 0.95, 0);
    for (var r = 0; r < 3; r++) {
      var reifen = U.torus(0.3, 0.12, 8, 16, reifenM);
      reifen.rotation.x = HALFPI;
      R.add(reifen, w / 2 - 0.7, 0.13 + r * 0.24, -2.6);
    }
    R.block(w / 2 - 0.7, -2.6, 0.86, 0.86);

    // Regale und Kisten
    var stahlregal = mkRegal(1.8, 2.2, 0.45, 5, 0x6b7078, false);
    R.put(stahlregal, -w / 2 + 0.4, 0.9, HALFPI, 0.5, 1.86);
    for (var k = 0; k < 4; k++) {
      R.deko(mkKiste(0.4, 0.26, 0.34, 0x9a7a4a, false), -w / 2 + 0.45, 0.1 + k * 0.5, 0.3 + (k % 2) * 0.9);
    }
    R.put(mkKiste(0.9, 0.7, 0.7, 0x8a6a45, false), 3.0, -2.8, 0.2, 0.96, 0.76);
    R.put(mkKiste(0.7, 0.55, 0.55, 0x9a7a4a, false), 2.1, -2.9, -0.3, 0.76, 0.6);

    var werkzeugwagen = mkKommode(0.7, 0.9, 0.5, 0xd94f4f, 4);
    R.put(werkzeugwagen, 0.9, -2.7, 0, 0.74, 0.54);

    R.wand(mkBild(0.7, 0.5, 0x4a4f56, 0x8a9aa8), 'w', -2.6, 2.0);
    R.add(mkDeckenlampe('roehre'), -1.2, R.h - 0.05, 0.6);
    R.add(mkDeckenlampe('roehre'), 2.2, R.h - 0.05, -1.4);
    R.licht(0xf4f8ff, 1.15, 15, 0, R.h - 0.6, 0);
  };

  /* ---------- 5. BÜRO ---------- */
  FURNISH.buero = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    R.add(mkTeppich(3.0, 2.2, 0x4a5a6a), 0.2, 0, -0.2);

    // EINZIGARTIG: Schreibtisch mit Rollcontainer, Rechner und Bildschirm
    var schreibtisch = mkTisch(2.0, 0.9, 0.75, 0x5a4636);
    R.put(schreibtisch, 0.2, -1.9, 0, 2.05, 0.95);
    var monitor = U.box(0.7, 0.44, 0.04, flatM(0x1a1c20, 0.4, 0.4));
    R.add(monitor, 0.5, 1.0, -2.2);
    var monBild = U.box(0.64, 0.38, 0.02, sharedM('screen') || glowM(0x2a5c8a, 0.8), false);
    R.add(monBild, 0.5, 1.0, -2.17);
    var monFuss = U.cyl(0.12, 0.14, 0.03, 12, flatM(0x1a1c20, 0.4, 0.4), false);
    R.add(monFuss, 0.5, 0.78, -2.2);
    var monHals = U.box(0.06, 0.22, 0.06, flatM(0x1a1c20, 0.4, 0.4), false);
    R.add(monHals, 0.5, 0.88, -2.2);
    var tastatur = U.box(0.44, 0.02, 0.16, flatM(0x2a2d33, 0.6, 0.1), false);
    R.add(tastatur, 0.4, 0.78, -1.68);
    var maus = U.sph(0.05, 8, 6, flatM(0x2a2d33, 0.5, 0.1), false);
    maus.scale.set(0.7, 0.5, 1.1);
    R.add(maus, 0.78, 0.79, -1.66);
    var rollcontainer = mkKommode(0.44, 0.62, 0.5, 0x5a4636, 3);
    R.put(rollcontainer, -0.7, -1.9, 0, 0.48, 0.54);
    R.deko(mkBuchstapel(4, 0.16), -0.4, 0.78, -2.1);

    // EINZIGARTIG: Bürodrehstuhl
    var stuhlFuss = U.cyl(0.05, 0.06, 0.35, 8, flatM(0x2a2d33, 0.5, 0.3));
    R.put(stuhlFuss, 0.2, -0.9, 0, 0.5, 0.5);
    stuhlFuss.position.y = 0.3;
    for (var s = 0; s < 5; s++) {
      var a = s * Math.PI * 2 / 5;
      var arm = U.box(0.3, 0.04, 0.06, flatM(0x2a2d33, 0.5, 0.3), false);
      arm.position.set(0.2 + Math.sin(a) * 0.16, 0.06, -0.9 + Math.cos(a) * 0.16);
      arm.rotation.y = a;
      R.group.add(arm);
      var rolle = U.sph(0.035, 6, 6, flatM(0x14161a, 0.6, 0.1), false);
      R.add(rolle, 0.2 + Math.sin(a) * 0.28, 0.035, -0.9 + Math.cos(a) * 0.28);
    }
    var sitzflaeche = U.box(0.46, 0.09, 0.44, clothM(0x2f3a4a));
    R.add(sitzflaeche, 0.2, 0.5, -0.9);
    var rueckenL = U.box(0.44, 0.5, 0.08, clothM(0x2f3a4a));
    R.add(rueckenL, 0.2, 0.8, -0.66);

    // EINZIGARTIG: Aktenschrank-Wand mit Ordnern
    var aktenschrank = mkRegal(2.4, 2.3, 0.36, 5, 0x6b6058, false);
    R.put(aktenschrank, -w / 2 + 0.35, 0.6, HALFPI, 0.4, 2.46);
    var ordnerFarben = [0x8a3b2e, 0x2f4d78, 0x3d6b46, 0x6b6058, 0x8a6a2a];
    for (var reihe = 0; reihe < 5; reihe++) {
      for (var o = 0; o < 8; o++) {
        var ordner = U.box(0.26, 0.3, 0.07, flatM(ordnerFarben[(reihe + o) % 5], 0.85, 0), false);
        R.add(ordner, -w / 2 + 0.4, 0.24 + reihe * 0.44, -0.5 + o * 0.28);
      }
    }

    // EINZIGARTIG: Tresor
    var tresor = U.box(0.6, 0.7, 0.55, metalM(0x3a3f46));
    R.put(tresor, w / 2 - 0.5, -2.3, 0, 0.64, 0.6);
    tresor.position.y = 0.35;
    var tresorTuer = U.box(0.5, 0.6, 0.05, metalM(0x4a4f56), false);
    R.add(tresorTuer, w / 2 - 0.78, 0.35, -2.3);
    var rad = U.torus(0.1, 0.02, 6, 14, sharedM('chrome') || metalM(0xe8ecf0), false);
    rad.rotation.y = HALFPI;
    R.add(rad, w / 2 - 0.82, 0.35, -2.3);
    var speichen = U.box(0.02, 0.2, 0.02, sharedM('chrome') || metalM(0xe8ecf0), false);
    R.add(speichen, w / 2 - 0.82, 0.35, -2.3);

    var besucherstuhl1 = mkStuhl(0x5a4636, 0x2f3a4a);
    R.put(besucherstuhl1, -0.6, 0.4, Math.PI, 0.48, 0.48);
    var besucherstuhl2 = mkStuhl(0x5a4636, 0x2f3a4a);
    R.put(besucherstuhl2, 1.0, 0.4, Math.PI, 0.48, 0.48);

    var sideboard = mkKommode(1.8, 0.85, 0.45, 0x5a4636, 3);
    R.put(sideboard, w / 2 - 0.42, 1.6, -HALFPI, 0.5, 1.86);
    R.deko(mkTischlampe(0x2f6b4a), w / 2 - 0.45, 0.9, 1.1);

    var pinnwand = U.box(1.6, 1.0, 0.05, flatM(0xc4a878, 0.9, 0), false);
    R.add(pinnwand, 0.6, 1.9, d / 2 - 0.08, Math.PI);
    for (var z = 0; z < 7; z++) {
      var zettel = U.box(0.18, 0.22, 0.01, paperM(), false);
      R.add(zettel, 0.0 + (z % 4) * 0.32, 1.6 + Math.floor(z / 4) * 0.4, d / 2 - 0.12);
    }

    R.put(mkPflanze(1.25, 0x5a6068), -w / 2 + 0.6, d / 2 - 0.6, 0, 0.5, 0.5);
    R.wand(mkUhr(0.22), 'n', -2.6, 2.3);
    R.wand(mkBild(0.9, 0.6, 0x4a4f56, 0x6a7a8a), 'o', 0.4, 2.1);
    R.add(mkDeckenlampe('roehre'), 0, R.h - 0.05, -0.6);
    R.licht(0xeaf2ff, 1.05, 13, 0, R.h - 0.6, -0.4);
  };

  /* ---------- 6. BAUERNSTUBE ---------- */
  FURNISH.bauernstube = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // EINZIGARTIG: Kachelofen mit Ofenbank
    var ofen = mkOfen(1.3, 2.05, 0.9, 0xe8dcc0);
    R.put(ofen, -w / 2 + 0.95, d / 2 - 0.8, 0, 1.4, 1.0);
    var ofenbank = U.box(1.9, 0.12, 0.42, woodM(0x8a6a45));
    R.put(ofenbank, -w / 2 + 0.9, d / 2 - 1.6, 0, 1.9, 0.42);
    ofenbank.position.y = 0.44;
    for (var ob = 0; ob < 2; ob++) {
      var stuetze = U.box(0.12, 0.44, 0.36, woodM(0x8a6a45));
      R.add(stuetze, -w / 2 + 0.2 + ob * 1.4, 0.22, d / 2 - 1.6);
    }
    R.licht(0xff7a2a, 0.8, 5.0, -w / 2 + 0.95, 0.6, d / 2 - 1.4);

    // EINZIGARTIG: Herrgottswinkel mit Eckbank
    var eckbank1 = mkBank(2.6, 0x7d5530, 0x6b7a4a);
    R.put(eckbank1, 1.4, d / 2 - 0.4, Math.PI, 2.6, 0.55);
    var eckbank2 = mkBank(2.2, 0x7d5530, 0x6b7a4a);
    R.put(eckbank2, w / 2 - 0.4, d / 2 - 1.7, -HALFPI, 0.55, 2.2);
    var kreuzBalken1 = U.box(0.07, 0.6, 0.07, woodM(0x5c4326), false);
    R.add(kreuzBalken1, w / 2 - 0.9, 2.15, d / 2 - 0.4);
    var kreuzBalken2 = U.box(0.36, 0.07, 0.07, woodM(0x5c4326), false);
    R.add(kreuzBalken2, w / 2 - 0.9, 2.28, d / 2 - 0.4);
    var kerze = U.cyl(0.03, 0.03, 0.16, 8, flatM(0xf4eddc, 0.9, 0), false);
    R.add(kerze, w / 2 - 0.9, 1.7, d / 2 - 0.42);
    var flamme = U.sph(0.045, 8, 6, glowM(0xffd47a, 1.5), false);
    R.add(flamme, w / 2 - 0.9, 1.82, d / 2 - 0.42);

    var stubentisch = mkTisch(1.8, 1.0, 0.76, 0x8a6a45);
    R.put(stubentisch, 1.6, d / 2 - 1.5, 0, 1.85, 1.05);
    R.deko(mkKrug(0xd8951f), 1.2, 0.78, d / 2 - 1.5);
    R.deko(mkKrug(0xd8951f), 2.0, 0.78, d / 2 - 1.7);
    R.deko(mkTeller(0xe8d8b8), 1.6, 0.78, d / 2 - 1.2);
    R.put(mkStuhl(0x8a6a45), 0.6, d / 2 - 2.5, 0, 0.48, 0.48);
    R.put(mkStuhl(0x8a6a45), 2.4, d / 2 - 2.5, 0, 0.48, 0.48);

    // EINZIGARTIG: Deckenbalken
    for (var i = 0; i < 4; i++) {
      var balken = U.box(w - 0.2, 0.22, 0.24, woodM(0x5c4326), false);
      R.add(balken, 0, R.h - 0.16, -d / 2 + 1.0 + i * ((d - 2.0) / 3));
    }

    // EINZIGARTIG: Speckseite und Kräuterbüschel an der Decke
    var stange = U.cyl(0.03, 0.03, 1.6, 8, woodM(0x5c4326), false);
    stange.rotation.z = HALFPI;
    R.add(stange, -2.6, R.h - 0.42, 1.4);
    for (var sp = 0; sp < 3; sp++) {
      var speck = U.box(0.24, 0.42, 0.16, flatM(0x9a5a4a, 0.85, 0));
      R.add(speck, -3.2 + sp * 0.6, R.h - 0.68, 1.4);
      var schwarte = U.box(0.26, 0.08, 0.18, flatM(0xe8d8c0, 0.8, 0), false);
      R.add(schwarte, -3.2 + sp * 0.6, R.h - 0.5, 1.4);
    }
    for (var kb = 0; kb < 4; kb++) {
      var buschel = U.cone(0.1, 0.34, 7, flatM(0x6b7a3a, 0.95, 0));
      buschel.rotation.x = Math.PI;
      R.add(buschel, -3.4 + kb * 0.5, R.h - 0.55, 0.7);
    }

    var kredenz = mkSchrank(1.8, 2.05, 0.55, 0x8a5f36, 3);
    R.put(kredenz, -w / 2 + 0.45, -1.4, HALFPI, 0.6, 1.86);
    var tellerbrett = mkWandregal(1.6, 0x8a6a45, 0.26);
    R.add(tellerbrett, -w / 2 + 0.2, 2.25, -1.4, HALFPI);
    for (var t = 0; t < 4; t++) {
      var teller = U.cyl(0.14, 0.14, 0.02, 16, flatM(0xe8d8b8, 0.5, 0.05), false);
      teller.rotation.z = HALFPI;
      R.add(teller, -w / 2 + 0.16, 2.45, -2.0 + t * 0.4);
    }

    R.put(mkTruhenBank(1.4, 0x6b4527), 3.0, -2.6, 0, 1.46, 0.6);
    R.put(mkPflanze(0.85, 0xa8563c), w / 2 - 0.55, -2.6, 0, 0.42, 0.42);
    R.add(mkTeppich(2.6, 1.8, 0x7a5a3a), -0.6, 0, -1.4);

    R.wand(mkUhr(0.26), 'w', 1.6, 2.1);
    R.wand(mkBild(0.8, 0.6, 0x5c4326, 0x7a8a5a), 's', 2.6, 1.95);
    R.wand(mkVorhang(1.3, 0.9, 0xd94f4f), 'o', 1.9, 2.3);
    R.add(mkDeckenlampe('haenge', 0xe8d8b0), 1.6, R.h - 0.35, d / 2 - 1.5);
    R.licht(0xffd9a0, 1.0, 12, 0.6, R.h - 1.0, 0.4);
  };

  // Truhenbank — kommt in mehreren Räumen vor.
  function mkTruhenBank(w, col) {
    var U = GTA.U, g = new THREE.Group();
    var korpus = U.box(w, 0.46, 0.5, woodM(col));
    korpus.position.y = 0.23;
    g.add(korpus);
    var deckel = U.box(w + 0.04, 0.06, 0.54, woodM(0x8a5f36));
    deckel.position.y = 0.49;
    g.add(deckel);
    var kissen = U.box(w - 0.12, 0.1, 0.42, clothM(0x6b7a4a));
    kissen.position.y = 0.57;
    g.add(kissen);
    var lehne = U.box(w, 0.5, 0.07, woodM(col));
    lehne.position.set(0, 0.78, -0.24);
    g.add(lehne);
    for (var i = 0; i < 3; i++) {
      var schnitz = U.cyl(0.06, 0.06, 0.03, 10, woodM(0x8a5f36), false);
      schnitz.rotation.x = HALFPI;
      schnitz.position.set(-w / 4 + i * (w / 4), 0.8, -0.2);
      g.add(schnitz);
    }
    return g;
  }

  /* ---------- 7. KINDERZIMMER ---------- */
  FURNISH.kinderzimmer = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    R.add(mkTeppich(2.6, 2.6, 0x4a8ab0, true), 0.2, 0, 0.2);

    // EINZIGARTIG: Hochbett mit Leiter und Höhle darunter
    var pfostenM = woodM(0xc9a06a);
    for (var p = 0; p < 4; p++) {
      var pf = U.box(0.1, 1.6, 0.1, pfostenM);
      R.add(pf, -w / 2 + 0.6 + (p < 2 ? 0 : 1.5), 0.8, d / 2 - 0.6 - ((p % 2) ? 0 : 1.9));
    }
    var lattenrost = U.box(1.7, 0.1, 2.1, pfostenM);
    R.add(lattenrost, -w / 2 + 1.35, 1.6, d / 2 - 1.55);
    var matratzeK = U.box(1.55, 0.18, 1.95, flatM(0xf1ece1, 0.95, 0));
    R.add(matratzeK, -w / 2 + 1.35, 1.74, d / 2 - 1.55);
    var deckeK = U.box(1.5, 0.12, 1.3, clothM(0x3a7bd5));
    R.add(deckeK, -w / 2 + 1.35, 1.88, d / 2 - 1.3);
    var kissenK = U.box(0.6, 0.13, 0.32, clothM(0xe0a132));
    R.add(kissenK, -w / 2 + 1.35, 1.88, d / 2 - 2.3);
    for (var g = 0; g < 2; g++) {
      var gelaender = U.box(1.7, 0.07, 0.06, pfostenM, false);
      R.add(gelaender, -w / 2 + 1.35, 2.1 + g * 0.22, d / 2 - 0.62);
    }
    for (var l = 0; l < 5; l++) {
      var sprosse = U.cyl(0.025, 0.025, 0.6, 8, pfostenM, false);
      sprosse.rotation.z = HALFPI;
      R.add(sprosse, -w / 2 + 2.15, 0.3 + l * 0.32, d / 2 - 1.55);
    }
    R.block(-w / 2 + 1.35, d / 2 - 1.55, 1.8, 2.2);

    // EINZIGARTIG: Spielzeugkiste voller Bauklötze
    var kiste = mkKiste(1.0, 0.55, 0.6, 0xe0a132, false);
    R.put(kiste, w / 2 - 0.7, d / 2 - 0.6, 0, 1.06, 0.66);
    var klotzFarben = [0xd94f4f, 0x3a7bd5, 0xe0a132, 0x35a06b, 0x8e5bc4];
    for (var k = 0; k < 9; k++) {
      var klotz = U.box(0.14, 0.14, 0.14, flatM(klotzFarben[k % 5], 0.85, 0));
      R.add(klotz, w / 2 - 1.05 + (k % 3) * 0.3, 0.68 + Math.floor(k / 3) * 0.02, d / 2 - 0.85 + Math.floor(k / 3) * 0.28);
      klotz.rotation.y = k * 0.4;
    }

    // EINZIGARTIG: Schaukelpferd
    var pferdKoerper = U.cyl(0.16, 0.16, 0.7, 12, woodM(0xd8b46a));
    pferdKoerper.rotation.z = HALFPI;
    R.add(pferdKoerper, 2.6, 0.62, -1.2);
    var pferdKopf = U.box(0.18, 0.3, 0.16, woodM(0xd8b46a));
    R.add(pferdKopf, 2.95, 0.82, -1.2);
    var maehne = U.box(0.06, 0.26, 0.14, flatM(0x8a3b2e, 0.9, 0), false);
    R.add(maehne, 2.86, 0.92, -1.2);
    for (var b = 0; b < 4; b++) {
      var beinP = U.cyl(0.05, 0.045, 0.4, 8, woodM(0xd8b46a));
      R.add(beinP, 2.35 + (b < 2 ? 0 : 0.5), 0.4, -1.2 + ((b % 2) ? 0.14 : -0.14));
    }
    for (var kufe = 0; kufe < 2; kufe++) {
      var kf = U.box(1.1, 0.06, 0.07, woodM(0x8a5f36));
      R.add(kf, 2.6, 0.16, -1.2 + (kufe ? 0.18 : -0.18));
    }
    R.block(2.6, -1.2, 1.2, 0.6);

    // EINZIGARTIG: Wandtafel mit Kreidezeichnung
    var tafel = U.box(1.2, 0.9, 0.06, flatM(0x2f4a3a, 0.95, 0), false);
    R.add(tafel, -1.6, 1.5, -d / 2 + 0.1);
    var tafelRahmen = U.box(1.32, 1.02, 0.04, woodM(0xc9a06a), false);
    R.add(tafelRahmen, -1.6, 1.5, -d / 2 + 0.08);
    for (var kr = 0; kr < 5; kr++) {
      var strich = U.box(0.5 - kr * 0.07, 0.03, 0.01, flatM(0xf0f4f6, 0.9, 0), false);
      R.add(strich, -1.7 + kr * 0.06, 1.25 + kr * 0.16, -d / 2 + 0.14);
    }
    var ablage = U.box(1.3, 0.05, 0.1, woodM(0xc9a06a), false);
    R.add(ablage, -1.6, 1.0, -d / 2 + 0.14);

    var schreibpult = mkTisch(1.1, 0.6, 0.62, 0xc9a06a);
    R.put(schreibpult, 1.4, -2.5, 0, 1.15, 0.65);
    R.put(mkStuhl(0xc9a06a, 0xe0a132, 0.36), 1.4, -1.75, Math.PI, 0.44, 0.44);
    R.deko(mkBuchstapel(3, 0.15), 1.1, 0.64, -2.6);

    var buecherregal = mkRegal(1.2, 1.3, 0.28, 3, 0x3a7bd5, true);
    R.put(buecherregal, w / 2 - 0.28, 0.6, -HALFPI, 0.32, 1.26);

    var kleiderschrank = mkSchrank(1.4, 1.9, 0.5, 0x35a06b, 2);
    R.put(kleiderschrank, w / 2 - 0.4, -2.4, -HALFPI, 0.56, 1.46);

    // Kuscheltiere
    var baerKoerper = U.sph(0.16, 10, 8, clothM(0xa8763f));
    R.add(baerKoerper, 0.3, 0.16, 1.6);
    var baerKopf = U.sph(0.11, 10, 8, clothM(0xa8763f));
    R.add(baerKopf, 0.3, 0.38, 1.6);
    for (var oh = 0; oh < 2; oh++) {
      var ohr = U.sph(0.05, 8, 6, clothM(0xa8763f), false);
      R.add(ohr, 0.3 + (oh ? 0.08 : -0.08), 0.46, 1.6);
    }

    R.put(mkPflanze(0.6, 0x35a06b), -w / 2 + 0.5, -2.6, 0, 0.36, 0.36);
    R.wand(mkBild(0.6, 0.5, 0xe0a132, 0x8ec4e8), 'n', 2.6, 2.0);
    R.wand(mkVorhang(1.3, 1.2, 0xe0a132), 'o', 1.4, 2.3);
    R.add(mkDeckenlampe('haenge', 0xf4d88a), 0.4, R.h - 0.05, -0.2);
    R.licht(0xffe9c8, 1.0, 12, 0.4, R.h - 0.9, -0.2);
  };

  /* ---------- 8. DORFLADEN ---------- */
  FURNISH.laden = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // EINZIGARTIG: Verkaufstheke mit Registrierkassa
    var theke = U.box(2.8, 1.0, 0.7, woodM(0x8a6a45));
    R.put(theke, -w / 2 + 1.8, -d / 2 + 1.0, 0, 2.86, 0.76);
    theke.position.y = 0.5;
    var thekenplatte = U.box(3.0, 0.06, 0.82, flatM(0x4a4f56, 0.35, 0.2));
    R.add(thekenplatte, -w / 2 + 1.8, 1.03, -d / 2 + 1.0);
    var kassa = U.box(0.44, 0.3, 0.4, flatM(0xe8e2d4, 0.5, 0.15));
    R.add(kassa, -w / 2 + 1.0, 1.21, -d / 2 + 1.0);
    var kassaDisplay = U.box(0.3, 0.14, 0.03, glowM(0x4affa0, 0.9), false);
    R.add(kassaDisplay, -w / 2 + 1.0, 1.4, -d / 2 + 0.82);
    var kassaLade = U.box(0.4, 0.12, 0.36, metalM(0x8f959c), false);
    R.add(kassaLade, -w / 2 + 1.0, 1.08, -d / 2 + 0.82);
    var waage = U.box(0.34, 0.12, 0.3, flatM(0xdfe6ea, 0.4, 0.2));
    R.add(waage, -w / 2 + 2.6, 1.12, -d / 2 + 1.0);
    var waageSchale = U.cyl(0.16, 0.16, 0.02, 16, sharedM('chrome') || metalM(0xe8ecf0), false);
    R.add(waageSchale, -w / 2 + 2.6, 1.2, -d / 2 + 1.0);

    // EINZIGARTIG: Kühlvitrine mit Glasfront
    var vitrine = U.box(2.2, 1.9, 0.7, flatM(0xdfe6ea, 0.4, 0.35));
    R.put(vitrine, -w / 2 + 1.4, d / 2 - 0.6, 0, 2.26, 0.76);
    vitrine.position.y = 0.95;
    var vitrineGlas = U.box(2.0, 1.2, 0.03, glassM(), false);
    R.add(vitrineGlas, -w / 2 + 1.4, 1.15, d / 2 - 0.98);
    for (var f = 0; f < 3; f++) {
      var fach = U.box(1.9, 0.03, 0.55, sharedM('chrome') || metalM(0xe8ecf0), false);
      R.add(fach, -w / 2 + 1.4, 0.6 + f * 0.42, d / 2 - 0.65);
      for (var wr = 0; wr < 4; wr++) {
        var ware = U.box(0.32, 0.2, 0.3, flatM([0xd94f4f, 0xe8c05a, 0xa8763f, 0xdfe6ea][wr], 0.8, 0), false);
        R.add(ware, -w / 2 + 0.6 + wr * 0.52, 0.72 + f * 0.42, d / 2 - 0.65);
      }
    }
    R.licht(0xe8f4ff, 0.6, 4.5, -w / 2 + 1.4, 1.7, d / 2 - 0.9);

    // EINZIGARTIG: Zwei Regalgassen mit Konserven
    // achse 'x' = Regal steht quer, 'z' = Regal steht längs
    function warenregal(lx, lz, ry, achse) {
      var reg = mkRegal(2.6, 1.9, 0.42, 4, 0x8f959c, false);
      var quer = achse === 'x';
      R.put(reg, lx, lz, ry, quer ? 2.66 : 0.46, quer ? 0.46 : 2.66);
      var dosenFarben = [0xd94f4f, 0x35a06b, 0xe0a132, 0x3a7bd5, 0x8e5bc4, 0xc2b280];
      for (var reihe = 0; reihe < 4; reihe++) {
        for (var i = 0; i < 10; i++) {
          var dose = U.cyl(0.05, 0.05, 0.13, 10, flatM(dosenFarben[(reihe + i) % 6], 0.6, 0.35), false);
          var off = -1.15 + i * 0.26;
          if (quer) R.add(dose, lx + off, 0.16 + reihe * 0.45, lz);
          else R.add(dose, lx, 0.16 + reihe * 0.45, lz + off);
        }
      }
    }
    warenregal(1.4, d / 2 - 0.4, Math.PI, 'x');
    warenregal(w / 2 - 0.35, 0.4, -HALFPI, 'z');

    // EINZIGARTIG: Obst- und Gemüsekisten
    var obstFarben = [0xd94f4f, 0xe0a132, 0x6b8a3a, 0xd8951f];
    for (var kk = 0; kk < 4; kk++) {
      var lx = 1.2 + (kk % 2) * 0.9;
      var lz = -2.6 + Math.floor(kk / 2) * 0.75;
      var okiste = mkKiste(0.8, 0.28, 0.6, 0xc9a06a, false);
      R.put(okiste, lx, lz, 0, 0.86, 0.66);
      for (var o = 0; o < 8; o++) {
        var frucht = U.sph(0.07, 8, 6, flatM(obstFarben[kk], 0.8, 0), false);
        R.add(frucht, lx - 0.28 + (o % 4) * 0.19, 0.34 + (o > 3 ? 0.11 : 0), lz - 0.12 + (o > 3 ? 0.2 : 0));
      }
    }

    var zeitungsstaender = mkRegal(0.9, 1.1, 0.3, 3, 0x4a4f56, false);
    R.put(zeitungsstaender, -w / 2 + 0.35, -d / 2 + 2.6, HALFPI, 0.34, 0.96);
    for (var zt = 0; zt < 3; zt++) {
      var zeitung = U.box(0.02, 0.3, 0.24, paperM(), false);
      R.add(zeitung, -w / 2 + 0.42, 0.3 + zt * 0.34, -d / 2 + 2.6);
    }

    var tiefkuehltruhe = U.box(1.6, 0.9, 0.8, flatM(0xe8eef2, 0.4, 0.3));
    R.put(tiefkuehltruhe, -0.4, 1.4, 0, 1.66, 0.86);
    tiefkuehltruhe.position.y = 0.45;
    var truhenGlas = U.box(1.5, 0.03, 0.7, glassM(), false);
    R.add(truhenGlas, -0.4, 0.92, 1.4);

    R.put(mkPflanze(0.9, 0x8f959c), w / 2 - 0.6, -d / 2 + 0.7, 0, 0.44, 0.44);
    R.wand(mkUhr(0.22), 's', -2.8, 2.4);
    R.wand(mkBild(1.2, 0.5, 0xe0a132, 0x35a06b), 'w', 2.6, 2.3);
    R.add(mkDeckenlampe('roehre'), -1.6, R.h - 0.05, 0.6);
    R.add(mkDeckenlampe('roehre'), 2.2, R.h - 0.05, -1.2);
    R.licht(0xf6faff, 1.2, 15, 0, R.h - 0.6, 0);
  };

  /* ---------- 9. WIRTSHAUS ---------- */
  FURNISH.wirtshaus = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // EINZIGARTIG: Schank mit Zapfhahn und Flaschenregal
    var schank = U.box(4.0, 1.1, 0.75, woodM(0x6b4527));
    R.put(schank, -w / 2 + 2.4, d / 2 - 1.0, 0, 4.06, 0.8);
    schank.position.y = 0.55;
    var schankPlatte = U.box(4.2, 0.08, 0.9, woodM(0x8a5f36));
    R.add(schankPlatte, -w / 2 + 2.4, 1.14, d / 2 - 1.0);
    var fussleiste = U.cyl(0.035, 0.035, 3.9, 8, metalM(0xb9a06a), false);
    fussleiste.rotation.z = HALFPI;
    R.add(fussleiste, -w / 2 + 2.4, 0.2, d / 2 - 1.5);
    var zapfsockel = U.box(0.4, 0.1, 0.34, sharedM('chrome') || metalM(0xe8ecf0));
    R.add(zapfsockel, -w / 2 + 1.2, 1.22, d / 2 - 1.0);
    for (var zh = 0; zh < 2; zh++) {
      var saeuleZ = U.cyl(0.05, 0.055, 0.42, 12, sharedM('chrome') || metalM(0xe8ecf0));
      R.add(saeuleZ, -w / 2 + 1.05 + zh * 0.3, 1.45, d / 2 - 1.0);
      var bogen = U.cyl(0.035, 0.035, 0.3, 10, sharedM('chrome') || metalM(0xe8ecf0));
      bogen.rotation.x = HALFPI;
      R.add(bogen, -w / 2 + 1.05 + zh * 0.3, 1.62, d / 2 - 1.18);
      var griffZ = U.box(0.05, 0.24, 0.05, woodM(0x8a3b2e), false);
      R.add(griffZ, -w / 2 + 1.05 + zh * 0.3, 1.78, d / 2 - 1.0);
    }
    var flaschenbrett = mkWandregal(3.4, 0x6b4527, 0.3);
    R.add(flaschenbrett, -w / 2 + 2.4, 1.9, d / 2 - 0.2, Math.PI);
    var flaschenFarben = [0x3d6b46, 0x8a3b2e, 0x2f4d78, 0xc8a06a, 0x6b4a86];
    for (var fl = 0; fl < 12; fl++) {
      R.deko(mkFlasche(flaschenFarben[fl % 5], 0.3), -w / 2 + 0.9 + fl * 0.27, 1.94, d / 2 - 0.22);
    }
    var glaeserbrett = mkWandregal(2.6, 0x6b4527, 0.26);
    R.add(glaeserbrett, -w / 2 + 2.4, 2.5, d / 2 - 0.2, Math.PI);
    for (var gl = 0; gl < 8; gl++) {
      R.deko(mkKrug(0xd8951f), -w / 2 + 1.3 + gl * 0.32, 2.54, d / 2 - 0.24);
    }
    R.licht(0xffcf90, 0.7, 5.0, -w / 2 + 2.4, 2.2, d / 2 - 1.0);

    // EINZIGARTIG: Barhocker vor der Schank
    for (var bh = 0; bh < 4; bh++) {
      R.put(mkHocker(0x6b4527, 0.2, 0.78), -w / 2 + 1.0 + bh * 0.95, d / 2 - 2.0, 0, 0.44, 0.44);
    }

    // EINZIGARTIG: Stammtisch mit Eckbank und Schild
    var stammtisch = mkRundtisch(0.95, 0.76, 0x8a6a45);
    R.put(stammtisch, w / 2 - 2.0, d / 2 - 1.8, 0, 1.9, 1.9);
    R.deko(mkKrug(0xd8951f), w / 2 - 2.3, 0.78, d / 2 - 1.6);
    R.deko(mkKrug(0xd8951f), w / 2 - 1.7, 0.78, d / 2 - 2.0);
    R.deko(mkTeller(0xe8d8b8), w / 2 - 2.0, 0.78, d / 2 - 1.5);
    var stammschild = U.box(0.7, 0.2, 0.04, woodM(0x8a3b2e), false);
    R.add(stammschild, w / 2 - 2.0, 2.2, d / 2 - 0.12);
    for (var sb = 0; sb < 4; sb++) {
      var a = sb * Math.PI / 2 + 0.6;
      R.put(mkStuhl(0x8a6a45, 0x6b7a4a), w / 2 - 2.0 + Math.sin(a) * 1.35, d / 2 - 1.8 + Math.cos(a) * 1.35, a + Math.PI, 0.48, 0.48);
    }

    // EINZIGARTIG: Kegelbahn-Anzeigetafel und Dartscheibe
    var tafelW = U.box(1.0, 0.7, 0.05, flatM(0x2f4a3a, 0.95, 0), false);
    R.add(tafelW, -w / 2 + 0.2, 1.8, -1.6, HALFPI);
    for (var st = 0; st < 4; st++) {
      var strichW = U.box(0.01, 0.24, 0.03, flatM(0xf0f4f6, 0.9, 0), false);
      R.add(strichW, -w / 2 + 0.15, 1.8, -1.9 + st * 0.16);
    }
    var dart = U.cyl(0.22, 0.22, 0.05, 20, flatM(0x2f343a, 0.9, 0), false);
    dart.rotation.z = HALFPI;
    R.add(dart, w / 2 - 0.14, 1.75, -2.4);
    var dartRing = U.torus(0.22, 0.025, 6, 20, flatM(0xd94f4f, 0.85, 0), false);
    dartRing.rotation.y = HALFPI;
    R.add(dartRing, w / 2 - 0.16, 1.75, -2.4);

    // Gasttische
    function gasttisch(lx, lz) {
      R.put(mkTisch(1.3, 0.9, 0.76, 0x8a6a45), lx, lz, 0, 1.35, 0.95);
      R.deko(mkKrug(0xd8951f), lx - 0.3, 0.78, lz);
      R.deko(mkTeller(0xe8d8b8), lx + 0.3, 0.78, lz - 0.1);
      R.put(mkStuhl(0x8a6a45, 0x6b7a4a), lx - 0.3, lz - 0.85, 0, 0.48, 0.48);
      R.put(mkStuhl(0x8a6a45, 0x6b7a4a), lx + 0.3, lz + 0.85, Math.PI, 0.48, 0.48);
    }
    gasttisch(-1.4, -1.2);
    gasttisch(1.8, -1.4);
    gasttisch(-3.0, -3.0);

    R.put(mkFass(0.34, 1.0, 0x8a5f36), w / 2 - 0.7, 2.6, 0, 0.72, 0.72);
    R.put(mkGarderobenstaender(), -w / 2 + 0.6, -d / 2 + 0.9, 0, 0.5, 0.5);

    R.wand(mkUhr(0.28), 'o', 1.6, 2.4);
    R.wand(mkBild(1.2, 0.8, 0x5c4326, 0x6a7a4a), 'n', w / 2 - 4.6, 2.5);
    R.wand(mkBild(0.7, 0.9, 0x5c4326, 0x8a6a4a), 's', -2.0, 2.0);
    R.add(mkDeckenlampe('luster'), 0.4, R.h - 0.05, 0.6);
    R.add(mkDeckenlampe('haenge', 0xe8c88a), -2.6, R.h - 0.05, -2.2);
    R.licht(0xffcf90, 1.15, 16, 0, R.h - 1.0, 0);
  };

  // Garderobenständer — Wirtshaus und Bibliothek.
  function mkGarderobenstaender() {
    var U = GTA.U, g = new THREE.Group();
    var fuss = U.cyl(0.24, 0.28, 0.06, 14, woodM(0x6b4527));
    fuss.position.y = 0.03;
    g.add(fuss);
    var stange = U.cyl(0.045, 0.05, 1.8, 10, woodM(0x6b4527));
    stange.position.y = 0.9;
    g.add(stange);
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2;
      var arm = U.cyl(0.02, 0.02, 0.24, 6, woodM(0x6b4527), false);
      arm.rotation.z = HALFPI;
      arm.rotation.y = a;
      arm.position.set(Math.sin(a) * 0.11, 1.74, Math.cos(a) * 0.11);
      g.add(arm);
      var knauf = U.sph(0.035, 8, 6, woodM(0x8a5f36), false);
      knauf.position.set(Math.sin(a) * 0.22, 1.76, Math.cos(a) * 0.22);
      g.add(knauf);
    }
    var mantel = U.cyl(0.16, 0.24, 0.9, 10, clothM(0x2f3a4a));
    mantel.position.set(0.18, 1.2, 0);
    g.add(mantel);
    var hut = U.cyl(0.14, 0.15, 0.14, 12, clothM(0x3d4a2f), false);
    hut.position.set(-0.18, 1.78, 0);
    g.add(hut);
    var krempe = U.cyl(0.24, 0.24, 0.02, 14, clothM(0x3d4a2f), false);
    krempe.position.set(-0.18, 1.72, 0);
    g.add(krempe);
    return g;
  }

  /* ---------- 10. ATELIER ---------- */
  FURNISH.atelier = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // EINZIGARTIG: Staffelei mit angefangenem Bild
    var staffelBeine = [-0.35, 0.35, 0];
    for (var sb = 0; sb < 3; sb++) {
      var beinS = U.box(0.06, 1.8, 0.06, woodM(0xc9a06a));
      beinS.rotation.x = sb === 2 ? -0.28 : 0.16;
      beinS.rotation.z = sb === 2 ? 0 : (sb ? -0.1 : 0.1);
      R.add(beinS, 0.0 + staffelBeine[sb], 0.9, -1.6 + (sb === 2 ? -0.32 : 0.12));
    }
    var staffelAblage = U.box(0.9, 0.07, 0.14, woodM(0xc9a06a));
    R.add(staffelAblage, 0, 0.9, -1.55);
    var leinwand = U.box(0.86, 1.0, 0.05, flatM(0xf2ece0, 0.9, 0));
    R.add(leinwand, 0, 1.45, -1.62);
    var motiv1 = U.box(0.66, 0.34, 0.02, flatM(0x4a7a9a, 0.85, 0), false);
    R.add(motiv1, 0, 1.62, -1.66);
    var motiv2 = U.box(0.6, 0.26, 0.02, flatM(0x6b8a4a, 0.85, 0), false);
    R.add(motiv2, 0, 1.3, -1.66);
    R.block(0, -1.6, 1.0, 0.7);

    // EINZIGARTIG: Farbtisch mit Palette und Tuben
    var farbtisch = mkTisch(1.3, 0.7, 0.82, 0x8a6a45);
    R.put(farbtisch, w / 2 - 0.6, 2.0, -HALFPI, 0.75, 1.35);
    var palette = U.cyl(0.22, 0.22, 0.02, 16, woodM(0xd8b46a), false);
    palette.rotation.x = HALFPI;
    palette.scale.set(1.4, 1, 1);
    R.add(palette, w / 2 - 0.6, 0.85, 2.0);
    var tubenFarben = [0xd94f4f, 0x3a7bd5, 0xe0a132, 0x35a06b, 0x8e5bc4, 0xf0f4f6, 0x1a1c20];
    for (var tf = 0; tf < 7; tf++) {
      var tube = U.cyl(0.022, 0.026, 0.13, 8, flatM(tubenFarben[tf], 0.65, 0.15), false);
      tube.rotation.z = HALFPI;
      R.add(tube, w / 2 - 0.85, 0.88, 1.55 + tf * 0.12);
    }
    var pinselbecher = U.cyl(0.06, 0.055, 0.14, 10, flatM(0xdfe6ea, 0.4, 0.2));
    R.add(pinselbecher, w / 2 - 0.35, 0.9, 2.3);
    for (var pb = 0; pb < 5; pb++) {
      var pinsel = U.cyl(0.008, 0.008, 0.3, 6, woodM(0xc9a06a), false);
      pinsel.rotation.x = (pb - 2) * 0.06;
      R.add(pinsel, w / 2 - 0.35 + (pb - 2) * 0.02, 1.06, 2.3);
    }

    // EINZIGARTIG: Gerahmte Bilderstapel an der Wand
    for (var bs = 0; bs < 5; bs++) {
      var rahmenS = U.box(0.06, 0.9 + (bs % 2) * 0.3, 0.7 + (bs % 3) * 0.2,
        woodM([0x6b4527, 0x8a5f36, 0xc9a06a][bs % 3]));
      R.add(rahmenS, -w / 2 + 0.35 + bs * 0.07, 0.48 + (bs % 2) * 0.15, -1.0 + bs * 0.1);
      rahmenS.rotation.z = 0.1;
    }
    R.block(-w / 2 + 0.5, -0.8, 0.6, 1.4);

    // EINZIGARTIG: Podest für Modelle
    var podest = U.cyl(0.7, 0.75, 0.4, 16, woodM(0x8a6a45));
    R.put(podest, -2.2, d / 2 - 1.6, 0, 1.5, 1.5);
    podest.position.y = 0.2;
    var tuchDrapiert = U.sph(0.5, 12, 8, clothM(0xd94f4f), false);
    tuchDrapiert.scale.set(1.5, 0.5, 1.4);
    R.add(tuchDrapiert, -2.2, 0.5, d / 2 - 1.6);
    var buesteKopf = U.sph(0.18, 12, 10, flatM(0xe8e2d4, 0.7, 0));
    R.add(buesteKopf, -2.2, 1.05, d / 2 - 1.6);
    var buesteHals = U.cyl(0.12, 0.2, 0.34, 12, flatM(0xe8e2d4, 0.7, 0));
    R.add(buesteHals, -2.2, 0.72, d / 2 - 1.6);

    var werkbankA = mkTisch(2.0, 0.8, 0.8, 0x8a6a45);
    R.put(werkbankA, 1.6, d / 2 - 0.55, Math.PI, 2.05, 0.85);
    R.deko(mkFlasche(0xc8b48a, 0.3), 1.0, 0.82, d / 2 - 0.55);
    R.deko(mkFlasche(0x8a9a6a, 0.26), 2.3, 0.82, d / 2 - 0.55);
    R.deko(mkBuchstapel(3, 0.18), 1.8, 0.82, d / 2 - 0.75);

    var materialregal = mkRegal(1.6, 2.2, 0.4, 5, 0x8a6a45, false);
    R.put(materialregal, w / 2 - 0.32, -1.4, -HALFPI, 0.44, 1.66);

    R.put(mkHocker(0x8a6a45, 0.2, 0.62), -0.9, -2.5, 0, 0.44, 0.44);
    R.put(mkPflanze(1.35, 0xa8563c), -w / 2 + 0.6, d / 2 - 0.6, 0, 0.52, 0.52);
    R.add(mkTeppich(2.4, 1.8, 0x6a6a5a), 1.2, 0, -2.2);

    R.wand(mkBild(1.0, 1.3, 0x8a5f36, 0x9a7a6a), 's', 2.6, 1.7);
    R.wand(mkVorhang(1.5, 1.6, 0xe8e2d4), 'w', 1.9, 2.6);
    R.add(mkDeckenlampe('roehre'), 0, R.h - 0.05, -0.6);
    R.add(mkDeckenlampe('roehre'), 0, R.h - 0.05, 1.8);
    R.licht(0xf8fbff, 1.15, 14, 0, R.h - 0.6, 0);
  };

  /* ---------- 11. JAGDHÜTTE ---------- */
  FURNISH.jagdhuette = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // EINZIGARTIG: Hirschgeweih-Sammlung an der Nordwand
    function geweih(lx, ly, groesse) {
      var gg = new THREE.Group();
      var schild = U.box(0.34 * groesse, 0.4 * groesse, 0.05, woodM(0x6b4527), false);
      gg.add(schild);
      var schaedel = U.sph(0.1 * groesse, 10, 8, flatM(0xe4dcc8, 0.8, 0), false);
      schaedel.scale.set(0.8, 1.1, 1.2);
      schaedel.position.z = 0.08;
      gg.add(schaedel);
      for (var s = 0; s < 2; s++) {
        var sgn = s ? 1 : -1;
        var stange = U.cyl(0.018 * groesse, 0.026 * groesse, 0.5 * groesse, 6, flatM(0xa88a5a, 0.85, 0), false);
        stange.position.set(sgn * 0.1 * groesse, 0.28 * groesse, 0.08);
        stange.rotation.z = -sgn * 0.42;
        gg.add(stange);
        for (var e = 0; e < 3; e++) {
          var ende = U.cyl(0.011 * groesse, 0.015 * groesse, 0.2 * groesse, 5, flatM(0xa88a5a, 0.85, 0), false);
          ende.position.set(sgn * (0.16 + e * 0.07) * groesse, (0.22 + e * 0.14) * groesse, 0.08);
          ende.rotation.z = -sgn * (0.9 + e * 0.15);
          gg.add(ende);
        }
      }
      R.add(gg, lx, ly, d / 2 - 0.1, Math.PI);
    }
    geweih(-2.6, 2.0, 1.0);
    geweih(-1.2, 2.2, 1.3);
    geweih(0.3, 2.0, 0.85);
    geweih(1.8, 2.15, 1.1);

    // EINZIGARTIG: Gewehrschrank mit Glasfront
    var gschrank = U.box(1.1, 2.05, 0.45, woodM(0x5c4326));
    R.put(gschrank, w / 2 - 0.4, -1.2, 0, 0.52, 1.16);
    gschrank.position.y = 1.03;
    var gGlas = U.box(0.04, 1.5, 0.9, glassM(), false);
    R.add(gGlas, w / 2 - 0.62, 1.2, -1.2);
    for (var gw = 0; gw < 3; gw++) {
      var lauf = U.cyl(0.018, 0.018, 0.95, 8, metalM(0x3a3f46), false);
      R.add(lauf, w / 2 - 0.45, 1.45, -1.55 + gw * 0.34);
      var schaft = U.box(0.07, 0.5, 0.09, woodM(0x6b4527), false);
      R.add(schaft, w / 2 - 0.45, 0.85, -1.55 + gw * 0.34);
    }
    var gSchloss = U.box(0.05, 0.1, 0.08, metalM(0xb9a06a), false);
    R.add(gSchloss, w / 2 - 0.62, 1.05, -0.75);

    // EINZIGARTIG: Offener Kamin mit Feuer
    var kaminKorpus = U.box(1.7, 1.5, 0.7, sharedM('brick') || flatM(0x8d5a48, 0.9, 0));
    R.put(kaminKorpus, -w / 2 + 1.1, d / 2 - 0.55, 0, 1.76, 0.76);
    kaminKorpus.position.y = 0.75;
    var kaminOeffnung = U.box(1.0, 0.85, 0.3, flatM(0x14161a, 0.95, 0), false);
    R.add(kaminOeffnung, -w / 2 + 1.1, 0.45, d / 2 - 0.85);
    for (var sc = 0; sc < 5; sc++) {
      var scheit = U.cyl(0.06, 0.07, 0.6, 7, woodM(0x5c4326), false);
      scheit.rotation.z = HALFPI;
      scheit.rotation.y = (sc - 2) * 0.24;
      R.add(scheit, -w / 2 + 1.1, 0.16 + (sc % 2) * 0.1, d / 2 - 0.85 + (sc - 2) * 0.05);
    }
    var feuer = U.cone(0.28, 0.5, 8, glowM(0xff8a2a, 1.8), false);
    R.add(feuer, -w / 2 + 1.1, 0.42, d / 2 - 0.85);
    var kaminSims = U.box(1.9, 0.12, 0.36, woodM(0x5c4326));
    R.add(kaminSims, -w / 2 + 1.1, 1.55, d / 2 - 0.68);
    R.deko(mkFlasche(0x6b4a2a, 0.3), -w / 2 + 0.6, 1.61, d / 2 - 0.68);
    R.deko(mkUhr(0.16), -w / 2 + 1.6, 1.78, d / 2 - 0.68);
    R.licht(0xff8a3a, 1.1, 6.5, -w / 2 + 1.1, 0.7, d / 2 - 1.2);

    // EINZIGARTIG: Bärenfell vor dem Kamin
    var fell = U.cyl(0.9, 0.9, 0.03, 18, clothM(0x6b5030), false);
    fell.scale.set(1, 1, 1.25);
    R.add(fell, -1.8, 0.02, 1.2);
    var fellKopf = U.sph(0.26, 12, 10, clothM(0x6b5030), false);
    fellKopf.scale.y = 0.35;
    R.add(fellKopf, -1.8, 0.06, 2.3);
    for (var oh = 0; oh < 2; oh++) {
      var ohrF = U.sph(0.09, 8, 6, clothM(0x5a4228), false);
      ohrF.scale.y = 0.35;
      R.add(ohrF, -1.8 + (oh ? 0.18 : -0.18), 0.07, 2.5);
    }

    var jagdtisch = mkTisch(1.7, 0.95, 0.76, 0x6b4527);
    R.put(jagdtisch, 0.6, -1.5, 0, 1.75, 1.0);
    R.deko(mkFlasche(0x8a5a2a, 0.3), 0.2, 0.78, -1.5);
    R.deko(mkBecher(0xd8c8a8), 0.9, 0.78, -1.3);
    R.deko(mkBecher(0xd8c8a8), 1.2, 0.78, -1.7);
    R.put(mkBank(1.6, 0x6b4527, 0x6b7a4a), 0.6, -2.6, 0, 1.64, 0.55);
    R.put(mkStuhl(0x6b4527), 0.6, -0.5, Math.PI, 0.48, 0.48);

    var vorratsregal = mkRegal(1.4, 1.8, 0.36, 4, 0x6b4527, false);
    R.put(vorratsregal, -w / 2 + 0.32, -2.0, HALFPI, 0.4, 1.46);
    for (var vr = 0; vr < 5; vr++) {
      R.deko(mkFlasche(0x3d6b46, 0.24), -w / 2 + 0.38, 0.36 + (vr % 3) * 0.44, -2.5 + vr * 0.24);
    }

    R.put(mkKiste(0.8, 0.6, 0.6, 0x5c4326, true), 3.2, 2.2, 0.2, 0.9, 0.7);
    R.wand(mkBild(0.9, 0.7, 0x5c4326, 0x4a6b4a), 'o', 2.0, 2.1);
    R.add(mkDeckenlampe('haenge', 0xd8b88a), 0.6, R.h - 0.05, -1.0);
    R.licht(0xffc98a, 0.95, 12, 0, R.h - 0.9, -0.6);
  };

  /* ---------- 12. WASCHKÜCHE ---------- */
  FURNISH.waschkueche = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // EINZIGARTIG: Waschmaschine und Trockner nebeneinander
    function maschine(lx, lz, farbe, trockner) {
      var korpus = U.box(0.66, 0.86, 0.64, flatM(farbe, 0.4, 0.3));
      R.put(korpus, lx, lz, 0, 0.7, 0.68);
      korpus.position.y = 0.43;
      var blende = U.box(0.62, 0.16, 0.03, flatM(0xdfe6ea, 0.4, 0.2), false);
      R.add(blende, lx, 0.76, lz - 0.33);
      var knopf = U.cyl(0.05, 0.05, 0.03, 12, flatM(0x3a3f46, 0.5, 0.3), false);
      knopf.rotation.x = HALFPI;
      R.add(knopf, lx - 0.2, 0.76, lz - 0.35);
      var led = U.box(0.16, 0.03, 0.02, glowM(trockner ? 0xff8a3a : 0x4affa0, 1.2), false);
      R.add(led, lx + 0.12, 0.76, lz - 0.35);
      var luke = U.cyl(0.21, 0.21, 0.05, 20, flatM(0x8f959c, 0.4, 0.5), false);
      luke.rotation.x = HALFPI;
      R.add(luke, lx, 0.42, lz - 0.33);
      var lukenglas = U.cyl(0.17, 0.17, 0.03, 20, glassM(), false);
      lukenglas.rotation.x = HALFPI;
      R.add(lukenglas, lx, 0.42, lz - 0.36);
    }
    maschine(-2.4, d / 2 - 0.5, 0xf0f4f6, false);
    maschine(-1.6, d / 2 - 0.5, 0xdfe6ea, true);

    // EINZIGARTIG: Waschtrog aus Beton mit Waschbrett
    var trog = U.box(1.2, 0.5, 0.7, flatM(0xb8bcc0, 0.85, 0));
    R.put(trog, 0.4, d / 2 - 0.5, 0, 1.26, 0.76);
    trog.position.y = 0.65;
    var trogInnen = U.box(1.0, 0.3, 0.54, flatM(0x9aa0a6, 0.8, 0), false);
    R.add(trogInnen, 0.4, 0.78, d / 2 - 0.5);
    for (var tb = 0; tb < 4; tb++) {
      var beinT = U.box(0.09, 0.4, 0.09, metalM(0x6b7078));
      R.add(beinT, 0.4 + (tb < 2 ? -0.5 : 0.5), 0.2, d / 2 - 0.5 + ((tb % 2) ? 0.28 : -0.28));
    }
    var wbrett = U.box(0.4, 0.6, 0.04, woodM(0xc9a06a));
    wbrett.rotation.x = -0.4;
    R.add(wbrett, 0.4, 1.0, d / 2 - 0.72);
    var trogHahn = U.cyl(0.016, 0.016, 0.24, 8, sharedM('chrome') || metalM(0xe8ecf0));
    R.add(trogHahn, 0.4, 1.1, d / 2 - 0.16);

    // EINZIGARTIG: Wäscheleine quer durch den Raum
    var leine = U.cyl(0.008, 0.008, w - 1.2, 6, flatM(0xe8e2d4, 0.9, 0), false);
    leine.rotation.z = HALFPI;
    R.add(leine, 0, 2.05, -0.4);
    var waescheFarben = [0xdfe6ea, 0x3a7bd5, 0xd94f4f, 0xe0a132, 0xf0f4f6, 0x35a06b];
    for (var wl = 0; wl < 6; wl++) {
      var stueck = U.box(0.42, 0.55, 0.03, clothM(waescheFarben[wl]), false);
      R.add(stueck, -2.4 + wl * 0.95, 1.74, -0.4);
      var klammer = U.box(0.03, 0.07, 0.05, woodM(0xc9a06a), false);
      R.add(klammer, -2.55 + wl * 0.95, 2.03, -0.4);
    }

    // EINZIGARTIG: Bügelbrett
    var bbPlatte = U.box(1.3, 0.05, 0.4, clothM(0xdfe6ea));
    R.put(bbPlatte, w / 2 - 0.7, -1.6, -HALFPI, 0.44, 1.34);
    bbPlatte.position.y = 0.86;
    for (var bb = 0; bb < 2; bb++) {
      var beinB = U.box(0.05, 0.9, 0.05, metalM(0x8f959c), false);
      beinB.rotation.x = bb ? 0.24 : -0.24;
      R.add(beinB, w / 2 - 0.7, 0.44, -1.6 + (bb ? 0.35 : -0.35));
    }
    var buegeleisen = U.box(0.14, 0.11, 0.26, flatM(0x2f343a, 0.4, 0.4), false);
    R.add(buegeleisen, w / 2 - 0.7, 0.94, -2.0);
    var eisenGriff = U.torus(0.07, 0.02, 6, 12, flatM(0x2f343a, 0.6, 0.2), false);
    eisenGriff.rotation.y = HALFPI;
    R.add(eisenGriff, w / 2 - 0.7, 1.04, -2.0);

    var regalW = mkRegal(1.2, 1.6, 0.32, 4, 0xdfe6ea, false);
    R.put(regalW, -w / 2 + 0.3, -1.5, HALFPI, 0.36, 1.26);
    for (var ws = 0; ws < 5; ws++) {
      var kanister = U.box(0.2, 0.26, 0.16, flatM([0x3a7bd5, 0xd94f4f, 0x35a06b, 0xe0a132, 0x8e5bc4][ws], 0.7, 0.05), false);
      R.add(kanister, -w / 2 + 0.36, 0.28 + (ws % 3) * 0.4, -1.9 + (ws > 2 ? 0.9 : 0) + (ws % 3) * 0.02);
    }

    // Wäschekörbe
    for (var wk = 0; wk < 2; wk++) {
      var korbW = U.cyl(0.34, 0.28, 0.44, 14, woodM(0xc9a06a));
      R.put(korbW, -2.6 + wk * 0.9, -2.5, 0, 0.7, 0.7);
      korbW.position.y = 0.22;
      var inhalt = U.sph(0.3, 10, 8, clothM(wk ? 0x3a7bd5 : 0xdfe6ea), false);
      inhalt.scale.y = 0.45;
      R.add(inhalt, -2.6 + wk * 0.9, 0.46, -2.5);
    }

    R.put(mkWaschbecken(), 2.6, d / 2 - 0.5, 0, 0.56, 0.44);
    R.wand(mkSpiegel(0.5, 0.6, 0xdfe6ea), 'n', 2.6, 1.6);
    R.put(mkKiste(0.6, 0.5, 0.45, 0x8a6a45, false), 3.2, -2.4, 0, 0.66, 0.5);
    R.wand(mkUhr(0.18), 'w', 1.8, 2.0);
    R.add(mkDeckenlampe('roehre'), 0, R.h - 0.05, 0.8);
    R.licht(0xeef6ff, 1.0, 11, 0, R.h - 0.6, 0);
  };

  /* ---------- 13. MUSIKZIMMER ---------- */
  FURNISH.musikzimmer = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    R.add(mkTeppich(3.6, 2.6, 0x6a4a6a), 0.4, 0, -0.4);

    // EINZIGARTIG: Klavier mit Tastatur, Deckel und Pedalen
    var klavierM = flatM(0x14161a, 0.28, 0.25);
    var korpusK = U.box(1.55, 1.15, 0.66, klavierM);
    R.put(korpusK, -w / 2 + 1.3, d / 2 - 0.6, 0, 1.62, 0.72);
    korpusK.position.y = 0.58;
    var deckelK = U.box(1.6, 0.07, 0.7, klavierM);
    R.add(deckelK, -w / 2 + 1.3, 1.18, d / 2 - 0.6);
    var deckelOffen = U.box(1.5, 0.05, 0.6, klavierM);
    deckelOffen.rotation.x = -0.5;
    R.add(deckelOffen, -w / 2 + 1.3, 1.42, d / 2 - 0.42);
    var tastenbrett = U.box(1.42, 0.09, 0.28, flatM(0x2a2d33, 0.4, 0.2));
    R.add(tastenbrett, -w / 2 + 1.3, 0.78, d / 2 - 1.02);
    for (var t = 0; t < 22; t++) {
      var taste = U.box(0.06, 0.02, 0.24, flatM(0xf6f2e6, 0.35, 0.05), false);
      R.add(taste, -w / 2 + 0.62 + t * 0.064, 0.835, d / 2 - 1.02);
      if (t % 7 !== 2 && t % 7 !== 6 && t < 21) {
        var schwarz = U.box(0.034, 0.03, 0.15, flatM(0x14161a, 0.35, 0.1), false);
        R.add(schwarz, -w / 2 + 0.652 + t * 0.064, 0.855, d / 2 - 1.07);
      }
    }
    var notenpult = U.box(1.2, 0.35, 0.03, woodM(0x2a2d33), false);
    notenpult.rotation.x = 0.28;
    R.add(notenpult, -w / 2 + 1.3, 1.05, d / 2 - 0.78);
    var noten = U.box(0.5, 0.3, 0.01, paperM(), false);
    noten.rotation.x = 0.28;
    R.add(noten, -w / 2 + 1.3, 1.08, d / 2 - 0.81);
    for (var pd = 0; pd < 3; pd++) {
      var pedal = U.box(0.06, 0.02, 0.14, metalM(0xb9a06a), false);
      R.add(pedal, -w / 2 + 1.16 + pd * 0.14, 0.09, d / 2 - 0.92);
    }
    R.put(mkHocker(0x2a2d33, 0.22, 0.52), -w / 2 + 1.3, d / 2 - 1.7, 0, 0.48, 0.48);

    // EINZIGARTIG: Kontrabass auf Ständer
    var bassKorpus = U.sph(0.32, 14, 12, woodM(0xa8763f));
    bassKorpus.scale.set(0.7, 1.55, 0.45);
    R.put(bassKorpus, w / 2 - 0.9, 1.9, 0, 0.6, 0.5);
    bassKorpus.position.y = 0.85;
    var bassHals = U.box(0.08, 1.0, 0.06, woodM(0x5c4326));
    R.add(bassHals, w / 2 - 0.9, 1.85, 1.9);
    var bassKopf = U.box(0.11, 0.24, 0.08, woodM(0x5c4326), false);
    R.add(bassKopf, w / 2 - 0.9, 2.4, 1.9);
    for (var sa = 0; sa < 4; sa++) {
      var saite = U.cyl(0.005, 0.005, 1.5, 4, sharedM('chrome') || metalM(0xe8ecf0), false);
      R.add(saite, w / 2 - 0.95 + sa * 0.033, 1.5, 1.86);
    }
    var stachel = U.cyl(0.02, 0.02, 0.3, 6, metalM(0x8f959c), false);
    R.add(stachel, w / 2 - 0.9, 0.15, 1.9);

    // EINZIGARTIG: Notenständer
    var nsFuss = U.cyl(0.02, 0.03, 1.1, 8, metalM(0x3a3f46));
    R.put(nsFuss, 0.8, -1.8, 0, 0.4, 0.4);
    nsFuss.position.y = 0.55;
    for (var nf = 0; nf < 3; nf++) {
      var a = nf * Math.PI * 2 / 3;
      var nbein = U.cyl(0.012, 0.012, 0.34, 5, metalM(0x3a3f46), false);
      nbein.rotation.z = Math.sin(a) * 0.5;
      nbein.rotation.x = -Math.cos(a) * 0.5;
      R.add(nbein, 0.8 + Math.sin(a) * 0.12, 0.16, -1.8 + Math.cos(a) * 0.12);
    }
    var nPult = U.box(0.5, 0.36, 0.02, metalM(0x3a3f46), false);
    nPult.rotation.x = 0.35;
    R.add(nPult, 0.8, 1.16, -1.8);
    var nBlatt = U.box(0.4, 0.3, 0.01, paperM(), false);
    nBlatt.rotation.x = 0.35;
    R.add(nBlatt, 0.8, 1.2, -1.83);

    // EINZIGARTIG: Grammophon mit Trichter
    var gramKiste = U.box(0.44, 0.3, 0.44, woodM(0x6b4527));
    var gramTisch = mkTisch(0.8, 0.6, 0.72, 0x6b4527);
    R.put(gramTisch, w / 2 - 0.6, -2.4, -HALFPI, 0.65, 0.85);
    R.add(gramKiste, w / 2 - 0.6, 0.87, -2.4);
    var gramTeller = U.cyl(0.16, 0.16, 0.02, 18, flatM(0x2a2d33, 0.5, 0.2), false);
    R.add(gramTeller, w / 2 - 0.6, 1.03, -2.4);
    var trichter = U.cone(0.28, 0.55, 14, metalM(0xb9a06a));
    trichter.rotation.z = -0.9;
    R.add(trichter, w / 2 - 0.95, 1.35, -2.4);
    var trichterHals = U.cyl(0.03, 0.05, 0.3, 8, metalM(0xb9a06a), false);
    trichterHals.rotation.z = -0.9;
    R.add(trichterHals, w / 2 - 0.68, 1.14, -2.4);

    var notenschrank = mkSchrank(1.4, 1.5, 0.45, 0x7d5530, 2);
    R.put(notenschrank, -w / 2 + 0.42, -2.0, HALFPI, 0.5, 1.46);
    R.deko(mkBuchstapel(4, 0.2), -w / 2 + 0.5, 1.56, -2.0);

    var lauschsessel = mkSessel(0x5a4a6a, 0x6d5a7d);
    R.put(lauschsessel, 2.8, 1.6, -2.2, 0.9, 0.9);
    var beistelltisch = mkTisch(0.5, 0.5, 0.5, 0x7d5530);
    R.put(beistelltisch, 2.0, 2.4, 0, 0.55, 0.55);
    R.deko(mkBecher(0xe8dcc0), 2.0, 0.52, 2.4);

    R.put(mkStehlampe(0xe8d0c0, 1.55), w / 2 - 0.8, 3.0, 0, 0.44, 0.44);
    R.put(mkPflanze(1.0, 0x6a4a6a), -w / 2 + 0.6, 2.6, 0, 0.46, 0.46);

    R.wand(mkBild(1.0, 0.7, 0x6b4527, 0x7a6a8a), 's', 2.4, 2.0);
    R.wand(mkBild(0.6, 0.8, 0x6b4527, 0x8a7a6a), 'w', 0.6, 2.1);
    R.wand(mkVorhang(1.5, 1.6, 0x7a4a5a), 'o', -0.2, 2.6);
    R.add(mkDeckenlampe('luster'), 0.4, R.h - 0.05, -0.4);
    R.licht(0xffe2bc, 1.05, 14, 0.4, R.h - 1.0, -0.4);
  };

  /* ---------- 14. BIBLIOTHEK ---------- */
  FURNISH.bibliothek = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    R.add(mkTeppich(3.8, 2.8, 0x6a3a3a), 0, 0, -0.2);

    // EINZIGARTIG: Bücherwände an drei Seiten
    R.put(mkRegal(3.2, 2.7, 0.38, 6, 0x5c4326, true), -w / 2 + 0.3, 1.2, HALFPI, 0.42, 3.26);
    R.put(mkRegal(2.4, 2.7, 0.38, 6, 0x5c4326, true), -w / 2 + 0.3, -2.2, HALFPI, 0.42, 2.46);
    R.put(mkRegal(3.4, 2.7, 0.38, 6, 0x5c4326, true), -1.4, d / 2 - 0.3, Math.PI, 3.46, 0.42);
    R.put(mkRegal(3.2, 2.7, 0.38, 6, 0x5c4326, true), w / 2 - 0.3, 0.8, -HALFPI, 0.42, 3.26);

    // EINZIGARTIG: Rollleiter an der Bücherwand
    var leiterM = woodM(0x8a5f36);
    for (var hb = 0; hb < 2; hb++) {
      var holm = U.box(0.07, 2.5, 0.07, leiterM);
      holm.rotation.x = 0.16;
      R.add(holm, -w / 2 + 0.85, 1.25, 0.4 + (hb ? 0.5 : -0.5));
    }
    for (var sp = 0; sp < 7; sp++) {
      var sprosseB = U.cyl(0.025, 0.025, 0.5, 8, leiterM, false);
      sprosseB.rotation.x = HALFPI;
      R.add(sprosseB, -w / 2 + 0.85, 0.28 + sp * 0.34, 0.4 - sp * 0.055);
    }
    R.block(-w / 2 + 0.85, 0.4, 0.24, 1.1);

    // EINZIGARTIG: Globus auf Holzständer
    var globusFuss = U.cyl(0.24, 0.28, 0.06, 16, woodM(0x6b4527));
    R.put(globusFuss, 2.8, -2.4, 0, 0.6, 0.6);
    globusFuss.position.y = 0.03;
    var globusSaeule = U.cyl(0.05, 0.06, 0.7, 10, woodM(0x6b4527));
    R.add(globusSaeule, 2.8, 0.4, -2.4);
    var globusRing = U.torus(0.3, 0.02, 6, 20, metalM(0xb9a06a), false);
    globusRing.rotation.y = 0.4;
    R.add(globusRing, 2.8, 1.05, -2.4);
    var kugel = U.sph(0.27, 18, 14, flatM(0x4a7a9a, 0.7, 0.05));
    kugel.rotation.z = 0.4;
    R.add(kugel, 2.8, 1.05, -2.4);
    for (var kn = 0; kn < 5; kn++) {
      var kontinent = U.sph(0.09 + (kn % 3) * 0.04, 8, 6, flatM(0x6b8a4a, 0.85, 0), false);
      kontinent.scale.set(1.4, 0.8, 0.35);
      var ka = kn * 1.3;
      kontinent.position.set(2.8 + Math.sin(ka) * 0.24, 1.05 + Math.cos(kn * 0.9) * 0.14, -2.4 + Math.cos(ka) * 0.24);
      kontinent.lookAt(2.8, 1.05, -2.4);
      R.group.add(kontinent);
    }

    // EINZIGARTIG: Lesepult mit aufgeschlagenem Folianten
    var pultFuss = U.box(0.5, 0.08, 0.5, woodM(0x5c4326));
    R.put(pultFuss, -1.0, -2.6, 0, 0.6, 0.6);
    pultFuss.position.y = 0.04;
    var pultSaeule = U.box(0.14, 1.05, 0.14, woodM(0x5c4326));
    R.add(pultSaeule, -1.0, 0.55, -2.6);
    var pultPlatte = U.box(0.7, 0.06, 0.5, woodM(0x8a5f36));
    pultPlatte.rotation.x = 0.4;
    R.add(pultPlatte, -1.0, 1.12, -2.6);
    var foliantL = U.box(0.32, 0.05, 0.44, paperM(), false);
    foliantL.rotation.x = 0.4;
    foliantL.rotation.z = 0.05;
    R.add(foliantL, -1.17, 1.18, -2.62);
    var foliantR = U.box(0.32, 0.05, 0.44, paperM(), false);
    foliantR.rotation.x = 0.4;
    foliantR.rotation.z = -0.05;
    R.add(foliantR, -0.83, 1.18, -2.62);

    // EINZIGARTIG: Ohrensessel-Leseecke mit Stehlampe
    var ohrensessel = mkSessel(0x6a3a3a, 0x7d4a4a);
    R.put(ohrensessel, 2.6, 1.6, -2.5, 0.92, 0.92);
    var ohrL = U.box(0.14, 0.5, 0.26, clothM(0x6a3a3a));
    R.add(ohrL, 2.28, 1.2, 1.32, -2.5);
    var ohrR = U.box(0.14, 0.5, 0.26, clothM(0x6a3a3a));
    R.add(ohrR, 2.92, 1.2, 1.88, -2.5);
    var fusshocker = U.box(0.5, 0.34, 0.42, clothM(0x6a3a3a));
    R.put(fusshocker, 1.9, 0.8, 0, 0.56, 0.48);
    fusshocker.position.y = 0.17;

    var lesetisch = mkRundtisch(0.5, 0.62, 0x5c4326);
    R.put(lesetisch, 3.4, 2.6, 0, 1.05, 1.05);
    R.deko(mkBuchstapel(3, 0.16), 3.4, 0.64, 2.6);
    R.deko(mkTischlampe(0x3d6b46), 3.1, 0.64, 2.4);

    R.put(mkStehlampe(0xe8dcc0, 1.7), 3.6, 0.9, 0, 0.46, 0.46);
    R.put(mkGarderobenstaender(), w / 2 - 0.7, -d / 2 + 0.9, 0, 0.5, 0.5);
    R.put(mkPflanze(1.3, 0x6b4527), -w / 2 + 0.7, -d / 2 + 0.9, 0, 0.52, 0.52);
    R.put(mkKiste(0.7, 0.5, 0.5, 0x6b4527, true), 0.9, -2.8, -0.2, 0.8, 0.6);

    R.wand(mkUhr(0.26), 's', 2.6, 2.5);
    R.wand(mkBild(0.8, 1.0, 0x5c4326, 0x7a6a5a), 's', -2.8, 1.9);
    R.add(mkDeckenlampe('luster'), 0, R.h - 0.05, 0);
    R.licht(0xffdfae, 1.0, 14, 0, R.h - 1.0, 0);
  };

  /* ---------- 15. GARAGE ---------- */
  FURNISH.garage = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // EINZIGARTIG: Hebebühne mit zwei Säulen und Tragarmen
    var buehneM = metalM(0xd9a520);
    for (var hs = 0; hs < 2; hs++) {
      var sgn = hs ? 1 : -1;
      var saeuleH = U.box(0.34, 3.0, 0.34, buehneM);
      R.add(saeuleH, sgn * 1.5, 1.5, 1.2);
      R.block(sgn * 1.5, 1.2, 0.4, 0.4);
      var schlitten = U.box(0.42, 0.4, 0.42, metalM(0x4a4f56));
      R.add(schlitten, sgn * 1.5, 0.95, 1.2);
      for (var ta = 0; ta < 2; ta++) {
        var arm = U.box(1.1, 0.14, 0.16, buehneM);
        arm.position.set(sgn * 0.95, 0.95, 1.2 + (ta ? 0.8 : -0.8));
        arm.rotation.y = sgn * (ta ? -0.22 : 0.22);
        R.group.add(arm);
        var teller = U.cyl(0.11, 0.13, 0.1, 12, metalM(0x2f343a), false);
        R.add(teller, sgn * 0.45, 1.02, 1.2 + (ta ? 1.05 : -1.05));
      }
    }
    var querJoch = U.box(3.4, 0.24, 0.3, buehneM);
    R.add(querJoch, 0, 2.95, 1.2);

    // EINZIGARTIG: Motorblock auf Rollständer
    var stRahmen = U.box(0.8, 0.1, 0.8, metalM(0x8f959c));
    R.put(stRahmen, -w / 2 + 1.0, -1.0, 0, 0.9, 0.9);
    stRahmen.position.y = 0.55;
    for (var sr = 0; sr < 4; sr++) {
      var stBein = U.box(0.07, 0.55, 0.07, metalM(0x8f959c));
      R.add(stBein, -w / 2 + 1.0 + (sr < 2 ? -0.32 : 0.32), 0.28, -1.0 + ((sr % 2) ? 0.32 : -0.32));
      var rolleG = U.sph(0.05, 6, 6, flatM(0x14161a, 0.7, 0.1), false);
      R.add(rolleG, -w / 2 + 1.0 + (sr < 2 ? -0.32 : 0.32), 0.05, -1.0 + ((sr % 2) ? 0.32 : -0.32));
    }
    var motorblock = U.box(0.62, 0.5, 0.55, metalM(0x5a6068));
    R.add(motorblock, -w / 2 + 1.0, 0.85, -1.0);
    for (var zy = 0; zy < 4; zy++) {
      var zylinder = U.cyl(0.07, 0.07, 0.2, 10, metalM(0x8f959c));
      R.add(zylinder, -w / 2 + 0.8 + (zy % 2) * 0.4, 1.2, -1.2 + Math.floor(zy / 2) * 0.35);
    }
    var kruemmer = U.torus(0.14, 0.045, 6, 12, metalM(0x6b4a3a), false);
    kruemmer.rotation.y = HALFPI;
    R.add(kruemmer, -w / 2 + 1.34, 0.9, -1.0);

    // EINZIGARTIG: Werkbank mit Kompressor
    var gbank = U.box(3.0, 0.12, 0.7, woodM(0x8a6a45));
    R.put(gbank, 1.2, d / 2 - 0.5, Math.PI, 3.06, 0.76);
    gbank.position.y = 0.92;
    var gbankUnterbau = U.box(2.9, 0.8, 0.6, metalM(0x4a6b8a));
    R.add(gbankUnterbau, 1.2, 0.45, d / 2 - 0.55);
    var kompKessel = U.cyl(0.24, 0.24, 0.9, 14, metalM(0xd94f4f));
    kompKessel.rotation.z = HALFPI;
    R.put(kompKessel, -1.2, d / 2 - 0.6, 0, 1.0, 0.55);
    kompKessel.position.y = 0.4;
    var kompMotor = U.box(0.3, 0.26, 0.28, metalM(0x2f343a));
    R.add(kompMotor, -1.2, 0.72, d / 2 - 0.6);
    var kompSchlauch = U.torus(0.16, 0.025, 6, 14, flatM(0x14161a, 0.9, 0), false);
    kompSchlauch.rotation.x = HALFPI;
    R.add(kompSchlauch, -0.7, 0.2, d / 2 - 0.6);

    // EINZIGARTIG: Reifenregal und Ölwanne
    var reifenregal = mkRegal(2.2, 2.2, 0.6, 3, 0x6b7078, false);
    R.put(reifenregal, w / 2 - 0.4, -1.6, -HALFPI, 0.66, 2.26);
    var reifenM2 = flatM(0x1a1c20, 0.95, 0);
    for (var rr = 0; rr < 6; rr++) {
      var reifenG = U.torus(0.29, 0.11, 8, 16, reifenM2, false);
      reifenG.rotation.y = HALFPI;
      R.add(reifenG, w / 2 - 0.45, 0.42 + Math.floor(rr / 3) * 0.72, -2.3 + (rr % 3) * 0.7);
      var felge = U.cyl(0.17, 0.17, 0.14, 14, sharedM('chrome') || metalM(0xe8ecf0), false);
      felge.rotation.z = HALFPI;
      R.add(felge, w / 2 - 0.45, 0.42 + Math.floor(rr / 3) * 0.72, -2.3 + (rr % 3) * 0.7);
    }
    var oelwanne = U.cyl(0.34, 0.34, 0.14, 16, metalM(0x3a3f46), false);
    R.add(oelwanne, -0.6, 0.07, -1.2);
    var oelfilm = U.cyl(0.3, 0.3, 0.02, 16, flatM(0x14120e, 0.15, 0.6), false);
    R.add(oelfilm, -0.6, 0.14, -1.2);

    // EINZIGARTIG: Rolltor an der Türwand
    var torRahmen = U.box(3.6, 0.16, 0.2, metalM(0x8f959c), false);
    R.add(torRahmen, 0, 2.55, -d / 2 + 0.2);
    for (var lam = 0; lam < 4; lam++) {
      var lamelle = U.box(3.5, 0.18, 0.08, metalM(0xb6bcc2), false);
      R.add(lamelle, 0, 2.72 + lam * 0.2, -d / 2 + 0.2);
    }

    var werkzeugwagenG = mkKommode(0.8, 1.0, 0.5, 0xd94f4f, 5);
    R.put(werkzeugwagenG, -w / 2 + 0.55, 2.4, HALFPI, 0.54, 0.84);
    R.put(mkFass(0.3, 0.9, 0x2f6b4a), -w / 2 + 0.6, 3.4, 0, 0.64, 0.64);
    R.put(mkKiste(0.9, 0.6, 0.6, 0x8a6a45, false), 3.4, -3.0, 0.2, 0.96, 0.7);
    R.put(mkKiste(0.6, 0.5, 0.5, 0x9a7a4a, false), -3.4, -3.2, -0.3, 0.7, 0.6);

    var kanister = U.box(0.28, 0.4, 0.2, flatM(0xd94f4f, 0.7, 0.05));
    R.add(kanister, -w / 2 + 1.6, 0.2, 3.2);
    var kanisterGriff = U.box(0.24, 0.06, 0.05, flatM(0x8a3b2e, 0.7, 0.05), false);
    R.add(kanisterGriff, -w / 2 + 1.6, 0.44, 3.2);

    R.wand(mkBild(1.0, 0.6, 0x4a4f56, 0x6a7a8a), 'w', -3.0, 2.4);
    R.add(mkDeckenlampe('roehre'), -2.4, R.h - 0.05, 0.8);
    R.add(mkDeckenlampe('roehre'), 2.4, R.h - 0.05, -1.6);
    R.licht(0xf2f8ff, 1.2, 17, 0, R.h - 0.6, 0);
  };

  /* ---------- 16. GEWÄCHSHAUS ---------- */
  FURNISH.gewaechshaus = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // EINZIGARTIG: Hochbeete in drei Reihen
    function hochbeet(lx, lz, laenge, pflanzenFarbe, hoch) {
      var hh = hoch ? 0.72 : 0.4;
      var rahmenH = U.box(laenge, hh, 0.9, woodM(0x8a6a45));
      R.put(rahmenH, lx, lz, 0, laenge + 0.06, 0.96);
      rahmenH.position.y = hh / 2;
      var erde = U.box(laenge - 0.14, 0.1, 0.76, flatM(0x40301f, 1, 0), false);
      R.add(erde, lx, hh - 0.02, lz);
      var n = Math.max(3, Math.round(laenge / 0.5));
      for (var i = 0; i < n; i++) {
        var px = lx - laenge / 2 + laenge / (n + 1) * (i + 1);
        var stiel = U.cyl(0.02, 0.025, 0.36, 6, flatM(0x4a7a3a, 0.95, 0), false);
        R.add(stiel, px, hh + 0.2, lz);
        for (var bl = 0; bl < 4; bl++) {
          var blatt = U.sph(0.1, 8, 6, flatM(0x3d7a3a, 0.9, 0), false);
          blatt.scale.set(1.3, 0.3, 0.8);
          var ba = bl * 1.6;
          blatt.rotation.y = ba;
          R.add(blatt, px + Math.sin(ba) * 0.11, hh + 0.28 + (bl % 2) * 0.08, lz + Math.cos(ba) * 0.11);
        }
        if (pflanzenFarbe !== null) {
          for (var fr = 0; fr < 3; fr++) {
            var frucht = U.sph(0.05, 8, 6, flatM(pflanzenFarbe, 0.75, 0.05), false);
            R.add(frucht, px + (fr - 1) * 0.07, hh + 0.34 + (fr % 2) * 0.06, lz + 0.06);
          }
        }
      }
    }
    hochbeet(-2.2, d / 2 - 0.9, 4.0, 0xd94f4f, true);
    hochbeet(-2.2, d / 2 - 2.4, 4.0, 0xe0a132, false);
    hochbeet(2.8, 1.4, 2.6, 0x8e5bc4, true);

    // EINZIGARTIG: Pflanztisch mit Töpfen und Erdsack
    var pflanztisch = mkTisch(2.0, 0.8, 0.86, 0x8a6a45);
    R.put(pflanztisch, -1.6, -2.6, 0, 2.05, 0.85);
    for (var tp = 0; tp < 5; tp++) {
      var topfP = U.cyl(0.1, 0.075, 0.16, 12, flatM(0xa8563c, 0.9, 0));
      R.add(topfP, -2.4 + tp * 0.4, 0.94, -2.6);
      var setzling = U.cone(0.07, 0.2, 6, flatM(0x4a8a3a, 0.9, 0), false);
      R.add(setzling, -2.4 + tp * 0.4, 1.12, -2.6);
    }
    var erdsack = U.cyl(0.3, 0.26, 0.6, 12, flatM(0x3a3f46, 0.95, 0));
    erdsack.rotation.z = 0.35;
    R.put(erdsack, -0.2, -2.7, 0, 0.7, 0.6);
    erdsack.position.y = 0.28;

    // EINZIGARTIG: Regentonne mit Giesskanne
    var tonne = mkFass(0.44, 1.1, 0x4a6b4f);
    R.put(tonne, w / 2 - 0.8, d / 2 - 0.9, 0, 0.94, 0.94);
    var wasser = U.cyl(0.4, 0.4, 0.03, 16, sharedM('water') || flatM(0x3d7dc8, 0.1, 0.3), false);
    R.add(wasser, w / 2 - 0.8, 1.06, d / 2 - 0.9);
    var kanneKorpus = U.cyl(0.14, 0.16, 0.28, 12, metalM(0x6b8a5a));
    R.put(kanneKorpus, w / 2 - 1.6, d / 2 - 0.9, 0, 0.4, 0.4);
    kanneKorpus.position.y = 0.14;
    var kanneRohr = U.cyl(0.03, 0.05, 0.42, 8, metalM(0x6b8a5a), false);
    kanneRohr.rotation.z = -0.9;
    R.add(kanneRohr, w / 2 - 1.85, 0.26, d / 2 - 0.9);
    var brause = U.cyl(0.07, 0.05, 0.06, 10, metalM(0x6b8a5a), false);
    R.add(brause, w / 2 - 2.05, 0.38, d / 2 - 0.9);
    var kanneHenkel = U.torus(0.09, 0.015, 5, 12, metalM(0x6b8a5a), false);
    R.add(kanneHenkel, w / 2 - 1.6, 0.32, d / 2 - 0.9);

    // EINZIGARTIG: Bewässerungsrohre unter der Decke
    var rohrM = metalM(0x8f959c);
    var hauptrohr = U.cyl(0.05, 0.05, w - 0.8, 10, rohrM, false);
    hauptrohr.rotation.z = HALFPI;
    R.add(hauptrohr, 0, R.h - 0.35, 0.2);
    for (var du = 0; du < 6; du++) {
      var duese = U.cyl(0.02, 0.03, 0.18, 6, rohrM, false);
      R.add(duese, -3.6 + du * 1.45, R.h - 0.48, 0.2);
      var tropfen = U.sph(0.035, 6, 6, GTA.U.mat(0x8ec8f0, 0.1, 0.2, { transparent: true, opacity: 0.6 }), false);
      R.add(tropfen, -3.6 + du * 1.45, R.h - 0.64, 0.2);
    }

    // EINZIGARTIG: Hängeampeln mit Ranken
    for (var ha = 0; ha < 3; ha++) {
      var hx = -2.5 + ha * 2.5;
      var seil = U.cyl(0.008, 0.008, 0.5, 5, flatM(0x8a7a5a, 0.9, 0), false);
      R.add(seil, hx, R.h - 0.3, -2.0);
      var ampel = U.cyl(0.2, 0.14, 0.22, 12, flatM(0xa8563c, 0.9, 0), false);
      R.add(ampel, hx, R.h - 0.66, -2.0);
      for (var ra = 0; ra < 5; ra++) {
        var ranke = U.cyl(0.015, 0.015, 0.5 + ra * 0.14, 5, flatM(0x4a8a3a, 0.9, 0), false);
        R.add(ranke, hx + Math.sin(ra * 1.3) * 0.14, R.h - 1.05 - ra * 0.07, -2.0 + Math.cos(ra * 1.3) * 0.14);
      }
    }

    var geraeteregal = mkRegal(1.6, 1.9, 0.36, 4, 0x8a6a45, false);
    R.put(geraeteregal, -w / 2 + 0.32, 1.8, HALFPI, 0.4, 1.66);
    for (var gt = 0; gt < 6; gt++) {
      var toepfchen = U.cyl(0.08, 0.06, 0.12, 10, flatM(0xa8563c, 0.9, 0), false);
      R.add(toepfchen, -w / 2 + 0.4, 0.34 + (gt % 3) * 0.44, 1.2 + (gt > 2 ? 1.1 : 0) + (gt % 3) * 0.03);
    }

    var schubkarre = U.box(0.6, 0.3, 0.9, metalM(0x3a6b8a));
    R.put(schubkarre, -3.6, 1.6, 0.3, 0.8, 1.0);
    schubkarre.position.y = 0.42;
    var karrenRad = U.torus(0.16, 0.06, 8, 14, flatM(0x1a1c20, 0.95, 0), false);
    karrenRad.rotation.y = HALFPI;
    R.add(karrenRad, -3.6, 0.16, 1.15);
    for (var kg = 0; kg < 2; kg++) {
      var karrenGriff = U.cyl(0.03, 0.03, 1.2, 8, woodM(0xc9a06a), false);
      karrenGriff.rotation.x = 0.2;
      R.add(karrenGriff, -3.6 + (kg ? 0.24 : -0.24), 0.5, 0.05);
    }

    R.put(mkHocker(0x8a6a45, 0.2, 0.42), 1.2, -2.6, 0, 0.44, 0.44);
    R.add(mkDeckenlampe('roehre'), 0, R.h - 0.05, -1.0);
    R.add(mkDeckenlampe('roehre'), 0, R.h - 0.05, 2.2);
    R.licht(0xe8ffe0, 1.15, 16, 0, R.h - 0.6, 0);
  };

  /* ---------- 17. FITNESSRAUM ---------- */
  FURNISH.fitnessraum = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    var matte = U.box(3.0, 0.04, 2.2, clothM(0x2f4a5a), false);
    R.add(matte, 0.4, 0.02, -0.4);

    // EINZIGARTIG: Hantelbank mit Langhantel und Ablagen
    var bankPolster = U.box(0.42, 0.14, 1.4, clothM(0x1e2228));
    R.put(bankPolster, -1.6, 0.6, 0, 0.5, 1.5);
    bankPolster.position.y = 0.5;
    var bankRahmen = U.box(0.2, 0.4, 1.3, metalM(0x2f343a));
    R.add(bankRahmen, -1.6, 0.24, 0.6);
    for (var bf = 0; bf < 4; bf++) {
      var bfuss = U.box(0.5, 0.07, 0.08, metalM(0x2f343a), false);
      R.add(bfuss, -1.6, 0.04, 0.6 + (bf < 2 ? -0.6 : 0.6) + (bf % 2) * 0.05);
    }
    for (var st = 0; st < 2; st++) {
      var staender = U.box(0.09, 1.2, 0.09, metalM(0xd94f4f));
      R.add(staender, -1.6 + (st ? 0.5 : -0.5), 0.6, -0.15);
      var gabel = U.box(0.1, 0.16, 0.16, metalM(0xd94f4f), false);
      R.add(gabel, -1.6 + (st ? 0.5 : -0.5), 1.25, -0.15);
      R.block(-1.6 + (st ? 0.5 : -0.5), -0.15, 0.14, 0.14);
    }
    var langhantel = U.cyl(0.025, 0.025, 1.9, 10, sharedM('chrome') || metalM(0xe8ecf0), false);
    langhantel.rotation.z = HALFPI;
    R.add(langhantel, -1.6, 1.3, -0.15);
    for (var sch = 0; sch < 4; sch++) {
      var scheibe = U.cyl(0.22, 0.22, 0.055, 18, flatM(0x14161a, 0.7, 0.15), false);
      scheibe.rotation.z = HALFPI;
      R.add(scheibe, -1.6 + (sch < 2 ? -0.72 - (sch % 2) * 0.07 : 0.72 + (sch % 2) * 0.07), 1.3, -0.15);
    }

    // EINZIGARTIG: Hantelständer mit Kurzhanteln
    var hsRahmen = U.box(1.8, 0.5, 0.5, metalM(0x2f343a));
    R.put(hsRahmen, 2.6, d / 2 - 0.6, 0, 1.86, 0.56);
    hsRahmen.position.y = 0.4;
    var hsAblage = U.box(1.8, 0.06, 0.4, metalM(0x4a4f56), false);
    R.add(hsAblage, 2.6, 0.9, d / 2 - 0.6);
    for (var kh = 0; kh < 5; kh++) {
      var griffH = U.cyl(0.022, 0.022, 0.3, 8, sharedM('chrome') || metalM(0xe8ecf0), false);
      griffH.rotation.z = HALFPI;
      R.add(griffH, 2.6 - 0.7 + kh * 0.35, 0.98, d / 2 - 0.6);
      for (var kd = 0; kd < 2; kd++) {
        var kopfH = U.cyl(0.09 + kh * 0.008, 0.09 + kh * 0.008, 0.09, 12, flatM(0x14161a, 0.7, 0.15), false);
        kopfH.rotation.z = HALFPI;
        R.add(kopfH, 2.6 - 0.7 + kh * 0.35 + (kd ? 0.14 : -0.14), 0.98, d / 2 - 0.6);
      }
    }

    // EINZIGARTIG: Laufband
    var lbBasis = U.box(0.8, 0.24, 1.7, flatM(0x2a2d33, 0.5, 0.3));
    R.put(lbBasis, w / 2 - 0.9, -1.4, 0, 0.88, 1.78);
    lbBasis.position.y = 0.12;
    var lbBand = U.box(0.6, 0.06, 1.5, flatM(0x14161a, 0.9, 0), false);
    R.add(lbBand, w / 2 - 0.9, 0.26, -1.4);
    for (var ho = 0; ho < 2; ho++) {
      var holmL = U.box(0.06, 1.1, 0.06, metalM(0x8f959c));
      holmL.rotation.x = -0.14;
      R.add(holmL, w / 2 - 0.9 + (ho ? 0.36 : -0.36), 0.68, -2.1);
    }
    var lbKonsole = U.box(0.76, 0.36, 0.1, flatM(0x2a2d33, 0.5, 0.3));
    lbKonsole.rotation.x = -0.3;
    R.add(lbKonsole, w / 2 - 0.9, 1.2, -2.2);
    var lbDisplay = U.box(0.5, 0.22, 0.02, glowM(0x2a8ad0, 1.0), false);
    lbDisplay.rotation.x = -0.3;
    R.add(lbDisplay, w / 2 - 0.9, 1.22, -2.26);
    var lbGriff = U.cyl(0.024, 0.024, 0.72, 8, metalM(0x8f959c), false);
    lbGriff.rotation.z = HALFPI;
    R.add(lbGriff, w / 2 - 0.9, 1.05, -2.05);

    // EINZIGARTIG: Boxsack an der Decke
    var kette = U.cyl(0.012, 0.012, 0.42, 6, metalM(0x8f959c), false);
    R.add(kette, -3.2, R.h - 0.32, -2.2);
    var boxsack = U.cyl(0.24, 0.22, 1.2, 14, clothM(0x8a3b2e));
    R.add(boxsack, -3.2, R.h - 1.15, -2.2);
    var sackKappe = U.cyl(0.25, 0.25, 0.08, 14, flatM(0x2a2d33, 0.6, 0.2), false);
    R.add(sackKappe, -3.2, R.h - 0.55, -2.2);
    R.block(-3.2, -2.2, 0.56, 0.56);

    // EINZIGARTIG: Spiegelwand
    for (var sw = 0; sw < 3; sw++) {
      var spiegelPanel = U.box(1.5, 1.9, 0.04, GTA.U.mat(0xcfe0ea, 0.06, 0.95), false);
      R.add(spiegelPanel, -2.6 + sw * 1.56, 1.25, -d / 2 + 0.1);
      var fuge = U.box(0.04, 1.9, 0.05, metalM(0x8f959c), false);
      R.add(fuge, -3.36 + sw * 1.56, 1.25, -d / 2 + 0.09);
    }

    // EINZIGARTIG: Klimmzugstange
    for (var kz = 0; kz < 2; kz++) {
      var kzPfosten = U.box(0.09, 2.3, 0.09, metalM(0x2f343a));
      R.add(kzPfosten, -w / 2 + 0.55, 1.15, 1.2 + (kz ? 0.9 : -0.9));
      R.block(-w / 2 + 0.55, 1.2 + (kz ? 0.9 : -0.9), 0.14, 0.14);
    }
    var kzStange = U.cyl(0.024, 0.024, 1.9, 10, sharedM('chrome') || metalM(0xe8ecf0), false);
    kzStange.rotation.x = HALFPI;
    R.add(kzStange, -w / 2 + 0.55, 2.25, 1.2);

    var gymnastikball = U.sph(0.34, 14, 12, flatM(0x8e5bc4, 0.75, 0.05));
    R.put(gymnastikball, 1.6, 2.6, 0, 0.7, 0.7);
    gymnastikball.position.y = 0.34;

    var handtuchregal = mkWandregal(1.2, 0x8f959c, 0.3);
    R.add(handtuchregal, 3.4, 1.7, d / 2 - 0.16, Math.PI);
    for (var ht = 0; ht < 3; ht++) {
      var handtuch = U.box(0.3, 0.14, 0.24, clothM([0xdfe6ea, 0x3a7bd5, 0xe0a132][ht]), false);
      R.add(handtuch, 3.0 + ht * 0.4, 1.79, d / 2 - 0.18);
    }

    R.put(mkPflanze(0.9, 0x4a4f56), w / 2 - 0.6, d / 2 - 0.6, 0, 0.44, 0.44);
    R.wand(mkUhr(0.24), 'o', 2.4, 2.3);
    R.add(mkDeckenlampe('roehre'), -1.8, R.h - 0.05, 0.6);
    R.add(mkDeckenlampe('roehre'), 2.4, R.h - 0.05, -1.4);
    R.licht(0xf4f9ff, 1.15, 15, 0, R.h - 0.6, 0);
  };

  /* ---------- 18. DACHBODEN ---------- */
  FURNISH.dachboden = function (R) {
    var U = GTA.U, w = R.w, d = R.d;

    // EINZIGARTIG: Dachsparren und Schrägen
    var sparrenM = woodM(0x6b4527);
    for (var sp = 0; sp < 6; sp++) {
      var lz = -d / 2 + 0.8 + sp * ((d - 1.6) / 5);
      for (var se = 0; se < 2; se++) {
        var sgn = se ? 1 : -1;
        var sparren = U.box(0.14, 0.16, 2.4, sparrenM, false);
        sparren.rotation.x = 0;
        sparren.rotation.z = sgn * 0.62;
        sparren.rotation.order = 'ZYX';
        R.add(sparren, sgn * (w / 2 - 0.9), R.h - 0.75, lz);
        sparren.scale.z = 0.1;
        sparren.scale.y = 1;
      }
      var kehlbalken = U.box(w - 1.2, 0.16, 0.16, sparrenM, false);
      R.add(kehlbalken, 0, R.h - 0.32, lz);
    }
    var firstbalken = U.box(0.2, 0.24, d - 0.4, sparrenM, false);
    R.add(firstbalken, 0, R.h - 0.16, 0);
    for (var sr = 0; sr < 2; sr++) {
      var schraege = U.box(0.12, 2.2, d - 0.3, flatM(0x9a8a70, 0.95, 0), false);
      schraege.rotation.z = (sr ? -1 : 1) * 0.5;
      R.add(schraege, (sr ? 1 : -1) * (w / 2 - 0.6), R.h - 1.15, 0);
    }

    // EINZIGARTIG: Dachfenster mit Lichtschacht
    var dfRahmen = U.box(0.9, 0.08, 1.1, woodM(0x8a6a45), false);
    dfRahmen.rotation.x = 0.5;
    R.add(dfRahmen, -2.2, R.h - 0.5, 1.6);
    var dfGlas = U.box(0.78, 0.03, 0.98, glassM(), false);
    dfGlas.rotation.x = 0.5;
    R.add(dfGlas, -2.2, R.h - 0.52, 1.6);
    R.licht(0xdfe8f4, 0.55, 6.0, -2.2, R.h - 1.2, 1.6);

    // EINZIGARTIG: Alte Truhen gestapelt
    R.put(mkKiste(1.2, 0.7, 0.7, 0x5c4326, true), -w / 2 + 1.0, -2.2, 0, 1.26, 0.76);
    var truheOben = mkKiste(0.8, 0.5, 0.5, 0x6b4527, true);
    R.add(truheOben, -w / 2 + 1.0, 0.78, -2.2, 0.2);
    R.put(mkKiste(0.9, 0.6, 0.6, 0x8a6a45, false), -w / 2 + 0.9, -0.9, -0.25, 1.0, 0.7);

    // EINZIGARTIG: Schneiderpuppe
    var puppeFuss = U.cyl(0.2, 0.24, 0.05, 14, woodM(0x6b4527));
    R.put(puppeFuss, 2.4, -2.4, 0, 0.5, 0.5);
    puppeFuss.position.y = 0.025;
    var puppeStange = U.cyl(0.03, 0.035, 0.85, 8, metalM(0x8f959c));
    R.add(puppeStange, 2.4, 0.47, -2.4);
    var puppeTorso = U.cyl(0.24, 0.19, 0.7, 14, clothM(0xd8c8b0));
    R.add(puppeTorso, 2.4, 1.24, -2.4);
    var puppeSchulter = U.sph(0.22, 12, 10, clothM(0xd8c8b0), false);
    puppeSchulter.scale.y = 0.5;
    R.add(puppeSchulter, 2.4, 1.58, -2.4);
    var tuchP = U.box(0.5, 0.6, 0.05, clothM(0x8a3b2e), false);
    R.add(tuchP, 2.4, 1.15, -2.62);

    // EINZIGARTIG: Nähmaschine auf altem Tisch
    var naehtisch = mkTisch(1.0, 0.6, 0.74, 0x6b4527);
    R.put(naehtisch, 3.2, 0.4, 0, 1.05, 0.65);
    var nmSockel = U.box(0.52, 0.08, 0.24, flatM(0x2a2d33, 0.5, 0.3));
    R.add(nmSockel, 3.2, 0.79, 0.4);
    var nmKoerper = U.box(0.44, 0.24, 0.16, flatM(0x1e2228, 0.4, 0.35));
    R.add(nmKoerper, 3.2, 0.95, 0.4);
    var nmArm = U.box(0.14, 0.2, 0.14, flatM(0x1e2228, 0.4, 0.35), false);
    R.add(nmArm, 3.02, 0.94, 0.4);
    var nmRad = U.cyl(0.07, 0.07, 0.025, 14, metalM(0xb9a06a), false);
    nmRad.rotation.z = HALFPI;
    R.add(nmRad, 3.44, 1.0, 0.4);
    var nmSpule = U.cyl(0.02, 0.02, 0.06, 8, flatM(0xd94f4f, 0.85, 0), false);
    R.add(nmSpule, 3.2, 1.1, 0.4);

    // EINZIGARTIG: Schaukelstuhl unterm Dachfenster
    var ssSitz = U.box(0.5, 0.06, 0.46, woodM(0x8a5f36));
    R.put(ssSitz, -2.4, 2.4, 0, 0.6, 0.7);
    ssSitz.position.y = 0.44;
    var ssLehne = U.box(0.5, 0.6, 0.06, woodM(0x8a5f36));
    ssLehne.rotation.x = -0.2;
    R.add(ssLehne, -2.4, 0.74, 2.62);
    for (var kf = 0; kf < 2; kf++) {
      var kufeS = U.torus(0.36, 0.03, 6, 12, woodM(0x8a5f36), false);
      kufeS.rotation.y = HALFPI;
      R.add(kufeS, -2.4 + (kf ? 0.24 : -0.24), 0.1, 2.4);
      var beinS2 = U.box(0.05, 0.4, 0.05, woodM(0x8a5f36), false);
      R.add(beinS2, -2.4 + (kf ? 0.24 : -0.24), 0.24, 2.2);
    }
    var plaid = U.box(0.44, 0.05, 0.4, clothM(0x6b7a4a), false);
    R.add(plaid, -2.4, 0.49, 2.4);

    var altesRegal = mkRegal(1.6, 1.6, 0.34, 4, 0x6b4527, true);
    R.put(altesRegal, w / 2 - 0.3, 2.0, -HALFPI, 0.38, 1.66);

    var kleiderstange = U.cyl(0.024, 0.024, 2.0, 8, metalM(0x8f959c), false);
    kleiderstange.rotation.z = HALFPI;
    R.add(kleiderstange, 0.6, 1.9, d / 2 - 0.7);
    var kleiderFarben = [0x2f3a4a, 0x8a3b2e, 0x4a5a3a, 0x6b4a86];
    for (var kl = 0; kl < 4; kl++) {
      var huelle = U.box(0.44, 0.9, 0.14, clothM(kleiderFarben[kl]), false);
      R.add(huelle, -0.2 + kl * 0.5, 1.4, d / 2 - 0.7);
      var buegel = U.cyl(0.008, 0.008, 0.3, 5, metalM(0x8f959c), false);
      buegel.rotation.z = HALFPI;
      R.add(buegel, -0.2 + kl * 0.5, 1.87, d / 2 - 0.7);
    }
    R.block(0.6, d / 2 - 0.7, 2.2, 0.4);

    // Staub, Spinnweben und altes Zeug
    for (var sw = 0; sw < 4; sw++) {
      var webe = U.cone(0.3, 0.3, 4, GTA.U.mat(0xe8e8e0, 0.95, 0, { transparent: true, opacity: 0.22 }), false);
      webe.rotation.x = Math.PI;
      webe.rotation.z = 0.6;
      R.add(webe, (sw % 2 ? 1 : -1) * (w / 2 - 0.8), R.h - 0.5, -d / 2 + 1.2 + sw * 1.6);
    }
    var koffer = U.box(0.7, 0.24, 0.5, woodM(0x5c4326));
    R.put(koffer, 1.4, -2.7, 0.3, 0.8, 0.6);
    koffer.position.y = 0.12;
    var kofferBand = U.box(0.72, 0.05, 0.06, flatM(0x8a6a45, 0.85, 0), false);
    R.add(kofferBand, 1.4, 0.25, -2.7);
    R.deko(mkBuchstapel(5, 0.18), 1.5, 0.26, -2.6);

    var lampe = U.sph(0.14, 10, 8, glowM(0xffe0a0, 1.2), false);
    R.add(lampe, 0, R.h - 0.6, -0.6);
    var lampenkabel = U.cyl(0.006, 0.006, 0.45, 5, flatM(0x2a2d33, 0.9, 0), false);
    R.add(lampenkabel, 0, R.h - 0.35, -0.6);
    R.licht(0xffdca8, 0.85, 12, 0, R.h - 0.7, -0.6);
  };

  /* ============================================================
     7. BEUTE
     Kleine schwebende Marker. Werte kommen aus der Raumtabelle.
     ============================================================ */

  function mkBeuteMarker(farbe) {
    var U = GTA.U, g = new THREE.Group();
    var kern = U.box(0.16, 0.16, 0.16, glowM(farbe, 1.1), false);
    kern.rotation.set(0.4, 0.4, 0);
    g.add(kern);
    var huelle = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.26, 0.26),
      GTA.U.mat(farbe, 0.4, 0.2, { transparent: true, opacity: 0.28 })
    );
    huelle.rotation.set(0.4, 0.4, 0);
    g.add(huelle);
    var ring = U.torus(0.2, 0.014, 6, 18, glowM(0xfff0c4, 0.9), false);
    ring.rotation.x = HALFPI;
    g.add(ring);
    g.userData.spin = ring;
    return g;
  }

  var BEUTE_FARBEN = [0xe0a132, 0x4affa0, 0x5aa8ff, 0xd94f4f, 0x8e5bc4];

  function buildLoot(ctx, rec, R, def) {
    var quelle = def.loot || [];
    for (var i = 0; i < quelle.length; i++) {
      var q = quelle[i];
      var farbe = BEUTE_FARBEN[i % BEUTE_FARBEN.length];
      var marker = mkBeuteMarker(farbe);
      var ly = 0.95;
      R.add(marker, q.lx, ly, q.lz);
      rec.loot.push({
        id: q.id,
        name: q.name,
        value: q.value === undefined ? 25 : q.value,
        x: R.wx(q.lx, q.lz),
        y: ly,
        z: R.wz(q.lx, q.lz),
        lx: q.lx, lz: q.lz,
        taken: false,
        phase: i * 1.3,
        mesh: marker,
        interiorId: rec.id
      });
    }
  }

  /* ============================================================
     8. WELTBAU
     ============================================================ */

  function buildOne(ctx, spot, index) {
    var U = GTA.U;
    var kind = spot.kind;
    var def = ROOMS[kind];
    if (!def) def = ROOMS.wohnzimmer;

    var rot = ((spot.rot % 4) + 4) % 4;
    var rec = {
      id: 'haus' + index,
      index: index,
      kind: kind,
      title: def.title,
      hint: def.hint,
      x: spot.x, z: spot.z, rot: rot,
      w: def.w, d: def.d, h: def.h,
      group: null, ceiling: null, roofMesh: null,
      door: null, spawn: null, exit: null,
      loot: [], lamps: [], colliders: [],
      active: false
    };

    var group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);
    group.rotation.y = rot * HALFPI;
    rec.group = group;

    // Einrichtung kommt in eine eigene Gruppe. Sie wird nur gezeichnet,
    // wenn der Spieler wirklich im Haus steht — das spart draussen
    // mehrere tausend Zeichenaufrufe, weil das Dach sie ohnehin verdeckt.
    var moebel = new THREE.Group();
    rec.furniture = moebel;
    var R = makeBuilder(ctx, rec, moebel);

    buildShell(ctx, rec, group, def);
    group.add(moebel);
    moebel.visible = false;

    var furnish = FURNISH[kind];
    if (furnish) furnish(R);

    buildLoot(ctx, rec, R, def);

    // Tür, Standpunkte, Aussenmasse
    var t = 0.28;
    rec.door = { x: R.wx(0, -def.d / 2 - t), z: R.wz(0, -def.d / 2 - t), heading: rot * HALFPI };
    rec.spawn = { x: R.wx(0, -def.d / 2 + 1.2), z: R.wz(0, -def.d / 2 + 1.2) };
    rec.exit = { x: R.wx(0, -def.d / 2 - 2.2), z: R.wz(0, -def.d / 2 - 2.2) };

    var hw = def.w / 2 + t, hd = def.d / 2 + t;
    var ex = (rot % 2) ? hd : hw;
    var ez = (rot % 2) ? hw : hd;
    rec.bounds = { x0: spot.x - ex, x1: spot.x + ex, z0: spot.z - ez, z1: spot.z + ez };

    // Von aussen soll niemand ins Haus laufen — Kreis-Hindernis um die Ecken
    U.addObstacle(ctx, spot.x, spot.z, 0.0);

    if (ctx.scene) ctx.scene.add(group);
    return rec;
  }

  /**
   * Baut alle Innenräume aus GTA.CFG.HOUSE_SPOTS.
   * Liefert das Raum-Array und legt es zusätzlich auf ctx.interiors ab.
   */
  API.build = function (ctx) {
    if (!ctx) return [];
    if (!ctx.obstacles) ctx.obstacles = [];
    if (!ctx.walls) ctx.walls = [];

    var CFG = GTA.CFG;
    var spots = (CFG && CFG.HOUSE_SPOTS) ? CFG.HOUSE_SPOTS : [];
    var list = [];
    for (var i = 0; i < spots.length; i++) {
      var rec = buildOne(ctx, spots[i], i);
      if (rec) list.push(rec);
    }
    API.list = list;
    ctx.interiors = list;
    return list;
  };

  API.list = [];

  /* ============================================================
     9. LAUFZEIT
     ============================================================ */

  // Liegt der Punkt in einem Raum? Liefert den Datensatz oder null.
  API.at = function (x, z) {
    var l = API.list;
    for (var i = 0; i < l.length; i++) {
      var b = l[i].bounds;
      if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return l[i];
    }
    return null;
  };

  API.byId = function (id) {
    var l = API.list;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  };

  API.byKind = function (kind) {
    var out = [];
    var l = API.list;
    for (var i = 0; i < l.length; i++) if (l[i].kind === kind) out.push(l[i]);
    return out;
  };

  // Innen: Dach und Decke verschwinden, Lampen gehen an.
  API.setActive = function (rec, on) {
    if (!rec || rec.active === on) return;
    rec.active = on;
    if (rec.furniture) rec.furniture.visible = on;
    for (var i = 0; i < rec.lamps.length; i++) rec.lamps[i].visible = on;
    // Decke bleibt drinnen sichtbar (sonst schaut man in den Himmel),
    // nur das Aussendach verschwindet.
    if (rec.ceiling) rec.ceiling.visible = on;
    if (rec.roofMesh) rec.roofMesh.visible = !on;
  };

  /**
   * Pro Bild aufrufen.
   * dt in Sekunden, px/pz = Spielerposition.
   * Liefert den aktuell betretenen Raum (oder null) — dieser Wert
   * gehört als activeInterior in GTA.U.resolveWalls / resolveAll.
   */
  API.update = function (dt, ctx, px, pz) {
    var l = API.list;
    var drin = API.at(px, pz);

    for (var i = 0; i < l.length; i++) {
      var rec = l[i];
      var soll = (rec === drin);
      if (rec.active !== soll) {
        API.setActive(rec, soll);
        if (soll) {
          if (GTA.UI && GTA.UI.showToast) GTA.UI.showToast(rec.title + ' — ' + rec.hint);
          if (GTA.Audio && GTA.Audio.play) GTA.Audio.play('tuer');
        }
      }
      if (!soll) continue;

      // Nur der betretene Raum animiert seine Beute.
      for (var k = 0; k < rec.loot.length; k++) {
        var it = rec.loot[k];
        if (it.taken || !it.mesh) continue;
        it.phase += dt * 2.2;
        it.mesh.rotation.y += dt * 1.6;
        it.mesh.position.y = 0.95 + Math.sin(it.phase) * 0.07;
      }
    }

    if (ctx) ctx.activeInterior = drin ? drin.id : null;
    return drin;
  };

  /**
   * Beute im Umkreis einsammeln. Liefert ein Array der Einträge.
   * Ruft andere Module nur auf, wenn es sie gibt.
   */
  API.collect = function (ctx, x, z, radius) {
    var r = radius === undefined ? 1.1 : radius;
    var rec = API.at(x, z);
    if (!rec) return [];
    var out = [];
    for (var i = 0; i < rec.loot.length; i++) {
      var it = rec.loot[i];
      if (it.taken) continue;
      if (Math.hypot(x - it.x, z - it.z) > r) continue;
      it.taken = true;
      if (it.mesh) {
        if (it.mesh.parent) it.mesh.parent.remove(it.mesh);
        if (GTA.U && GTA.U.disposeObject) GTA.U.disposeObject(it.mesh);
        it.mesh = null;
      }
      out.push(it);

      if (GTA.Items && GTA.Items.give) GTA.Items.give(it.id, 1, it);
      if (GTA.Player && GTA.Player.addMoney) GTA.Player.addMoney(ctx, it.value);
      if (GTA.UI && GTA.UI.showToast) GTA.UI.showToast(it.name + ' eingesteckt (+' + it.value + ')');
      if (GTA.Audio && GTA.Audio.play) GTA.Audio.play('pickup');
    }
    return out;
  };

  // Nächstliegende, noch vorhandene Beute im aktuellen Raum.
  API.nearestLoot = function (x, z, radius) {
    var rec = API.at(x, z);
    if (!rec) return null;
    var r = radius === undefined ? 2.0 : radius;
    var best = null, bd = r;
    for (var i = 0; i < rec.loot.length; i++) {
      var it = rec.loot[i];
      if (it.taken) continue;
      var dd = Math.hypot(x - it.x, z - it.z);
      if (dd < bd) { bd = dd; best = it; }
    }
    return best;
  };

  // Ist der Spieler nahe genug an einer Haustür? (für Hinweistexte)
  API.nearDoor = function (x, z, radius) {
    var r = radius === undefined ? 2.4 : radius;
    var l = API.list, best = null, bd = r;
    for (var i = 0; i < l.length; i++) {
      var dd = Math.hypot(x - l[i].door.x, z - l[i].door.z);
      if (dd < bd) { bd = dd; best = l[i]; }
    }
    return best;
  };

  // Freier Standpunkt in einem Raum — für NPCs oder Missionsziele.
  API.randomPointIn = function (rec, ctx, radius) {
    if (!rec) return null;
    var U = GTA.U;
    var r = radius === undefined ? 0.42 : radius;
    for (var i = 0; i < 40; i++) {
      var lx = U.rand(-rec.w / 2 + 0.8, rec.w / 2 - 0.8);
      var lz = U.rand(-rec.d / 2 + 0.8, rec.d / 2 - 0.8);
      var wx, wz;
      if (rec.rot === 0) { wx = rec.x + lx; wz = rec.z + lz; }
      else if (rec.rot === 1) { wx = rec.x + lz; wz = rec.z - lx; }
      else if (rec.rot === 2) { wx = rec.x - lx; wz = rec.z - lz; }
      else { wx = rec.x - lz; wz = rec.z + lx; }
      if (!ctx) return { x: wx, z: wz };
      var frei = true;
      for (var k = 0; k < rec.colliders.length; k++) {
        var c = rec.colliders[k];
        var nx = U.clamp(wx, c.x - c.w / 2, c.x + c.w / 2);
        var nz = U.clamp(wz, c.z - c.d / 2, c.z + c.d / 2);
        if ((wx - nx) * (wx - nx) + (wz - nz) * (wz - nz) < r * r) { frei = false; break; }
      }
      if (frei) return { x: wx, z: wz };
    }
    return { x: rec.spawn.x, z: rec.spawn.z };
  };

  // Zusammenfassung für Speicherstände / HUD.
  API.summary = function () {
    var l = API.list, offen = 0, gesamt = 0, wert = 0;
    for (var i = 0; i < l.length; i++) {
      for (var k = 0; k < l[i].loot.length; k++) {
        gesamt++;
        if (!l[i].loot[k].taken) { offen++; wert += l[i].loot[k].value; }
      }
    }
    return { raeume: l.length, beuteGesamt: gesamt, beuteOffen: offen, restwert: wert };
  };

  // Beute-Zustand sichern und wiederherstellen.
  API.saveState = function () {
    var l = API.list, out = {};
    for (var i = 0; i < l.length; i++) {
      var genommen = [];
      for (var k = 0; k < l[i].loot.length; k++) {
        if (l[i].loot[k].taken) genommen.push(l[i].loot[k].id);
      }
      out[l[i].id] = genommen;
    }
    return out;
  };

  API.loadState = function (state) {
    if (!state) return;
    var l = API.list;
    for (var i = 0; i < l.length; i++) {
      var rec = l[i];
      var genommen = state[rec.id];
      if (!genommen) continue;
      for (var k = 0; k < rec.loot.length; k++) {
        var it = rec.loot[k];
        if (genommen.indexOf(it.id) < 0 || it.taken) continue;
        it.taken = true;
        if (it.mesh) {
          rec.group.remove(it.mesh);
          if (GTA.U && GTA.U.disposeObject) GTA.U.disposeObject(it.mesh);
          it.mesh = null;
        }
      }
    }
  };

  // Alles wieder abräumen (Neustart / Grafikwechsel).
  API.dispose = function (ctx) {
    var l = API.list;
    for (var i = 0; i < l.length; i++) {
      if (ctx && ctx.scene && GTA.U && GTA.U.removeFromScene) {
        GTA.U.removeFromScene(ctx.scene, l[i].group);
      }
    }
    API.list = [];
    if (ctx) ctx.interiors = [];
    _mcache = {};
  };

  // Deutscher Anzeigename einer Raumart.
  API.titleFor = function (kind) {
    return ROOMS[kind] ? ROOMS[kind].title : 'Raum';
  };

  // Nur für Tests: gibt es zu jeder Art aus CFG auch eine Einrichtung?
  API.checkComplete = function () {
    var fehlend = [];
    for (var i = 0; i < KINDS.length; i++) {
      if (!ROOMS[KINDS[i]] || !FURNISH[KINDS[i]]) fehlend.push(KINDS[i]);
    }
    return fehlend;
  };

  return API;
})();
