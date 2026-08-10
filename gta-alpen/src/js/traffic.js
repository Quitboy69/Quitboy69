'use strict';
/* ============================================================
   traffic.js — Verkehr auf den Straßen und Polizeifahrzeuge
   Abhängig von: config.js, util.js, vehicles.js, player.js, audio.js
   Definiert GTA.Traffic.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Traffic = (function () {
  var T = {};
  var U, CFG;

  function ensure() { U = GTA.U; CFG = GTA.CFG; }

  /* Ein Fahrzeug in die Welt setzen. */
  T.addCar = function (ctx, mesh, params, kind) {
    mesh.castShadow = true;
    ctx.scene.add(mesh);
    var c = {
      mesh: mesh, params: params, kind: kind,
      angle: 0, speed: 0, stun: 0, lane: CFG.RING_R,
      dir: 1, route: 'ring', axis: 'ns', pos: 0
    };
    ctx.worldCars.push(c);
    return c;
  };

  /* ---------------- Aufbau ---------------- */
  T.build = function (ctx) {
    ensure();
    var V = GTA.Vehicles;
    if (!V || !V.CATALOG) return;

    // Fahrbare Fahrzeuge für den Verkehr: alles außer dem teuersten Kram.
    var pool = V.CATALOG.filter(function (v) { return v.price <= 20000; });
    if (!pool.length) pool = V.CATALOG.slice();

    var n = ctx.gfx.traffic;

    // --- Ringstraße ---
    for (var i = 0; i < n; i++) {
      var def = U.pick(pool);
      var col = U.pick(CFG.TRAFFIC_COLORS);
      var c = T.addCar(ctx, V.build(def.id, col), V.TRAFFIC_PARAMS, 'traffic');
      c.route = 'ring';
      c.angle = i / n * Math.PI * 2;
      c.lane = (i % 2 === 0) ? CFG.RING_R - 6 : CFG.RING_R + 6;
      c.dir = (i % 2 === 0) ? 1 : -1;
      c.speed = U.rand(10, 16);
    }

    // --- Kreuzstraßen ---
    for (var k = 0; k < Math.floor(n * 0.7); k++) {
      var def2 = U.pick(pool);
      var c2 = T.addCar(ctx, V.build(def2.id, U.pick(CFG.TRAFFIC_COLORS)), V.TRAFFIC_PARAMS, 'traffic');
      c2.route = 'line';
      c2.axis = (k % 2 === 0) ? 'ns' : 'ew';
      c2.dir = (k % 4 < 2) ? 1 : -1;
      c2.lane = c2.dir > 0 ? 6 : -6;
      c2.pos = U.rand(-CFG.ROAD_LEN / 2, CFG.ROAD_LEN / 2);
      c2.speed = U.rand(12, 19);
    }

    // --- Geparkte Fahrzeuge im Dorf ---
    var parkSpots = [
      [62, 52], [102, -38], [-50, 54], [130, 82], [-98, 78],
      [50, -70], [160, 50], [-130, -78], [26, 156], [-24, -164]
    ];
    parkSpots.forEach(function (sp) {
      if (!U.isFree(ctx, sp[0], sp[1], 3)) return;
      var d = U.pick(pool);
      var pc = T.addCar(ctx, V.build(d.id, U.pick(CFG.TRAFFIC_COLORS)), V.TRAFFIC_PARAMS, 'parked');
      pc.mesh.position.set(sp[0], 0, sp[1]);
      pc.mesh.rotation.y = U.rand(0, Math.PI * 2);
    });
  };

  /* Das eigene Fahrzeug des Spielers neben ihm abstellen. */
  T.placeOwnCar = function (ctx) {
    ensure();
    var V = GTA.Vehicles;
    if (!V) return null;
    var p = ctx.player;
    var def = V.byId(p.ownedVehicle) || V.CATALOG[0];
    var c = T.addCar(ctx, V.build(def.id, def.color), def, 'parked');
    c.isOwn = true;
    c.mesh.position.set(5, 0, 10);
    c.mesh.rotation.y = 0;
    return c;
  };

  /* Eigenes Fahrzeug austauschen (Garage). */
  T.replaceOwnCar = function (ctx, vehicleId) {
    ensure();
    var V = GTA.Vehicles;
    var p = ctx.player;
    var old = null;
    for (var i = 0; i < ctx.worldCars.length; i++) {
      if (ctx.worldCars[i].isOwn) { old = ctx.worldCars[i]; break; }
    }
    var wasDriving = (p.car === old);
    var px = p.x, pz = p.z, ph = p.heading;
    if (old) {
      if (wasDriving) p.car = null;
      U.removeFromScene(ctx.scene, old.mesh);
      ctx.worldCars.splice(ctx.worldCars.indexOf(old), 1);
    }
    var def = V.byId(vehicleId) || V.CATALOG[0];
    var c = T.addCar(ctx, V.build(def.id, def.color), def, 'parked');
    c.isOwn = true;
    if (wasDriving) {
      c.mesh.position.set(px, 0, pz);
      c.mesh.rotation.y = ph;
      GTA.Player.enterCar(ctx, c);
    } else {
      c.mesh.position.set(px + Math.sin(ph) * 6, 0, pz + Math.cos(ph) * 6);
      c.mesh.rotation.y = ph;
    }
    return c;
  };

  /* ---------------- Verkehr fahren lassen ---------------- */
  function spinWheels(c, dt) {
    var wheels = c.mesh.userData.wheels || [];
    for (var i = 0; i < wheels.length; i++) {
      if (wheels[i].userData.spin) {
        wheels[i].userData.spin.rotation.x += (c.speed / wheels[i].userData.radius) * dt;
      }
    }
  }

  function collideWithPlayer(ctx, c, x, z) {
    var p = ctx.player;
    var pr = p.car ? p.car.params.radius : 0.6;
    var dx = p.x - x, dz = p.z - z;
    var rr = c.params.radius + pr;
    if (dx * dx + dz * dz >= rr * rr) return;
    var d = Math.hypot(dx, dz) || 0.01;
    if (p.car) {
      p.speed *= 0.4;
      c.stun = 2.5;
      p.x = x + dx / d * rr;
      p.z = z + dz / d * rr;
      if (GTA.Audio) GTA.Audio.crash();
    } else {
      GTA.Player.damage(ctx, 28, 'traffic');
      c.stun = 3;
      p.x = x + dx / d * (rr + 0.6);
      p.z = z + dz / d * (rr + 0.6);
    }
  }

  T.update = function (ctx, dt) {
    ensure();
    for (var i = 0; i < ctx.worldCars.length; i++) {
      var c = ctx.worldCars[i];
      if (c.kind !== 'traffic' || c === ctx.player.car) continue;
      if (c.stun > 0) { c.stun -= dt; continue; }

      var x, z, heading;
      if (c.route === 'ring') {
        c.angle += c.dir * (c.speed / c.lane) * dt;
        x = Math.cos(c.angle) * c.lane;
        z = Math.sin(c.angle) * c.lane;
        var tx = -Math.sin(c.angle) * c.dir, tz = Math.cos(c.angle) * c.dir;
        heading = Math.atan2(tx, tz);
      } else {
        c.pos += c.dir * c.speed * dt;
        var half = CFG.ROAD_LEN / 2;
        if (c.pos > half) c.pos = -half;
        if (c.pos < -half) c.pos = half;
        if (c.axis === 'ns') {
          x = c.lane; z = c.pos;
          heading = c.dir > 0 ? 0 : Math.PI;
        } else {
          x = c.pos; z = -c.lane;
          heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      c.x = x; c.z = z; c.heading = heading;
      c.mesh.position.set(x, 0, z);
      c.mesh.rotation.y = heading;
      spinWheels(c, dt);
      collideWithPlayer(ctx, c, x, z);

      // Fußgänger springen zur Seite
      if (GTA.NPCs && GTA.NPCs.scare) GTA.NPCs.scare(ctx, x, z, 7);
    }
  };

  /* ---------------- Polizeifahrzeuge ---------------- */
  T.spawnCopCar = function (ctx) {
    ensure();
    var V = GTA.Vehicles;
    if (!V) return;
    var stars = GTA.Player.wantedLevel(ctx);
    var mesh = (stars >= 4 && V.buildCopBike) ? V.buildCopBike() : V.buildCop();
    var a = U.rand(0, Math.PI * 2);
    var p = ctx.player;
    var cc = {
      mesh: mesh,
      x: p.x + Math.cos(a) * 95,
      z: p.z + Math.sin(a) * 95,
      heading: 0, speed: 0, rammCd: 0
    };
    mesh.position.set(cc.x, 0, cc.z);
    ctx.scene.add(mesh);
    ctx.copCars.push(cc);
  };

  T.updateCopCars = function (ctx, dt) {
    ensure();
    var p = ctx.player;
    for (var i = ctx.copCars.length - 1; i >= 0; i--) {
      var cc = ctx.copCars[i];
      cc.rammCd -= dt;

      // Blaulicht blinkt
      if (cc.mesh.userData.siren) {
        var on = Math.floor(ctx.elapsed * 6) % 2;
        cc.mesh.userData.siren.material.emissive.setHex(on ? 0x2255ff : 0xff2233);
      }

      var dx = p.x - cc.x, dz = p.z - cc.z;
      var d = Math.hypot(dx, dz) || 0.01;
      var targetH = Math.atan2(dx / d, dz / d);
      cc.heading += U.clamp(U.angDiff(targetH, cc.heading), -1.8 * dt, 1.8 * dt);

      var want = d > 12 ? 28 : 15;
      cc.speed += (want - cc.speed) * Math.min(dt * 1.3, 1);
      cc.x += Math.sin(cc.heading) * cc.speed * dt;
      cc.z += Math.cos(cc.heading) * cc.speed * dt;

      // Rammen
      var pr = p.car ? p.car.params.radius : 0.6;
      if (d < pr + 1.6 && cc.rammCd <= 0) {
        cc.rammCd = 0.8;
        if (p.car) { p.speed *= 0.55; GTA.Player.damage(ctx, 6, 'cop'); }
        else GTA.Player.damage(ctx, 15, 'cop');
        cc.speed = -7;
        if (GTA.Audio) GTA.Audio.crash();
      }

      // Hindernisse: grob abprallen
      if (U.blockedByCircle(ctx, cc.x, cc.z, 1.5)) {
        cc.heading += 0.9;
        cc.x -= Math.sin(cc.heading) * 2.4;
        cc.z -= Math.cos(cc.heading) * 2.4;
        cc.speed *= 0.5;
      }

      cc.mesh.position.set(cc.x, 0, cc.z);
      cc.mesh.rotation.y = cc.heading;
      var wheels = cc.mesh.userData.wheels || [];
      for (var w = 0; w < wheels.length; w++) {
        if (wheels[w].userData.spin) {
          wheels[w].userData.spin.rotation.x += (cc.speed / wheels[w].userData.radius) * dt;
        }
      }

      // Sirene gelegentlich hörbar
      if (Math.random() < dt * 0.5 && d < 70 && GTA.Audio) GTA.Audio.siren();
    }

    // Anzahl an die Fahndungsstufe anpassen
    var stars = GTA.Player.wantedLevel(ctx);
    var soll = stars >= 2 ? (stars - 1) : 0;
    if (ctx.copCars.length < soll) T.spawnCopCar(ctx);
    if (stars <= 0 && ctx.copCars.length) {
      for (var k = ctx.copCars.length - 1; k >= 0; k--) {
        U.removeFromScene(ctx.scene, ctx.copCars[k].mesh);
        ctx.copCars.splice(k, 1);
      }
    }
  };

  return T;
})();
