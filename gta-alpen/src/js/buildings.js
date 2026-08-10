'use strict';
/* ============================================================
   buildings.js — Dorf: Häuser anmelden, Kirche, Tankstelle, Deko
   Abhängig von: config.js, util.js, textures.js, interiors.js
   Definiert GTA.Buildings.

   Die eigentlichen Häuser samt Einrichtung baut GTA.Interiors.
   Dieses Modul
     · übersetzt die Interiors-Datensätze in die Form, die der
       Spielkern erwartet (x, z, w, d, doorX, doorZ, name, roof),
     · blendet Dach und Decke aus, sobald man drinnen steht,
     · stellt Kirche, Tankstelle, Zäune, Laternen und Bänke dazu.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Buildings = (function () {
  var Bd = {};
  var U, CFG, TEX;
  var doorSigns = [];

  function ensure() { U = GTA.U; CFG = GTA.CFG; TEX = GTA.TEX; }

  /* ============================================================
     1. Häuser übernehmen
     ============================================================ */
  function adoptInteriors(ctx) {
    var list = (GTA.Interiors && GTA.Interiors.build) ? GTA.Interiors.build(ctx) : [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var rec = list[i];
      var b = rec.bounds || { x0: rec.x - 5, x1: rec.x + 5, z0: rec.z - 5, z1: rec.z + 5 };
      var door = rec.door || { x: rec.x, z: rec.z - 6 };
      // Der Spielkern prüft "innen" über Mittelpunkt + halbe Kantenlänge.
      var eintrag = {
        id: rec.id,
        rec: rec,
        kind: rec.kind,
        name: rec.title || 'Haus',
        hint: rec.hint || '',
        x: (b.x0 + b.x1) / 2,
        z: (b.z0 + b.z1) / 2,
        w: (b.x1 - b.x0),
        d: (b.z1 - b.z0),
        rot: rec.rot,
        group: rec.group,
        roof: rec.roofMesh || null,
        ceiling: rec.ceiling || null,
        doorX: door.x,
        doorZ: door.z,
        spawn: rec.spawn || null,
        exit: rec.exit || null,
        lootSpots: rec.loot || []
      };
      out.push(eintrag);
      addDoorSign(ctx, eintrag);
    }
    ctx.interiors = out;
    return out;
  }

  /* Kleines schwebendes Schild über der Tür — zeigt, wo man rein kann. */
  function addDoorSign(ctx, it) {
    var g = new THREE.Group();
    var platte = U.box(1.5, 0.42, 0.09, U.mat(0xffd23c, 0.5, 0.1, {
      emissive: 0x6b5510, emissiveIntensity: 0.55
    }), false);
    g.add(platte);
    var rahmen = U.box(1.62, 0.54, 0.05, U.mat(0x2a2118, 0.8, 0), false);
    rahmen.position.z = -0.04;
    g.add(rahmen);

    // Schild leicht vor der Tür, in Türhöhe
    var nx = it.x - it.doorX, nz = it.z - it.doorZ;
    var len = Math.hypot(nx, nz) || 1;
    g.position.set(it.doorX - (nx / len) * 0.35, 2.55, it.doorZ - (nz / len) * 0.35);
    g.rotation.y = Math.atan2(-nx, -nz);
    g.userData.baseY = 2.55;
    g.userData.phase = Math.random() * 6.28;
    ctx.scene.add(g);
    doorSigns.push(g);
  }

  /* ============================================================
     2. Kirche
     ============================================================ */
  function buildChurch(ctx, x, z, rotY) {
    var g = new THREE.Group();
    var wandM = TEX.M.plaster, dachM = TEX.M.roof;

    var schiff = U.box(10, 7.5, 17, wandM);
    schiff.position.y = 3.75;
    schiff.receiveShadow = true;
    g.add(schiff);

    var dach = U.cone(8.2, 4.2, 4, dachM);
    dach.position.y = 9.6;
    dach.rotation.y = Math.PI / 4;
    g.add(dach);

    var turm = U.box(4.4, 19, 4.4, wandM);
    turm.position.set(0, 9.5, 11);
    g.add(turm);

    var zwiebel = U.sph(3.0, 14, 12, U.mat(0x3f6b46, 0.45, 0.35));
    zwiebel.scale.y = 1.2;
    zwiebel.position.set(0, 20.4, 11);
    g.add(zwiebel);

    var spitz = U.cone(0.9, 3.6, 8, U.mat(0x3f6b46, 0.45, 0.35));
    spitz.position.set(0, 23.6, 11);
    g.add(spitz);

    var kreuzV = U.box(0.14, 1.5, 0.14, TEX.M.chrome);
    kreuzV.position.set(0, 26.1, 11);
    g.add(kreuzV);
    var kreuzH = U.box(0.9, 0.14, 0.14, TEX.M.chrome);
    kreuzH.position.set(0, 26.4, 11);
    g.add(kreuzH);

    // Zifferblatt
    var uhr = U.cyl(1.05, 1.05, 0.16, 20, U.mat(0xf4f1e6, 0.6, 0));
    uhr.rotation.x = Math.PI / 2;
    uhr.position.set(0, 14.5, 13.3);
    g.add(uhr);
    var zeiger = U.box(0.08, 0.8, 0.05, U.mat(0x1b1d22, 0.7, 0), false);
    zeiger.position.set(0, 14.8, 13.42);
    g.add(zeiger);

    // Rundbogenfenster
    for (var i = -1; i <= 1; i++) {
      [5.05, -5.05].forEach(function (sx) {
        var f = U.box(0.1, 2.6, 1.1, TEX.M.darkGlass, false);
        f.position.set(sx, 4.2, i * 5);
        g.add(f);
      });
    }
    var portal = U.box(2.2, 3.4, 0.2, TEX.M.woodDark, false);
    portal.position.set(0, 1.7, -8.6);
    g.add(portal);

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    ctx.scene.add(g);
    U.addObstacle(ctx, x, z, 9.5);
    return g;
  }

  /* ============================================================
     3. Tankstelle
     ============================================================ */
  function buildGasStation(ctx, x, z) {
    var g = new THREE.Group();

    var haus = U.box(9, 3.6, 6, TEX.M.plaster);
    haus.position.set(-6, 1.8, 0);
    g.add(haus);
    var schaufenster = U.box(0.12, 2.0, 4.4, TEX.M.glass, false);
    schaufenster.position.set(-1.5, 1.9, 0);
    g.add(schaufenster);

    // Vordach auf zwei Säulen
    var dach = U.box(13, 0.5, 9, U.mat(0xe9edf0, 0.6, 0.25));
    dach.position.set(4, 5.2, 0);
    g.add(dach);
    var streifen = U.box(13.2, 0.28, 9.2, U.mat(0xd8342c, 0.6, 0.1), false);
    streifen.position.set(4, 4.9, 0);
    g.add(streifen);
    [[-1, -3.6], [-1, 3.6], [9, -3.6], [9, 3.6]].forEach(function (p) {
      var saeule = U.cyl(0.24, 0.24, 5.2, 10, TEX.M.metal);
      saeule.position.set(p[0], 2.6, p[1]);
      g.add(saeule);
      U.addObstacle(ctx, x + p[0], z + p[1], 0.4);
    });

    // Zapfsäulen
    [[2, -1.8], [6, 1.8]].forEach(function (p) {
      var z1 = U.box(0.9, 1.7, 0.6, U.mat(0xd8342c, 0.5, 0.2));
      z1.position.set(p[0], 0.85, p[1]);
      g.add(z1);
      var display = U.box(0.6, 0.4, 0.05, TEX.M.screen, false);
      display.position.set(p[0], 1.3, p[1] + 0.33);
      g.add(display);
      var schlauch = U.cyl(0.05, 0.05, 0.9, 6, TEX.M.dark);
      schlauch.position.set(p[0] + 0.5, 1.1, p[1]);
      schlauch.rotation.z = 0.4;
      g.add(schlauch);
      U.addObstacle(ctx, x + p[0], z + p[1], 0.8);
    });

    // Preistafel
    var mast = U.cyl(0.16, 0.16, 6, 8, TEX.M.metal);
    mast.position.set(11, 3, -5);
    g.add(mast);
    var tafel = U.box(2.6, 2.0, 0.2, U.mat(0x14306b, 0.6, 0.1));
    tafel.position.set(11, 6.4, -5);
    g.add(tafel);
    var zahl = U.box(2.0, 0.5, 0.06, U.mat(0xf2c200, 0.4, 0, { emissive: 0x6b5000, emissiveIntensity: 0.7 }), false);
    zahl.position.set(11, 6.4, -4.88);
    g.add(zahl);
    U.addObstacle(ctx, x + 11, z - 5, 0.4);

    g.position.set(x, 0, z);
    ctx.scene.add(g);
    U.addObstacle(ctx, x - 6, z, 5.2);
    return g;
  }

  /* ============================================================
     4. Kleinteile: Laternen, Bänke, Zäune, Tonnen, Brunnen
     ============================================================ */
  function streetLamp(ctx, x, z) {
    var g = new THREE.Group();
    var mast = U.cyl(0.1, 0.14, 5.4, 8, TEX.M.metal);
    mast.position.y = 2.7;
    g.add(mast);
    var arm = U.box(1.1, 0.11, 0.11, TEX.M.metal);
    arm.position.set(0.5, 5.35, 0);
    g.add(arm);
    var kopf = U.box(0.7, 0.22, 0.34, U.mat(0xf5f0d8, 0.4, 0.2, {
      emissive: 0xffe9a8, emissiveIntensity: 0.5
    }));
    kopf.position.set(1.0, 5.18, 0);
    g.add(kopf);
    g.position.set(x, 0, z);
    ctx.scene.add(g);
    U.addObstacle(ctx, x, z, 0.35);
  }

  function bench(ctx, x, z, rotY) {
    var g = new THREE.Group();
    var sitz = U.box(1.9, 0.1, 0.55, TEX.M.wood);
    sitz.position.y = 0.48;
    g.add(sitz);
    var lehne = U.box(1.9, 0.5, 0.09, TEX.M.wood);
    lehne.position.set(0, 0.78, -0.24);
    lehne.rotation.x = -0.18;
    g.add(lehne);
    [-0.78, 0.78].forEach(function (sx) {
      var bein = U.box(0.1, 0.46, 0.5, TEX.M.dark);
      bein.position.set(sx, 0.23, 0);
      g.add(bein);
    });
    g.position.set(x, 0, z);
    g.rotation.y = rotY || 0;
    ctx.scene.add(g);
    U.addObstacle(ctx, x, z, 0.8);
  }

  function bin(ctx, x, z) {
    var g = new THREE.Group();
    var koerper = U.cyl(0.34, 0.29, 0.95, 12, U.mat(U.pick([0x2f6b34, 0x3a4048, 0x6b4527]), 0.85, 0.05));
    koerper.position.y = 0.48;
    g.add(koerper);
    var deckel = U.cyl(0.37, 0.37, 0.09, 12, TEX.M.dark);
    deckel.position.y = 1.0;
    g.add(deckel);
    g.position.set(x, 0, z);
    ctx.scene.add(g);
    U.addObstacle(ctx, x, z, 0.42);
  }

  function fence(ctx, x0, z0, x1, z1) {
    var len = Math.hypot(x1 - x0, z1 - z0);
    var n = Math.max(2, Math.round(len / 2.2));
    var g = new THREE.Group();
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var px = (x1 - x0) * t, pz = (z1 - z0) * t;
      var pfosten = U.box(0.11, 1.15, 0.11, TEX.M.woodDark);
      pfosten.position.set(px, 0.57, pz);
      g.add(pfosten);
    }
    var winkel = Math.atan2(x1 - x0, z1 - z0);
    [0.42, 0.85].forEach(function (h) {
      var latte = U.box(0.06, 0.09, len, TEX.M.wood);
      latte.position.set((x1 - x0) / 2, h, (z1 - z0) / 2);
      latte.rotation.y = winkel;
      g.add(latte);
    });
    g.position.set(x0, 0, z0);
    ctx.scene.add(g);
    // Zaun als dünne Wand eintragen, damit man nicht durchläuft
    U.addWall(ctx, x0 + (x1 - x0) / 2, z0 + (z1 - z0) / 2,
      Math.max(0.3, Math.abs(x1 - x0)), Math.max(0.3, Math.abs(z1 - z0)), null);
  }

  function fountain(ctx, x, z) {
    var g = new THREE.Group();
    var becken = U.cyl(2.4, 2.5, 0.7, 20, U.mat(0x9a9d9f, 0.9, 0));
    becken.position.y = 0.35;
    g.add(becken);
    var wasser = U.cyl(2.2, 2.2, 0.1, 20, TEX.M.water, false);
    wasser.position.y = 0.62;
    g.add(wasser);
    var saeule = U.cyl(0.28, 0.36, 1.9, 12, U.mat(0x9a9d9f, 0.9, 0));
    saeule.position.y = 1.35;
    g.add(saeule);
    var schale = U.cyl(0.95, 0.5, 0.28, 14, U.mat(0x9a9d9f, 0.9, 0));
    schale.position.y = 2.3;
    g.add(schale);
    g.position.set(x, 0, z);
    ctx.scene.add(g);
    U.addObstacle(ctx, x, z, 2.6);
  }

  function busStop(ctx, x, z, rotY) {
    var g = new THREE.Group();
    var dach = U.box(3.4, 0.14, 1.5, U.mat(0x3a5f8a, 0.6, 0.2));
    dach.position.y = 2.35;
    g.add(dach);
    [[-1.6, -0.65], [1.6, -0.65]].forEach(function (p) {
      var st = U.cyl(0.07, 0.07, 2.35, 8, TEX.M.metal);
      st.position.set(p[0], 1.17, p[1]);
      g.add(st);
    });
    var rueck = U.box(3.4, 1.8, 0.08, TEX.M.glass, false);
    rueck.position.set(0, 1.3, -0.72);
    g.add(rueck);
    var bank = U.box(2.8, 0.09, 0.42, TEX.M.wood);
    bank.position.set(0, 0.5, -0.45);
    g.add(bank);
    var schild = U.box(0.5, 0.5, 0.05, U.mat(0xf2c200, 0.5, 0.1), false);
    schild.position.set(1.85, 2.1, 0);
    g.add(schild);
    g.position.set(x, 0, z);
    g.rotation.y = rotY || 0;
    ctx.scene.add(g);
    U.addObstacle(ctx, x, z, 1.8);
  }

  function flowerBox(ctx, x, z) {
    var g = new THREE.Group();
    var kiste = U.box(1.3, 0.34, 0.42, TEX.M.wood);
    kiste.position.y = 0.17;
    g.add(kiste);
    for (var i = 0; i < 7; i++) {
      var bl = U.sph(0.09, 6, 6, U.mat(U.pick([0xd94f4f, 0xe0a132, 0xd3689a, 0xf0f0f0]), 0.8, 0), false);
      bl.position.set(-0.5 + i * 0.17, 0.42, U.rand(-0.12, 0.12));
      g.add(bl);
    }
    g.position.set(x, 0, z);
    ctx.scene.add(g);
  }

  /* ============================================================
     5. Aufbau
     ============================================================ */
  Bd.build = function (ctx) {
    ensure();
    doorSigns.length = 0;

    adoptInteriors(ctx);

    buildChurch(ctx, 96, -116, -0.5);
    buildGasStation(ctx, -150, 150);
    fountain(ctx, 40, 30);
    busStop(ctx, 20, 40, Math.PI);
    busStop(ctx, -20, -40, 0);

    // Laternen an den Hauptstraßen
    for (var z = -180; z <= 180; z += 45) {
      if (Math.abs(z) < 20) continue;
      streetLamp(ctx, CFG.ROAD_HALF + 2.5, z);
      streetLamp(ctx, -CFG.ROAD_HALF - 2.5, z);
    }
    for (var x = -180; x <= 180; x += 45) {
      if (Math.abs(x) < 20) continue;
      streetLamp(ctx, x, CFG.ROAD_HALF + 2.5);
      streetLamp(ctx, x, -CFG.ROAD_HALF - 2.5);
    }

    // Bänke, Tonnen, Blumen im Ortskern
    [[34, 26, 0.6], [46, 34, 2.2], [24, 44, 3.9], [-18, 36, 1.2]].forEach(function (p) {
      bench(ctx, p[0], p[1], p[2]);
    });
    [[30, 20], [50, 40], [-24, 30], [70, -20], [-60, 60]].forEach(function (p) {
      bin(ctx, p[0], p[1]);
    });
    for (var i = 0; i < ctx.interiors.length; i++) {
      var it = ctx.interiors[i];
      flowerBox(ctx, it.doorX + U.rand(-1.8, 1.8), it.doorZ + U.rand(-0.6, 0.6));
    }

    // Weidezäune abseits der Straßen
    var koppeln = [
      [200, 60, 260, 60], [260, 60, 260, 130], [200, 60, 200, 130], [200, 130, 260, 130],
      [-260, -60, -200, -60], [-260, -60, -260, -130], [-200, -60, -200, -130]
    ];
    koppeln.forEach(function (f) { fence(ctx, f[0], f[1], f[2], f[3]); });

    return ctx.interiors;
  };

  /* ============================================================
     6. Laufzeit — Dach ausblenden, Schilder wippen
     ============================================================ */
  Bd.update = function (ctx, dt) {
    var p = ctx.player;
    if (GTA.Interiors && GTA.Interiors.update && p) {
      // Kümmert sich um Dach, Decke, Lampen, Beute-Animation und
      // setzt ctx.activeInterior selbst.
      GTA.Interiors.update(dt, ctx, p.x, p.z);
    } else {
      var aktiv = ctx.activeInterior;
      for (var i = 0; i < ctx.interiors.length; i++) {
        var it = ctx.interiors[i];
        var drin = (it.id === aktiv);
        if (it.roof) it.roof.visible = !drin;
        if (it.ceiling) it.ceiling.visible = !drin;
      }
    }
    for (var s = 0; s < doorSigns.length; s++) {
      var g = doorSigns[s];
      g.userData.phase += dt;
      g.position.y = g.userData.baseY + Math.sin(g.userData.phase * 1.6) * 0.07;
    }
  };

  /* Haus in der Nähe eines Punktes (für Missionen). */
  Bd.nearestDoor = function (ctx, x, z, maxDist) {
    var best = null, bd = maxDist === undefined ? 4 : maxDist;
    for (var i = 0; i < ctx.interiors.length; i++) {
      var it = ctx.interiors[i];
      var d = U.dist2d(x, z, it.doorX, it.doorZ);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  };

  Bd.byKind = function (ctx, kind) {
    return ctx.interiors.filter(function (it) { return it.kind === kind; });
  };

  return Bd;
})();
