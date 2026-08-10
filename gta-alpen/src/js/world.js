'use strict';
/* ============================================================
   world.js — Himmel, Licht, Gelände, Straßen, See, Berge, Vegetation
   Abhängig von: three.js, config.js, util.js, textures.js
   Definiert GTA.World.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.World = (function () {
  var W = {};
  var U, CFG, TEX;
  var rotors = [], clouds = [], waterMesh = null, sunLight = null, sunTarget = null;

  W.sun = null;
  W.hemi = null;

  function ensure() { U = GTA.U; CFG = GTA.CFG; TEX = GTA.TEX; }

  /* ---------------- Himmelskuppel ---------------- */
  W.makeSky = function () {
    ensure();
    var geo = new THREE.SphereGeometry(1500, 48, 24);
    var m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x2a72c4) },
        bot: { value: new THREE.Color(0xdcefFA) },
        sunDir: { value: CFG.sunDir() }
      },
      vertexShader:
        'varying vec3 vP;' +
        'void main(){ vP=(modelMatrix*vec4(position,1.0)).xyz;' +
        ' gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 vP; uniform vec3 top; uniform vec3 bot; uniform vec3 sunDir;' +
        'void main(){' +
        ' vec3 d=normalize(vP); float h=max(d.y,0.0);' +
        ' vec3 c=mix(bot,top,pow(h,0.5));' +
        ' float sd=max(dot(d,normalize(sunDir)),0.0);' +
        ' c+=vec3(1.0,0.93,0.78)*pow(sd,240.0)*1.6;' +
        ' c+=vec3(1.0,0.85,0.60)*pow(sd,24.0)*0.35;' +
        ' c+=vec3(1.0,0.80,0.55)*pow(sd,6.0)*0.13;' +
        ' float hz=1.0-abs(d.y); c+=vec3(0.9,0.95,1.0)*pow(hz,10.0)*0.18;' +
        ' gl_FragColor=vec4(c,1.0); }'
    });
    return new THREE.Mesh(geo, m);
  };

  /* ---------------- Licht ---------------- */
  W.buildLights = function (ctx) {
    ensure();
    var hemi = new THREE.HemisphereLight(0xbfd9ff, 0x93a86e, 0.78);
    ctx.scene.add(hemi);
    W.hemi = hemi;

    var sun = new THREE.DirectionalLight(0xfff1d6, 1.85);
    sun.castShadow = true;
    sun.shadow.mapSize.set(ctx.gfx.shadow, ctx.gfx.shadow);
    sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
    sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 470;
    sun.shadow.bias = -0.00035;
    sun.shadow.radius = ctx.gfx.shadowRadius;
    ctx.scene.add(sun);
    ctx.scene.add(sun.target);
    sunLight = sun; sunTarget = sun.target;
    W.sun = sun;

    // Kaltes Gegenlicht macht Fahrzeuge und Figuren plastischer.
    var fill = new THREE.DirectionalLight(0xcfe0ff, 0.34);
    fill.position.set(-60, 40, -80);
    ctx.scene.add(fill);
    return sun;
  };

  // Schattenkamera folgt dem Spieler, sonst wären Schatten nur am Ursprung scharf.
  W.updateSun = function (ctx) {
    if (!sunLight) return;
    var d = CFG.sunDir();
    var p = ctx.player;
    sunLight.position.set(p.x + d.x * 180, d.y * 180, p.z + d.z * 180);
    sunTarget.position.set(p.x, 0, p.z);
  };

  /* ---------------- Umgebungsreflexion ---------------- */
  W.buildEnvironment = function (ctx) {
    try {
      var pmrem = new THREE.PMREMGenerator(ctx.renderer);
      var envScene = new THREE.Scene();
      envScene.add(W.makeSky());
      var g = new THREE.Mesh(
        new THREE.PlaneGeometry(4000, 4000),
        new THREE.MeshBasicMaterial({ color: 0x8fb56d })
      );
      g.rotation.x = -Math.PI / 2; g.position.y = -4;
      envScene.add(g);
      ctx.scene.environment = pmrem.fromScene(envScene, 0.03).texture;
    } catch (e) {
      console.warn('[GTA] Umgebungsreflexion nicht verfügbar:', e.message);
    }
  };

  /* ---------------- Boden & Straßen ---------------- */
  W.buildGround = function (ctx) {
    ensure();
    var ground = new THREE.Mesh(new THREE.CircleGeometry(CFG.GROUND_R, 80), TEX.M.grass);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ctx.scene.add(ground);

    // Farbflecken brechen die gleichmäßige Wiese auf.
    var p1 = U.mat(0x7cbb5d, 1, 0, { transparent: true, opacity: 0.38 });
    var p2 = U.mat(0x5d9445, 1, 0, { transparent: true, opacity: 0.38 });
    for (var i = 0; i < 28; i++) {
      var patch = new THREE.Mesh(new THREE.CircleGeometry(U.rand(25, 95), 22), i % 2 ? p1 : p2);
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(U.rand(-575, 575), 0.012, U.rand(-575, 575));
      patch.receiveShadow = true;
      ctx.scene.add(patch);
    }

    // Feldwege
    var pathMat = TEX.M.dirt;
    [[-260, 300, 40], [300, -60, -25], [-330, -260, 70]].forEach(function (p) {
      var road = new THREE.Mesh(new THREE.PlaneGeometry(7, 260), pathMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = p[2] * Math.PI / 180;
      road.position.set(p[0], 0.018, p[1]);
      road.receiveShadow = true;
      ctx.scene.add(road);
    });
  };

  W.buildRoads = function (ctx) {
    ensure();
    var RH = CFG.ROAD_HALF, RL = CFG.ROAD_LEN, RR = CFG.RING_R;

    var ns = new THREE.Mesh(new THREE.PlaneGeometry(RH * 2, RL), TEX.M.asphalt);
    ns.rotation.x = -Math.PI / 2; ns.position.y = 0.02; ns.receiveShadow = true;
    ctx.scene.add(ns);

    var ew = new THREE.Mesh(new THREE.PlaneGeometry(RL, RH * 2), TEX.M.asphalt);
    ew.rotation.x = -Math.PI / 2; ew.position.y = 0.021; ew.receiveShadow = true;
    ctx.scene.add(ew);

    var ring = new THREE.Mesh(new THREE.RingGeometry(RR - RH, RR + RH, 180), TEX.M.asphalt);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.receiveShadow = true;
    ctx.scene.add(ring);

    // Mittelstreifen
    var stripeMat = U.mat(0xf2f3ef, 0.7, 0, { emissive: 0x33342f });
    var stripeGeo = new THREE.PlaneGeometry(0.5, 4.2);
    function stripe(x, z, rotY) {
      var s = new THREE.Mesh(stripeGeo, stripeMat);
      s.rotation.x = -Math.PI / 2;
      s.rotation.z = rotY || 0;
      s.position.set(x, 0.036, z);
      ctx.scene.add(s);
    }
    for (var z = -RL / 2 + 6; z < RL / 2; z += 13) if (Math.abs(z) > RH + 2) stripe(0, z, 0);
    for (var x = -RL / 2 + 6; x < RL / 2; x += 13) if (Math.abs(x) > RH + 2) stripe(x, 0, Math.PI / 2);
    for (var i = 0; i < 84; i++) {
      var a = i / 84 * Math.PI * 2;
      stripe(Math.cos(a) * RR, Math.sin(a) * RR, -a);
    }

    // Randlinien am Ring
    var edgeMat = U.mat(0xe8e9e4, 0.7, 0, { transparent: true, opacity: 0.75 });
    [RR - RH + 0.8, RR + RH - 0.8].forEach(function (r) {
      var e = new THREE.Mesh(new THREE.RingGeometry(r - 0.22, r + 0.22, 180), edgeMat);
      e.rotation.x = -Math.PI / 2; e.position.y = 0.032;
      ctx.scene.add(e);
    });

    // Leitpflöcke am Ring
    var poleMat = U.mat(0xf0f2f4, 0.8, 0);
    var reflMat = U.mat(0xff8c22, 0.5, 0, { emissive: 0x883300, emissiveIntensity: 0.6 });
    for (var k = 0; k < 56; k++) {
      var ang = k / 56 * Math.PI * 2;
      var rr = RR + RH + 2.4;
      var pole = U.cyl(0.07, 0.09, 1.05, 6, poleMat);
      pole.position.set(Math.cos(ang) * rr, 0.52, Math.sin(ang) * rr);
      ctx.scene.add(pole);
      var refl = U.box(0.14, 0.09, 0.04, reflMat, false);
      refl.position.set(Math.cos(ang) * rr, 0.88, Math.sin(ang) * rr);
      refl.rotation.y = -ang;
      ctx.scene.add(refl);
    }
  };

  /* ---------------- See ---------------- */
  W.buildLake = function (ctx) {
    ensure();
    var L = CFG.LAKE;
    var sand = new THREE.Mesh(new THREE.CircleGeometry(L.r + 8, 48), U.mat(0xd8c79a, 1, 0));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(L.x, 0.016, L.z);
    sand.receiveShadow = true;
    ctx.scene.add(sand);

    var water = new THREE.Mesh(new THREE.CircleGeometry(L.r, 48), TEX.M.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(L.x, 0.06, L.z);
    ctx.scene.add(water);
    waterMesh = water;

    // Steg
    var plank = TEX.M.wood;
    for (var i = 0; i < 12; i++) {
      var p = U.box(2.4, 0.14, 0.9, plank);
      p.position.set(L.x - L.r + 2 + i * 0.95, 0.5, L.z + 14);
      ctx.scene.add(p);
    }
    for (var j = 0; j < 5; j++) {
      var post = U.cyl(0.12, 0.12, 1.1, 7, TEX.M.woodDark);
      post.position.set(L.x - L.r + 2.5 + j * 2.2, 0.05, L.z + 14.5);
      ctx.scene.add(post);
    }

    // Ruderboote
    for (var b = 0; b < 3; b++) {
      var boat = new THREE.Group();
      var hull = U.box(1.5, 0.45, 3.6, U.mat(U.pick([0xd8d3c4, 0x7fa8c8, 0xc07050]), 0.7, 0));
      hull.position.y = 0.25;
      boat.add(hull);
      var bench = U.box(1.3, 0.09, 0.4, TEX.M.wood);
      bench.position.y = 0.5;
      boat.add(bench);
      var ang2 = U.rand(0, Math.PI * 2), rad = U.rand(12, L.r - 10);
      boat.position.set(L.x + Math.cos(ang2) * rad, 0.08, L.z + Math.sin(ang2) * rad);
      boat.rotation.y = U.rand(0, Math.PI * 2);
      boat.userData.bob = U.rand(0, 6.28);
      ctx.scene.add(boat);
      W._boats = W._boats || [];
      W._boats.push(boat);
    }
  };

  /* ---------------- Berge ---------------- */
  W.buildMountains = function (ctx) {
    ensure();
    var m1 = U.mat(0x5f7161, 1, 0), m2 = U.mat(0x6d7f6d, 1, 0), snow = U.mat(0xf4f7fa, 0.9, 0);
    for (var i = 0; i < 30; i++) {
      var a = i / 30 * Math.PI * 2 + U.rand(0, 0.18);
      var r = U.rand(770, 930);
      var h = U.rand(110, 270), w = U.rand(90, 205);
      var peak = new THREE.Mesh(new THREE.ConeGeometry(w, h, U.randInt(6, 8)), i % 2 ? m1 : m2);
      peak.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
      peak.rotation.y = U.rand(0, Math.PI);
      ctx.scene.add(peak);
      if (h > 170) {
        var cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.36, h * 0.3, 6), snow);
        cap.position.set(peak.position.x, h - h * 0.15 - 4, peak.position.z);
        cap.rotation.y = peak.rotation.y;
        ctx.scene.add(cap);
      }
    }
  };

  /* ---------------- Bäume & Sträucher ---------------- */
  W.makePine = function (s) {
    ensure();
    var g = new THREE.Group();
    var trunkM = U.mat(0x6e4a2f, 0.95, 0), needleM = U.mat(0x2f6b34, 0.9, 0);
    var t = U.cyl(0.32 * s, 0.44 * s, 1.6 * s, 7, trunkM);
    t.position.y = 0.8 * s; g.add(t);
    for (var i = 0; i < 3; i++) {
      var c = U.cone((2.2 - i * 0.55) * s, 2.2 * s, 9, needleM);
      c.position.y = (2.1 + i * 1.35) * s;
      g.add(c);
    }
    return g;
  };

  W.makeLeafTree = function (s) {
    ensure();
    var g = new THREE.Group();
    var trunkM = U.mat(0x6e4a2f, 0.95, 0);
    var leafM = U.mat(U.pick([0x4d8f3a, 0x5aa042, 0x437f33]), 0.9, 0);
    var t = U.cyl(0.3 * s, 0.42 * s, 2.2 * s, 7, trunkM);
    t.position.y = 1.1 * s; g.add(t);
    var c1 = U.sph(1.7 * s, 10, 8, leafM); c1.position.y = 3.1 * s; g.add(c1);
    var c2 = U.sph(1.15 * s, 9, 8, leafM); c2.position.set(0.9 * s, 2.5 * s, 0.5 * s); g.add(c2);
    var c3 = U.sph(1.0 * s, 9, 8, leafM); c3.position.set(-0.8 * s, 2.7 * s, -0.4 * s); g.add(c3);
    return g;
  };

  W.makeBush = function (s) {
    ensure();
    var g = new THREE.Group();
    var m = U.mat(U.pick([0x3d7a30, 0x4b8a38]), 0.95, 0);
    for (var i = 0; i < 3; i++) {
      var b = U.sph(U.rand(0.5, 0.8) * s, 8, 7, m);
      b.position.set(U.rand(-0.4, 0.4) * s, U.rand(0.35, 0.6) * s, U.rand(-0.4, 0.4) * s);
      g.add(b);
    }
    return g;
  };

  W.buildVegetation = function (ctx) {
    ensure();
    var L = CFG.LAKE;
    var target = ctx.gfx.trees;
    var planted = 0, tries = 0;
    while (planted < target && tries < target * 40) {
      tries++;
      var x = U.rand(-620, 620), z = U.rand(-620, 620);
      var dC = Math.hypot(x, z);
      if (dC < 34 || dC > 615) continue;
      if (U.isNearRoad(x, z, 7)) continue;
      if (Math.hypot(x - L.x, z - L.z) < L.r + 10) continue;
      if (!U.isFree(ctx, x, z, 3)) continue;
      var s = U.rand(0.8, 1.7);
      var tree = Math.random() < 0.55 ? W.makePine(s) : W.makeLeafTree(s);
      tree.position.set(x, 0, z);
      tree.rotation.y = U.rand(0, Math.PI * 2);
      ctx.scene.add(tree);
      U.addObstacle(ctx, x, z, 1.1 * s);
      planted++;
    }

    // Sträucher brauchen keine Kollision — reine Deko
    for (var i = 0; i < Math.floor(target * 0.6); i++) {
      var bx = U.rand(-600, 600), bz = U.rand(-600, 600);
      if (U.isNearRoad(bx, bz, 4)) continue;
      if (Math.hypot(bx - L.x, bz - L.z) < L.r + 4) continue;
      var bush = W.makeBush(U.rand(0.7, 1.5));
      bush.position.set(bx, 0, bz);
      ctx.scene.add(bush);
    }

    // Felsen
    var rockM = U.mat(0x8b8d90, 0.95, 0);
    for (var r = 0; r < 40; r++) {
      var rx = U.rand(-600, 600), rz = U.rand(-600, 600);
      if (U.isNearRoad(rx, rz, 6)) continue;
      if (!U.isFree(ctx, rx, rz, 2)) continue;
      var sc = U.rand(0.8, 2.4);
      var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), rockM);
      rock.position.set(rx, sc * 0.4, rz);
      rock.rotation.set(U.rand(0, 3), U.rand(0, 3), U.rand(0, 3));
      rock.castShadow = true;
      ctx.scene.add(rock);
      U.addObstacle(ctx, rx, rz, sc * 0.75);
    }
  };

  /* ---------------- Windräder ---------------- */
  W.buildWindmills = function (ctx) {
    ensure();
    var mastM = U.mat(0xe9edf0, 0.6, 0.2), bladeM = U.mat(0xf4f7f9, 0.5, 0.1);
    [[-300, 185], [-345, 120], [-255, 245], [-390, 210]].forEach(function (p) {
      var g = new THREE.Group();
      var mast = U.cyl(0.9, 1.6, 38, 12, mastM);
      mast.position.y = 19; g.add(mast);
      var hub = U.box(2.4, 2, 2.6, mastM);
      hub.position.set(0, 38.5, 1); g.add(hub);
      var rotor = new THREE.Group();
      rotor.position.set(0, 38.5, 2.4);
      for (var i = 0; i < 3; i++) {
        var blade = U.box(1.1, 15, 0.35, bladeM);
        blade.position.y = 7.5;
        var arm = new THREE.Group();
        arm.rotation.z = i * (Math.PI * 2 / 3);
        arm.add(blade);
        rotor.add(arm);
      }
      g.add(rotor);
      rotors.push(rotor);
      g.position.set(p[0], 0, p[1]);
      ctx.scene.add(g);
      U.addObstacle(ctx, p[0], p[1], 2.4);
    });
  };

  /* ---------------- Wolken & Sonnenscheibe ---------------- */
  W.buildSkyProps = function (ctx) {
    ensure();
    var cloudM = U.mat(0xffffff, 1, 0, { transparent: true, opacity: 0.92, fog: false });
    for (var i = 0; i < 14; i++) {
      var g = new THREE.Group();
      var n = U.randInt(3, 5);
      for (var j = 0; j < n; j++) {
        var s = U.sph(U.rand(9, 19), 9, 8, cloudM, false);
        s.position.set(j * 12 - n * 5, U.rand(0, 4), U.rand(-5, 5));
        s.scale.y = 0.55;
        g.add(s);
      }
      g.position.set(U.rand(-700, 700), U.rand(130, 200), U.rand(-700, 700));
      g.userData.vx = U.rand(1.2, 2.8);
      clouds.push(g);
      ctx.scene.add(g);
    }
    var sunBall = new THREE.Mesh(
      new THREE.SphereGeometry(24, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false })
    );
    sunBall.position.copy(CFG.sunDir()).multiplyScalar(1250);
    ctx.scene.add(sunBall);
  };

  /* ---------------- Gesamtaufbau ---------------- */
  W.build = function (ctx) {
    ensure();
    ctx.scene.add(W.makeSky());
    W.buildLights(ctx);
    W.buildEnvironment(ctx);
    W.buildGround(ctx);
    W.buildRoads(ctx);
    W.buildLake(ctx);
    W.buildMountains(ctx);
    W.buildWindmills(ctx);
    W.buildSkyProps(ctx);
    // Vegetation kommt NACH den Gebäuden (main.js ruft buildVegetation separat),
    // damit Bäume nicht in Häusern stehen.
  };

  /* ---------------- Animation ---------------- */
  W.update = function (ctx, dt) {
    for (var i = 0; i < rotors.length; i++) rotors[i].rotation.z += dt * 0.9;
    for (var c = 0; c < clouds.length; c++) {
      var cl = clouds[c];
      if (!cl) continue;
      cl.position.x += cl.userData.vx * dt;
      if (cl.position.x > 780) cl.position.x = -780;
    }
    if (waterMesh && waterMesh.material.map) {
      waterMesh.material.map.offset.x += dt * 0.008;
      waterMesh.material.map.offset.y += dt * 0.005;
    }
    if (W._boats) {
      for (var b = 0; b < W._boats.length; b++) {
        var bo = W._boats[b];
        bo.userData.bob += dt;
        bo.position.y = 0.08 + Math.sin(bo.userData.bob) * 0.06;
        bo.rotation.z = Math.sin(bo.userData.bob * 0.7) * 0.04;
      }
    }
    W.updateSun(ctx);
  };

  /* Grafikstufe geändert: Schattenauflösung neu setzen */
  W.applyGfx = function (ctx) {
    if (!sunLight) return;
    if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
    sunLight.shadow.mapSize.set(ctx.gfx.shadow, ctx.gfx.shadow);
    sunLight.shadow.radius = ctx.gfx.shadowRadius;
  };

  return W;
})();
