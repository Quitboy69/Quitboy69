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

  /* ---------- Traktor ---------- */
  B.traktor = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var motorblock = U.box(1.05, 0.85, 2.10, p); motorblock.position.set(0, 1.05, 1.35); t.add(motorblock);
    var kuehlergrill = U.box(0.95, 0.55, 0.14, R.grille); kuehlergrill.position.set(0, 1.00, 2.42); t.add(kuehlergrill);
    var rumpf = U.box(1.20, 0.70, 1.60, R.dark); rumpf.position.set(0, 0.95, -0.35); t.add(rumpf);
    var kabine = U.box(1.50, 1.10, 1.45, R.clear); kabine.position.set(0, 2.05, -0.55); t.add(kabine);
    var kabinendach = U.box(1.70, 0.14, 1.65, p); kabinendach.position.set(0, 2.68, -0.55); t.add(kabinendach);
    var sitz = U.box(0.5, 0.5, 0.16, R.leather, false); sitz.position.set(0, 1.85, -1.05); t.add(sitz);
    var lenkrad = U.torus(0.19, 0.03, 6, 14, R.dark, false);
    lenkrad.rotation.x = 1.0; lenkrad.position.set(0, 1.95, -0.05); t.add(lenkrad);
    var auspuffrohr = U.cyl(0.07, 0.08, 1.5, 10, R.metal); auspuffrohr.position.set(0.45, 1.9, 2.05); t.add(auspuffrohr);
    var auspuffkappe = U.cyl(0.10, 0.10, 0.08, 10, R.dark, false); auspuffkappe.position.set(0.45, 2.68, 2.05); t.add(auspuffkappe);
    var gewicht = U.box(0.9, 0.4, 0.3, R.dark); gewicht.position.set(0, 0.75, 2.60); t.add(gewicht);
    var hydraulik = U.box(1.0, 0.24, 0.3, R.metal); hydraulik.position.set(0, 0.85, -1.60); t.add(hydraulik);
    var kupplung = U.cyl(0.08, 0.08, 0.3, 8, R.chrome, false);
    kupplung.rotation.x = Math.PI / 2; kupplung.position.set(0, 0.75, -1.85); t.add(kupplung);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var kotfluegel = U.box(0.28, 0.4, 1.5, p, false); kotfluegel.position.set(s * 0.86, 1.35, -0.75); t.add(kotfluegel);
      var arbeitslicht = U.box(0.18, 0.14, 0.12, R.lightF, false);
      arbeitslicht.position.set(s * 0.5, 2.72, 0.2); t.add(arbeitslicht);
      root.userData.headlights.push(arbeitslicht);
      var spiegelarm = U.cyl(0.02, 0.02, 0.5, 6, R.metal, false);
      spiegelarm.rotation.z = Math.PI / 2 + s * 0.3; spiegelarm.position.set(s * 1.0, 2.4, -0.1); t.add(spiegelarm);
      var spiegel = U.box(0.06, 0.28, 0.2, R.chrome, false); spiegel.position.set(s * 1.22, 2.35, -0.1); t.add(spiegel);
    }

    var rundum = U.cyl(0.09, 0.11, 0.16, 10, R.lightA, false);
    rundum.position.set(-0.6, 2.82, -0.55); t.add(rundum);
    root.userData.siren = rundum;

    lightPack(root, { hx: 0.42, hy: 1.22, hz: 2.48, hw: 0.24, hh: 0.18,
                      tx: 0.5, ty: 1.05, tz: -1.72, tw: 0.2, th: 0.2,
                      pfy: 0.80, pry: 0.72, ps: 0.9 });

    attachWheel(root,  0.78, 0.52, 1.60, 0.52, 0.30, true, 'offroad');
    attachWheel(root, -0.78, 0.52, 1.60, 0.52, 0.30, true, 'offroad');
    attachWheel(root,  0.86, 0.92, -0.75, 0.92, 0.46, false, 'traktor');
    attachWheel(root, -0.86, 0.92, -0.75, 0.92, 0.46, false, 'traktor');
    return root;
  };

  /* ---------- Postbus ---------- */
  B.bus = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paintMatte(color);

    var body = U.box(2.45, 2.10, 9.40, p); body.position.y = 1.65; t.add(body);
    var dach = U.box(2.30, 0.18, 9.0, R.white, false); dach.position.set(0, 2.76, 0); t.add(dach);
    var front = U.box(2.40, 0.9, 0.3, p); front.position.set(0, 0.85, 4.62); t.add(front);
    var wind = U.box(2.20, 1.10, 0.10, R.clear); wind.position.set(0, 2.05, 4.68); t.add(wind);
    var heckscheibe = U.box(2.10, 0.9, 0.10, R.glass); heckscheibe.position.set(0, 2.10, -4.68); t.add(heckscheibe);
    var streifen = U.box(2.48, 0.28, 9.2, R.lightA, false); streifen.position.set(0, 1.12, 0); t.add(streifen);

    var i, s, k;
    for (k = 0; k < 2; k++) {
      s = k ? -1 : 1;
      for (i = 0; i < 5; i++) {
        var fenster = U.box(0.08, 0.85, 1.35, R.glass, false);
        fenster.position.set(s * 1.24, 2.15, -3.2 + i * 1.62);
        t.add(fenster);
      }
      var tuer = U.box(0.08, 1.6, 1.0, R.glass, false);
      tuer.position.set(s * 1.24, 1.6, 3.6); t.add(tuer);
      var stufe = U.box(0.24, 0.1, 1.0, R.metal, false);
      stufe.position.set(s * 1.24, 0.48, 3.6); t.add(stufe);
    }

    var gepaeck = U.box(1.9, 0.5, 3.0, R.dark, false); gepaeck.position.set(0, 3.02, -1.0); t.add(gepaeck);
    var ziel = U.box(1.6, 0.3, 0.06, R.screen ? R.screen : R.dark, false);
    ziel.position.set(0, 2.62, 4.72); t.add(ziel);
    var horn = U.cyl(0.08, 0.14, 0.3, 8, R.rimGold, false);
    horn.rotation.x = Math.PI / 2; horn.position.set(0.9, 2.9, 4.4); t.add(horn);

    addBumper(root, 0.5, 4.75, 2.45, 0.3, R.plastic);
    addBumper(root, 0.5, -4.75, 2.45, 0.3, R.plastic);
    addMirrors(root, 1.42, 2.30, 4.35, R.dark);
    addExhaust(root, -1.0, 0.5, -4.7, 0.08, 0.34, 0, R.metal);

    lightPack(root, { hx: 0.86, hy: 0.92, hz: 4.76, hw: 0.44, hh: 0.26,
                      tx: 0.92, ty: 1.0, tz: -4.76, tw: 0.36, th: 0.42,
                      pfy: 0.58, pry: 0.62 });

    attachWheel(root,  1.10, 0.58, 3.20, 0.58, 0.36, true, 'stahl');
    attachWheel(root, -1.10, 0.58, 3.20, 0.58, 0.36, true, 'stahl');
    attachWheel(root,  1.10, 0.58, -3.10, 0.58, 0.36, false, 'stahl');
    attachWheel(root, -1.10, 0.58, -3.10, 0.58, 0.36, false, 'stahl');
    return root;
  };

  /* ---------- Holz-LKW ---------- */
  B.lkw = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paintMatte(color);

    var fahrerhaus = U.box(2.35, 1.85, 2.20, p); fahrerhaus.position.set(0, 1.75, 3.10); t.add(fahrerhaus);
    var wind = U.box(2.10, 0.90, 0.10, R.clear); wind.position.set(0, 2.20, 4.16); t.add(wind);
    var haube = U.box(2.20, 0.7, 1.0, p); haube.position.set(0, 1.05, 4.4); t.add(haube);
    var rahmen = U.box(1.60, 0.34, 8.6, R.dark); rahmen.position.set(0, 0.90, -0.6); t.add(rahmen);
    var ladeflaeche = U.box(2.40, 0.20, 6.0, R.wood); ladeflaeche.position.set(0, 1.16, -1.6); t.add(ladeflaeche);

    var i, s;
    for (i = 0; i < 5; i++) {
      var stamm = U.cyl(0.30, 0.32, 5.4, 10, R.wood);
      stamm.rotation.x = Math.PI / 2;
      stamm.position.set(-0.72 + i * 0.36, 1.5 + (i % 2) * 0.5, -1.6);
      t.add(stamm);
    }
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var rungeV = U.cyl(0.06, 0.06, 1.4, 8, R.metal); rungeV.position.set(s * 1.16, 1.9, 0.6); t.add(rungeV);
      var rungeH = rungeV.clone(); rungeH.position.z = -3.8; t.add(rungeH);
      var tank = U.cyl(0.28, 0.28, 1.2, 12, R.alu); tank.rotation.z = Math.PI / 2;
      tank.position.set(s * 1.05, 0.85, 1.6); t.add(tank);
      var kotf = U.box(0.4, 0.2, 1.3, R.plastic, false); kotf.position.set(s * 1.15, 1.3, -2.6); t.add(kotf);
    }

    var auspuff = U.cyl(0.09, 0.09, 2.4, 10, R.chrome); auspuff.position.set(1.18, 2.0, 2.1); t.add(auspuff);
    var luftfilter = U.cyl(0.16, 0.16, 1.4, 10, R.metal); luftfilter.position.set(-1.18, 2.3, 2.1); t.add(luftfilter);
    var dachlampen = U.box(1.6, 0.16, 0.22, R.lightA, false); dachlampen.position.set(0, 2.76, 3.6); t.add(dachlampen);
    var kuh = U.box(2.2, 0.5, 0.14, R.metal); kuh.position.set(0, 1.0, 4.92); t.add(kuh);

    addGrille(root, 1.6, 4.2, 1.7, 0.6);
    addBumper(root, 0.6, 4.9, 2.4, 0.34, R.metal);
    addMirrors(root, 1.42, 2.20, 3.9, R.dark);

    lightPack(root, { hx: 0.82, hy: 1.0, hz: 4.9, hw: 0.42, hh: 0.28,
                      tx: 0.72, ty: 0.9, tz: -4.3, tw: 0.3, th: 0.34,
                      pfy: 0.62, pry: 0.56 });

    attachWheel(root,  1.12, 0.62, 3.30, 0.62, 0.40, true, 'stahl');
    attachWheel(root, -1.12, 0.62, 3.30, 0.62, 0.40, true, 'stahl');
    attachWheel(root,  1.14, 0.62, -2.20, 0.62, 0.44, false, 'stahl');
    attachWheel(root, -1.14, 0.62, -2.20, 0.62, 0.44, false, 'stahl');
    attachWheel(root,  1.14, 0.62, -3.55, 0.62, 0.44, false, 'stahl');
    attachWheel(root, -1.14, 0.62, -3.55, 0.62, 0.44, false, 'stahl');
    return root;
  };

  /* ---------- Militär-Geländewagen ---------- */
  B.militaer = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paintMatte(color === undefined ? 0x4a5540 : color);

    var wanne = U.box(2.30, 0.95, 4.70, p); wanne.position.y = 1.05; t.add(wanne);
    var motorhaube = U.box(2.10, 0.45, 1.30, p); motorhaube.position.set(0, 1.62, 1.75); t.add(motorhaube);
    var wind = U.box(1.90, 0.55, 0.10, R.clear); wind.position.set(0, 1.95, 1.05); wind.rotation.x = -0.22; t.add(wind);
    var buegelDach = U.box(1.95, 0.10, 2.4, R.cloth); buegelDach.position.set(0, 2.30, -0.6); t.add(buegelDach);
    var schnorchel = U.cyl(0.09, 0.09, 2.0, 10, R.dark); schnorchel.position.set(1.06, 1.95, 1.3); t.add(schnorchel);
    var seilwinde = U.cyl(0.14, 0.14, 0.7, 10, R.metal); seilwinde.rotation.z = Math.PI / 2;
    seilwinde.position.set(0, 0.85, 2.50); t.add(seilwinde);
    var reserverad = makeWheel(0.52, 0.34, 'offroad');
    reserverad.rotation.y = Math.PI / 2; reserverad.position.set(0, 1.35, -2.50); t.add(reserverad);
    var kanister2 = U.box(0.24, 0.5, 0.34, R.dark); kanister2.position.set(-1.0, 1.7, -1.9); t.add(kanister2);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var buegel = U.cyl(0.06, 0.06, 1.2, 8, R.dark); buegel.position.set(s * 0.95, 1.75, -1.75); t.add(buegel);
      var buegelV = U.cyl(0.06, 0.06, 1.0, 8, R.dark); buegelV.position.set(s * 0.95, 1.85, 0.6); t.add(buegelV);
      var stufe = U.box(0.26, 0.1, 1.4, R.metal, false); stufe.position.set(s * 1.2, 0.72, -0.2); t.add(stufe);
      var radlauf = U.box(0.16, 0.24, 1.3, R.dark, false); radlauf.position.set(s * 1.16, 1.0, 1.5); t.add(radlauf);
      var radlaufH = radlauf.clone(); radlaufH.position.z = -1.5; t.add(radlaufH);
    }

    var netz = U.box(1.9, 0.14, 1.2, R.cloth, false); netz.position.set(0, 1.6, -1.9); t.add(netz);
    var antenne2 = U.cyl(0.014, 0.014, 1.6, 6, R.dark, false);
    antenne2.position.set(-1.05, 2.2, -1.2); antenne2.rotation.z = 0.12; t.add(antenne2);

    addGrille(root, 1.55, 2.42, 1.4, 0.4);
    addBumper(root, 0.7, 2.52, 2.3, 0.3, R.dark);
    addBumper(root, 0.7, -2.52, 2.3, 0.3, R.dark);
    addMirrors(root, 1.22, 1.95, 1.35, R.dark);
    addExhaust(root, -0.9, 0.6, -2.5, 0.07, 0.32, 0, R.metal);

    lightPack(root, { hx: 0.74, hy: 1.62, hz: 2.44, hh: 0.18, round: true,
                      tx: 0.84, ty: 1.30, tz: -2.44, tw: 0.24, th: 0.24,
                      pfy: 1.10, pry: 0.96 });

    axles(root, { x: 1.06, y: 0.56, z: 1.55, r: 0.56, w: 0.42, style: 'offroad' });
    return root;
  };

  /* ---------- Streifenwagen (nicht kaufbar) ---------- */
  B.streifenwagen = function (color) {
    var root = B.kombi(color === undefined ? 0xf2f4f6 : color);
    var t = root.userData.tilt;

    var streifen = U.box(2.00, 0.24, 2.90, U.mat(0x1a55a8, 0.6, 0.1), false);
    streifen.position.set(0, 0.64, 0); t.add(streifen);
    var balken = U.box(1.16, 0.16, 0.36, R.dark);
    balken.position.set(0, 1.54, 0.10); t.add(balken);
    var blauL = U.box(0.46, 0.14, 0.32, R.lightBlue, false);
    blauL.position.set(0.34, 1.56, 0.10); t.add(blauL);
    var blauR = U.box(0.46, 0.14, 0.32, R.lightBlue, false);
    blauR.position.set(-0.34, 1.56, 0.10); t.add(blauR);
    var schrift = U.box(0.02, 0.16, 1.2, R.dark, false);
    schrift.position.set(1.00, 0.98, -0.3); t.add(schrift);
    var schrift2 = schrift.clone(); schrift2.position.x = -1.00; t.add(schrift2);
    var suchscheinwerfer = U.cyl(0.09, 0.09, 0.12, 10, R.lightW, false);
    suchscheinwerfer.rotation.x = Math.PI / 2; suchscheinwerfer.position.set(0.72, 1.32, 0.95); t.add(suchscheinwerfer);

    root.userData.siren = balken;
    root.userData.sirenLights = [blauL, blauR];
    return root;
  };

  /* ==========================================================
     KAROSSERIEN — ZWEIRÄDER (alle mit sichtbarem Fahrer)
     ========================================================== */

  // Gabel + Schutzblech, von mehreren Zweirädern genutzt
  function addFork(root, x, y, z, len, neigung, m, r) {
    var t = root.userData.tilt, i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var holm = U.cyl(r === undefined ? 0.035 : r, r === undefined ? 0.035 : r, len, 8, m || R.chrome);
      holm.position.set(s * x, y, z);
      holm.rotation.x = neigung;
      t.add(holm);
    }
  }

  function addFender(root, y, z, w, r, m, ang) {
    var f = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, w, 14, 1, true, ang === undefined ? -0.9 : ang, 1.8),
      m || R.dark
    );
    f.rotation.z = Math.PI / 2;
    f.position.set(0, y, z);
    f.castShadow = true;
    root.userData.tilt.add(f);
    return f;
  }

  /* ---------- E-Mountainbike ---------- */
  B.fahrrad = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var oberrohr = U.cyl(0.026, 0.026, 0.86, 8, p); oberrohr.rotation.x = Math.PI / 2 - 0.12;
    oberrohr.position.set(0, 0.92, 0.06); t.add(oberrohr);
    var unterrohr = U.cyl(0.03, 0.03, 0.92, 8, p); unterrohr.rotation.x = Math.PI / 2 + 0.55;
    unterrohr.position.set(0, 0.66, 0.22); t.add(unterrohr);
    var sitzrohr = U.cyl(0.025, 0.025, 0.6, 8, p); sitzrohr.rotation.x = -0.22;
    sitzrohr.position.set(0, 0.82, -0.32); t.add(sitzrohr);
    var kettenstrebe = U.cyl(0.02, 0.02, 0.6, 6, p); kettenstrebe.rotation.x = Math.PI / 2 - 0.1;
    kettenstrebe.position.set(0, 0.42, -0.34); t.add(kettenstrebe);
    var sitzstrebe = U.cyl(0.018, 0.018, 0.62, 6, p); sitzstrebe.rotation.x = 0.5;
    sitzstrebe.position.set(0, 0.72, -0.46); t.add(sitzstrebe);

    var motor = U.box(0.16, 0.2, 0.26, R.dark); motor.position.set(0, 0.44, -0.02); t.add(motor);
    var akku = U.box(0.1, 0.14, 0.62, R.dark); akku.position.set(0, 0.68, 0.2); akku.rotation.x = 0.55; t.add(akku);
    var display = U.box(0.1, 0.03, 0.07, R.chrome, false); display.position.set(0, 1.12, 0.42); t.add(display);

    var sattel = U.box(0.12, 0.07, 0.32, R.dark); sattel.position.set(0, 1.06, -0.4); t.add(sattel);
    var kurbel = U.cyl(0.11, 0.11, 0.02, 12, R.metal, false); kurbel.rotation.z = Math.PI / 2;
    kurbel.position.set(0.06, 0.44, -0.02); t.add(kurbel);
    var pedalL = U.box(0.07, 0.03, 0.15, R.dark, false); pedalL.position.set(0.16, 0.36, 0.05); t.add(pedalL);
    var pedalR = U.box(0.07, 0.03, 0.15, R.dark, false); pedalR.position.set(-0.16, 0.52, -0.09); t.add(pedalR);

    addFork(root, 0.08, 0.52, 0.58, 0.72, 0.24, R.metal, 0.022);
    addBars(root, 1.14, 0.42, 0.6, R.dark);
    addFender(root, 0.82, 0.62, 0.07, 0.4, R.dark);
    addFender(root, 0.78, -0.62, 0.07, 0.4, R.dark);

    var lampe = U.cyl(0.05, 0.05, 0.05, 10, R.lightF, false);
    lampe.rotation.x = Math.PI / 2; lampe.position.set(0, 0.92, 0.66); t.add(lampe);
    root.userData.headlights.push(lampe);
    var ruecklicht = U.box(0.06, 0.05, 0.03, R.lightR, false);
    ruecklicht.position.set(0, 0.9, -0.72); t.add(ruecklicht);
    root.userData.tailLights.push(ruecklicht);
    var traeger = U.box(0.22, 0.03, 0.34, R.metal, false); traeger.position.set(0, 0.94, -0.62); t.add(traeger);
    var korb = U.box(0.26, 0.16, 0.3, R.wood, false); korb.position.set(0, 1.05, -0.62); t.add(korb);

    addRider(root, { suit: 0x2f6f4a, helmet: 0xe0e4e8, lean: 0.45, y: 1.02, z: -0.12 });

    attachWheel(root, 0, 0.36, 0.60, 0.36, 0.06, true, 'speiche');
    attachWheel(root, 0, 0.36, -0.62, 0.36, 0.06, false, 'speiche');
    return root;
  };

  /* ---------- Moped (Zweitakter) ---------- */
  B.moped = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var rahmen = U.cyl(0.04, 0.04, 0.9, 8, p); rahmen.rotation.x = Math.PI / 2 + 0.35;
    rahmen.position.set(0, 0.6, 0.16); t.add(rahmen);
    var tank = U.box(0.2, 0.2, 0.5, p); tank.position.set(0, 0.82, 0.1); t.add(tank);
    var tankdeckel = U.cyl(0.05, 0.05, 0.04, 8, R.chrome, false); tankdeckel.position.set(0, 0.93, 0.16); t.add(tankdeckel);
    var motor = U.box(0.22, 0.24, 0.3, R.metal); motor.position.set(0, 0.44, -0.06); t.add(motor);
    var zylinder = U.cyl(0.07, 0.07, 0.18, 8, R.alu); zylinder.rotation.x = 0.9;
    zylinder.position.set(0, 0.58, 0.06); t.add(zylinder);
    var sattel = U.box(0.24, 0.1, 0.46, R.dark); sattel.position.set(0, 0.84, -0.38); t.add(sattel);
    var gepaecktraeger = U.box(0.24, 0.03, 0.3, R.chrome, false); gepaecktraeger.position.set(0, 0.92, -0.7); t.add(gepaecktraeger);
    var kette = U.box(0.03, 0.06, 0.5, R.dark, false); kette.position.set(0.1, 0.4, -0.3); t.add(kette);
    var staender = U.cyl(0.018, 0.018, 0.3, 6, R.metal, false);
    staender.rotation.x = 0.4; staender.position.set(-0.12, 0.2, -0.16); t.add(staender);
    var pedale = U.box(0.44, 0.03, 0.08, R.dark, false); pedale.position.set(0, 0.34, -0.02); t.add(pedale);

    addExhaust(root, 0.14, 0.32, -0.44, 0.045, 0.7, 0.1, R.chrome);
    addFork(root, 0.07, 0.56, 0.6, 0.6, 0.3, R.chrome, 0.022);
    addBars(root, 1.0, 0.46, 0.62, R.chrome);
    addFender(root, 0.78, 0.62, 0.09, 0.36, p);
    addFender(root, 0.74, -0.64, 0.09, 0.34, p);

    var lampe = U.cyl(0.08, 0.08, 0.08, 12, R.lightF, false);
    lampe.rotation.x = Math.PI / 2; lampe.position.set(0, 0.88, 0.66); t.add(lampe);
    root.userData.headlights.push(lampe);
    var rueck = U.box(0.09, 0.07, 0.04, R.lightR, false); rueck.position.set(0, 0.86, -0.78); t.add(rueck);
    root.userData.tailLights.push(rueck);
    var blinkL = U.sph(0.035, 8, 6, R.lightA, false); blinkL.position.set(0.2, 0.88, 0.62); t.add(blinkL);
    root.userData.blinkers.push(blinkL);
    var blinkR = U.sph(0.035, 8, 6, R.lightA, false); blinkR.position.set(-0.2, 0.88, 0.62); t.add(blinkR);
    root.userData.blinkers.push(blinkR);
    addPlate(root, 0, 0.7, -0.82, Math.PI, 0.5);

    addRider(root, { suit: 0x394050, helmet: 0xd94f4f, lean: 0.2, y: 1.0, z: -0.16 });

    attachWheel(root, 0, 0.32, 0.62, 0.32, 0.09, true, 'speiche');
    attachWheel(root, 0, 0.32, -0.64, 0.32, 0.09, false, 'speiche');
    return root;
  };

  /* ---------- Roller ---------- */
  B.roller = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var trittbrett = U.box(0.38, 0.1, 0.7, R.dark); trittbrett.position.set(0, 0.36, 0.02); t.add(trittbrett);
    var beinschild = U.box(0.42, 0.7, 0.14, p); beinschild.position.set(0, 0.72, 0.42); beinschild.rotation.x = -0.16; t.add(beinschild);
    var heckschale = U.sph(0.3, 12, 10, p); heckschale.scale.set(0.75, 0.8, 1.5);
    heckschale.position.set(0, 0.66, -0.42); t.add(heckschale);
    var sitzbank = U.box(0.3, 0.14, 0.62, R.leather); sitzbank.position.set(0, 0.88, -0.36); t.add(sitzbank);
    var rueckenlehne = U.box(0.26, 0.22, 0.06, R.leather, false); rueckenlehne.position.set(0, 1.02, -0.66); t.add(rueckenlehne);
    var topcase = U.box(0.34, 0.28, 0.34, p); topcase.position.set(0, 1.08, -0.78); t.add(topcase);
    var motorblock = U.box(0.2, 0.22, 0.4, R.dark); motorblock.position.set(0.13, 0.4, -0.5); t.add(motorblock);
    var scheibe = U.box(0.4, 0.4, 0.03, R.clear); scheibe.position.set(0, 1.22, 0.5); scheibe.rotation.x = -0.2; t.add(scheibe);
    var lenkerverkleidung = U.box(0.34, 0.24, 0.2, p); lenkerverkleidung.position.set(0, 1.0, 0.5); t.add(lenkerverkleidung);
    var tacho = U.cyl(0.06, 0.06, 0.03, 10, R.chrome, false); tacho.rotation.x = 1.2;
    tacho.position.set(0, 1.1, 0.44); t.add(tacho);
    var haken = U.box(0.05, 0.06, 0.05, R.chrome, false); haken.position.set(0, 0.66, 0.34); t.add(haken);

    addExhaust(root, -0.16, 0.32, -0.62, 0.05, 0.36, 0, R.metal);
    addBars(root, 1.1, 0.46, 0.58, R.dark);
    addFender(root, 0.66, 0.58, 0.12, 0.3, p);

    var lampe = U.box(0.24, 0.14, 0.1, R.lightF, false); lampe.position.set(0, 0.9, 0.56); t.add(lampe);
    root.userData.headlights.push(lampe);
    var rueck = U.box(0.16, 0.1, 0.05, R.lightR, false); rueck.position.set(0, 0.82, -0.72); t.add(rueck);
    root.userData.tailLights.push(rueck);
    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var bl = U.sph(0.04, 8, 6, R.lightA, false); bl.position.set(s * 0.2, 0.92, 0.5); t.add(bl);
      root.userData.blinkers.push(bl);
      var spiegelchen = U.box(0.1, 0.06, 0.02, R.chrome, false); spiegelchen.position.set(s * 0.3, 1.28, 0.46); t.add(spiegelchen);
    }
    addPlate(root, 0, 0.66, -0.84, Math.PI, 0.55);

    addRider(root, { suit: 0x4a3b6e, helmet: 0xf0f2f4, lean: 0.05, y: 1.02, z: -0.24 });

    attachWheel(root, 0, 0.26, 0.58, 0.26, 0.12, true, 'sport');
    attachWheel(root, 0, 0.26, -0.56, 0.26, 0.14, false, 'sport');
    return root;
  };

  /* ---------- Enduro / Cross ---------- */
  B.enduro = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var rahmen = U.box(0.16, 0.34, 1.0, R.dark); rahmen.position.set(0, 0.74, 0); t.add(rahmen);
    var tank = U.box(0.28, 0.24, 0.55, p); tank.position.set(0, 0.98, 0.2); t.add(tank);
    var spoilerL = U.box(0.06, 0.22, 0.4, p, false); spoilerL.position.set(0.17, 0.92, 0.12); t.add(spoilerL);
    var spoilerR = U.box(0.06, 0.22, 0.4, p, false); spoilerR.position.set(-0.17, 0.92, 0.12); t.add(spoilerR);
    var sitz = U.box(0.24, 0.1, 0.75, R.dark); sitz.position.set(0, 0.98, -0.36); t.add(sitz);
    var heckteil = U.box(0.22, 0.12, 0.3, p, false); heckteil.position.set(0, 1.0, -0.8); t.add(heckteil);
    var motor = U.box(0.3, 0.32, 0.34, R.metal); motor.position.set(0, 0.62, 0.02); t.add(motor);
    var kruemmer = U.cyl(0.035, 0.035, 0.6, 8, R.chrome); kruemmer.rotation.x = 0.9;
    kruemmer.position.set(0.1, 0.82, 0.3); t.add(kruemmer);
    var schutzblechV = U.box(0.24, 0.05, 0.6, p, false); schutzblechV.position.set(0, 1.06, 0.72); schutzblechV.rotation.x = 0.2; t.add(schutzblechV);
    var kettenschutz = U.box(0.04, 0.1, 0.5, R.dark, false); kettenschutz.position.set(0.12, 0.6, -0.4); t.add(kettenschutz);
    var federbein = U.cyl(0.045, 0.045, 0.36, 8, R.rimGold); federbein.rotation.x = 0.4;
    federbein.position.set(0, 0.78, -0.4); t.add(federbein);
    var schwinge = U.box(0.1, 0.08, 0.7, R.metal, false); schwinge.position.set(0, 0.56, -0.5); t.add(schwinge);
    var startnummer = U.box(0.02, 0.22, 0.24, R.white, false); startnummer.position.set(0.21, 0.94, 0.05); t.add(startnummer);

    addExhaust(root, 0.16, 0.86, -0.62, 0.055, 0.55, 0.12, R.metal);
    addFork(root, 0.11, 0.82, 0.62, 0.86, 0.34, R.rimGold, 0.032);
    addBars(root, 1.28, 0.42, 0.72, R.dark);
    addFender(root, 0.9, -0.78, 0.1, 0.34, p);

    var lampe = U.box(0.22, 0.2, 0.1, R.lightF, false); lampe.position.set(0, 1.14, 0.68); t.add(lampe);
    root.userData.headlights.push(lampe);
    var maske = U.box(0.3, 0.28, 0.06, p, false); maske.position.set(0, 1.16, 0.62); t.add(maske);
    var rueck = U.box(0.1, 0.08, 0.04, R.lightR, false); rueck.position.set(0, 1.0, -0.94); t.add(rueck);
    root.userData.tailLights.push(rueck);
    addPlate(root, 0, 0.86, -0.96, Math.PI, 0.5);

    addRider(root, { suit: 0x1f2a38, helmet: 0x27ae60, lean: 0.4, y: 1.16, z: -0.1 });

    attachWheel(root, 0, 0.46, 0.76, 0.46, 0.12, true, 'offroad');
    attachWheel(root, 0, 0.44, -0.76, 0.44, 0.15, false, 'offroad');
    return root;
  };

  /* ---------- Café Racer ---------- */
  B.caferacer = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var rahmen = U.cyl(0.045, 0.045, 1.0, 8, R.chrome); rahmen.rotation.x = Math.PI / 2 - 0.1;
    rahmen.position.set(0, 0.72, 0.0); t.add(rahmen);
    var tank = U.sph(0.24, 14, 12, p); tank.scale.set(0.85, 0.72, 1.6);
    tank.position.set(0, 0.86, 0.2); t.add(tank);
    var knieausschnittL = U.box(0.04, 0.14, 0.3, R.dark, false); knieausschnittL.position.set(0.2, 0.84, 0.2); t.add(knieausschnittL);
    var knieausschnittR = knieausschnittL.clone(); knieausschnittR.position.x = -0.2; t.add(knieausschnittR);
    var sitzbank = U.box(0.24, 0.09, 0.62, R.leather); sitzbank.position.set(0, 0.88, -0.34); t.add(sitzbank);
    var hoecker = U.sph(0.16, 12, 10, p); hoecker.scale.set(0.9, 0.9, 1.3);
    hoecker.position.set(0, 0.94, -0.68); t.add(hoecker);
    var motor = U.box(0.34, 0.3, 0.36, R.alu); motor.position.set(0, 0.6, 0.0); t.add(motor);
    var kuehlrippen = U.box(0.38, 0.04, 0.3, R.metal, false); kuehlrippen.position.set(0, 0.68, 0.02); t.add(kuehlrippen);
    var federbein = U.cyl(0.03, 0.03, 0.34, 8, R.chrome); federbein.rotation.x = 0.5;
    federbein.position.set(0.14, 0.66, -0.5); t.add(federbein);
    var schwinge2 = U.box(0.1, 0.07, 0.62, R.chrome, false); schwinge2.position.set(0, 0.48, -0.46); t.add(schwinge2);
    var tacho = U.cyl(0.07, 0.07, 0.05, 12, R.chrome, false); tacho.rotation.x = 1.3;
    tacho.position.set(0.08, 1.02, 0.5); t.add(tacho);
    var tacho2 = tacho.clone(); tacho2.position.x = -0.08; t.add(tacho2);

    addExhaust(root, 0.18, 0.5, -0.5, 0.05, 0.9, 0.02, R.chrome);
    addExhaust(root, -0.18, 0.5, -0.5, 0.05, 0.9, 0.02, R.chrome);
    addFork(root, 0.1, 0.7, 0.66, 0.72, 0.28, R.chrome, 0.028);
    addBars(root, 0.98, 0.5, 0.56, R.chrome);
    addFender(root, 0.78, 0.68, 0.1, 0.34, R.chrome);
    addFender(root, 0.76, -0.72, 0.1, 0.32, R.chrome);

    var lampe = U.cyl(0.11, 0.11, 0.09, 14, R.lightF, false);
    lampe.rotation.x = Math.PI / 2; lampe.position.set(0, 0.94, 0.7); t.add(lampe);
    root.userData.headlights.push(lampe);
    var ring = U.torus(0.12, 0.02, 6, 14, R.chrome, false); ring.position.set(0, 0.94, 0.72); t.add(ring);
    var rueck = U.box(0.09, 0.07, 0.04, R.lightR, false); rueck.position.set(0, 0.9, -0.86); t.add(rueck);
    root.userData.tailLights.push(rueck);
    addPlate(root, 0, 0.74, -0.9, Math.PI, 0.5);

    addRider(root, { suit: 0x5a3826, helmet: 0x1d2026, lean: 0.6, y: 0.98, z: -0.06 });

    attachWheel(root, 0, 0.36, 0.7, 0.36, 0.12, true, 'speiche');
    attachWheel(root, 0, 0.36, -0.7, 0.36, 0.15, false, 'speiche');
    return root;
  };

  /* ---------- Chopper ---------- */
  B.chopper = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var rahmen = U.cyl(0.05, 0.05, 1.3, 8, R.chrome); rahmen.rotation.x = Math.PI / 2 - 0.12;
    rahmen.position.set(0, 0.6, 0.05); t.add(rahmen);
    var tank = U.sph(0.22, 12, 10, p); tank.scale.set(0.85, 0.8, 1.5);
    tank.position.set(0, 0.82, 0.25); t.add(tank);
    var sitz = U.box(0.3, 0.09, 0.5, R.leather); sitz.position.set(0, 0.74, -0.35); t.add(sitz);
    var sissy = U.box(0.24, 0.5, 0.05, R.chrome); sissy.position.set(0, 0.98, -0.68); sissy.rotation.x = 0.22; t.add(sissy);
    var motorV = U.box(0.3, 0.3, 0.16, R.alu); motorV.position.set(0, 0.6, 0.1); motorV.rotation.x = -0.35; t.add(motorV);
    var motorH = U.box(0.3, 0.3, 0.16, R.alu); motorH.position.set(0, 0.6, -0.08); motorH.rotation.x = 0.35; t.add(motorH);
    var getriebe = U.box(0.26, 0.2, 0.3, R.chrome); getriebe.position.set(0, 0.44, -0.16); t.add(getriebe);
    var luftfilter = U.cyl(0.1, 0.1, 0.08, 12, R.chrome, false);
    luftfilter.rotation.z = Math.PI / 2; luftfilter.position.set(0.22, 0.62, 0.02); t.add(luftfilter);
    var trittbretter = U.box(0.5, 0.03, 0.16, R.chrome, false); trittbretter.position.set(0, 0.34, 0.18); t.add(trittbretter);
    var satteltasche = U.box(0.1, 0.24, 0.34, R.leather); satteltasche.position.set(0.24, 0.62, -0.55); t.add(satteltasche);
    var satteltasche2 = satteltasche.clone(); satteltasche2.position.x = -0.24; t.add(satteltasche2);

    addExhaust(root, 0.2, 0.42, -0.5, 0.055, 1.0, 0.06, R.chrome);
    addExhaust(root, -0.2, 0.36, -0.5, 0.055, 1.0, 0.06, R.chrome);
    addFork(root, 0.11, 0.66, 0.82, 1.15, 0.62, R.chrome, 0.03);
    addBars(root, 1.24, 0.5, 0.78, R.chrome);
    addFender(root, 0.82, -0.68, 0.24, 0.42, p);

    var lampe = U.cyl(0.12, 0.12, 0.1, 14, R.lightF, false);
    lampe.rotation.x = Math.PI / 2; lampe.position.set(0, 0.98, 1.02); t.add(lampe);
    root.userData.headlights.push(lampe);
    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var bl = U.cyl(0.035, 0.035, 0.06, 8, R.lightA, false);
      bl.rotation.x = Math.PI / 2; bl.position.set(s * 0.22, 1.0, 0.96); t.add(bl);
      root.userData.blinkers.push(bl);
    }
    var rueck = U.cyl(0.06, 0.06, 0.05, 10, R.lightR, false);
    rueck.rotation.x = Math.PI / 2; rueck.position.set(0, 0.86, -0.92); t.add(rueck);
    root.userData.tailLights.push(rueck);
    addPlate(root, 0, 0.7, -0.94, Math.PI, 0.55);

    addRider(root, { suit: 0x2b2b30, helmet: 0x8a1c1c, lean: 0.05, y: 0.9, z: -0.16 });

    attachWheel(root, 0, 0.44, 1.02, 0.44, 0.1, true, 'speiche');
    attachWheel(root, 0, 0.42, -0.66, 0.42, 0.26, false, 'sport');
    return root;
  };

  /* ---------- Bobber ---------- */
  B.bobber = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paintMatte(color);

    var rahmen = U.cyl(0.05, 0.05, 1.05, 8, R.dark); rahmen.rotation.x = Math.PI / 2 - 0.05;
    rahmen.position.set(0, 0.62, 0.02); t.add(rahmen);
    var untergurt = U.cyl(0.035, 0.035, 0.9, 8, R.dark); untergurt.rotation.x = Math.PI / 2;
    untergurt.position.set(0, 0.42, 0.0); t.add(untergurt);
    var tank = U.sph(0.2, 12, 10, p); tank.scale.set(0.9, 0.85, 1.2);
    tank.position.set(0, 0.8, 0.28); t.add(tank);
    var solositz = U.box(0.26, 0.07, 0.34, R.leather); solositz.position.set(0, 0.8, -0.34); t.add(solositz);
    var sitzfeder = U.cyl(0.02, 0.02, 0.12, 6, R.chrome, false); sitzfeder.position.set(0.09, 0.72, -0.44); t.add(sitzfeder);
    var sitzfeder2 = sitzfeder.clone(); sitzfeder2.position.x = -0.09; t.add(sitzfeder2);
    var motor = U.box(0.32, 0.34, 0.3, R.dark); motor.position.set(0, 0.58, 0.0); t.add(motor);
    var rippen = U.box(0.36, 0.04, 0.26, R.alu, false); rippen.position.set(0, 0.68, 0.0); t.add(rippen);
    var rippen2 = U.box(0.36, 0.04, 0.26, R.alu, false); rippen2.position.set(0, 0.58, 0.0); t.add(rippen2);
    var oel = U.cyl(0.09, 0.09, 0.2, 10, R.chrome); oel.position.set(0, 0.62, -0.4); t.add(oel);
    var schwinge = U.box(0.12, 0.06, 0.56, R.dark, false); schwinge.position.set(0, 0.46, -0.42); t.add(schwinge);

    addExhaust(root, 0.16, 0.4, -0.44, 0.06, 1.1, 0.0, R.dark);
    addExhaust(root, -0.16, 0.5, -0.44, 0.06, 1.1, 0.0, R.dark);
    addFork(root, 0.1, 0.66, 0.7, 0.8, 0.4, R.dark, 0.032);
    addBars(root, 1.06, 0.46, 0.7, R.dark);
    addFender(root, 0.86, -0.72, 0.2, 0.44, p, -0.4);

    var lampe = U.cyl(0.1, 0.1, 0.09, 12, R.lightF, false);
    lampe.rotation.x = Math.PI / 2; lampe.position.set(0, 0.9, 0.78); t.add(lampe);
    root.userData.headlights.push(lampe);
    var rueck = U.cyl(0.05, 0.05, 0.05, 10, R.lightR, false);
    rueck.rotation.x = Math.PI / 2; rueck.position.set(0, 0.82, -0.94); t.add(rueck);
    root.userData.tailLights.push(rueck);
    addPlate(root, 0.16, 0.66, -0.9, Math.PI, 0.5);

    addRider(root, { suit: 0x3a3f46, helmet: 0x1c1f24, lean: 0.15, y: 0.94, z: -0.14 });

    attachWheel(root, 0, 0.42, 0.74, 0.42, 0.16, true, 'speiche');
    attachWheel(root, 0, 0.42, -0.74, 0.42, 0.22, false, 'speiche');
    return root;
  };

  /* ---------- Tourenmotorrad ---------- */
  B.tourer = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var rahmen = U.box(0.18, 0.3, 1.1, R.dark); rahmen.position.set(0, 0.68, 0.0); t.add(rahmen);
    var verkleidung = U.box(0.5, 0.6, 0.7, p); verkleidung.position.set(0, 0.94, 0.5); t.add(verkleidung);
    var scheibe = U.box(0.42, 0.44, 0.04, R.clear); scheibe.position.set(0, 1.36, 0.5); scheibe.rotation.x = -0.24; t.add(scheibe);
    var tank = U.box(0.34, 0.26, 0.6, p); tank.position.set(0, 0.98, 0.12); t.add(tank);
    var sitz = U.box(0.32, 0.14, 0.5, R.leather); sitz.position.set(0, 0.96, -0.3); t.add(sitz);
    var soziussitz = U.box(0.3, 0.16, 0.3, R.leather); soziussitz.position.set(0, 1.04, -0.66); t.add(soziussitz);
    var topcase = U.box(0.42, 0.32, 0.4, p); topcase.position.set(0, 1.22, -0.82); t.add(topcase);
    var motor = U.box(0.42, 0.32, 0.4, R.alu); motor.position.set(0, 0.62, 0.02); t.add(motor);
    var kuehler = U.box(0.32, 0.28, 0.06, R.grille, false); kuehler.position.set(0, 0.66, 0.28); t.add(kuehler);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var koffer = U.box(0.2, 0.34, 0.5, p); koffer.position.set(s * 0.34, 0.9, -0.6); t.add(koffer);
      var reflektor = U.box(0.03, 0.08, 0.16, R.lightR, false); reflektor.position.set(s * 0.45, 0.9, -0.72); t.add(reflektor);
      var sturzbuegel = U.cyl(0.022, 0.022, 0.5, 6, R.chrome, false);
      sturzbuegel.rotation.z = 0.5 * s; sturzbuegel.position.set(s * 0.3, 0.6, 0.24); t.add(sturzbuegel);
      var zusatz = U.cyl(0.055, 0.055, 0.06, 10, R.lightF, false);
      zusatz.rotation.x = Math.PI / 2; zusatz.position.set(s * 0.28, 0.88, 0.82); t.add(zusatz);
      root.userData.headlights.push(zusatz);
    }

    addExhaust(root, 0.24, 0.5, -0.6, 0.07, 0.7, 0.04, R.chrome);
    addFork(root, 0.12, 0.72, 0.66, 0.8, 0.3, R.metal, 0.034);
    addBars(root, 1.14, 0.4, 0.74, R.dark);
    addFender(root, 0.92, 0.72, 0.14, 0.38, p);
    addFender(root, 0.86, -0.78, 0.14, 0.36, p);

    var lampe = U.box(0.3, 0.18, 0.1, R.lightF, false); lampe.position.set(0, 1.02, 0.84); t.add(lampe);
    root.userData.headlights.push(lampe);
    var rueck = U.box(0.16, 0.1, 0.05, R.lightR, false); rueck.position.set(0, 1.06, -1.04); t.add(rueck);
    root.userData.tailLights.push(rueck);
    addPlate(root, 0, 0.84, -1.02, Math.PI, 0.55);

    addRider(root, { suit: 0x24303f, helmet: 0xe8e2d2, lean: 0.15, y: 1.08, z: -0.18 });

    attachWheel(root, 0, 0.4, 0.72, 0.4, 0.13, true, 'sport');
    attachWheel(root, 0, 0.4, -0.78, 0.4, 0.18, false, 'sport');
    return root;
  };

  /* ---------- Superbike ---------- */
  B.superbike = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var rahmen = U.box(0.3, 0.22, 0.9, R.alu); rahmen.position.set(0, 0.78, 0.05); t.add(rahmen);
    var verkleidung = U.box(0.38, 0.46, 1.1, p); verkleidung.position.set(0, 0.8, 0.3); verkleidung.rotation.x = -0.1; t.add(verkleidung);
    var nase = U.box(0.28, 0.3, 0.42, p); nase.position.set(0, 1.0, 0.86); nase.rotation.x = 0.5; t.add(nase);
    var scheibe = U.box(0.24, 0.2, 0.04, R.glass, false); scheibe.position.set(0, 1.12, 0.72); scheibe.rotation.x = -0.5; t.add(scheibe);
    var tank = U.box(0.32, 0.2, 0.5, p); tank.position.set(0, 0.98, 0.24); t.add(tank);
    var sitz = U.box(0.24, 0.1, 0.5, R.dark); sitz.position.set(0, 0.98, -0.3); t.add(sitz);
    var heck = U.box(0.22, 0.14, 0.42, p); heck.position.set(0, 1.06, -0.72); heck.rotation.x = 0.28; t.add(heck);
    var motor = U.box(0.36, 0.3, 0.38, R.dark); motor.position.set(0, 0.62, 0.05); t.add(motor);
    var schwinge = U.box(0.14, 0.09, 0.66, R.alu, false); schwinge.position.set(0, 0.5, -0.44); t.add(schwinge);
    var federbein = U.cyl(0.035, 0.035, 0.3, 8, R.rimGold); federbein.rotation.x = 0.3;
    federbein.position.set(0, 0.74, -0.36); t.add(federbein);
    var kettenrad = U.cyl(0.11, 0.11, 0.02, 14, R.alu, false); kettenrad.rotation.z = Math.PI / 2;
    kettenrad.position.set(0.12, 0.4, -0.76); t.add(kettenrad);
    var rastenL = U.box(0.06, 0.03, 0.12, R.alu, false); rastenL.position.set(0.2, 0.5, -0.24); t.add(rastenL);
    var rastenR = rastenL.clone(); rastenR.position.x = -0.2; t.add(rastenR);
    var winglet = U.box(0.44, 0.03, 0.14, R.dark, false); winglet.position.set(0, 0.86, 0.62); t.add(winglet);

    addExhaust(root, 0.14, 0.86, -0.86, 0.06, 0.34, -0.25, R.metal);
    addExhaust(root, -0.14, 0.86, -0.86, 0.06, 0.34, -0.25, R.metal);
    addFork(root, 0.11, 0.72, 0.7, 0.72, 0.26, R.rimGold, 0.032);
    addBars(root, 0.94, 0.56, 0.5, R.alu);
    addFender(root, 0.86, 0.74, 0.12, 0.36, p);

    var lampeL = U.box(0.11, 0.09, 0.08, R.lightF, false); lampeL.position.set(0.08, 1.02, 1.02); t.add(lampeL);
    var lampeR = U.box(0.11, 0.09, 0.08, R.lightF, false); lampeR.position.set(-0.08, 1.02, 1.02); t.add(lampeR);
    root.userData.headlights.push(lampeL); root.userData.headlights.push(lampeR);
    var rueck = U.box(0.12, 0.06, 0.04, R.lightR, false); rueck.position.set(0, 1.08, -0.94); t.add(rueck);
    root.userData.tailLights.push(rueck);
    addPlate(root, 0, 0.78, -0.9, Math.PI, 0.5);

    addRider(root, { suit: 0x14203a, helmet: 0x0e6fd8, lean: 0.85, y: 1.0, z: -0.02 });

    attachWheel(root, 0, 0.34, 0.76, 0.34, 0.14, true, 'sport');
    attachWheel(root, 0, 0.36, -0.76, 0.36, 0.2, false, 'sport');
    return root;
  };

  /* ---------- Quad ---------- */
  B.quad = function (color) {
    var root = baseGroup(), t = root.userData.tilt, p = paint(color);

    var rahmen = U.box(0.6, 0.18, 1.5, R.dark); rahmen.position.set(0, 0.56, 0); t.add(rahmen);
    var haube = U.box(0.72, 0.24, 0.9, p); haube.position.set(0, 0.76, 0.45); t.add(haube);
    var kotfluegelV = U.box(1.24, 0.12, 0.62, p, false); kotfluegelV.position.set(0, 0.74, 0.62); t.add(kotfluegelV);
    var kotfluegelH = U.box(1.30, 0.12, 0.7, p, false); kotfluegelH.position.set(0, 0.76, -0.62); t.add(kotfluegelH);
    var sitz = U.box(0.34, 0.16, 0.7, R.dark); sitz.position.set(0, 0.86, -0.16); t.add(sitz);
    var motor = U.box(0.4, 0.34, 0.44, R.metal); motor.position.set(0, 0.5, 0.02); t.add(motor);
    var traeger = U.box(0.6, 0.04, 0.4, R.metal, false); traeger.position.set(0, 0.94, -0.82); t.add(traeger);
    var traegerV = U.box(0.5, 0.04, 0.3, R.metal, false); traegerV.position.set(0, 0.92, 0.78); t.add(traegerV);
    var tank2 = U.box(0.34, 0.2, 0.36, p); tank2.position.set(0, 0.86, 0.24); t.add(tank2);

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var trittbrett = U.box(0.22, 0.05, 0.7, R.dark, false); trittbrett.position.set(s * 0.42, 0.44, -0.1); t.add(trittbrett);
      var buegel = U.cyl(0.025, 0.025, 0.5, 6, R.metal, false);
      buegel.rotation.x = Math.PI / 2; buegel.position.set(s * 0.45, 0.6, -0.7); t.add(buegel);
    }

    addBars(root, 1.1, 0.32, 0.66, R.dark);
    var lampe = U.box(0.4, 0.14, 0.1, R.lightF, false); lampe.position.set(0, 0.92, 0.9); t.add(lampe);
    root.userData.headlights.push(lampe);
    var rueck = U.box(0.16, 0.08, 0.05, R.lightR, false); rueck.position.set(0, 0.86, -0.98); t.add(rueck);
    root.userData.tailLights.push(rueck);
    var wimpel = U.cyl(0.01, 0.01, 1.0, 6, R.metal, false); wimpel.position.set(-0.3, 1.4, -0.8); t.add(wimpel);
    var wimpelTuch = U.box(0.02, 0.12, 0.2, R.lightA, false); wimpelTuch.position.set(-0.3, 1.82, -0.72); t.add(wimpelTuch);
    addPlate(root, 0, 0.68, -1.0, Math.PI, 0.55);

    addRider(root, { suit: 0x6b3f1f, helmet: 0xe0a132, lean: 0.2, y: 1.0, z: -0.12 });

    axles(root, { x: 0.52, y: 0.34, z: 0.72, r: 0.34, w: 0.24, rz: -0.72, rr: 0.36, rw: 0.3, ry: 0.36, style: 'offroad' });
    return root;
  };

  /* ---------- Polizeimotorrad (nicht kaufbar) ---------- */
  B.polizeibike = function (color) {
    var root = B.tourer(color === undefined ? 0xf2f4f6 : color);
    var t = root.userData.tilt;

    var i, s;
    for (i = 0; i < 2; i++) {
      s = i ? -1 : 1;
      var blau = U.box(0.14, 0.1, 0.16, R.lightBlue, false);
      blau.position.set(s * 0.3, 1.24, -0.55); t.add(blau);
      if (!root.userData.sirenLights) root.userData.sirenLights = [];
      root.userData.sirenLights.push(blau);
      var streifen = U.box(0.03, 0.12, 0.4, U.mat(0x1a55a8, 0.6, 0.1), false);
      streifen.position.set(s * 0.45, 0.94, -0.6); t.add(streifen);
    }
    var kelle = U.box(0.2, 0.02, 0.2, R.lightA, false);
    kelle.position.set(0, 1.44, -0.82); t.add(kelle);
    root.userData.siren = kelle;
    return root;
  };

  V.BUILDERS = B;

  /* ==========================================================
     KATALOG — was man fahren und kaufen kann
     Werte: accel/max in m/s, kmh nur fuer die Anzeige,
     offGrip = Halt abseits der Strasse, wb = Radstand.
     ========================================================== */
  V.CATALOG = [
    // ---------------- Autos ----------------
    { id: 'rs_coupe',   bau: 'sport',      name: 'RS Coupé',       desc: 'Sportwagen · Heckantrieb',        cls: 'car', color: 0xd6362b, accel: 24, max: 64, steer: 0.60, wb: 2.70, kmh: 230, offGrip: 0.70, radius: 1.40, seats: 2, price: 0 },
    { id: 'polo',       bau: 'kleinwagen', name: 'Alpen Mini',     desc: 'Kleinwagen · sparsam und wendig', cls: 'car', color: 0x7fb2d8, accel: 14, max: 44, steer: 0.72, wb: 2.35, kmh: 158, offGrip: 0.72, radius: 1.20, seats: 4, price: 900 },
    { id: 'kombi320',   bau: 'kombi',      name: '320 Kombi',      desc: 'Diesel-Kombi · Alltagsheld',      cls: 'car', color: 0x33507c, accel: 15, max: 53, steer: 0.60, wb: 2.90, kmh: 190, offGrip: 0.75, radius: 1.40, seats: 5, price: 1500 },
    { id: 'taxi',       bau: 'taxi',       name: 'Ortstaxi',       desc: 'Taxi · kennt jede Abkürzung',     cls: 'car', color: 0xf0c020, accel: 16, max: 52, steer: 0.62, wb: 2.85, kmh: 187, offGrip: 0.74, radius: 1.40, seats: 5, price: 2200 },
    { id: 'van',        bau: 'van',        name: 'Alpen-Van',      desc: 'Transporter · viel Platz',        cls: 'car', color: 0xc8cdd2, accel: 12, max: 44, steer: 0.55, wb: 3.20, kmh: 160, offGrip: 0.70, radius: 1.60, seats: 9, price: 3000 },
    { id: 'suv',        bau: 'suv',        name: 'Alpin SUV',      desc: 'Allrad · stark im Gelände',       cls: 'car', color: 0x2b2f36, accel: 14, max: 47, steer: 0.58, wb: 2.95, kmh: 170, offGrip: 1.00, radius: 1.50, seats: 5, price: 4000 },
    { id: 'pickup',     bau: 'pickup',     name: 'Ranch 4x4',      desc: 'Pickup · V8 mit Ladefläche',      cls: 'car', color: 0x7b3f24, accel: 16, max: 50, steer: 0.56, wb: 3.05, kmh: 180, offGrip: 0.95, radius: 1.55, seats: 4, price: 5000 },
    { id: 'classic',    bau: 'classic',    name: 'Landstraße 63',  desc: 'Oldtimer · Chrom ohne Ende',      cls: 'car', color: 0x86142a, accel: 13, max: 49, steer: 0.58, wb: 2.75, kmh: 176, offGrip: 0.65, radius: 1.35, seats: 4, price: 6000 },
    { id: 'traktor',    bau: 'traktor',    name: 'Steyrer 40',     desc: 'Traktor · langsam, aber nimmt alles mit', cls: 'car', color: 0xc23b25, accel: 9, max: 26, steer: 0.52, wb: 2.40, kmh: 94, offGrip: 1.15, radius: 1.60, seats: 1, price: 6500 },
    { id: 'cabrio',     bau: 'cabrio',     name: 'Seewind Cabrio', desc: 'Offen fahren am Badesee',         cls: 'car', color: 0xe8e2d0, accel: 20, max: 58, steer: 0.63, wb: 2.65, kmh: 208, offGrip: 0.66, radius: 1.35, seats: 2, price: 8000 },
    { id: 'muscle',     bau: 'muscle',     name: 'Donau V8',       desc: 'Muscle Car · laut und quer',      cls: 'car', color: 0x1f6f3a, accel: 26, max: 66, steer: 0.55, wb: 2.90, kmh: 237, offGrip: 0.60, radius: 1.45, seats: 4, price: 11000 },
    { id: 'limo',       bau: 'limo',       name: 'Bürgermeister',  desc: 'Limousine · für den großen Auftritt', cls: 'car', color: 0x14171c, accel: 17, max: 56, steer: 0.54, wb: 3.30, kmh: 202, offGrip: 0.62, radius: 1.60, seats: 5, price: 13000 },
    { id: 'bus',        bau: 'bus',        name: 'Postbus',        desc: 'Linienbus · Platz für das ganze Dorf', cls: 'car', color: 0xf2c200, accel: 10, max: 40, steer: 0.46, wb: 4.20, kmh: 144, offGrip: 0.58, radius: 2.10, seats: 40, price: 15000 },
    { id: 'lkw',        bau: 'lkw',        name: 'Fuhrwerk 7,5t',  desc: 'LKW · räumt alles aus dem Weg',   cls: 'car', color: 0x3a5f8a, accel: 9, max: 38, steer: 0.44, wb: 4.40, kmh: 137, offGrip: 0.62, radius: 2.20, seats: 3, price: 17000 },
    { id: 'rally',      bau: 'rally',      name: 'Schotter WRC',   desc: 'Rallyeauto · für Feldwege gemacht', cls: 'car', color: 0x1e5fc0, accel: 28, max: 63, steer: 0.70, wb: 2.60, kmh: 227, offGrip: 1.10, radius: 1.38, seats: 2, price: 21000 },
    { id: 'militaer',   bau: 'militaer',   name: 'Bundesheer 4x4', desc: 'Geländewagen · fährt überall',    cls: 'car', color: 0x4a5535, accel: 15, max: 46, steer: 0.60, wb: 3.00, kmh: 166, offGrip: 1.20, radius: 1.65, seats: 6, price: 26000 },
    { id: 'hyper',      bau: 'hyper',      name: 'Falke GT-X',     desc: 'Hypercar · 920 PS',               cls: 'car', color: 0xffb020, accel: 34, max: 82, steer: 0.55, wb: 2.85, kmh: 295, offGrip: 0.55, radius: 1.45, seats: 2, price: 45000 },

    // ---------------- Zweiräder ----------------
    { id: 'fahrrad',    bau: 'fahrrad',    name: 'Alpenrad',       desc: 'Fahrrad · kostet nix an der Tankstelle', cls: 'bike', bike: true, color: 0x2f7d4f, accel: 9,  max: 22, steer: 1.00, wb: 1.05, kmh: 79,  offGrip: 0.90, radius: 0.70, seats: 1, price: 300 },
    { id: 'moped',      bau: 'moped',      name: 'Puch Moped',     desc: 'Moped · 50 ccm Dorfklassiker',    cls: 'bike', bike: true, color: 0x9a2f2f, accel: 13, max: 31, steer: 0.95, wb: 1.15, kmh: 112, offGrip: 0.80, radius: 0.75, seats: 1, price: 1200 },
    { id: 'roller',     bau: 'roller',     name: 'Vespo 125',      desc: 'Roller · flott durch die Gassen', cls: 'bike', bike: true, color: 0x4aa3c8, accel: 16, max: 38, steer: 0.92, wb: 1.25, kmh: 137, offGrip: 0.75, radius: 0.78, seats: 2, price: 2000 },
    { id: 'enduro',     bau: 'enduro',     name: 'Cross 250',      desc: 'Enduro · Wiese ist auch Straße',  cls: 'bike', bike: true, color: 0x27ae60, accel: 27, max: 57, steer: 0.85, wb: 1.45, kmh: 205, offGrip: 0.95, radius: 0.90, seats: 1, price: 2500 },
    { id: 'quad',       bau: 'quad',       name: 'Quad 700',       desc: 'Quad · vier Räder, kein Dach',    cls: 'bike', color: 0xd85a1e, accel: 20, max: 45, steer: 0.80, wb: 1.60, kmh: 162, offGrip: 1.15, radius: 1.00, seats: 2, price: 5500 },
    { id: 'caferacer',  bau: 'caferacer',  name: 'Café Racer',     desc: 'Umgebaut · schön und unbequem',   cls: 'bike', bike: true, color: 0x1d6f6f, accel: 25, max: 60, steer: 0.82, wb: 1.42, kmh: 216, offGrip: 0.62, radius: 0.88, seats: 1, price: 7000 },
    { id: 'bobber',     bau: 'bobber',     name: 'Bobber 900',     desc: 'Tiefergelegt · brabbelt schön',   cls: 'bike', bike: true, color: 0x2b2b30, accel: 22, max: 55, steer: 0.74, wb: 1.62, kmh: 198, offGrip: 0.66, radius: 0.92, seats: 1, price: 8500 },
    { id: 'chopper',    bau: 'chopper',    name: 'Chopper 1200',   desc: 'Cruiser · V2 mit langer Gabel',   cls: 'bike', bike: true, color: 0x191d24, accel: 20, max: 54, steer: 0.70, wb: 1.75, kmh: 194, offGrip: 0.68, radius: 0.95, seats: 2, price: 10000 },
    { id: 'tourer',     bau: 'tourer',     name: 'Alpen Tourer',   desc: 'Reisemaschine · Koffer inklusive', cls: 'bike', bike: true, color: 0x35507d, accel: 24, max: 62, steer: 0.72, wb: 1.58, kmh: 223, offGrip: 0.72, radius: 0.95, seats: 2, price: 14000 },
    { id: 'superbike',  bau: 'superbike',  name: 'RR 1000',        desc: 'Superbike · 210 PS am Hinterrad', cls: 'bike', bike: true, color: 0x0e6fd8, accel: 32, max: 74, steer: 0.80, wb: 1.42, kmh: 266, offGrip: 0.50, radius: 0.90, seats: 1, price: 30000 }
  ];

  // Fremde Fahrzeuge (Verkehr) und Polizei fahren mit festen Werten.
  V.TRAFFIC_PARAMS = {
    id: 'geklaut', name: 'Geklautes Fahrzeug', cls: 'car',
    accel: 16, max: 50, steer: 0.60, wb: 2.85, kmh: 180,
    offGrip: 0.75, radius: 1.40, seats: 4, price: 0
  };
  V.COP_PARAMS = {
    id: 'streife', name: 'Streifenwagen', cls: 'car',
    accel: 22, max: 60, steer: 0.62, wb: 2.85, kmh: 216,
    offGrip: 0.80, radius: 1.40, seats: 4, price: 0
  };

  var byIdCache = null;
  V.byId = function (id) {
    if (!byIdCache) {
      byIdCache = {};
      for (var i = 0; i < V.CATALOG.length; i++) byIdCache[V.CATALOG[i].id] = V.CATALOG[i];
    }
    return byIdCache[id] || null;
  };

  V.byClass = function (cls) {
    return V.CATALOG.filter(function (v) { return v.cls === cls; });
  };

  /**
   * Baut ein Fahrzeug aus dem Katalog.
   * @param {string} id            Katalog-Kennung
   * @param {number} [colorOverride] abweichende Lackfarbe
   */
  V.build = function (id, colorOverride) {
    ensure();
    var spec = V.byId(id);
    if (!spec) spec = V.CATALOG[0];
    var bauer = B[spec.bau] || B.sport;
    var root = bauer(colorOverride === undefined ? spec.color : colorOverride);
    root.userData.spec = spec;
    root.castShadow = true;
    return root;
  };

  V.buildCop = function () {
    ensure();
    var root = B.streifenwagen(0xf2f4f6);
    root.userData.spec = V.COP_PARAMS;
    return root;
  };

  V.buildCopBike = function () {
    ensure();
    var root = B.polizeibike(0xf2f4f6);
    root.userData.spec = V.COP_PARAMS;
    return root;
  };

  /* Ein zufälliges Fahrzeug, das zum Verkehr passt (nichts Exotisches). */
  V.randomTraffic = function () {
    var pool = V.CATALOG.filter(function (v) {
      return v.cls === 'car' && v.price <= 17000 && v.id !== 'traktor';
    });
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : V.CATALOG[0];
  };

  return V;
})();
