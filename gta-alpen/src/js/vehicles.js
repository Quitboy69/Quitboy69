'use strict';
/* ============================================================
   vehicles.js — Fahrzeug-Baukasten (Karosserien, Räder, Fahrer)
   Abhängig von: three.js, config.js, util.js, textures.js,
                 characters.js (nur optional/defensiv).
   Definiert GTA.Vehicles.

   Beim Laden entstehen NUR Datentabellen. Jede Geometrie wird
   erst in build(ctx) bzw. makeMesh() erzeugt, weil GTA.TEX.M
   vorher nicht existiert.

   Jedes gebaute Fahrzeug ist eine THREE.Group mit userData:
     {
       tilt          : THREE.Group  (Karosserie, wird geneigt)
       wheels        : [ Rad-Pivots ]      (alle Räder)
       frontWheels   : [ Rad-Pivots ]      (lenkbare Räder)
       headlights    : [ Mesh ]
       tailLights    : [ Mesh ]
       blinkers      : [ Mesh ]
       rider         : THREE.Group|null    (sichtbarer Fahrer, Zweiräder)
       hasDriver     : bool
       siren         : Mesh|null
       spec          : Fahrzeugdaten
     }
   Jedes Rad-Pivot hat userData.spin (Drehgruppe) und userData.radius.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Vehicles = (function () {

  var V = {};
  var U = null;          // GTA.U, erst bei ensure() gesetzt
  var R = null;          // gemeinsame Materialien, erst bei ensure() gebaut
  var paintCache = {};   // Lackfarben, damit gleiche Farbe ein Material teilt

  /* ==========================================================
     RESSOURCEN — werden beim ersten Bauen einmalig erzeugt
     ========================================================== */

  function texM() {
    return (GTA.TEX && GTA.TEX.M) ? GTA.TEX.M : null;
  }

  // Gemeinsames Material aus GTA.TEX.M holen, sonst Notfarbe bauen.
  function shared(key, color, rough, metal, extra) {
    var m = texM();
    if (m && m[key]) return m[key];
    return GTA.U.mat(color, rough, metal, extra);
  }

  // Österreichisches Kennzeichen, prozedural gezeichnet.
  function plateTexture() {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    var c = cv.getContext('2d');
    c.fillStyle = '#f3f4f6'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#16357e'; c.fillRect(0, 0, 36, 64);
    c.fillStyle = '#f2d64b';
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      c.beginPath();
      c.arc(18 + Math.cos(a) * 10, 22 + Math.sin(a) * 10, 1.6, 0, 7);
      c.fill();
    }
    c.fillStyle = '#ffffff';
    c.font = 'bold 17px sans-serif';
    c.textAlign = 'center';
    c.fillText('A', 18, 56);
    c.fillStyle = '#c8102e';
    c.fillRect(44, 8, 7, 48);
    c.fillRect(58, 8, 7, 48);
    c.fillStyle = '#15171c';
    c.font = 'bold 36px sans-serif';
    c.textAlign = 'left';
    c.fillText('GTA 2000', 74, 47);
    c.strokeStyle = '#15171c'; c.lineWidth = 4;
    c.strokeRect(2, 2, 252, 60);
    var tx = new THREE.CanvasTexture(cv);
    if (GTA.TEX && GTA.TEX.maxAniso) tx.anisotropy = GTA.TEX.maxAniso;
    return tx;
  }

  // Ladeflächen-Plane / Warnstreifen für Nutzfahrzeuge
  function stripeTexture(colA, colB) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var c = cv.getContext('2d');
    c.fillStyle = colA; c.fillRect(0, 0, 64, 64);
    c.strokeStyle = colB; c.lineWidth = 12;
    for (var i = -64; i < 128; i += 24) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 64, 64); c.stroke();
    }
    var tx = new THREE.CanvasTexture(cv);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(3, 1);
    return tx;
  }

  function ensure() {
    if (R) return R;
    U = GTA.U;
    R = {};

    R.tire      = U.mat(0x17191d, 0.95, 0.0);
    R.rubber    = U.mat(0x24272c, 0.98, 0.0);
    R.rim       = U.mat(0xd7dde2, 0.20, 0.95);
    R.rimDark   = U.mat(0x363b42, 0.35, 0.85);
    R.rimGold   = U.mat(0xc9a24a, 0.25, 0.9);
    R.rimBlack  = U.mat(0x1c1f24, 0.5, 0.6);

    R.chrome    = shared('chrome', 0xe8ecf0, 0.08, 1.0, { envMapIntensity: 1.6 });
    R.dark      = shared('dark', 0x181b20, 0.85, 0.1);
    R.glass     = shared('darkGlass', 0x0d1420, 0.05, 0.9, { envMapIntensity: 1.5 });
    R.clear     = shared('glass', 0xbcd4e6, 0.05, 0.5, { transparent: true, opacity: 0.32 });
    R.metal     = shared('metal', 0x9fa6ad, 0.35, 0.85);
    R.white     = shared('white', 0xf4f6f8, 0.70, 0.0);
    R.wood      = shared('wood', 0x9a6b3f, 0.72, 0.0);

    R.leather   = U.mat(0x3a2c22, 0.75, 0.05);
    R.cloth     = U.mat(0x2a2f38, 0.9, 0.0);
    R.grille    = U.mat(0x101317, 0.55, 0.55);
    R.plastic   = U.mat(0x2a2e34, 0.8, 0.05);
    R.alu       = U.mat(0xb6bcc4, 0.28, 0.9);
    R.rust      = U.mat(0x7a4a2c, 0.95, 0.15);

    R.lightF    = U.mat(0x30302a, 0.40, 0.30, { emissive: 0xfff0b8, emissiveIntensity: 1.7 });
    R.lightR    = U.mat(0x2a1414, 0.40, 0.20, { emissive: 0xff2a22, emissiveIntensity: 1.4 });
    R.lightA    = U.mat(0x33240c, 0.40, 0.20, { emissive: 0xffa41c, emissiveIntensity: 1.2 });
    R.lightW    = U.mat(0x2c2e30, 0.35, 0.25, { emissive: 0xdfe8f0, emissiveIntensity: 0.9 });
    R.lightBlue = U.mat(0x0e1c46, 0.30, 0.20, { emissive: 0x2a62ff, emissiveIntensity: 1.6 });

    R.plate     = U.mat(0xffffff, 0.62, 0.0, { map: plateTexture() });
    R.warn      = U.mat(0xffffff, 0.8, 0.0, { map: stripeTexture('#e8a021', '#20242a') });

    return R;
  }

  // Klarlack / Mattlack — pro Farbe nur ein Material.
  function paint(color) {
    ensure();
    var k = 'g' + color;
    if (!paintCache[k]) paintCache[k] = U.mat(color, 0.16, 0.7, { envMapIntensity: 1.35 });
    return paintCache[k];
  }
  function paintMatte(color) {
    ensure();
    var k = 'm' + color;
    if (!paintCache[k]) paintCache[k] = U.mat(color, 0.55, 0.3, { envMapIntensity: 0.9 });
    return paintCache[k];
  }
  V.paint = paint;
  V.paintMatte = paintMatte;

  /* ==========================================================
     RAD — makeWheel(r, w, rimStyle)
     rimStyle: 'sport' | 'stahl' | 'speiche' | 'offroad' | 'traktor'
     Aufbau: pivot -> spin -> visual. Gedreht wird immer spin.rotation.x.
     ========================================================== */

  function makeWheel(r, w, rimStyle) {
    ensure();
    var style = rimStyle || 'sport';
    var pivot = new THREE.Group();
    var spin = new THREE.Group();
    var visual = new THREE.Group();
    var i, a, seg;

    // Reifen
    seg = (style === 'speiche') ? 20 : 22;
    var tire = U.cyl(r, r, w, seg, style === 'traktor' ? R.rubber : R.tire);
    visual.add(tire);

    // Grobes Profil bei Gelände- und Traktorreifen
    if (style === 'offroad' || style === 'traktor') {
      var lugs = style === 'traktor' ? 11 : 14;
      var lugM = style === 'traktor' ? R.rubber : R.tire;
      for (i = 0; i < lugs; i++) {
        a = i / lugs * Math.PI * 2;
        var lug = U.box(r * 0.24, w * (style === 'traktor' ? 1.02 : 1.12), r * 0.17, lugM, false);
        lug.position.set(Math.cos(a) * r * 0.95, 0, Math.sin(a) * r * 0.95);
        lug.rotation.y = -a;
        if (style === 'traktor') lug.rotation.x = 0.5;
        visual.add(lug);
      }
    }

    // Felgenkörper
    var rimM = R.rim;
    if (style === 'stahl') rimM = R.rimDark;
    if (style === 'offroad') rimM = R.rimBlack;
    if (style === 'traktor') rimM = R.rimGold;

    var dish = U.cyl(r * (style === 'traktor' ? 0.5 : 0.6), r * (style === 'traktor' ? 0.5 : 0.6),
                     w + 0.02, 14, rimM);
    visual.add(dish);

    if (style === 'sport') {
      for (i = 0; i < 5; i++) {
        var sp = U.box(r * 1.32, w + 0.05, r * 0.15, rimM, false);
        sp.rotation.y = i / 5 * Math.PI;
        visual.add(sp);
      }
      var lip = U.torus(r * 0.86, r * 0.06, 6, 18, rimM, false);
      lip.rotation.x = Math.PI / 2;
      visual.add(lip);
    } else if (style === 'stahl') {
      var cap = U.cyl(r * 0.4, r * 0.4, w + 0.06, 12, R.chrome);
      visual.add(cap);
      for (i = 0; i < 5; i++) {
        a = i / 5 * Math.PI * 2;
        var bolt = U.cyl(r * 0.05, r * 0.05, w + 0.09, 6, R.chrome, false);
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(Math.cos(a) * r * 0.28, 0, Math.sin(a) * r * 0.28);
        visual.add(bolt);
      }
    } else if (style === 'speiche') {
      for (i = 0; i < 8; i++) {
        var wire = U.box(r * 1.82, w * 0.3, 0.018, R.chrome, false);
        wire.rotation.y = i / 8 * Math.PI;
        visual.add(wire);
      }
      var ring = U.torus(r * 0.9, r * 0.05, 6, 20, R.chrome, false);
      ring.rotation.x = Math.PI / 2;
      visual.add(ring);
    } else if (style === 'offroad') {
      for (i = 0; i < 6; i++) {
        var osp = U.box(r * 1.18, w + 0.06, r * 0.22, rimM, false);
        osp.rotation.y = i / 6 * Math.PI;
        visual.add(osp);
      }
      var bead = U.torus(r * 0.72, r * 0.08, 6, 16, R.metal, false);
      bead.rotation.x = Math.PI / 2;
      visual.add(bead);
    } else if (style === 'traktor') {
      for (i = 0; i < 6; i++) {
        var tsp = U.box(r * 0.9, w * 0.7, r * 0.14, rimM, false);
        tsp.rotation.y = i / 6 * Math.PI;
        visual.add(tsp);
      }
    }

    // Nabe
    var hub = U.cyl(r * 0.15, r * 0.15, w + 0.08, 10, R.chrome, false);
    visual.add(hub);

    visual.rotation.z = Math.PI / 2;   // Achse zeigt nach X
    spin.add(visual);
    pivot.add(spin);
    pivot.userData.spin = spin;
    pivot.userData.radius = r;
    return pivot;
  }
  V.makeWheel = makeWheel;

  /* ==========================================================
     GRUNDGERÜST
     ========================================================== */

  function baseGroup() {
    ensure();
    var root = new THREE.Group();
    var tilt = new THREE.Group();
    root.add(tilt);
    root.userData = {
      tilt: tilt,
      wheels: [],
      frontWheels: [],
      headlights: [],
      tailLights: [],
      blinkers: [],
      rider: null,
      hasDriver: false,
      siren: null,
      sirenT: 0,
      spec: null
    };
    return root;
  }

  function attachWheel(root, x, y, z, r, w, steer, rimStyle) {
    var wheel = makeWheel(r, w, rimStyle);
    wheel.position.set(x, y, z);
    root.userData.tilt.add(wheel);
    root.userData.wheels.push(wheel);
    if (steer) root.userData.frontWheels.push(wheel);
    return wheel;
  }
  V.baseGroup = baseGroup;
  V.attachWheel = attachWheel;

  // Vier Räder in einem Rutsch: {x, y, z, r, w, rz (hinten), style}
  function axles(root, o) {
    var st = o.style || 'sport';
    var rz = o.rz === undefined ? -o.z : o.rz;
    var rr = o.rr === undefined ? o.r : o.rr;
    var rw = o.rw === undefined ? o.w : o.rw;
    var ry = o.ry === undefined ? rr : o.ry;
    attachWheel(root,  o.x, o.y, o.z, o.r, o.w, true, st);
    attachWheel(root, -o.x, o.y, o.z, o.r, o.w, true, st);
    attachWheel(root,  (o.rx === undefined ? o.x : o.rx), ry, rz, rr, rw, false, st);
    attachWheel(root, -(o.rx === undefined ? o.x : o.rx), ry, rz, rr, rw, false, st);
  }

  /* ==========================================================
     DETAIL-BAUSTEINE
     ========================================================== */

  function addPlate(root, x, y, z, rotY, sc) {
    var s = sc === undefined ? 1 : sc;
    var p = U.box(0.54 * s, 0.13 * s, 0.025, R.plate, false);
    p.position.set(x, y, z);
    p.rotation.y = rotY || 0;
    root.userData.tilt.add(p);
    return p;
  }

  function addMirrors(root, x, y, z, m) {
    var t = root.userData.tilt, i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var arm = U.box(0.07, 0.04, 0.08, R.dark, false);
      arm.position.set(s * (x - 0.06), y, z);
      t.add(arm);
      var shell = U.box(0.11, 0.1, 0.17, m || R.dark, false);
      shell.position.set(s * x, y, z);
      t.add(shell);
      var mir = U.box(0.02, 0.075, 0.13, R.chrome, false);
      mir.position.set(s * (x + 0.05), y, z);
      t.add(mir);
    }
  }

  function addExhaust(root, x, y, z, r, len, tiltX, m) {
    var pipe = U.cyl(r, r * 1.15, len, 10, m || R.chrome);
    pipe.rotation.x = Math.PI / 2 + (tiltX || 0);
    pipe.position.set(x, y, z);
    root.userData.tilt.add(pipe);
    var tip = U.cyl(r * 1.3, r * 1.3, 0.06, 10, R.chrome, false);
    tip.rotation.x = Math.PI / 2 + (tiltX || 0);
    tip.position.set(x, y - Math.sin(tiltX || 0) * len * 0.5, z - Math.cos(tiltX || 0) * len * 0.5);
    root.userData.tilt.add(tip);
    return pipe;
  }

  function addBumper(root, y, z, w, h, m) {
    var b = U.box(w, h || 0.16, 0.22, m || R.chrome);
    b.position.set(0, y, z);
    root.userData.tilt.add(b);
    return b;
  }

  function addGrille(root, y, z, w, h) {
    var t = root.userData.tilt;
    var g = U.box(w, h, 0.07, R.grille, false);
    g.position.set(0, y, z);
    t.add(g);
    var i, n = 4;
    for (i = 0; i < n; i++) {
      var bar = U.box(w * 0.96, 0.02, 0.09, R.chrome, false);
      bar.position.set(0, y - h / 2 + (i + 0.6) * (h / (n + 0.2)), z + 0.01);
      t.add(bar);
    }
    return g;
  }

  // Scheinwerfer, Rücklichter, Blinker und beide Kennzeichen auf einen Schlag.
  function lightPack(root, o) {
    var t = root.userData.tilt, ud = root.userData;
    var hx = o.hx, hy = o.hy, hz = o.hz;
    var tx = o.tx === undefined ? hx : o.tx;
    var ty = o.ty === undefined ? hy : o.ty;
    var tz = o.tz;
    var hw = o.hw === undefined ? 0.40 : o.hw;
    var hh = o.hh === undefined ? 0.16 : o.hh;
    var tw = o.tw === undefined ? hw : o.tw;
    var th = o.th === undefined ? hh : o.th;
    var round = o.round === true;
    var i, s, hl, rl, b1, b2;

    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      if (round) {
        hl = U.cyl(hh * 0.9, hh * 0.9, 0.09, 12, R.lightF, false);
        hl.rotation.x = Math.PI / 2;
      } else {
        hl = U.box(hw, hh, 0.09, R.lightF, false);
      }
      hl.position.set(s * hx, hy, hz);
      t.add(hl); ud.headlights.push(hl);

      if (round) {
        var chromeRing = U.torus(hh * 1.0, 0.022, 6, 14, R.chrome, false);
        chromeRing.position.set(s * hx, hy, hz + 0.01);
        t.add(chromeRing);
      }

      rl = U.box(tw, th, 0.09, R.lightR, false);
      rl.position.set(s * tx, ty, tz);
      t.add(rl); ud.tailLights.push(rl);

      b1 = U.box(hw * 0.42, hh * 0.72, 0.08, R.lightA, false);
      b1.position.set(s * (hx + hw * 0.72), hy, hz - 0.005);
      t.add(b1); ud.blinkers.push(b1);

      b2 = U.box(tw * 0.42, th * 0.6, 0.08, R.lightA, false);
      b2.position.set(s * (tx + tw * 0.7), ty, tz + 0.005);
      t.add(b2); ud.blinkers.push(b2);

      // Rückfahrscheinwerfer
      var rw = U.box(tw * 0.3, th * 0.4, 0.07, R.lightW, false);
      rw.position.set(s * (tx - tw * 0.62), ty - th * 0.2, tz + 0.005);
      t.add(rw);
    }

    if (o.plateF !== false) addPlate(root, 0, o.pfy === undefined ? hy - 0.22 : o.pfy, hz + 0.03, 0, o.ps);
    if (o.plateR !== false) addPlate(root, 0, o.pry === undefined ? ty - 0.24 : o.pry, tz - 0.03, Math.PI, o.ps);
  }

  // Türfugen + Griffe — macht flache Flanken lebendig.
  function addDoors(root, x, y, z, count, len, m) {
    var t = root.userData.tilt, i, k, s;
    for (k = 0; k < 2; k++) {
      s = k ? -1 : 1;
      for (i = 0; i < count; i++) {
        var zz = z + (i - (count - 1) / 2) * len;
        var seam = U.box(0.03, 0.5, 0.02, R.dark, false);
        seam.position.set(s * x, y, zz + len / 2);
        t.add(seam);
        var handle = U.box(0.05, 0.05, 0.16, m || R.chrome, false);
        handle.position.set(s * (x + 0.02), y + 0.12, zz);
        t.add(handle);
      }
    }
  }

  function addRoofRack(root, y, z, w, d) {
    var t = root.userData.tilt, i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var rail = U.box(0.07, 0.07, d, R.dark);
      rail.position.set(s * w / 2, y, z);
      t.add(rail);
    }
    for (i = 0; i < 3; i++) {
      var cross = U.box(w, 0.05, 0.09, R.metal, false);
      cross.position.set(0, y + 0.02, z + (i - 1) * d * 0.35);
      t.add(cross);
    }
  }

  /* ==========================================================
     FAHRER FÜR ZWEIRÄDER — kompakte Figur, ~11 Primitive
     ========================================================== */

  function makeRider(o) {
    ensure();
    o = o || {};
    var suitM = paintMatte(o.suit === undefined ? 0x23262c : o.suit);
    var helmM = paint(o.helmet === undefined ? 0xd9dde2 : o.helmet);
    var skinM = U.mat(o.skin === undefined ? 0xe8b98a : o.skin, 0.6, 0);
    var lean = o.lean === undefined ? 0.35 : o.lean;   // 0 = aufrecht, 1 = Rennhaltung
    var g = new THREE.Group();

    var hip = U.box(0.34, 0.2, 0.28, suitM);
    hip.position.set(0, 0.0, -0.06);
    g.add(hip);

    var torso = U.box(0.36, 0.54, 0.26, suitM);
    torso.position.set(0, 0.32, -0.02 - lean * 0.06);
    torso.rotation.x = lean * 0.9;
    g.add(torso);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var thigh = U.box(0.13, 0.14, 0.44, suitM);
      thigh.position.set(s * 0.15, -0.02, 0.1);
      g.add(thigh);
      var shin = U.box(0.12, 0.36, 0.13, suitM);
      shin.position.set(s * 0.17, -0.2, 0.24);
      shin.rotation.x = -0.5;
      g.add(shin);
      var boot = U.box(0.13, 0.11, 0.24, R.dark, false);
      boot.position.set(s * 0.17, -0.36, 0.3);
      g.add(boot);
      var arm = U.box(0.1, 0.1, 0.5, suitM);
      arm.position.set(s * 0.2, 0.36 - lean * 0.05, 0.24);
      arm.rotation.x = -0.45 + lean * 0.35;
      g.add(arm);
      var glove = U.sph(0.065, 8, 6, R.dark, false);
      glove.position.set(s * 0.21, 0.3 - lean * 0.1, 0.48);
      g.add(glove);
    }

    var neck = U.cyl(0.06, 0.07, 0.09, 8, skinM, false);
    neck.position.set(0, 0.6, -0.06);
    g.add(neck);

    var helm = U.sph(0.17, 14, 12, helmM);
    helm.scale.set(1, 1.06, 1.1);
    helm.position.set(0, 0.72, -0.04);
    g.add(helm);

    var visor = U.box(0.21, 0.1, 0.06, R.glass, false);
    visor.position.set(0, 0.72, 0.11);
    g.add(visor);

    var stripe = U.box(0.05, 0.03, 0.3, R.white, false);
    stripe.position.set(0, 0.86, -0.04);
    g.add(stripe);

    return g;
  }
  V.makeRider = makeRider;

  function addRider(root, o) {
    var r = makeRider(o);
    r.position.set(0, (o && o.y !== undefined) ? o.y : 0.98, (o && o.z !== undefined) ? o.z : -0.1);
    root.userData.tilt.add(r);
    root.userData.rider = r;
    root.userData.hasDriver = true;
    return r;
  }

  // Lenker + Spiegel + Scheinwerfer für Zweiräder
  function addBars(root, y, z, width, m) {
    var t = root.userData.tilt;
    var bar = U.cyl(0.024, 0.024, width, 8, m || R.dark);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, y, z);
    t.add(bar);
    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var grip = U.cyl(0.034, 0.034, 0.13, 8, R.rubber, false);
      grip.rotation.z = Math.PI / 2;
      grip.position.set(s * (width / 2 - 0.07), y, z);
      t.add(grip);
      var mir = U.cyl(0.012, 0.012, 0.16, 6, R.chrome, false);
      mir.position.set(s * (width / 2 - 0.12), y + 0.09, z);
      t.add(mir);
      var glassM = U.box(0.11, 0.07, 0.02, R.chrome, false);
      glassM.position.set(s * (width / 2 - 0.12), y + 0.18, z);
      t.add(glassM);
    }
    return bar;
  }

  /* ==========================================================
     KAROSSERIEN — AUTOS
     Jede Silhouette ist eigenständig: Höhe, Länge, Dachform,
     Radstand und Anbauteile unterscheiden sich deutlich.
     ========================================================== */

  var B = {};   // Bauplan-Register: B[key](color) -> THREE.Group

  /* ---------- Sportcoupé (Startauto) ---------- */
  B.sport = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var body = U.box(2.00, 0.50, 4.35, p); body.position.y = 0.52; t.add(body);
    var haube = U.box(1.88, 0.26, 1.30, p); haube.position.set(0, 0.73, 1.45); t.add(haube);
    var nase = U.box(1.72, 0.30, 0.45, p); nase.position.set(0, 0.60, 2.10); t.add(nase);
    var kanzel = U.box(1.70, 0.50, 2.05, R.glass); kanzel.position.set(0, 1.02, -0.20); t.add(kanzel);
    var dach = U.box(1.48, 0.14, 1.10, p); dach.position.set(0, 1.28, -0.35); t.add(dach);
    var heck = U.box(1.92, 0.30, 0.9, p); heck.position.set(0, 0.80, -1.75); t.add(heck);
    var spoiler = U.box(1.85, 0.09, 0.50, R.dark); spoiler.position.set(0, 1.06, -2.05); t.add(spoiler);
    var schweller = U.box(2.04, 0.14, 3.60, R.dark); schweller.position.y = 0.30; t.add(schweller);
    var diff = U.box(1.70, 0.16, 0.34, R.dark, false); diff.position.set(0, 0.30, -2.14); t.add(diff);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var intake = U.box(0.16, 0.20, 0.85, R.grille, false);
      intake.position.set(s * 1.00, 0.62, -0.60); t.add(intake);
      var kieme = U.box(0.05, 0.14, 0.36, R.chrome, false);
      kieme.position.set(s * 1.01, 0.72, 0.85); t.add(kieme);
    }

    addGrille(root, 0.48, 2.25, 1.10, 0.22);
    addBumper(root, 0.34, 2.20, 1.94, 0.14, R.dark);
    addBumper(root, 0.36, -2.20, 1.94, 0.14, R.dark);
    addMirrors(root, 1.00, 0.95, 0.65, p);
    addDoors(root, 1.00, 0.66, -0.1, 1, 1.5, R.chrome);
    addExhaust(root, 0.42, 0.36, -2.26, 0.06, 0.28, 0, R.chrome);
    addExhaust(root, -0.42, 0.36, -2.26, 0.06, 0.28, 0, R.chrome);

    lightPack(root, { hx: 0.62, hy: 0.66, hz: 2.20, hw: 0.44, hh: 0.13,
                      tx: 0.62, ty: 0.72, tz: -2.20, tw: 0.50, th: 0.14,
                      pfy: 0.40, pry: 0.50 });

    axles(root, { x: 0.95, y: 0.42, z: 1.42, r: 0.42, w: 0.34, rz: -1.42, rr: 0.44, rw: 0.38, ry: 0.44, style: 'sport' });
    return root;
  };

  /* ---------- Hypercar ---------- */
  B.hyper = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var body = U.box(2.14, 0.40, 4.55, p); body.position.y = 0.44; t.add(body);
    var keil = U.box(1.90, 0.22, 1.60, p); keil.position.set(0, 0.60, 1.55); t.add(keil);
    var splitter = U.box(2.05, 0.06, 0.5, R.dark, false); splitter.position.set(0, 0.24, 2.25); t.add(splitter);
    var kanzel = U.box(1.56, 0.44, 1.75, R.glass); kanzel.position.set(0, 0.86, -0.30); t.add(kanzel);
    var dach = U.box(1.28, 0.10, 0.9, R.dark); dach.position.set(0, 1.08, -0.45); t.add(dach);
    var motor = U.box(1.7, 0.2, 1.0, R.grille, false); motor.position.set(0, 0.80, -1.45); t.add(motor);
    var fluegel = U.box(2.10, 0.07, 0.55, R.dark); fluegel.position.set(0, 1.26, -2.20); t.add(fluegel);
    var diff = U.box(1.90, 0.18, 0.32, R.dark); diff.position.set(0, 0.26, -2.24); t.add(diff);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var stuetze = U.box(0.10, 0.42, 0.12, R.chrome); stuetze.position.set(s * 0.80, 1.02, -2.16); t.add(stuetze);
      var intake = U.box(0.16, 0.26, 1.05, R.grille, false); intake.position.set(s * 1.06, 0.62, -0.85); t.add(intake);
      var canard = U.box(0.30, 0.04, 0.24, R.dark, false); canard.position.set(s * 0.95, 0.42, 2.05); canard.rotation.z = s * 0.2; t.add(canard);
      var finne = U.box(0.05, 0.22, 0.9, p, false); finne.position.set(s * 0.98, 0.72, 0.9); t.add(finne);
    }

    addMirrors(root, 0.98, 0.86, 0.35, p);
    addExhaust(root, 0.0, 0.68, -2.30, 0.09, 0.26, 0, R.chrome);
    addExhaust(root, 0.34, 0.55, -2.30, 0.06, 0.22, 0, R.chrome);
    addExhaust(root, -0.34, 0.55, -2.30, 0.06, 0.22, 0, R.chrome);

    lightPack(root, { hx: 0.66, hy: 0.62, hz: 2.28, hw: 0.50, hh: 0.10,
                      tx: 0.66, ty: 0.76, tz: -2.28, tw: 0.56, th: 0.10,
                      pfy: 0.40, pry: 0.52 });

    axles(root, { x: 1.00, y: 0.44, z: 1.50, r: 0.44, w: 0.38, rz: -1.50, rr: 0.47, rw: 0.44, ry: 0.47, style: 'sport' });
    return root;
  };

  /* ---------- Diesel-Kombi ---------- */
  B.kombi = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var body = U.box(1.95, 0.58, 4.60, p); body.position.y = 0.58; t.add(body);
    var haube = U.box(1.86, 0.20, 1.20, p); haube.position.set(0, 0.94, 1.70); t.add(haube);
    var kabine = U.box(1.74, 0.56, 2.95, R.glass); kabine.position.set(0, 1.14, -0.50); t.add(kabine);
    var dach = U.box(1.66, 0.10, 2.55, p); dach.position.set(0, 1.44, -0.55); t.add(dach);
    var saeuleA = U.box(1.70, 0.5, 0.09, p, false); saeuleA.position.set(0, 1.16, 0.92); saeuleA.rotation.x = -0.25; t.add(saeuleA);
    var heckklappe = U.box(1.78, 0.72, 0.12, p); heckklappe.position.set(0, 1.10, -1.98); t.add(heckklappe);
    var stossR = U.box(1.96, 0.28, 0.22, R.dark); stossR.position.set(0, 0.44, -2.32); t.add(stossR);

    addRoofRack(root, 1.53, -0.55, 1.34, 2.4);
    addGrille(root, 0.86, 2.30, 1.15, 0.24);
    addBumper(root, 0.46, 2.32, 1.92, 0.26, R.dark);
    addMirrors(root, 0.98, 1.06, 0.85, p);
    addDoors(root, 0.99, 0.86, -0.55, 2, 1.25, R.chrome);
    addExhaust(root, -0.62, 0.34, -2.34, 0.055, 0.3, 0, R.chrome);

    var antenne = U.cyl(0.012, 0.012, 0.42, 6, R.dark, false);
    antenne.position.set(0.5, 1.68, -1.55); antenne.rotation.x = -0.25; t.add(antenne);
    var wischer = U.box(0.62, 0.02, 0.03, R.dark, false);
    wischer.position.set(0.35, 0.96, 1.12); wischer.rotation.z = 0.2; t.add(wischer);

    lightPack(root, { hx: 0.62, hy: 0.82, hz: 2.32, hw: 0.44, hh: 0.18,
                      tx: 0.76, ty: 1.04, tz: -2.32, tw: 0.34, th: 0.34,
                      pfy: 0.60, pry: 0.66 });

    axles(root, { x: 0.92, y: 0.42, z: 1.50, r: 0.42, w: 0.30, style: 'stahl' });
    return root;
  };

  /* ---------- Kleinwagen ---------- */
  B.kleinwagen = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var body = U.box(1.68, 0.66, 3.30, p); body.position.y = 0.60; t.add(body);
    var kabine = U.box(1.56, 0.60, 1.85, R.glass); kabine.position.set(0, 1.14, -0.15); t.add(kabine);
    var dach = U.box(1.46, 0.10, 1.55, p); dach.position.set(0, 1.44, -0.20); t.add(dach);
    var haube = U.box(1.60, 0.18, 0.80, p); haube.position.set(0, 0.92, 1.30); t.add(haube);
    var heck = U.box(1.62, 0.62, 0.14, p); heck.position.set(0, 1.06, -1.55); t.add(heck);
    var schweller = U.box(1.72, 0.12, 2.5, R.dark, false); schweller.position.y = 0.34; t.add(schweller);
    var dachkante = U.box(1.44, 0.08, 0.22, R.dark, false); dachkante.position.set(0, 1.48, -1.42); t.add(dachkante);

    addGrille(root, 0.80, 1.66, 0.9, 0.18);
    addBumper(root, 0.46, 1.68, 1.66, 0.24, R.plastic);
    addBumper(root, 0.46, -1.68, 1.66, 0.24, R.plastic);
    addMirrors(root, 0.86, 1.04, 0.72, p);
    addDoors(root, 0.85, 0.82, -0.2, 1, 1.1, R.dark);
    addExhaust(root, -0.45, 0.32, -1.70, 0.045, 0.24, 0, R.metal);

    var tankdeckel = U.cyl(0.09, 0.09, 0.03, 10, R.metal, false);
    tankdeckel.rotation.z = Math.PI / 2; tankdeckel.position.set(-0.85, 0.72, -1.1); t.add(tankdeckel);

    lightPack(root, { hx: 0.54, hy: 0.84, hz: 1.68, hw: 0.36, hh: 0.18,
                      tx: 0.62, ty: 1.02, tz: -1.68, tw: 0.28, th: 0.30,
                      pfy: 0.56, pry: 0.62, ps: 0.85 });

    axles(root, { x: 0.80, y: 0.32, z: 1.12, r: 0.32, w: 0.24, rz: -1.12, style: 'stahl' });
    return root;
  };

  /* ---------- Taxi ---------- */
  B.taxi = function (color) {
    var root = B.kombi(color === undefined ? 0xe8c02a : color);
    var t = root.userData.tilt;

    var schild = U.box(0.72, 0.18, 0.26, R.white);
    schild.position.set(0, 1.58, 0.35); t.add(schild);
    var text = U.box(0.66, 0.12, 0.02, R.dark, false);
    text.position.set(0, 1.58, 0.49); t.add(text);
    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var wappen = U.box(0.02, 0.24, 0.5, R.dark, false);
      wappen.position.set(s * 1.00, 0.72, -0.2); t.add(wappen);
      var karo = U.box(0.02, 0.1, 0.46, R.white, false);
      karo.position.set(s * 1.01, 0.72, -0.2); t.add(karo);
    }
    var funk = U.cyl(0.012, 0.012, 0.5, 6, R.dark, false);
    funk.position.set(-0.5, 1.72, 1.0); t.add(funk);
    return root;
  };

  /* ---------- SUV ---------- */
  B.suv = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var body = U.box(2.10, 0.85, 4.45, p); body.position.y = 0.88; t.add(body);
    var kabine = U.box(1.92, 0.62, 2.60, R.glass); kabine.position.set(0, 1.60, -0.35); t.add(kabine);
    var dach = U.box(1.84, 0.12, 2.35, p); dach.position.set(0, 1.94, -0.40); t.add(dach);
    var haube = U.box(2.00, 0.20, 1.15, p); haube.position.set(0, 1.34, 1.62); t.add(haube);
    var untfahr = U.box(2.14, 0.22, 4.0, R.dark, false); untfahr.position.y = 0.55; t.add(untfahr);
    var reserve = U.cyl(0.44, 0.44, 0.24, 16, R.tire); reserve.rotation.x = Math.PI / 2;
    reserve.position.set(0, 1.05, -2.36); t.add(reserve);
    var reserveDeckel = U.cyl(0.2, 0.2, 0.26, 12, p, false); reserveDeckel.rotation.x = Math.PI / 2;
    reserveDeckel.position.set(0, 1.05, -2.38); t.add(reserveDeckel);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var trittbrett = U.box(0.22, 0.09, 2.1, R.metal, false);
      trittbrett.position.set(s * 1.06, 0.55, -0.1); t.add(trittbrett);
      var radlauf = U.box(0.10, 0.26, 1.0, R.plastic, false);
      radlauf.position.set(s * 1.06, 0.72, 1.45); t.add(radlauf);
      var radlauf2 = radlauf.clone(); radlauf2.position.z = -1.45; t.add(radlauf2);
    }

    addRoofRack(root, 2.04, -0.40, 1.5, 2.2);
    addGrille(root, 1.14, 2.24, 1.30, 0.34);
    addBumper(root, 0.62, 2.28, 2.12, 0.30, R.metal);
    addBumper(root, 0.62, -2.28, 2.12, 0.30, R.metal);
    addMirrors(root, 1.10, 1.46, 0.72, p);
    addDoors(root, 1.06, 1.20, -0.35, 2, 1.2, R.chrome);
    addExhaust(root, -0.70, 0.48, -2.32, 0.06, 0.3, 0, R.chrome);

    lightPack(root, { hx: 0.70, hy: 1.30, hz: 2.26, hw: 0.42, hh: 0.22,
                      tx: 0.82, ty: 1.42, tz: -2.26, tw: 0.30, th: 0.40,
                      pfy: 0.96, pry: 0.98 });

    axles(root, { x: 1.00, y: 0.50, z: 1.45, r: 0.50, w: 0.38, style: 'offroad' });
    return root;
  };

  /* ---------- Transporter / Van ---------- */
  B.van = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paintMatte(color);

    var body = U.box(2.05, 1.50, 5.10, p); body.position.y = 1.10; t.add(body);
    var dachwulst = U.box(1.86, 0.22, 3.0, p); dachwulst.position.set(0, 1.94, -0.7); t.add(dachwulst);
    var schnauze = U.box(2.0, 0.55, 0.6, p); schnauze.position.set(0, 0.78, 2.48); t.add(schnauze);
    var wind = U.box(1.86, 0.66, 0.08, R.glass); wind.position.set(0, 1.58, 2.52); t.add(wind);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var sw = U.box(0.07, 0.52, 1.10, R.glass, false); sw.position.set(s * 1.04, 1.62, 1.30); t.add(sw);
      var schiebe = U.box(0.05, 1.0, 1.5, R.dark, false); schiebe.position.set(s * 1.04, 1.15, 0.1); t.add(schiebe);
      var griff = U.box(0.06, 0.06, 0.3, R.dark, false); griff.position.set(s * 1.07, 1.2, 0.75); t.add(griff);
      var stufe = U.box(0.2, 0.08, 1.0, R.metal, false); stufe.position.set(s * 1.06, 0.5, 0.1); t.add(stufe);
    }

    var tuerL = U.box(1.0, 1.4, 0.1, p, false); tuerL.position.set(0.5, 1.15, -2.56); t.add(tuerL);
    var tuerR = U.box(1.0, 1.4, 0.1, p, false); tuerR.position.set(-0.5, 1.15, -2.56); t.add(tuerR);
    var fuge = U.box(0.04, 1.4, 0.12, R.dark, false); fuge.position.set(0, 1.15, -2.58); t.add(fuge);

    addGrille(root, 0.95, 2.56, 1.2, 0.26);
    addBumper(root, 0.55, 2.60, 2.0, 0.26, R.plastic);
    addBumper(root, 0.55, -2.60, 2.0, 0.26, R.plastic);
    addMirrors(root, 1.14, 1.62, 2.28, R.dark);
    addExhaust(root, -0.7, 0.4, -2.6, 0.055, 0.3, 0, R.metal);

    lightPack(root, { hx: 0.68, hy: 0.86, hz: 2.60, hw: 0.44, hh: 0.24,
                      tx: 0.86, ty: 1.05, tz: -2.60, tw: 0.28, th: 0.44,
                      pfy: 0.58, pry: 0.62 });

    axles(root, { x: 0.95, y: 0.44, z: 1.70, r: 0.44, w: 0.32, rz: -1.70, style: 'stahl' });
    return root;
  };

  /* ---------- Pickup ---------- */
  B.pickup = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var front = U.box(2.05, 0.80, 2.40, p); front.position.set(0, 0.86, 1.20); t.add(front);
    var kabine = U.box(1.92, 0.62, 1.35, R.glass); kabine.position.set(0, 1.56, 0.60); t.add(kabine);
    var dach = U.box(1.86, 0.12, 1.30, p); dach.position.set(0, 1.90, 0.58); t.add(dach);
    var pritsche = U.box(2.05, 0.62, 2.25, p); pritsche.position.set(0, 0.78, -1.30); t.add(pritsche);
    var ladeboden = U.box(1.82, 0.08, 2.05, R.metal, false); ladeboden.position.set(0, 1.06, -1.30); t.add(ladeboden);
    var heckklappe = U.box(1.9, 0.5, 0.1, p); heckklappe.position.set(0, 0.94, -2.38); t.add(heckklappe);
    var kiste = U.box(0.7, 0.45, 0.9, R.wood); kiste.position.set(0.45, 1.3, -1.5); kiste.rotation.y = 0.3; t.add(kiste);
    var kanister = U.box(0.3, 0.4, 0.22, R.rust); kanister.position.set(-0.6, 1.28, -0.7); t.add(kanister);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var buegel = U.cyl(0.045, 0.045, 0.6, 8, R.chrome); buegel.position.set(s * 0.62, 0.9, 2.44); t.add(buegel);
      var seitenwand = U.box(0.06, 0.24, 2.1, p, false); seitenwand.position.set(s * 1.03, 1.2, -1.3); t.add(seitenwand);
      var lampe = U.box(0.16, 0.1, 0.1, R.lightW, false); lampe.position.set(s * 0.3, 1.98, 0.0); t.add(lampe);
    }
    var buegelTop = U.cyl(0.04, 0.04, 1.3, 8, R.chrome, false);
    buegelTop.rotation.z = Math.PI / 2; buegelTop.position.set(0, 1.18, 2.44); t.add(buegelTop);

    addGrille(root, 1.02, 2.38, 1.35, 0.36);
    addBumper(root, 0.56, 2.46, 2.05, 0.26, R.chrome);
    addBumper(root, 0.56, -2.46, 2.05, 0.26, R.chrome);
    addMirrors(root, 1.10, 1.50, 1.12, p);
    addExhaust(root, -0.8, 0.42, -2.44, 0.06, 0.3, 0, R.chrome);

    var kupplung = U.sph(0.09, 8, 6, R.chrome, false); kupplung.position.set(0, 0.5, -2.6); t.add(kupplung);

    lightPack(root, { hx: 0.68, hy: 1.02, hz: 2.42, hw: 0.44, hh: 0.22,
                      tx: 0.80, ty: 0.94, tz: -2.42, tw: 0.34, th: 0.34,
                      pfy: 0.70, pry: 0.62 });

    axles(root, { x: 1.00, y: 0.52, z: 1.55, r: 0.52, w: 0.40, rz: -1.50, style: 'offroad' });
    return root;
  };

  /* ---------- Oldtimer ---------- */
  B.classic = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var body = U.box(1.90, 0.55, 4.20, p); body.position.y = 0.62; t.add(body);
    var haube = U.box(1.72, 0.30, 1.40, p); haube.position.set(0, 0.88, 1.35); t.add(haube);
    var kabine = U.box(1.62, 0.50, 1.70, R.glass); kabine.position.set(0, 1.14, -0.30); t.add(kabine);
    var dach = U.box(1.52, 0.12, 1.55, p); dach.position.set(0, 1.42, -0.35); t.add(dach);
    var kofferraum = U.box(1.74, 0.34, 1.0, p); kofferraum.position.set(0, 0.88, -1.72); t.add(kofferraum);
    var kuehler = U.box(1.1, 0.42, 0.16, R.chrome); kuehler.position.set(0, 0.86, 2.08); t.add(kuehler);
    var stern = U.sph(0.05, 8, 6, R.chrome, false); stern.position.set(0, 1.08, 1.96); t.add(stern);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var kotfluegelV = U.sph(0.5, 12, 10, p); kotfluegelV.scale.set(0.42, 0.5, 0.85);
      kotfluegelV.position.set(s * 0.94, 0.66, 1.36); t.add(kotfluegelV);
      var kotfluegelH = kotfluegelV.clone(); kotfluegelH.position.z = -1.36; t.add(kotfluegelH);
      var zierleiste = U.box(0.05, 0.06, 3.6, R.chrome, false); zierleiste.position.set(s * 0.97, 0.62, 0); t.add(zierleiste);
      var trittbrett = U.box(0.24, 0.08, 1.5, R.dark, false); trittbrett.position.set(s * 0.98, 0.42, 0); t.add(trittbrett);
    }

    addBumper(root, 0.46, 2.14, 1.96, 0.16, R.chrome);
    addBumper(root, 0.48, -2.14, 1.96, 0.16, R.chrome);
    addMirrors(root, 0.98, 1.06, 1.0, R.chrome);
    addExhaust(root, -0.55, 0.32, -2.18, 0.05, 0.26, 0, R.chrome);

    var ersatzrad = makeWheel(0.34, 0.2, 'speiche');
    ersatzrad.rotation.y = Math.PI / 2;
    ersatzrad.position.set(0, 0.95, -2.28); t.add(ersatzrad);

    lightPack(root, { hx: 0.60, hy: 0.86, hz: 2.05, hh: 0.16, round: true,
                      tx: 0.66, ty: 0.86, tz: -2.14, tw: 0.26, th: 0.16,
                      pfy: 0.56, pry: 0.60 });

    axles(root, { x: 0.90, y: 0.40, z: 1.35, r: 0.40, w: 0.26, style: 'speiche' });
    return root;
  };

  /* ---------- Cabrio ---------- */
  B.cabrio = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var body = U.box(1.92, 0.62, 4.20, p); body.position.y = 0.60; t.add(body);
    var haube = U.box(1.80, 0.16, 1.45, p); haube.position.set(0, 0.94, 1.40); t.add(haube);
    var innen = U.box(1.62, 0.30, 1.70, R.leather, false); innen.position.set(0, 0.92, -0.25); t.add(innen);
    var wind = U.box(1.55, 0.42, 0.06, R.clear); wind.position.set(0, 1.16, 0.62); wind.rotation.x = -0.28; t.add(wind);
    var verdeck = U.box(1.62, 0.22, 0.7, R.cloth); verdeck.position.set(0, 1.02, -1.40); t.add(verdeck);
    var heck = U.box(1.80, 0.30, 0.9, p); heck.position.set(0, 0.88, -1.80); t.add(heck);
    var schweller = U.box(1.96, 0.12, 3.4, R.dark, false); schweller.position.y = 0.34; t.add(schweller);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var sitz = U.box(0.5, 0.42, 0.16, R.leather); sitz.position.set(s * 0.38, 1.06, -0.72); t.add(sitz);
      var kopf = U.box(0.34, 0.16, 0.14, R.leather, false); kopf.position.set(s * 0.38, 1.3, -0.74); t.add(kopf);
      var buegel = U.cyl(0.05, 0.05, 0.3, 8, R.chrome, false); buegel.position.set(s * 0.38, 1.28, -1.0); t.add(buegel);
    }
    var lenkrad = U.torus(0.16, 0.025, 6, 14, R.dark, false);
    lenkrad.rotation.x = 1.2; lenkrad.position.set(0.38, 1.02, 0.3); t.add(lenkrad);

    addGrille(root, 0.72, 2.10, 1.05, 0.22);
    addBumper(root, 0.44, 2.14, 1.90, 0.16, R.chrome);
    addBumper(root, 0.46, -2.14, 1.90, 0.16, R.chrome);
    addMirrors(root, 1.00, 1.02, 0.68, p);
    addExhaust(root, 0.5, 0.34, -2.18, 0.05, 0.26, 0, R.chrome);
    addExhaust(root, -0.5, 0.34, -2.18, 0.05, 0.26, 0, R.chrome);

    lightPack(root, { hx: 0.62, hy: 0.82, hz: 2.12, hw: 0.40, hh: 0.16,
                      tx: 0.66, ty: 0.86, tz: -2.16, tw: 0.36, th: 0.16,
                      pfy: 0.54, pry: 0.58 });

    axles(root, { x: 0.92, y: 0.40, z: 1.38, r: 0.40, w: 0.30, style: 'sport' });
    return root;
  };

  /* ---------- Muscle-Car ---------- */
  B.muscle = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var body = U.box(2.06, 0.62, 4.70, p); body.position.y = 0.62; t.add(body);
    var haube = U.box(1.94, 0.24, 1.70, p); haube.position.set(0, 0.94, 1.50); t.add(haube);
    var hutze = U.box(0.62, 0.22, 0.7, R.dark); hutze.position.set(0, 1.14, 1.35); t.add(hutze);
    var lufttrichter = U.cyl(0.22, 0.26, 0.16, 12, R.chrome); lufttrichter.position.set(0, 1.3, 1.35); t.add(lufttrichter);
    var kabine = U.box(1.72, 0.46, 1.70, R.glass); kabine.position.set(0, 1.10, -0.30); t.add(kabine);
    var dach = U.box(1.62, 0.12, 1.35, p); dach.position.set(0, 1.36, -0.40); t.add(dach);
    var heck = U.box(1.98, 0.34, 1.15, p); heck.position.set(0, 0.92, -1.85); t.add(heck);
    var spoiler = U.box(1.8, 0.08, 0.3, p, false); spoiler.position.set(0, 1.12, -2.2); t.add(spoiler);
    var streifen = U.box(0.5, 0.02, 4.4, R.white, false); streifen.position.set(0, 0.94, 0); t.add(streifen);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var kieme = U.box(0.04, 0.2, 0.4, R.dark, false); kieme.position.set(s * 1.04, 0.78, -1.1); t.add(kieme);
      var seitenrohr = U.cyl(0.06, 0.06, 1.6, 8, R.chrome, false);
      seitenrohr.rotation.x = Math.PI / 2; seitenrohr.position.set(s * 1.02, 0.32, -0.4); t.add(seitenrohr);
    }

    addGrille(root, 0.80, 2.36, 1.55, 0.28);
    addBumper(root, 0.48, 2.42, 2.02, 0.18, R.chrome);
    addBumper(root, 0.50, -2.42, 2.02, 0.18, R.chrome);
    addMirrors(root, 1.02, 1.02, 0.72, R.chrome);

    lightPack(root, { hx: 0.66, hy: 0.86, hz: 2.36, hh: 0.15, round: true,
                      tx: 0.62, ty: 0.90, tz: -2.42, tw: 0.42, th: 0.20,
                      pfy: 0.56, pry: 0.62 });

    axles(root, { x: 0.98, y: 0.42, z: 1.55, r: 0.42, w: 0.32, rz: -1.55, rr: 0.48, rw: 0.48, ry: 0.48, style: 'sport' });
    return root;
  };

  /* ---------- Rallye-Auto ---------- */
  B.rally = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paintMatte(color);

    var body = U.box(1.94, 0.60, 4.10, p); body.position.y = 0.66; t.add(body);
    var kabine = U.box(1.76, 0.54, 2.1, R.glass); kabine.position.set(0, 1.20, -0.15); t.add(kabine);
    var dach = U.box(1.68, 0.12, 1.8, p); dach.position.set(0, 1.50, -0.2); t.add(dach);
    var dachhutze = U.box(0.4, 0.14, 0.5, R.dark); dachhutze.position.set(0, 1.62, 0.55); t.add(dachhutze);
    var haube = U.box(1.82, 0.18, 1.1, p); haube.position.set(0, 0.98, 1.45); t.add(haube);
    var fluegel = U.box(1.9, 0.08, 0.45, R.dark); fluegel.position.set(0, 1.62, -2.0); t.add(fluegel);
    var unterfahr = U.box(1.9, 0.1, 3.0, R.metal, false); unterfahr.position.y = 0.36; t.add(unterfahr);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var stuetze = U.box(0.08, 0.36, 0.1, R.dark); stuetze.position.set(s * 0.8, 1.42, -1.96); t.add(stuetze);
      var kotfluegel = U.box(0.16, 0.3, 1.1, p, false); kotfluegel.position.set(s * 1.02, 0.74, 1.4); t.add(kotfluegel);
      var kotfluegelH = kotfluegel.clone(); kotfluegelH.position.z = -1.4; t.add(kotfluegelH);
      var startnr = U.box(0.02, 0.32, 0.32, R.white, false); startnr.position.set(s * 1.05, 0.9, -0.1); t.add(startnr);
      var mudflap = U.box(0.2, 0.26, 0.03, R.rubber, false); mudflap.position.set(s * 0.95, 0.28, -1.9); t.add(mudflap);
    }

    // Zusatzscheinwerfer auf der Stange
    var stange = U.cyl(0.03, 0.03, 1.3, 8, R.metal, false);
    stange.rotation.z = Math.PI / 2; stange.position.set(0, 1.02, 2.12); t.add(stange);
    for (i = 0; i < 4; i++) {
      var zs = U.cyl(0.11, 0.11, 0.1, 12, R.lightF, false);
      zs.rotation.x = Math.PI / 2;
      zs.position.set(-0.48 + i * 0.32, 1.12, 2.14);
      t.add(zs); root.userData.headlights.push(zs);
    }

    addBumper(root, 0.48, 2.16, 1.92, 0.2, R.dark);
    addMirrors(root, 1.02, 1.10, 0.78, R.dark);
    addExhaust(root, -0.7, 0.42, -2.14, 0.07, 0.3, 0, R.metal);

    lightPack(root, { hx: 0.60, hy: 0.86, hz: 2.10, hw: 0.40, hh: 0.16,
                      tx: 0.66, ty: 0.94, tz: -2.10, tw: 0.34, th: 0.24,
                      pfy: 0.58, pry: 0.64 });

    axles(root, { x: 0.96, y: 0.44, z: 1.42, r: 0.44, w: 0.36, style: 'offroad' });
    return root;
  };

  /* ---------- Stretch-Limousine ---------- */
  B.limo = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var body = U.box(2.02, 0.66, 6.60, p); body.position.y = 0.64; t.add(body);
    var haube = U.box(1.92, 0.20, 1.5, p); haube.position.set(0, 0.98, 2.55); t.add(haube);
    var kabineV = U.box(1.80, 0.52, 1.2, R.glass); kabineV.position.set(0, 1.18, 1.45); t.add(kabineV);
    var kabineM = U.box(1.82, 0.52, 3.3, R.glass); kabineM.position.set(0, 1.18, -0.7); t.add(kabineM);
    var dach = U.box(1.76, 0.14, 5.0, p); dach.position.set(0, 1.48, 0.1); t.add(dach);
    var kofferraum = U.box(1.92, 0.36, 0.9, p); kofferraum.position.set(0, 0.94, -2.9); t.add(kofferraum);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var leiste = U.box(0.05, 0.07, 6.2, R.chrome, false); leiste.position.set(s * 1.02, 0.68, 0); t.add(leiste);
      var schweller = U.box(0.12, 0.16, 5.4, R.chrome, false); schweller.position.set(s * 1.0, 0.34, 0); t.add(schweller);
      var flagge = U.box(0.04, 0.2, 0.14, R.white, false); flagge.position.set(s * 0.7, 1.2, 3.2); t.add(flagge);
    }
    addDoors(root, 1.02, 0.9, 0.2, 3, 1.5, R.chrome);

    addGrille(root, 0.84, 3.30, 1.5, 0.3);
    addBumper(root, 0.48, 3.36, 2.0, 0.2, R.chrome);
    addBumper(root, 0.50, -3.36, 2.0, 0.2, R.chrome);
    addMirrors(root, 1.04, 1.12, 1.9, R.chrome);
    addExhaust(root, 0.6, 0.36, -3.4, 0.06, 0.28, 0, R.chrome);
    addExhaust(root, -0.6, 0.36, -3.4, 0.06, 0.28, 0, R.chrome);

    var stern2 = U.cyl(0.05, 0.05, 0.12, 8, R.chrome, false); stern2.position.set(0, 1.12, 3.2); t.add(stern2);

    lightPack(root, { hx: 0.66, hy: 0.88, hz: 3.32, hw: 0.44, hh: 0.18,
                      tx: 0.72, ty: 0.94, tz: -3.32, tw: 0.40, th: 0.20,
                      pfy: 0.60, pry: 0.66 });

    axles(root, { x: 0.94, y: 0.42, z: 2.40, r: 0.42, w: 0.30, rz: -2.40, style: 'sport' });
    return root;
  };

  /* __PART5__ */

  return V;
})();
