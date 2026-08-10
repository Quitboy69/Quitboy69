'use strict';
/* ============================================================
   characters.js — Menschenmodelle und Animation
   Abhängig von: three.js, config.js, util.js, textures.js
   Definiert GTA.Chars.

   makeHuman(opts) liefert eine THREE.Group mit userData:
     { legL, legR, armL, armR, torso, head, hips, walkT, armLock,
       build, height }
   Alle Gliedmaßen sind Pivot-Gruppen: rotation.x dreht um die Achse.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Chars = (function () {
  var C = {};
  var U, CFG;

  function ensure() { U = GTA.U; CFG = GTA.CFG; }

  /* Körperbau-Varianten — verändern Breite/Höhe, nicht die Skelettlogik. */
  C.BUILDS = {
    normal:  { shoulder: 1.00, belly: 1.00, height: 1.00, limb: 1.00 },
    schlank: { shoulder: 0.90, belly: 0.86, height: 1.04, limb: 1.05 },
    kraeftig:{ shoulder: 1.18, belly: 1.16, height: 1.02, limb: 0.98 },
    stämmig: { shoulder: 1.10, belly: 1.30, height: 0.94, limb: 0.94 },
    klein:   { shoulder: 0.86, belly: 0.94, height: 0.82, limb: 0.86 }
  };

  /* Kopfbedeckungen */
  C.HATS = ['keine', 'kappe', 'beanie', 'hut', 'helm', 'trachtenhut'];

  /**
   * opts: {
   *   shirt, pants, skin, hair (Farben als 0xRRGGBB),
   *   hat: Name aus C.HATS | 'keine', hatColor,
   *   build: Name aus C.BUILDS,
   *   jacket: bool, jacketColor,
   *   beard: bool, glasses: bool,
   *   shoes: Farbe
   * }
   */
  C.makeHuman = function (opts) {
    ensure();
    opts = opts || {};
    var b = C.BUILDS[opts.build] || C.BUILDS.normal;
    var g = new THREE.Group();

    var shirtC = opts.shirt === undefined ? 0x3a7bd5 : opts.shirt;
    var pantsC = opts.pants === undefined ? 0x2b3242 : opts.pants;
    var skinC = opts.skin === undefined ? 0xe8b98a : opts.skin;
    var hairC = opts.hair === undefined ? 0x2a1c10 : opts.hair;
    var shoeC = opts.shoes === undefined ? 0x23262b : opts.shoes;

    var shirtM = U.mat(shirtC, 0.72, 0);
    var pantsM = U.mat(pantsC, 0.86, 0);
    var skinM = U.mat(skinC, 0.6, 0);
    var shoeM = U.mat(shoeC, 0.8, 0);
    var hairM = U.mat(hairC, 0.65, 0);

    var H = b.height;          // Gesamtskalierung der Höhen
    var L = b.limb;            // Gliedmaßenlänge

    // ---------- Beine (Pivot an der Hüfte) ----------
    function makeLeg(sx) {
      var leg = new THREE.Group();
      leg.position.set(sx * b.shoulder, 0.92 * H, 0);
      var thigh = U.cyl(0.098 * b.belly, 0.082 * b.belly, 0.5 * L, 10, pantsM);
      thigh.position.y = -0.25 * L;
      leg.add(thigh);
      var shin = U.cyl(0.078, 0.062, 0.42 * L, 10, pantsM);
      shin.position.y = -0.7 * L;
      leg.add(shin);
      var shoe = U.box(0.17, 0.1, 0.3, shoeM);
      shoe.position.set(0, -0.95 * L, 0.06);
      leg.add(shoe);
      return leg;
    }
    var legL = makeLeg(0.13), legR = makeLeg(-0.13);
    g.add(legL); g.add(legR);

    // ---------- Hüfte + Torso ----------
    var hips = U.cyl(0.21 * b.belly, 0.23 * b.belly, 0.18, 12, pantsM);
    hips.position.y = 0.9 * H;
    g.add(hips);

    var torso = U.cyl(0.26 * b.shoulder, 0.215 * b.belly, 0.72 * H, 14, shirtM);
    torso.position.y = 1.3 * H;
    g.add(torso);

    // Jacke als zweite, leicht größere Schale
    if (opts.jacket) {
      var jM = U.mat(opts.jacketColor === undefined ? 0x2f3a4a : opts.jacketColor, 0.7, 0.05);
      var jacket = U.cyl(0.285 * b.shoulder, 0.245 * b.belly, 0.6 * H, 14, jM);
      jacket.position.y = 1.34 * H;
      g.add(jacket);
      var collar = U.torus(0.16, 0.045, 6, 14, jM);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 1.66 * H;
      g.add(collar);
    }

    var shL = U.sph(0.1 * b.shoulder, 10, 8, shirtM);
    shL.position.set(0.27 * b.shoulder, 1.6 * H, 0);
    g.add(shL);
    var shR = shL.clone();
    shR.position.x = -0.27 * b.shoulder;
    g.add(shR);

    // ---------- Arme (Pivot an der Schulter) ----------
    function makeArm(sx) {
      var arm = new THREE.Group();
      arm.position.set(sx * b.shoulder, 1.58 * H, 0);
      var upper = U.cyl(0.066, 0.058, 0.36 * L, 9, shirtM);
      upper.position.y = -0.18 * L;
      arm.add(upper);
      var lower = U.cyl(0.056, 0.048, 0.34 * L, 9, opts.jacket ? shirtM : skinM);
      lower.position.y = -0.52 * L;
      arm.add(lower);
      var hand = U.sph(0.068, 9, 8, skinM);
      hand.position.y = -0.72 * L;
      arm.add(hand);
      arm.userData.hand = hand;
      return arm;
    }
    var armL = makeArm(0.34), armR = makeArm(-0.34);
    g.add(armL); g.add(armR);

    // ---------- Hals + Kopf ----------
    var neck = U.cyl(0.07, 0.08, 0.1, 9, skinM);
    neck.position.y = 1.7 * H;
    g.add(neck);

    var head = U.sph(0.185, 16, 14, skinM);
    head.scale.y = 1.12;
    head.position.y = 1.92 * H;
    g.add(head);

    var eyeM = U.mat(0x14161a, 0.3, 0);
    var whiteM = U.mat(0xf2f4f6, 0.35, 0);
    function eye(sx) {
      var e = new THREE.Group();
      var w = U.sph(0.032, 8, 8, whiteM, false);
      e.add(w);
      var p = U.sph(0.017, 6, 6, eyeM, false);
      p.position.z = 0.021;
      e.add(p);
      e.position.set(sx, 1.96 * H, 0.158);
      return e;
    }
    g.add(eye(0.066)); g.add(eye(-0.066));

    var nose = U.sph(0.03, 7, 6, skinM, false);
    nose.scale.z = 1.4;
    nose.position.set(0, 1.91 * H, 0.182);
    g.add(nose);

    var mouth = U.box(0.06, 0.012, 0.02, U.mat(0x9a5a52, 0.6, 0), false);
    mouth.position.set(0, 1.855 * H, 0.176);
    g.add(mouth);

    // Ohren
    [0.185, -0.185].forEach(function (sx) {
      var ear = U.sph(0.038, 7, 6, skinM, false);
      ear.scale.set(0.5, 1, 0.8);
      ear.position.set(sx, 1.925 * H, 0.01);
      g.add(ear);
    });

    // ---------- Haare / Bart / Brille ----------
    var hasHelmet = opts.hat === 'helm';
    if (!hasHelmet) {
      var hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.196, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
        hairM
      );
      hair.scale.y = 1.1;
      hair.position.set(0, 1.95 * H, -0.012);
      hair.rotation.x = -0.22;
      hair.castShadow = true;
      g.add(hair);
    }

    if (opts.beard) {
      var beard = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.48),
        hairM
      );
      beard.position.set(0, 1.9 * H, 0.03);
      beard.scale.set(1, 1.05, 1.05);
      g.add(beard);
    }

    if (opts.glasses) {
      var frameM = U.mat(0x1a1c20, 0.4, 0.5);
      var gl = new THREE.Group();
      [0.066, -0.066].forEach(function (sx) {
        var r = U.torus(0.045, 0.009, 6, 14, frameM, false);
        r.position.set(sx, 0, 0);
        gl.add(r);
      });
      var bridge = U.box(0.05, 0.008, 0.008, frameM, false);
      gl.add(bridge);
      gl.position.set(0, 1.96 * H, 0.175);
      g.add(gl);
    }

    // ---------- Kopfbedeckung ----------
    var hatKind = opts.hat || 'keine';
    if (hatKind !== 'keine') {
      var hc = opts.hatColor === undefined ? 0x1d1f24 : opts.hatColor;
      var hm = U.mat(hc, 0.75, hatKind === 'helm' ? 0.35 : 0);
      var hatG = new THREE.Group();
      if (hatKind === 'kappe') {
        var crown = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hm);
        hatG.add(crown);
        var brim = new THREE.Mesh(
          new THREE.CylinderGeometry(0.19, 0.215, 0.032, 14, 1, false, -Math.PI * 0.42, Math.PI * 0.84), hm);
        brim.position.set(0, -0.005, 0.115);
        hatG.add(brim);
      } else if (hatKind === 'beanie') {
        var bn = new THREE.Mesh(new THREE.SphereGeometry(0.205, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), hm);
        hatG.add(bn);
        var rim = U.torus(0.196, 0.03, 6, 16, hm, false);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = -0.055;
        hatG.add(rim);
      } else if (hatKind === 'hut' || hatKind === 'trachtenhut') {
        var top = U.cyl(0.15, 0.165, 0.17, 14, hm);
        top.position.y = 0.06;
        hatG.add(top);
        var wide = U.cyl(0.3, 0.3, 0.022, 18, hm);
        wide.position.y = -0.025;
        hatG.add(wide);
        var band = U.cyl(0.168, 0.168, 0.045, 14, U.mat(hatKind === 'trachtenhut' ? 0x2f5d34 : 0x1b1d22, 0.8, 0));
        band.position.y = -0.005;
        hatG.add(band);
        if (hatKind === 'trachtenhut') {
          var feather = U.cone(0.02, 0.22, 6, U.mat(0xd8c15a, 0.7, 0));
          feather.position.set(0.13, 0.1, -0.06);
          feather.rotation.z = -0.5;
          hatG.add(feather);
        }
      } else if (hatKind === 'helm') {
        var shell = U.sph(0.215, 16, 14, hm);
        shell.scale.y = 1.05;
        hatG.add(shell);
        var visor = U.box(0.26, 0.1, 0.06, GTA.TEX.M.darkGlass, false);
        visor.position.set(0, -0.02, 0.17);
        hatG.add(visor);
      }
      hatG.position.y = 2.03 * H;
      g.add(hatG);
    }

    g.userData = {
      legL: legL, legR: legR, armL: armL, armR: armR,
      torso: torso, head: head, hips: hips,
      walkT: 0, armLock: false, build: opts.build || 'normal',
      height: 1.95 * H, baseY: 0
    };
    return g;
  };

  /* Gehen/Laufen. speed in m/s. Bei 0 sanft in die Ruhepose. */
  C.animate = function (mesh, speed, dt) {
    var u = mesh.userData;
    if (!u || !u.legL) return;
    if (speed > 0.2) {
      var cadence = 2.2 + Math.min(speed, 9) * 0.12;
      u.walkT += dt * speed * cadence * 0.42;
      var amp = Math.min(speed / 4.2, 1.35);
      var a = Math.sin(u.walkT) * amp * 0.62;
      u.legL.rotation.x = a;
      u.legR.rotation.x = -a;
      if (!u.armLock) {
        u.armL.rotation.x = -a * 0.72;
        u.armR.rotation.x = a * 0.72;
        u.armL.rotation.z = 0.06;
        u.armR.rotation.z = -0.06;
      }
      mesh.position.y = u.baseY + Math.abs(Math.sin(u.walkT)) * 0.045 * amp;
      u.torso.rotation.y = Math.sin(u.walkT) * 0.08;
      u.torso.rotation.x = Math.min(speed / 20, 0.12);
    } else {
      u.legL.rotation.x *= 0.85;
      u.legR.rotation.x *= 0.85;
      if (!u.armLock) {
        u.armL.rotation.x *= 0.85;
        u.armR.rotation.x *= 0.85;
      }
      mesh.position.y = u.baseY + (mesh.position.y - u.baseY) * 0.8;
      u.torso.rotation.y *= 0.85;
      u.torso.rotation.x *= 0.85;
    }
  };

  /* Sitzpose für Fahrer in Autos/auf Motorrädern */
  C.poseSitting = function (mesh) {
    var u = mesh.userData;
    if (!u) return;
    u.legL.rotation.x = 1.2; u.legR.rotation.x = 1.2;
    u.armL.rotation.x = -0.9; u.armR.rotation.x = -0.9;
    u.armLock = true;
  };

  /* Zufälliges Aussehen — für Passanten */
  C.randomLook = function (extra) {
    ensure();
    var buildNames = Object.keys(C.BUILDS);
    var o = {
      skin: U.pick(CFG.SKIN_TONES),
      shirt: U.pick(CFG.SHIRT_COLORS),
      pants: U.pick(CFG.PANTS_COLORS),
      hair: U.pick(CFG.HAIR_COLORS),
      build: U.pick(buildNames),
      hat: Math.random() < 0.35 ? U.pick(['kappe', 'beanie', 'hut', 'trachtenhut']) : 'keine',
      hatColor: U.pick(CFG.SHIRT_COLORS),
      jacket: Math.random() < 0.35,
      jacketColor: U.pick(CFG.PANTS_COLORS),
      beard: Math.random() < 0.28,
      glasses: Math.random() < 0.22
    };
    return Object.assign(o, extra || {});
  };

  return C;
})();
