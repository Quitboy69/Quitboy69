'use strict';
/* ============================================================
   weapons.js — Waffen, Nahkampf, Schüsse, Wurfobjekte
   Abhängig von: config.js, util.js, textures.js, player.js,
                 npcs.js, audio.js. Definiert GTA.Weapons.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Weapons = (function () {
  var W = {};
  var U, TEX;
  var flieger = [];      // fliegende Wurfobjekte
  var kurzlebig = [];    // Mündungsblitze und Leuchtspuren
  var byIdCache = null;

  function ensure() { U = GTA.U; TEX = GTA.TEX; }

  /* ============================================================
     1. Handmodelle
     ============================================================ */
  function mSchlagring() {
    var g = new THREE.Group();
    var r = U.torus(0.05, 0.016, 6, 14, TEX.M.chrome, false);
    r.rotation.y = Math.PI / 2;
    r.position.set(0, -0.7, 0.03);
    g.add(r);
    for (var i = 0; i < 3; i++) {
      var z = U.sph(0.017, 6, 6, TEX.M.chrome, false);
      z.position.set(0, -0.655, 0.055 - i * 0.001);
      z.position.x = (i - 1) * 0.028;
      g.add(z);
    }
    return g;
  }

  function mMesser() {
    var g = new THREE.Group();
    var griff = U.box(0.035, 0.13, 0.045, U.mat(0x2a1c14, 0.8, 0), false);
    griff.position.set(0, -0.7, 0.04);
    g.add(griff);
    var klinge = U.box(0.022, 0.22, 0.06, TEX.M.chrome, false);
    klinge.position.set(0, -0.55, 0.06);
    g.add(klinge);
    var spitze = U.cone(0.035, 0.09, 4, TEX.M.chrome, false);
    spitze.position.set(0, -0.42, 0.06);
    spitze.rotation.x = Math.PI / 2;
    spitze.rotation.z = Math.PI / 4;
    g.add(spitze);
    return g;
  }

  function mSchlaeger() {
    var b = U.cyl(0.045, 0.072, 0.86, 10, U.mat(0xb08347, 0.7, 0));
    b.position.set(0, -0.62, 0.25);
    b.rotation.x = 0.5;
    return b;
  }

  function mBrechstange() {
    var g = new THREE.Group();
    var m = U.mat(0xc4342a, 0.55, 0.5);
    var stange = U.cyl(0.022, 0.022, 0.78, 8, m);
    stange.position.set(0, -0.64, 0.2);
    stange.rotation.x = 0.45;
    g.add(stange);
    var haken = U.box(0.05, 0.14, 0.035, m, false);
    haken.position.set(0, -0.34, 0.36);
    haken.rotation.x = 1.0;
    g.add(haken);
    return g;
  }

  function mSchaufel() {
    var g = new THREE.Group();
    var stiel = U.cyl(0.024, 0.028, 0.8, 8, TEX.M.wood);
    stiel.position.set(0, -0.62, 0.22);
    stiel.rotation.x = 0.45;
    g.add(stiel);
    var blatt = U.box(0.22, 0.28, 0.03, TEX.M.metal, false);
    blatt.position.set(0, -0.3, 0.4);
    blatt.rotation.x = 0.45;
    g.add(blatt);
    return g;
  }

  function pistolenKoerper(farbe, lauflaenge, dick) {
    var g = new THREE.Group();
    var m = U.mat(farbe, 0.45, 0.65);
    var lauf = U.box(dick, dick * 1.25, lauflaenge, m, false);
    lauf.position.set(0, -0.6, 0.16 + lauflaenge * 0.4);
    g.add(lauf);
    var griff = U.box(dick * 0.9, 0.15, 0.07, U.mat(0x1d2027, 0.75, 0.2), false);
    griff.position.set(0, -0.7, 0.06);
    griff.rotation.x = -0.28;
    g.add(griff);
    var abzug = U.box(0.02, 0.05, 0.02, TEX.M.chrome, false);
    abzug.position.set(0, -0.655, 0.11);
    g.add(abzug);
    return g;
  }

  function mPistole() { return pistolenKoerper(0x23262c, 0.3, 0.055); }
  function mRevolver() {
    var g = pistolenKoerper(0x3a3d44, 0.26, 0.05);
    var trommel = U.cyl(0.05, 0.05, 0.08, 10, TEX.M.chrome, false);
    trommel.rotation.z = Math.PI / 2;
    trommel.position.set(0, -0.6, 0.19);
    g.add(trommel);
    return g;
  }
  function mSchrot() {
    var g = pistolenKoerper(0x2b2f36, 0.62, 0.062);
    var schaft = U.box(0.055, 0.1, 0.24, TEX.M.woodDark, false);
    schaft.position.set(0, -0.66, 0.0);
    g.add(schaft);
    var vorderschaft = U.box(0.06, 0.06, 0.16, TEX.M.woodDark, false);
    vorderschaft.position.set(0, -0.63, 0.33);
    g.add(vorderschaft);
    return g;
  }
  function mMp() {
    var g = pistolenKoerper(0x1f2228, 0.34, 0.052);
    var magazin = U.box(0.04, 0.19, 0.05, U.mat(0x2b2f36, 0.6, 0.4), false);
    magazin.position.set(0, -0.74, 0.17);
    g.add(magazin);
    var schiene = U.box(0.03, 0.02, 0.2, TEX.M.metal, false);
    schiene.position.set(0, -0.555, 0.24);
    g.add(schiene);
    return g;
  }
  function mGewehr() {
    var g = pistolenKoerper(0x2f3238, 0.72, 0.05);
    var schaft = U.box(0.05, 0.11, 0.28, TEX.M.woodDark, false);
    schaft.position.set(0, -0.67, -0.02);
    g.add(schaft);
    var zielfernrohr = U.cyl(0.028, 0.028, 0.2, 10, TEX.M.dark, false);
    zielfernrohr.rotation.x = Math.PI / 2;
    zielfernrohr.position.set(0, -0.53, 0.26);
    g.add(zielfernrohr);
    return g;
  }
  function mLeucht() {
    var g = pistolenKoerper(0xd8342c, 0.24, 0.07);
    return g;
  }
  function mMolotow() {
    var g = new THREE.Group();
    var flasche = U.cyl(0.05, 0.06, 0.19, 10,
      U.mat(0x9ac08a, 0.15, 0.25, { transparent: true, opacity: 0.75 }), false);
    flasche.position.set(0, -0.66, 0.05);
    g.add(flasche);
    var hals = U.cyl(0.024, 0.032, 0.09, 8,
      U.mat(0x9ac08a, 0.15, 0.25, { transparent: true, opacity: 0.75 }), false);
    hals.position.set(0, -0.55, 0.05);
    g.add(hals);
    var lappen = U.box(0.03, 0.08, 0.03, U.mat(0xd8d0b8, 0.9, 0), false);
    lappen.position.set(0, -0.48, 0.05);
    g.add(lappen);
    return g;
  }
  function mStein() {
    var s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), U.mat(0x8b8d90, 0.95, 0));
    s.position.set(0, -0.68, 0.05);
    return s;
  }

  /* ============================================================
     2. Katalog
     ============================================================ */
  W.CATALOG = [
    { id: 'faeuste',   name: 'Fäuste',            desc: 'Immer dabei, kostet nix.',                 icon: '👊', typ: 'nah',   price: 0,    dmg: 1,  range: 2.2, cooldown: 0.38, heat: 0.35, mesh: null },
    { id: 'schlagring',name: 'Schlagring',        desc: 'Klein, unauffällig, tut weh.',             icon: '🪨', typ: 'nah',   price: 250,  dmg: 2,  range: 2.3, cooldown: 0.38, heat: 0.4,  mesh: mSchlagring },
    { id: 'messer',    name: 'Klappmesser',       desc: 'Schnell und leise.',                       icon: '🔪', typ: 'nah',   price: 400,  dmg: 3,  range: 2.4, cooldown: 0.32, heat: 0.5,  mesh: mMesser },
    { id: 'schlaeger', name: 'Baseballschläger',  desc: 'Mehr Wumms, mehr Reichweite.',             icon: '🏏', typ: 'nah',   price: 550,  dmg: 3,  range: 2.9, cooldown: 0.52, heat: 0.45, mesh: mSchlaeger },
    { id: 'brechstange',name:'Brechstange',       desc: 'Öffnet Türen und Diskussionen.',           icon: '🪛', typ: 'nah',   price: 700,  dmg: 4,  range: 2.8, cooldown: 0.55, heat: 0.45, mesh: mBrechstange },
    { id: 'schaufel',  name: 'Feldschaufel',      desc: 'Vom Bauernhof, überraschend wirksam.',     icon: '🥄', typ: 'nah',   price: 850,  dmg: 5,  range: 3.0, cooldown: 0.62, heat: 0.5,  mesh: mSchaufel },
    { id: 'stein',     name: 'Wurfstein',         desc: 'Trifft auf Distanz, danach ist er weg.',   icon: '🪨', typ: 'wurf',  price: 60,   dmg: 3,  range: 34,  cooldown: 0.7,  heat: 0.5,  ammoId: 'stein',   clip: 0, mesh: mStein },
    { id: 'pistole',   name: 'Pistole',           desc: 'Solides Distanz-Argument.',                icon: '🔫', typ: 'schuss',price: 2000, dmg: 3,  range: 46,  cooldown: 0.36, heat: 1.0,  ammoId: 'pistole', clip: 12, spread: 0.024, mesh: mPistole,  klang: 'pistole' },
    { id: 'revolver',  name: 'Revolver',          desc: 'Sechs Schuss, jeder sitzt.',               icon: '🔫', typ: 'schuss',price: 3200, dmg: 6,  range: 52,  cooldown: 0.62, heat: 1.1,  ammoId: 'pistole', clip: 6,  spread: 0.018, mesh: mRevolver, klang: 'revolver' },
    { id: 'schrot',    name: 'Schrotflinte',      desc: 'Auf kurze Distanz vernichtend.',           icon: '🔫', typ: 'schuss',price: 5000, dmg: 3,  range: 22,  cooldown: 0.85, heat: 1.3,  ammoId: 'schrot',  clip: 6,  spread: 0.14, pellets: 7, mesh: mSchrot, klang: 'schrot' },
    { id: 'mp',        name: 'Maschinenpistole',  desc: 'Dauerfeuer, frisst Munition.',             icon: '🔫', typ: 'schuss',price: 8000, dmg: 2,  range: 40,  cooldown: 0.09, heat: 1.5,  ammoId: 'mp',      clip: 30, spread: 0.055, auto: true, mesh: mMp, klang: 'mp' },
    { id: 'gewehr',    name: 'Jagdgewehr',        desc: 'Präzise auf große Entfernung.',            icon: '🎯', typ: 'schuss',price: 12000,dmg: 9,  range: 130, cooldown: 1.2,  heat: 1.4,  ammoId: 'gewehr',  clip: 5,  spread: 0.004, mesh: mGewehr, klang: 'gewehr' },
    { id: 'leucht',    name: 'Leuchtpistole',     desc: 'Macht Lärm und zieht Aufmerksamkeit.',     icon: '🎆', typ: 'schuss',price: 1500, dmg: 4,  range: 36,  cooldown: 1.4,  heat: 2.0,  ammoId: 'leucht',  clip: 1,  spread: 0.03, mesh: mLeucht, klang: 'leucht' },
    { id: 'molotow',   name: 'Molotow',           desc: 'Fliegt weit, wirkt in der Fläche.',        icon: '🔥', typ: 'wurf',  price: 2500, dmg: 8,  range: 30,  cooldown: 1.3,  heat: 2.2,  ammoId: 'molotow', clip: 0, radius: 5.5, mesh: mMolotow }
  ];

  W.byId = function (id) {
    if (!byIdCache) {
      byIdCache = {};
      for (var i = 0; i < W.CATALOG.length; i++) byIdCache[W.CATALOG[i].id] = W.CATALOG[i];
    }
    return byIdCache[id] || null;
  };

  W.makeMesh = function (id) {
    ensure();
    var w = W.byId(id);
    if (!w || !w.mesh) return null;
    return w.mesh();
  };

  /* Welche Waffen besitzt der Spieler — in Katalogreihenfolge. */
  W.owned = function (ctx) {
    var out = [];
    for (var i = 0; i < W.CATALOG.length; i++) {
      if (ctx.player.weapons[W.CATALOG[i].id]) out.push(W.CATALOG[i]);
    }
    return out;
  };

  W.ammoOf = function (ctx, w) {
    if (!w || !w.ammoId) return Infinity;
    return ctx.player.ammo[w.ammoId] || 0;
  };

  /* ============================================================
     3. Auswahl
     ============================================================ */
  W.select = function (ctx, id) {
    if (!ctx.player.weapons[id]) return false;
    ctx.player.weapon = id;
    GTA.Player.refreshWeaponMesh(ctx);
    if (GTA.Audio) GTA.Audio.beep(420, 0.05, 0.14, 'square');
    GTA.Player.save(ctx);
    return true;
  };

  W.selectSlot = function (ctx, index) {
    var liste = W.owned(ctx);
    if (index < 0 || index >= liste.length) return false;
    return W.select(ctx, liste[index].id);
  };

  W.cycle = function (ctx, richtung) {
    var liste = W.owned(ctx);
    if (liste.length < 2) return false;
    var i = 0;
    for (var k = 0; k < liste.length; k++) if (liste[k].id === ctx.player.weapon) i = k;
    var n = (i + (richtung >= 0 ? 1 : -1) + liste.length) % liste.length;
    return W.select(ctx, liste[n].id);
  };

  /* ============================================================
     4. Nachladen
     ============================================================ */
  W.reload = function (ctx) {
    var p = ctx.player;
    var w = W.byId(p.weapon);
    if (!w || w.typ !== 'schuss' || !w.clip) return false;
    if (p.reloadT > 0) return false;
    p.magazin = p.magazin || {};
    var drin = p.magazin[w.id] === undefined ? w.clip : p.magazin[w.id];
    if (drin >= w.clip) return false;
    var vorrat = W.ammoOf(ctx, w);
    if (vorrat <= 0) {
      if (GTA.Audio) GTA.Audio.empty();
      if (GTA.UI) GTA.UI.showToast('KEINE MUNITION', w.name, '#ff5544');
      return false;
    }
    p.reloadT = 1.5;
    var brauche = w.clip - drin;
    var nimmt = Math.min(brauche, vorrat);
    p.ammo[w.ammoId] = vorrat - nimmt;
    p.magazin[w.id] = drin + nimmt;
    if (GTA.Audio) GTA.Audio.reload();
    return true;
  };

  W.canFire = function (ctx) {
    var p = ctx.player;
    if (p.car || p.attackCd > 0 || p.reloadT > 0) return false;
    if (GTA.Player.isDead()) return false;
    return true;
  };

  /* ============================================================
     5. Angriff
     ============================================================ */
  function trefferKegel(ctx, w) {
    var p = ctx.player;
    var getroffen = 0;
    for (var i = 0; i < ctx.npcs.length; i++) {
      var n = ctx.npcs[i];
      if (n.dead || n.state === 'down') continue;
      var dx = n.x - p.x, dz = n.z - p.z;
      var d = Math.hypot(dx, dz);
      if (d > w.range || d < 0.01) continue;
      var winkel = Math.atan2(dx / d, dz / d);
      if (Math.abs(U.angDiff(winkel, p.heading)) > 1.1) continue;
      if (GTA.NPCs && GTA.NPCs.takeHit) GTA.NPCs.takeHit(ctx, n, w.dmg, p.x, p.z);
      getroffen++;
    }
    return getroffen;
  }

  function leuchtspur(ctx, x0, z0, x1, z1, farbe) {
    var len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.2) return;
    var m = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.045, len),
      new THREE.MeshBasicMaterial({ color: farbe || 0xfff2a0, transparent: true, opacity: 0.85 })
    );
    m.position.set((x0 + x1) / 2, 1.32, (z0 + z1) / 2);
    m.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    ctx.scene.add(m);
    kurzlebig.push({ mesh: m, t: 0.07 });
  }

  function muendungsblitz(ctx, x, z, dirX, dirZ) {
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 7, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe08a })
    );
    m.position.set(x + dirX * 0.7, 1.34, z + dirZ * 0.7);
    ctx.scene.add(m);
    kurzlebig.push({ mesh: m, t: 0.06 });
  }

  /* Ein Strahl: sucht das NPC mit dem kleinsten Winkelabstand. */
  function strahl(ctx, w, streuung) {
    var p = ctx.player;
    var winkel = p.heading + U.rand(-streuung, streuung);
    var dirX = Math.sin(winkel), dirZ = Math.cos(winkel);
    var best = null, bestD = w.range;

    for (var i = 0; i < ctx.npcs.length; i++) {
      var n = ctx.npcs[i];
      if (n.dead || n.state === 'down') continue;
      var dx = n.x - p.x, dz = n.z - p.z;
      var d = Math.hypot(dx, dz);
      if (d > w.range || d < 0.4) continue;
      // Abstand des NPC zur Schusslinie
      var quer = Math.abs(dx * dirZ - dz * dirX);
      var laengs = dx * dirX + dz * dirZ;
      if (laengs <= 0 || quer > 0.55) continue;
      if (laengs < bestD) { bestD = laengs; best = n; }
    }

    var len = best ? bestD : w.range * 0.8;
    leuchtspur(ctx, p.x, p.z, p.x + dirX * len, p.z + dirZ * len,
      w.id === 'leucht' ? 0xff6622 : 0xfff2a0);
    if (best && GTA.NPCs && GTA.NPCs.takeHit) {
      GTA.NPCs.takeHit(ctx, best, w.dmg, p.x, p.z);
      return true;
    }
    return false;
  }

  function schiessen(ctx, w) {
    var p = ctx.player;
    p.magazin = p.magazin || {};
    if (p.magazin[w.id] === undefined) p.magazin[w.id] = w.clip;

    if (p.magazin[w.id] <= 0) {
      if (W.ammoOf(ctx, w) > 0) { W.reload(ctx); }
      else { if (GTA.Audio) GTA.Audio.empty(); }
      return false;
    }
    p.magazin[w.id]--;

    var dirX = Math.sin(p.heading), dirZ = Math.cos(p.heading);
    muendungsblitz(ctx, p.x, p.z, dirX, dirZ);
    if (GTA.Audio) GTA.Audio.shot(w.klang);

    var n = w.pellets || 1;
    for (var i = 0; i < n; i++) strahl(ctx, w, w.spread || 0.02);

    GTA.Player.addHeat(ctx, w.heat);
    // Zivilisten in der Umgebung erschrecken
    if (GTA.NPCs && GTA.NPCs.scare) GTA.NPCs.scare(ctx, p.x, p.z, 30, true);
    return true;
  }

  function werfen(ctx, w) {
    var p = ctx.player;
    if (w.ammoId) {
      var n = p.ammo[w.ammoId] || 0;
      if (n <= 0) {
        if (GTA.Audio) GTA.Audio.empty();
        if (GTA.UI) GTA.UI.showToast('NICHTS MEHR ZUM WERFEN', w.name, '#ff5544');
        return false;
      }
      p.ammo[w.ammoId] = n - 1;
    }
    var mesh = w.mesh ? w.mesh() : null;
    if (!mesh) mesh = U.sph(0.09, 8, 8, U.mat(0x8b8d90, 0.9, 0), false);
    mesh.position.set(p.x, 1.3, p.z);
    mesh.rotation.set(0, 0, 0);
    ctx.scene.add(mesh);

    flieger.push({
      mesh: mesh, def: w,
      x: p.x, y: 1.3, z: p.z,
      vx: Math.sin(p.heading) * 17,
      vy: 6.5,
      vz: Math.cos(p.heading) * 17,
      t: 0
    });
    if (GTA.Audio) GTA.Audio.swing();
    GTA.Player.addHeat(ctx, w.heat);
    return true;
  }

  /* Einziger Einstiegspunkt für einen Angriff. */
  W.attack = function (ctx, weaponId) {
    ensure();
    if (!W.canFire(ctx)) return false;
    var w = W.byId(weaponId || ctx.player.weapon);
    if (!w) return false;
    var p = ctx.player;

    // Schlaganimation: Arm kurz nach vorne
    var u = p.mesh ? p.mesh.userData : null;
    if (u) {
      u.armLock = true;
      u.armR.rotation.x = (w.typ === 'schuss') ? -Math.PI / 2 : -1.6;
      setTimeout(function () {
        if (u.armR) u.armR.rotation.x = 0;
        u.armLock = false;
      }, w.typ === 'schuss' ? 200 : 190);
    }

    p.attackCd = w.cooldown;

    if (w.typ === 'nah') {
      if (GTA.Audio) GTA.Audio.swing();
      var n = trefferKegel(ctx, w);
      if (n > 0) GTA.Player.addHeat(ctx, w.heat);
      return true;
    }
    if (w.typ === 'schuss') return schiessen(ctx, w);
    if (w.typ === 'wurf') return werfen(ctx, w);
    return false;
  };

  /* Für Dauerfeuer: wird jeden Frame gerufen, solange die Taste hängt. */
  W.attackAuto = function (ctx) {
    var w = W.byId(ctx.player.weapon);
    if (!w || !w.auto) return false;
    return W.attack(ctx, w.id);
  };

  /* ============================================================
     6. Laufzeit — Wurfobjekte und kurzlebige Effekte
     ============================================================ */
  function explosion(ctx, x, y, z, def) {
    var kugel = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius || 4, 14, 12),
      new THREE.MeshBasicMaterial({ color: 0xff7a22, transparent: true, opacity: 0.55 })
    );
    kugel.position.set(x, Math.max(0.6, y), z);
    ctx.scene.add(kugel);
    kurzlebig.push({ mesh: kugel, t: 0.45, schrumpf: true });

    if (GTA.Audio) { GTA.Audio.crash(); GTA.Audio.noise(0.5, 0.5, 260, 0.6); }

    var r = def.radius || 4;
    for (var i = 0; i < ctx.npcs.length; i++) {
      var n = ctx.npcs[i];
      if (n.dead || n.state === 'down') continue;
      var d = U.dist2d(n.x, n.z, x, z);
      if (d > r) continue;
      var anteil = 1 - d / r;
      if (GTA.NPCs && GTA.NPCs.takeHit) {
        GTA.NPCs.takeHit(ctx, n, Math.ceil(def.dmg * anteil), x, z);
      }
    }
    // Auch der Spieler bekommt etwas ab, wenn er zu nah steht.
    var dp = U.dist2d(ctx.player.x, ctx.player.z, x, z);
    if (dp < r) GTA.Player.damage(ctx, Math.ceil(22 * (1 - dp / r)), 'explosion');
    GTA.Player.addHeat(ctx, 0.8);
  }

  W.update = function (ctx, dt) {
    // Wurfobjekte
    for (var i = flieger.length - 1; i >= 0; i--) {
      var f = flieger[i];
      f.t += dt;
      f.vy -= 19 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.z += f.vz * dt;
      f.mesh.position.set(f.x, f.y, f.z);
      f.mesh.rotation.x += dt * 9;
      f.mesh.rotation.z += dt * 5;

      var getroffen = false;
      if (f.y <= 0.12) getroffen = true;
      if (!U.isFree(ctx, f.x, f.z, 0.3)) getroffen = true;
      if (f.t > 5) getroffen = true;

      if (getroffen) {
        if (f.def.radius) explosion(ctx, f.x, f.y, f.z, f.def);
        else {
          // Stein: Punktschaden auf das nächste Ziel
          for (var k = 0; k < ctx.npcs.length; k++) {
            var n = ctx.npcs[k];
            if (n.dead || n.state === 'down') continue;
            if (U.dist2d(n.x, n.z, f.x, f.z) < 1.4) {
              if (GTA.NPCs && GTA.NPCs.takeHit) GTA.NPCs.takeHit(ctx, n, f.def.dmg, f.x, f.z);
              break;
            }
          }
          if (GTA.Audio) GTA.Audio.thud();
        }
        U.removeFromScene(ctx.scene, f.mesh);
        flieger.splice(i, 1);
      }
    }

    // Blitze, Spuren, Explosionskugeln
    for (var j = kurzlebig.length - 1; j >= 0; j--) {
      var e = kurzlebig[j];
      e.t -= dt;
      if (e.schrumpf && e.mesh.material) {
        e.mesh.material.opacity = Math.max(0, e.t * 1.2);
        e.mesh.scale.multiplyScalar(1 + dt * 1.6);
      }
      if (e.t <= 0) {
        U.removeFromScene(ctx.scene, e.mesh);
        kurzlebig.splice(j, 1);
      }
    }
  };

  /* Anzeigetext für das HUD: "12 / 48" oder "∞". */
  W.ammoText = function (ctx) {
    var p = ctx.player;
    var w = W.byId(p.weapon);
    if (!w) return '—';
    if (w.typ === 'nah') return '—';
    p.magazin = p.magazin || {};
    if (w.typ === 'wurf') return String(p.ammo[w.ammoId] || 0);
    var drin = p.magazin[w.id] === undefined ? w.clip : p.magazin[w.id];
    return drin + ' / ' + (p.ammo[w.ammoId] || 0);
  };

  W.clear = function (ctx) {
    for (var i = flieger.length - 1; i >= 0; i--) U.removeFromScene(ctx.scene, flieger[i].mesh);
    for (var j = kurzlebig.length - 1; j >= 0; j--) U.removeFromScene(ctx.scene, kurzlebig[j].mesh);
    flieger.length = 0;
    kurzlebig.length = 0;
  };

  return W;
})();
