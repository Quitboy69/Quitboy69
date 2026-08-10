'use strict';
/* ============================================================
   items.js — Gegenstände, die in der Welt liegen und aufgehoben
   werden können. Abhängig von: config.js, util.js, textures.js,
   player.js, audio.js. Definiert GTA.Items.

   Ein Gegenstand:
     { id, type, x, z, y, mesh, ring, t, taken, respawnT, fest }
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Items = (function () {
  var I = {};
  var U, CFG, TEX;
  var AUFHEB_RADIUS = 1.5;

  function ensure() { U = GTA.U; CFG = GTA.CFG; TEX = GTA.TEX; }

  /* ============================================================
     1. Modelle
     ============================================================ */
  function geldbuendel() {
    var g = new THREE.Group();
    var scheinM = U.mat(0x6fae52, 0.8, 0);
    for (var i = 0; i < 4; i++) {
      var s = U.box(0.42, 0.035, 0.22, scheinM);
      s.position.y = i * 0.038;
      s.rotation.y = U.rand(-0.09, 0.09);
      g.add(s);
    }
    var band = U.box(0.1, 0.17, 0.24, U.mat(0xd8342c, 0.8, 0), false);
    band.position.y = 0.06;
    g.add(band);
    return g;
  }

  function geldkoffer() {
    var g = new THREE.Group();
    var k = U.box(0.62, 0.22, 0.44, U.mat(0x3a3d44, 0.6, 0.25));
    k.position.y = 0.11;
    g.add(k);
    var deckel = U.box(0.64, 0.05, 0.46, U.mat(0x2c2f35, 0.6, 0.3));
    deckel.position.y = 0.235;
    g.add(deckel);
    var griff = U.torus(0.09, 0.022, 6, 12, TEX.M.chrome, false);
    griff.rotation.x = Math.PI / 2;
    griff.position.set(0, 0.3, 0);
    g.add(griff);
    [-0.18, 0.18].forEach(function (sx) {
      var schloss = U.box(0.08, 0.06, 0.03, TEX.M.chrome, false);
      schloss.position.set(sx, 0.2, 0.23);
      g.add(schloss);
    });
    return g;
  }

  function erstehilfe() {
    var g = new THREE.Group();
    var k = U.box(0.44, 0.3, 0.3, U.mat(0xf2f4f6, 0.65, 0));
    k.position.y = 0.15;
    g.add(k);
    var kreuzM = U.mat(0xd8342c, 0.6, 0);
    var kv = U.box(0.09, 0.2, 0.02, kreuzM, false);
    kv.position.set(0, 0.16, 0.16);
    g.add(kv);
    var kh = U.box(0.2, 0.09, 0.02, kreuzM, false);
    kh.position.set(0, 0.16, 0.16);
    g.add(kh);
    var griff = U.box(0.16, 0.04, 0.04, U.mat(0x3a3d44, 0.7, 0), false);
    griff.position.y = 0.32;
    g.add(griff);
    return g;
  }

  function verband() {
    var g = new THREE.Group();
    var rolle = U.cyl(0.11, 0.11, 0.16, 14, U.mat(0xf4f2ec, 0.85, 0));
    rolle.rotation.z = Math.PI / 2;
    rolle.position.y = 0.11;
    g.add(rolle);
    var streifen = U.box(0.17, 0.02, 0.14, U.mat(0xe8e4d8, 0.85, 0), false);
    streifen.position.set(0, 0.11, 0.11);
    g.add(streifen);
    return g;
  }

  function weste() {
    var g = new THREE.Group();
    var m = U.mat(0x2f4a3a, 0.75, 0.1);
    var brust = U.box(0.38, 0.42, 0.16, m);
    brust.position.y = 0.28;
    g.add(brust);
    [-0.14, 0.14].forEach(function (sx) {
      var traeger = U.box(0.09, 0.16, 0.14, m);
      traeger.position.set(sx, 0.55, 0);
      g.add(traeger);
    });
    var platte = U.box(0.3, 0.2, 0.03, U.mat(0x1e2a22, 0.6, 0.3), false);
    platte.position.set(0, 0.3, 0.09);
    g.add(platte);
    return g;
  }

  function helm() {
    var g = new THREE.Group();
    var schale = U.sph(0.2, 14, 12, U.mat(0xe8a020, 0.5, 0.2));
    schale.scale.y = 0.8;
    schale.position.y = 0.16;
    g.add(schale);
    var rand = U.torus(0.19, 0.028, 6, 16, U.mat(0xd08810, 0.6, 0.2), false);
    rand.rotation.x = Math.PI / 2;
    rand.position.y = 0.08;
    g.add(rand);
    return g;
  }

  function munikiste(farbe) {
    var g = new THREE.Group();
    var k = U.box(0.4, 0.2, 0.26, U.mat(farbe, 0.7, 0.15));
    k.position.y = 0.1;
    g.add(k);
    var deckel = U.box(0.42, 0.04, 0.28, U.mat(0x2f3238, 0.7, 0.2));
    deckel.position.y = 0.22;
    g.add(deckel);
    for (var i = 0; i < 3; i++) {
      var patrone = U.cyl(0.028, 0.028, 0.13, 8, TEX.M.chrome, false);
      patrone.position.set(-0.1 + i * 0.1, 0.29, 0);
      g.add(patrone);
      var spitze = U.cone(0.028, 0.05, 8, U.mat(0xb08040, 0.4, 0.7), false);
      spitze.position.set(-0.1 + i * 0.1, 0.37, 0);
      g.add(spitze);
    }
    return g;
  }

  function waffenkiste() {
    var g = new THREE.Group();
    var k = U.box(0.85, 0.26, 0.38, TEX.M.woodDark);
    k.position.y = 0.13;
    g.add(k);
    var deckel = U.box(0.87, 0.06, 0.4, U.mat(0x4a3520, 0.8, 0));
    deckel.position.y = 0.29;
    g.add(deckel);
    [-0.3, 0.3].forEach(function (sx) {
      var band = U.box(0.06, 0.34, 0.42, TEX.M.metal, false);
      band.position.set(sx, 0.16, 0);
      g.add(band);
    });
    return g;
  }

  function kanister() {
    var g = new THREE.Group();
    var k = U.box(0.28, 0.42, 0.16, U.mat(0xc23b25, 0.7, 0.1));
    k.position.y = 0.21;
    g.add(k);
    var griff = U.box(0.22, 0.05, 0.05, U.mat(0x9a2f1e, 0.7, 0.1), false);
    griff.position.y = 0.45;
    g.add(griff);
    var stutzen = U.cyl(0.045, 0.045, 0.12, 8, TEX.M.metal, false);
    stutzen.position.set(0.1, 0.47, 0);
    stutzen.rotation.z = -0.3;
    g.add(stutzen);
    return g;
  }

  function werkzeugkasten() {
    var g = new THREE.Group();
    var k = U.box(0.5, 0.22, 0.24, U.mat(0xd8342c, 0.7, 0.15));
    k.position.y = 0.11;
    g.add(k);
    var oben = U.box(0.5, 0.06, 0.24, U.mat(0xb02a20, 0.7, 0.15));
    oben.position.y = 0.25;
    g.add(oben);
    var buegel = U.torus(0.1, 0.02, 6, 12, TEX.M.chrome, false);
    buegel.rotation.x = Math.PI / 2;
    buegel.position.y = 0.33;
    g.add(buegel);
    var schluessel = U.box(0.24, 0.03, 0.05, TEX.M.chrome, false);
    schluessel.position.set(0.1, 0.29, 0.09);
    g.add(schluessel);
    return g;
  }

  function autoschluessel() {
    var g = new THREE.Group();
    var bart = U.box(0.05, 0.16, 0.015, TEX.M.chrome, false);
    bart.position.y = 0.1;
    g.add(bart);
    var kopf = U.box(0.11, 0.08, 0.03, U.mat(0x2b2f36, 0.6, 0.3), false);
    kopf.position.y = 0.22;
    g.add(kopf);
    var ring = U.torus(0.045, 0.01, 6, 12, TEX.M.chrome, false);
    ring.position.y = 0.3;
    g.add(ring);
    return g;
  }

  function bierkrug() {
    var g = new THREE.Group();
    var krug = U.cyl(0.1, 0.085, 0.24, 14, U.mat(0xdfe6ea, 0.2, 0.1, { transparent: true, opacity: 0.55 }));
    krug.position.y = 0.12;
    g.add(krug);
    var bier = U.cyl(0.088, 0.075, 0.18, 14, U.mat(0xd8a020, 0.35, 0), false);
    bier.position.y = 0.1;
    g.add(bier);
    var schaum = U.cyl(0.09, 0.09, 0.045, 14, U.mat(0xf8f4e8, 0.8, 0), false);
    schaum.position.y = 0.21;
    g.add(schaum);
    var henkel = U.torus(0.06, 0.016, 6, 12, U.mat(0xdfe6ea, 0.2, 0.1, { transparent: true, opacity: 0.55 }), false);
    henkel.position.set(0.11, 0.13, 0);
    g.add(henkel);
    return g;
  }

  function semmel() {
    var g = new THREE.Group();
    var unten = U.sph(0.13, 12, 10, U.mat(0xd8b478, 0.85, 0));
    unten.scale.set(1, 0.5, 1);
    unten.position.y = 0.07;
    g.add(unten);
    var belag = U.cyl(0.115, 0.115, 0.03, 14, U.mat(0xb05a4a, 0.75, 0), false);
    belag.position.y = 0.115;
    g.add(belag);
    var oben = U.sph(0.13, 12, 10, U.mat(0xe0c088, 0.85, 0));
    oben.scale.set(1, 0.55, 1);
    oben.position.y = 0.17;
    g.add(oben);
    return g;
  }

  function edelweiss() {
    var g = new THREE.Group();
    var stiel = U.cyl(0.012, 0.014, 0.26, 6, U.mat(0x4a7a3a, 0.9, 0));
    stiel.position.y = 0.13;
    g.add(stiel);
    var mitte = U.sph(0.035, 8, 8, U.mat(0xe8d060, 0.7, 0), false);
    mitte.position.y = 0.27;
    g.add(mitte);
    var blattM = U.mat(0xf4f2e8, 0.85, 0);
    for (var i = 0; i < 7; i++) {
      var a = i / 7 * Math.PI * 2;
      var bl = U.box(0.09, 0.012, 0.035, blattM, false);
      bl.position.set(Math.cos(a) * 0.06, 0.27, Math.sin(a) * 0.06);
      bl.rotation.y = -a;
      g.add(bl);
    }
    return g;
  }

  function schnaps() {
    var g = new THREE.Group();
    var glas = U.mat(0x9ac08a, 0.15, 0.2, { transparent: true, opacity: 0.7 });
    var bauch = U.cyl(0.07, 0.08, 0.22, 12, glas);
    bauch.position.y = 0.11;
    g.add(bauch);
    var hals = U.cyl(0.028, 0.04, 0.14, 10, glas);
    hals.position.y = 0.28;
    g.add(hals);
    var korken = U.cyl(0.03, 0.03, 0.05, 8, U.mat(0xb08347, 0.8, 0), false);
    korken.position.y = 0.37;
    g.add(korken);
    var etikett = U.box(0.1, 0.09, 0.005, U.mat(0xf4f0e0, 0.8, 0), false);
    etikett.position.set(0, 0.12, 0.075);
    g.add(etikett);
    return g;
  }

  function kaffee() {
    var g = new THREE.Group();
    var becher = U.cyl(0.055, 0.045, 0.14, 12, U.mat(0xf2f0ea, 0.7, 0));
    becher.position.y = 0.07;
    g.add(becher);
    var deckel = U.cyl(0.06, 0.06, 0.02, 12, U.mat(0x8a4a2a, 0.7, 0), false);
    deckel.position.y = 0.15;
    g.add(deckel);
    return g;
  }

  /* ============================================================
     2. Katalog
     ============================================================ */
  I.TYPES = {
    geld:        { name: 'Geldbündel',        icon: '💶', kind: 'cash',   value: 150, color: 0x6fae52, build: geldbuendel, gewicht: 26 },
    koffer:      { name: 'Geldkoffer',        icon: '💼', kind: 'cash',   value: 800, color: 0xffd23c, build: geldkoffer,  gewicht: 4 },
    erstehilfe:  { name: 'Erste-Hilfe-Kasten',icon: '🧰', kind: 'health', value: 55,  color: 0xd8342c, build: erstehilfe,  gewicht: 16 },
    verband:     { name: 'Verbandspäckchen',  icon: '🩹', kind: 'health', value: 22,  color: 0xf4f2ec, build: verband,     gewicht: 20 },
    weste:       { name: 'Schutzweste',       icon: '🦺', kind: 'armor',  value: 60,  color: 0x2f4a3a, build: weste,       gewicht: 10 },
    helm:        { name: 'Schutzhelm',        icon: '⛑', kind: 'armor',  value: 30,  color: 0xe8a020, build: helm,        gewicht: 10 },
    muni_pistole:{ name: 'Pistolenmunition',  icon: '🔩', kind: 'ammo',   value: 24,  color: 0x8a6a30, build: function () { return munikiste(0x6b5a34); }, ammoId: 'pistole', gewicht: 18 },
    muni_schrot: { name: 'Schrotpatronen',    icon: '🔴', kind: 'ammo',   value: 12,  color: 0x9a3a2a, build: function () { return munikiste(0x7a2f24); }, ammoId: 'schrot', gewicht: 12 },
    muni_mp:     { name: 'MP-Magazin',        icon: '🔫', kind: 'ammo',   value: 45,  color: 0x3a4650, build: function () { return munikiste(0x37414a); }, ammoId: 'mp', gewicht: 9 },
    waffenkiste: { name: 'Waffenkiste',       icon: '📦', kind: 'weapon', value: 1,   color: 0x8a6a40, build: waffenkiste, gewicht: 5 },
    kanister:    { name: 'Benzinkanister',    icon: '⛽', kind: 'collect',value: 40,  color: 0xc23b25, build: kanister,    gewicht: 12 },
    werkzeug:    { name: 'Werkzeugkasten',    icon: '🔧', kind: 'collect',value: 65,  color: 0xd8342c, build: werkzeugkasten, gewicht: 12 },
    schluessel:  { name: 'Autoschlüssel',     icon: '🔑', kind: 'collect',value: 35,  color: 0xc8ccd2, build: autoschluessel, gewicht: 10 },
    bier:        { name: 'Bierkrug',          icon: '🍺', kind: 'health', value: 14,  color: 0xd8a020, build: bierkrug,    gewicht: 14 },
    semmel:      { name: 'Leberkässemmel',    icon: '🥪', kind: 'health', value: 26,  color: 0xd8b478, build: semmel,      gewicht: 16 },
    schnaps:     { name: 'Obstler',           icon: '🍶', kind: 'health', value: 18,  color: 0x9ac08a, build: schnaps,     gewicht: 10 },
    kaffee:      { name: 'Verlängerter',      icon: '☕', kind: 'health', value: 12,  color: 0x8a4a2a, build: kaffee,      gewicht: 12 },
    edelweiss:   { name: 'Edelweiß',          icon: '🌼', kind: 'sammel', value: 250, color: 0xf4f2e8, build: edelweiss,   gewicht: 0 }
  };

  /* Welche Waffe steckt in einer Waffenkiste? Zufällig aus dem, was es gibt. */
  function zufallswaffe() {
    if (!GTA.Weapons || !GTA.Weapons.CATALOG) return null;
    var pool = GTA.Weapons.CATALOG.filter(function (w) {
      return w.id !== 'faeuste' && w.price > 0 && w.price <= 3500;
    });
    return pool.length ? U.pick(pool) : null;
  }

  /* ============================================================
     3. Setzen
     ============================================================ */
  I.spawn = function (ctx, typeId, x, z, y, fest) {
    ensure();
    var def = I.TYPES[typeId];
    if (!def) return null;

    var g = new THREE.Group();
    var koerper = def.build();
    g.add(koerper);

    // Leuchtender Boden-Ring macht Gegenstände von weitem sichtbar.
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.5, 20),
      new THREE.MeshBasicMaterial({
        color: def.color, transparent: true, opacity: 0.42,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);

    var basisY = y === undefined ? 0.45 : y;
    g.position.set(x, basisY, z);
    ctx.scene.add(g);

    var item = {
      id: 'it' + (ctx.items.length) + '_' + typeId,
      type: typeId, def: def,
      x: x, z: z, y: basisY,
      mesh: g, koerper: koerper, ring: ring,
      t: Math.random() * 6.28,
      taken: false, respawnT: 0,
      fest: !!fest
    };
    ctx.items.push(item);
    return item;
  };

  /* ============================================================
     4. Weltverteilung
     ============================================================ */
  I.build = function (ctx) {
    ensure();

    // a) Feste Punkte an markanten Orten
    var L = CFG.LAKE;
    var feste = [
      ['erstehilfe', 96, -100], ['geld', 100, -122], ['bier', 92, -108],
      ['kanister', -150, 158], ['werkzeug', -142, 146], ['muni_pistole', -158, 144],
      ['semmel', L.x - 70, L.z + 16], ['bier', L.x - 66, L.z + 20], ['weste', L.x - 88, L.z - 8],
      ['geld', 40, 34], ['kaffee', 34, 26], ['schluessel', 46, 34],
      ['waffenkiste', -210, 92], ['muni_schrot', -206, 96],
      ['koffer', 250, -152], ['muni_mp', 246, -148],
      ['verband', 20, 42], ['helm', -20, -38]
    ];
    feste.forEach(function (f) { I.spawn(ctx, f[0], f[1], f[2]); });

    // b) Streuung in der Landschaft
    var typen = Object.keys(I.TYPES);
    var gewichtet = [];
    typen.forEach(function (t) {
      var n = I.TYPES[t].gewicht || 0;
      for (var i = 0; i < n; i++) gewichtet.push(t);
    });

    var gesetzt = 0, versuche = 0;
    while (gesetzt < 60 && versuche < 3000) {
      versuche++;
      var a = U.rand(0, Math.PI * 2), r = U.rand(26, 430);
      var x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (U.isNearRoad(x, z, 2)) continue;          // nicht mitten auf der Fahrbahn
      if (U.inLake(x, z)) continue;
      if (!U.isFree(ctx, x, z, 1.2)) continue;
      if (GTA.Interiors && GTA.Interiors.at && GTA.Interiors.at(x, z)) continue;
      I.spawn(ctx, U.pick(gewichtet), x, z);
      gesetzt++;
    }

    // c) Edelweiß als Sammelziel — schwer erreichbar, weiter draußen
    var blumen = 0, v2 = 0;
    while (blumen < 12 && v2 < 900) {
      v2++;
      var a2 = U.rand(0, Math.PI * 2), r2 = U.rand(300, 560);
      var bx = Math.cos(a2) * r2, bz = Math.sin(a2) * r2;
      if (U.isNearRoad(bx, bz, 6) || U.inLake(bx, bz)) continue;
      if (!U.isFree(ctx, bx, bz, 1.2)) continue;
      I.spawn(ctx, 'edelweiss', bx, bz, 0.3, true);
      blumen++;
    }

    return ctx.items;
  };

  /* ============================================================
     5. Aufsammeln
     ============================================================ */
  function wirkung(ctx, item) {
    var def = item.def;
    var p = ctx.player;
    var text = def.name, unter = '', farbe = '#2ecc71';

    if (def.kind === 'cash') {
      GTA.Player.addMoney(ctx, def.value);
      unter = '+' + U.fmtMoney(def.value);
      farbe = '#ffd23c';
      if (GTA.Audio) GTA.Audio.cash();
    } else if (def.kind === 'health') {
      GTA.Player.heal(ctx, def.value);
      unter = '+' + def.value + ' Gesundheit';
      if (GTA.Audio) GTA.Audio.pickup();
    } else if (def.kind === 'armor') {
      GTA.Player.addArmor(ctx, def.value);
      unter = '+' + def.value + ' Schutz';
      farbe = '#8ed1ff';
      if (GTA.Audio) GTA.Audio.pickup();
    } else if (def.kind === 'ammo') {
      GTA.Player.giveAmmo(ctx, def.ammoId, def.value);
      unter = '+' + def.value + ' Schuss';
      farbe = '#c8ccd2';
      if (GTA.Audio) GTA.Audio.reload();
    } else if (def.kind === 'weapon') {
      var w = zufallswaffe();
      if (w) {
        var neu = GTA.Player.giveWeapon(ctx, w.id);
        text = w.name;
        unter = neu ? 'neue Waffe' : 'schon vorhanden — Munition dazu';
        if (w.ammoId) GTA.Player.giveAmmo(ctx, w.ammoId, w.clip ? w.clip * 2 : 20);
        farbe = '#ff8c22';
      } else {
        GTA.Player.addMoney(ctx, 120);
        unter = '+' + U.fmtMoney(120);
      }
      if (GTA.Audio) GTA.Audio.jingle();
    } else if (def.kind === 'sammel') {
      p.stats.collected[item.type] = (p.stats.collected[item.type] || 0) + 1;
      GTA.Player.addMoney(ctx, def.value);
      unter = p.stats.collected[item.type] + ' gefunden · +' + U.fmtMoney(def.value);
      farbe = '#f4f2e8';
      if (GTA.Audio) GTA.Audio.jingle();
    } else {
      GTA.Player.addMoney(ctx, def.value);
      unter = '+' + U.fmtMoney(def.value);
      if (GTA.Audio) GTA.Audio.pickup();
    }

    p.stats.itemsFound = (p.stats.itemsFound || 0) + 1;
    if (GTA.UI && GTA.UI.showToast) GTA.UI.showToast(text.toUpperCase(), unter, farbe);
    GTA.Player.save(ctx);
  }

  I.collect = function (ctx, item) {
    if (!item || item.taken) return false;
    item.taken = true;
    item.mesh.visible = false;
    // Sammelobjekte kommen nicht wieder, alles andere nach einer Weile.
    item.respawnT = item.def.kind === 'sammel' ? -1 : U.rand(60, 120);
    wirkung(ctx, item);
    return true;
  };

  /* Nächster erreichbarer Gegenstand (nur zu Fuß). */
  I.nearest = function (ctx, radius) {
    var p = ctx.player;
    if (p.car) return null;
    var r = radius === undefined ? AUFHEB_RADIUS : radius;
    var best = null, bd = r;
    for (var i = 0; i < ctx.items.length; i++) {
      var it = ctx.items[i];
      if (it.taken) continue;
      var d = U.dist2d(p.x, p.z, it.x, it.z);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  };

  /* Von der [F]-Taste gerufen: auch Haus-Beute mitnehmen. */
  I.collectNearest = function (ctx) {
    var p = ctx.player;
    if (p.car) return false;
    var etwas = false;
    var it = I.nearest(ctx, 2.2);
    if (it) { I.collect(ctx, it); etwas = true; }
    if (GTA.Interiors && GTA.Interiors.collect) {
      var beute = GTA.Interiors.collect(ctx, p.x, p.z, 2.2);
      if (beute && beute.length) etwas = true;
    }
    return etwas;
  };

  /* Hinweistext für die Fußzeile, falls etwas in Reichweite liegt. */
  I.hintFor = function (ctx) {
    var p = ctx.player;
    if (p.car) return null;
    var it = I.nearest(ctx, 2.2);
    if (it) return it.def.name + ' aufheben';
    if (GTA.Interiors && GTA.Interiors.nearestLoot) {
      var l = GTA.Interiors.nearestLoot(p.x, p.z, 2.2);
      if (l) return (l.name || 'Gegenstand') + ' aufheben';
    }
    return null;
  };

  /* Von anderen Modulen (z. B. Haus-Beute) gerufen. */
  I.give = function (typeId, anzahl, quelle) {
    var ctx = GTA.ctx;
    if (!ctx) return false;
    var def = I.TYPES[typeId];
    if (!def) return false;
    var n = anzahl || 1;
    for (var i = 0; i < n; i++) {
      wirkung(ctx, { def: def, type: typeId });
    }
    return true;
  };

  /* ============================================================
     6. Laufzeit
     ============================================================ */
  I.update = function (ctx, dt) {
    var p = ctx.player;
    var zuFuss = !p.car;

    for (var i = 0; i < ctx.items.length; i++) {
      var it = ctx.items[i];

      if (it.taken) {
        if (it.respawnT < 0) continue;             // kommt nie wieder
        it.respawnT -= dt;
        if (it.respawnT <= 0) {
          it.taken = false;
          it.mesh.visible = true;
        }
        continue;
      }

      // Schweben und drehen — nur in der Nähe, spart Rechenzeit.
      var d = U.dist2d(p.x, p.z, it.x, it.z);
      if (d < 60) {
        it.t += dt * 2.1;
        it.koerper.rotation.y += dt * 1.15;
        it.mesh.position.y = it.y + Math.sin(it.t) * 0.09;
        if (it.ring) it.ring.material.opacity = 0.3 + Math.sin(it.t * 1.4) * 0.14;
      }

      // Beim Drüberlaufen automatisch einsammeln.
      if (zuFuss && d < AUFHEB_RADIUS) I.collect(ctx, it);
    }
  };

  /* Alles wieder abräumen (Missionsende, Neustart). */
  I.remove = function (ctx, item) {
    var idx = ctx.items.indexOf(item);
    if (idx >= 0) ctx.items.splice(idx, 1);
    U.removeFromScene(ctx.scene, item.mesh);
  };

  I.count = function (ctx, typeId) {
    var n = 0;
    for (var i = 0; i < ctx.items.length; i++) {
      if (ctx.items[i].type === typeId && !ctx.items[i].taken) n++;
    }
    return n;
  };

  return I;
})();
