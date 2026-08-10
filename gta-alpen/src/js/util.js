'use strict';
/* ============================================================
   util.js — Materialien, Primitive, Mathe, Kollisionsprimitive
   Abhängig von: three.js, config.js. Definiert GTA.U.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.U = (function () {
  var U = {};

  // ---------- Farbraum ----------
  /* three.js r128 rechnet Beleuchtung linear, gibt aber nach sRGB aus.
     Hexfarben aus dem Quelltext sind sRGB-Werte und müssen deshalb einmal
     nach linear umgerechnet werden — sonst wird jede Fläche zu hell.
     Materialien werden markiert, damit sie nicht doppelt umgerechnet werden. */
  U.fixMaterial = function (m) {
    if (!m || m.userData.srgbFixed) return m;
    m.userData.srgbFixed = true;
    if (m.color && m.color.convertSRGBToLinear) m.color.convertSRGBToLinear();
    if (m.emissive && m.emissive.convertSRGBToLinear) m.emissive.convertSRGBToLinear();
    if (m.map && m.map.isTexture && m.map.encoding === THREE.LinearEncoding) {
      m.map.encoding = THREE.sRGBEncoding;
      m.map.needsUpdate = true;
    }
    return m;
  };

  /* Nachträglicher Durchlauf für Material, das nicht über U.mat entstanden ist. */
  U.fixMaterials = function (root) {
    root.traverse(function (o) {
      if (!o.material) return;
      if (Array.isArray(o.material)) o.material.forEach(U.fixMaterial);
      else U.fixMaterial(o.material);
    });
    return root;
  };

  // ---------- Materialien & Primitive ----------
  U.mat = function (color, rough, metal, extra) {
    return U.fixMaterial(new THREE.MeshStandardMaterial(Object.assign({
      color: color,
      roughness: rough === undefined ? 0.8 : rough,
      metalness: metal === undefined ? 0 : metal
    }, extra || {})));
  };

  U.basic = function (color, extra) {
    return U.fixMaterial(new THREE.MeshBasicMaterial(Object.assign({ color: color }, extra || {})));
  };

  U.box = function (w, h, d, m, shadow) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    if (shadow !== false) mesh.castShadow = true;
    return mesh;
  };

  U.cyl = function (rt, rb, h, seg, m, shadow) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), m);
    if (shadow !== false) mesh.castShadow = true;
    return mesh;
  };

  U.sph = function (r, ws, hs, m, shadow) {
    var mesh = new THREE.Mesh(new THREE.SphereGeometry(r, ws || 12, hs || 10), m);
    if (shadow !== false) mesh.castShadow = true;
    return mesh;
  };

  U.cone = function (r, h, seg, m, shadow) {
    var mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 8), m);
    if (shadow !== false) mesh.castShadow = true;
    return mesh;
  };

  U.torus = function (r, tube, rs, ts, m, shadow) {
    var mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, rs || 8, ts || 16), m);
    if (shadow !== false) mesh.castShadow = true;
    return mesh;
  };

  // ---------- Mathe ----------
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.dist2d = function (ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); };

  // Kleinste Winkeldifferenz in [-PI, PI]
  U.angDiff = function (target, current) {
    var d = target - current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  // Richtungswinkel wie im Spiel definiert: heading = atan2(dx, dz)
  U.headingTo = function (fromX, fromZ, toX, toZ) {
    return Math.atan2(toX - fromX, toZ - fromZ);
  };

  // ---------- Formatierung ----------
  U.fmtMoney = function (v) { return '€ ' + Math.round(v).toLocaleString('de-AT'); };
  U.hexCss = function (c) { return '#' + c.toString(16).padStart(6, '0'); };
  U.fmtTime = function (t) {
    var s = Math.max(0, Math.ceil(t));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  };

  // ---------- Straßen-Test ----------
  U.isNearRoad = function (x, z, buffer) {
    var C = GTA.CFG;
    var b = C.ROAD_HALF + (buffer || 0);
    if (Math.abs(x) < b && Math.abs(z) < C.ROAD_LEN / 2) return true;
    if (Math.abs(z) < b && Math.abs(x) < C.ROAD_LEN / 2) return true;
    if (Math.abs(Math.hypot(x, z) - C.RING_R) < b) return true;
    return false;
  };

  U.inLake = function (x, z) {
    var L = GTA.CFG.LAKE;
    return Math.hypot(x - L.x, z - L.z) < L.r;
  };

  /* ============================================================
     KOLLISION
     ctx.obstacles : Kreise  { x, z, r }
     ctx.walls     : achsenparallele Rechtecke { x0, z0, x1, z1, interiorId? }
     Rechtecke erlauben echte Hauswände mit Türlücken — deshalb
     stehen alle Häuser in 90°-Schritten.
     ============================================================ */

  U.addObstacle = function (ctx, x, z, r) {
    ctx.obstacles.push({ x: x, z: z, r: r });
  };

  // Wand aus Mittelpunkt + Größe. interiorId markiert Innenwände,
  // damit sie nur kollidieren, wenn der Spieler auch drinnen ist.
  U.addWall = function (ctx, cx, cz, w, d, interiorId) {
    ctx.walls.push({
      x0: cx - w / 2, x1: cx + w / 2,
      z0: cz - d / 2, z1: cz + d / 2,
      interiorId: interiorId === undefined ? null : interiorId
    });
  };

  // Trifft ein Kreis (x,z,r) einen der Kreis-Hindernisse?
  U.blockedByCircle = function (ctx, x, z, r) {
    var list = ctx.obstacles;
    for (var i = 0; i < list.length; i++) {
      var o = list[i], dx = x - o.x, dz = z - o.z, rr = o.r + r;
      if (Math.abs(dx) < rr && Math.abs(dz) < rr && dx * dx + dz * dz < rr * rr) return o;
    }
    return null;
  };

  // Schiebt einen Kreis aus allen Rechtecken heraus (kleinste Eindringtiefe).
  // Gibt {x, z, hit} zurück. activeInterior = aktuell betretene Innen-ID (oder null).
  U.resolveWalls = function (ctx, x, z, r, activeInterior) {
    var hit = false;
    var list = ctx.walls;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      // Innenwände zählen nur, wenn man in genau diesem Haus ist.
      if (w.interiorId !== null && w.interiorId !== activeInterior) continue;
      var nx = U.clamp(x, w.x0, w.x1);
      var nz = U.clamp(z, w.z0, w.z1);
      var dx = x - nx, dz = z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      hit = true;
      if (d2 > 1e-6) {
        var d = Math.sqrt(d2);
        x = nx + dx / d * r;
        z = nz + dz / d * r;
      } else {
        // Mittelpunkt liegt im Rechteck: entlang der kürzesten Achse rausschieben.
        var left = x - w.x0, right = w.x1 - x, up = z - w.z0, down = w.z1 - z;
        var m = Math.min(left, right, up, down);
        if (m === left) x = w.x0 - r;
        else if (m === right) x = w.x1 + r;
        else if (m === up) z = w.z0 - r;
        else z = w.z1 + r;
      }
    }
    return { x: x, z: z, hit: hit };
  };

  // Kombinierte Auflösung für Fußgänger/NPCs: Kreise + Wände.
  U.resolveAll = function (ctx, x, z, r, activeInterior) {
    var hit = false;
    var list = ctx.obstacles;
    for (var i = 0; i < list.length; i++) {
      var o = list[i], dx = x - o.x, dz = z - o.z, rr = o.r + r;
      if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
      var d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr) continue;
      hit = true;
      var d = Math.sqrt(d2) || 0.0001;
      x = o.x + dx / d * rr;
      z = o.z + dz / d * rr;
    }
    var res = U.resolveWalls(ctx, x, z, r, activeInterior);
    return { x: res.x, z: res.z, hit: hit || res.hit };
  };

  // Ist der Punkt frei? (für Spawn-Suche)
  U.isFree = function (ctx, x, z, r) {
    if (U.blockedByCircle(ctx, x, z, r)) return false;
    var list = ctx.walls;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      var nx = U.clamp(x, w.x0, w.x1), nz = U.clamp(z, w.z0, w.z1);
      var dx = x - nx, dz = z - nz;
      if (dx * dx + dz * dz < r * r) return false;
    }
    return true;
  };

  // ---------- Sichtbarkeit / Aufräumen ----------
  U.disposeObject = function (obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); });
        else o.material.dispose();
      }
    });
  };

  U.removeFromScene = function (scene, obj) {
    if (!obj) return;
    scene.remove(obj);
    U.disposeObject(obj);
  };

  return U;
})();
