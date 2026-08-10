'use strict';
/* ============================================================
   player.js — Spielerzustand, Physik, Kamera, Speichern
   Abhängig von: config.js, util.js, characters.js, audio.js, input.js
   Definiert GTA.Player.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Player = (function () {
  var P = {};
  var U, CFG;
  var camPos = null, camLook = null;
  var camYawSmooth = 0;
  var deadT = 0;

  function ensure() { U = GTA.U; CFG = GTA.CFG; }

  P.DEFAULT_STYLE = {
    skin: 0, shirt: 0xe8632d, pants: 0x2b3242, hair: 0,
    hat: 'keine', hatColor: 0x1d1f24, build: 'normal',
    jacket: false, jacketColor: 0x2f3a4a, beard: false, glasses: false
  };

  /* ---------------- Erzeugen ---------------- */
  P.create = function (ctx, saved) {
    ensure();
    var p = {
      x: 0, z: 16, y: 0,
      heading: 0, speed: 0, steer: 0, throttleSm: 0,
      hp: CFG.MAX_HP, armor: 0, money: CFG.START_MONEY, regenT: 0,
      car: null,
      ownedVehicle: 'rs_coupe',
      owned: { rs_coupe: true },
      weapons: { faeuste: true },
      weapon: 'faeuste',
      ammo: {},
      attackCd: 0, reloadT: 0,
      sprint: false,
      style: Object.assign({}, P.DEFAULT_STYLE),
      stats: { missionsDone: {}, kills: 0, itemsFound: 0, distance: 0, collected: {} },
      interiorId: null,
      mesh: null
    };

    if (saved) {
      if (typeof saved.money === 'number') p.money = saved.money;
      if (saved.owned) p.owned = Object.assign({ rs_coupe: true }, saved.owned);
      if (saved.ownedVehicle) p.ownedVehicle = saved.ownedVehicle;
      if (saved.weapons) p.weapons = Object.assign({ faeuste: true }, saved.weapons);
      if (saved.weapon) p.weapon = saved.weapon;
      if (saved.ammo) p.ammo = saved.ammo;
      if (saved.style) p.style = Object.assign({}, P.DEFAULT_STYLE, saved.style);
      if (saved.stats) p.stats = Object.assign(p.stats, saved.stats);
    }
    // Ausgewähltes Fahrzeug muss dem Spieler auch gehören.
    if (!p.owned[p.ownedVehicle]) p.ownedVehicle = 'rs_coupe';
    if (!p.weapons[p.weapon]) p.weapon = 'faeuste';

    ctx.player = p;
    P.state = p;
    camPos = new THREE.Vector3(0, 5, 4);
    camLook = new THREE.Vector3();
    P.rebuildMesh(ctx);
    return p;
  };

  /* ---------------- Figur (neu) bauen ---------------- */
  P.rebuildMesh = function (ctx) {
    ensure();
    var p = ctx.player;
    var visible = p.mesh ? p.mesh.visible : true;
    if (p.mesh) U.removeFromScene(ctx.scene, p.mesh);
    var s = p.style;
    p.mesh = GTA.Chars.makeHuman({
      skin: CFG.SKIN_TONES[s.skin] || CFG.SKIN_TONES[0],
      shirt: s.shirt, pants: s.pants,
      hair: CFG.HAIR_COLORS[s.hair] || CFG.HAIR_COLORS[0],
      hat: s.hat, hatColor: s.hatColor,
      build: s.build,
      jacket: s.jacket, jacketColor: s.jacketColor,
      beard: s.beard, glasses: s.glasses
    });
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    p.mesh.visible = visible;
    ctx.scene.add(p.mesh);
    P.refreshWeaponMesh(ctx);
  };

  P.refreshWeaponMesh = function (ctx) {
    var p = ctx.player;
    if (!p.mesh) return;
    var armR = p.mesh.userData.armR;
    if (p._weaponMesh) { armR.remove(p._weaponMesh); p._weaponMesh = null; }
    if (GTA.Weapons && GTA.Weapons.makeMesh) {
      var m = GTA.Weapons.makeMesh(p.weapon);
      if (m) { armR.add(m); p._weaponMesh = m; }
    }
  };

  /* ---------------- Werte ändern ---------------- */
  P.addMoney = function (ctx, v) {
    ctx.player.money = Math.max(0, ctx.player.money + v);
    P.save(ctx);
  };

  P.heal = function (ctx, v) {
    var p = ctx.player;
    p.hp = Math.min(CFG.MAX_HP, p.hp + v);
  };

  P.addArmor = function (ctx, v) {
    var p = ctx.player;
    p.armor = Math.min(CFG.MAX_ARMOR, p.armor + v);
  };

  P.giveWeapon = function (ctx, id) {
    var p = ctx.player;
    var isNew = !p.weapons[id];
    p.weapons[id] = true;
    if (isNew) {
      p.weapon = id;
      P.refreshWeaponMesh(ctx);
    }
    P.save(ctx);
    return isNew;
  };

  P.giveAmmo = function (ctx, ammoId, n) {
    if (!ammoId) return;
    var p = ctx.player;
    p.ammo[ammoId] = (p.ammo[ammoId] || 0) + n;
  };

  P.addHeat = function (ctx, v) {
    ctx.heat = Math.min(CFG.HEAT_MAX, ctx.heat + v);
  };

  P.wantedLevel = function (ctx) {
    return Math.min(CFG.HEAT_STARS, Math.floor(ctx.heat));
  };

  /* ---------------- Schaden & Tod ---------------- */
  P.damage = function (ctx, dmg, quelle) {
    if (deadT > 0) return;
    var p = ctx.player;
    // Rüstung fängt 60 % ab, solange sie hält.
    if (p.armor > 0) {
      var absorbed = Math.min(p.armor, dmg * 0.6);
      p.armor -= absorbed;
      dmg -= absorbed;
    }
    p.hp -= dmg;
    p.regenT = 0;
    if (GTA.Audio) GTA.Audio.thud();
    if (GTA.UI && GTA.UI.flashHurt) GTA.UI.flashHurt();

    if (p.hp <= 0) {
      p.hp = 0;
      deadT = 2.4;
      var verhaftet = (quelle === 'cop');
      var verlust = Math.floor(p.money * 0.2);
      p.money -= verlust;
      P.save(ctx);
      if (GTA.UI) GTA.UI.showToast(verhaftet ? 'VERHAFTET' : 'K. O.', '−' + U.fmtMoney(verlust), '#ff5544');
      if (GTA.Audio) GTA.Audio.fail();
      if (ctx.mission && GTA.Missions) {
        GTA.Missions.fail(ctx, verhaftet ? 'Verhaftet.' : 'Du bist K. o. gegangen.');
      }
      setTimeout(function () { P.respawn(ctx); }, 1700);
    }
  };

  P.respawn = function (ctx) {
    var p = ctx.player;
    if (p.car) P.exitCar(ctx);
    p.x = 0; p.z = 16; p.heading = 0; p.speed = 0;
    p.hp = CFG.MAX_HP; p.armor = 0;
    p.interiorId = null;
    ctx.activeInterior = null;
    ctx.heat = 0;
    // Verfolger verschwinden
    if (GTA.NPCs && GTA.NPCs.clearHostiles) GTA.NPCs.clearHostiles(ctx);
    for (var i = ctx.copCars.length - 1; i >= 0; i--) {
      U.removeFromScene(ctx.scene, ctx.copCars[i].mesh);
      ctx.copCars.splice(i, 1);
    }
    if (p.mesh) { p.mesh.visible = true; p.mesh.position.set(p.x, 0, p.z); }
  };

  P.isDead = function () { return deadT > 0; };

  /* ---------------- Fahrzeuge ---------------- */
  P.nearestCar = function (ctx, maxDist) {
    var p = ctx.player, best = null, bd = maxDist;
    for (var i = 0; i < ctx.worldCars.length; i++) {
      var c = ctx.worldCars[i];
      if (c === p.car || c.isMissionTarget || c.noEnter) continue;
      var d = U.dist2d(p.x, p.z, c.mesh.position.x, c.mesh.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  };

  P.enterCar = function (ctx, c) {
    if (!c) return false;
    var p = ctx.player;
    if (c.kind === 'traffic') {
      // Fahrer flieht, das gibt Fahndung.
      if (GTA.NPCs && GTA.NPCs.spawnCiv) {
        var f = GTA.NPCs.spawnCiv(ctx, c.mesh.position.x + 1.8, c.mesh.position.z);
        if (f) { f.state = 'flee'; f.timer = 9; }
      }
      P.addHeat(ctx, 1.0);
      if (GTA.UI) GTA.UI.showToast('FAHRZEUG GEKLAUT', '+1 Fahndungsstern', '#ffd23c');
      c.kind = 'parked';
    }
    p.car = c;
    p.x = c.mesh.position.x;
    p.z = c.mesh.position.z;
    p.heading = c.mesh.rotation.y;
    p.speed = 0; p.steer = 0;
    p.interiorId = null;
    ctx.activeInterior = null;
    if (p.mesh) p.mesh.visible = false;
    if (GTA.Audio) GTA.Audio.door();
    if (GTA.Input) GTA.Input.lookYaw = p.heading;
    return true;
  };

  P.exitCar = function (ctx) {
    var p = ctx.player;
    var c = p.car;
    if (!c) return false;
    c.mesh.position.set(p.x, 0, p.z);
    c.mesh.rotation.y = p.heading;
    p.car = null;

    // Seitlich aussteigen, aber nicht in eine Wand.
    var side = 2.2;
    var ox = p.x + Math.cos(p.heading) * side;
    var oz = p.z - Math.sin(p.heading) * side;
    if (!U.isFree(ctx, ox, oz, 0.5)) {
      ox = p.x - Math.cos(p.heading) * side;
      oz = p.z + Math.sin(p.heading) * side;
    }
    if (!U.isFree(ctx, ox, oz, 0.5)) { ox = p.x; oz = p.z; }
    p.x = ox; p.z = oz;
    p.speed = 0;
    if (p.mesh) { p.mesh.visible = true; p.mesh.position.set(p.x, 0, p.z); }
    if (GTA.Audio) GTA.Audio.door();
    return true;
  };

  /* ---------------- Innenräume ---------------- */
  // Welches Haus enthält den Punkt? (Häuser stehen achsenparallel.)
  P.interiorAt = function (ctx, x, z) {
    for (var i = 0; i < ctx.interiors.length; i++) {
      var it = ctx.interiors[i];
      if (Math.abs(x - it.x) < it.w / 2 && Math.abs(z - it.z) < it.d / 2) return it;
    }
    return null;
  };

  P.updateInterior = function (ctx) {
    var p = ctx.player;
    if (p.car) { p.interiorId = null; ctx.activeInterior = null; return; }
    var it = P.interiorAt(ctx, p.x, p.z);
    var id = it ? it.id : null;
    if (id !== p.interiorId) {
      p.interiorId = id;
      ctx.activeInterior = id;
      if (GTA.Audio) GTA.Audio.door();
      if (id !== null && it && GTA.UI) GTA.UI.showToast(it.name || 'Haus', 'betreten', '#8ed1ff');
    }
  };

  /* ---------------- Physik ---------------- */
  P.update = function (ctx, dt) {
    ensure();
    var p = ctx.player;
    var In = GTA.Input;

    if (deadT > 0) { deadT -= dt; p.speed = 0; return; }

    p.attackCd -= dt;
    p.reloadT = Math.max(0, p.reloadT - dt);
    p.regenT += dt;
    if (p.regenT > CFG.REGEN_DELAY && p.hp < CFG.MAX_HP) {
      p.hp = Math.min(CFG.MAX_HP, p.hp + CFG.REGEN_RATE * dt);
    }

    if (p.car) P.updateDriving(ctx, dt, In);
    else P.updateOnFoot(ctx, dt, In);

    P.updateInterior(ctx);
  };

  /* ---- zu Fuß: Bewegung relativ zur Kamera ---- */
  P.updateOnFoot = function (ctx, dt, In) {
    var p = ctx.player;
    var a = In.actions;

    var fwd = (a.forward ? 1 : 0) - (a.back ? 1 : 0);
    var strafe = (a.right ? 1 : 0) - (a.left ? 1 : 0);

    var moving = (fwd !== 0 || strafe !== 0);
    var speed = 0;
    if (moving) {
      var yaw = In.lookYaw;
      // Vorwärts = (sin yaw, cos yaw), Rechts = (-cos yaw, sin yaw)
      var mx = fwd * Math.sin(yaw) + strafe * (-Math.cos(yaw));
      var mz = fwd * Math.cos(yaw) + strafe * (Math.sin(yaw));
      var len = Math.hypot(mx, mz) || 1;
      mx /= len; mz /= len;

      var sprintOk = a.sprint && fwd > 0;
      speed = fwd < 0 ? CFG.BACK_SPEED : (sprintOk ? CFG.SPRINT_SPEED : CFG.WALK_SPEED);
      p.sprint = sprintOk;

      // Figur dreht sich weich in die Laufrichtung.
      var want = Math.atan2(mx, mz);
      p.heading += GTA.U.angDiff(want, p.heading) * Math.min(dt * 12, 1);

      var nx = p.x + mx * speed * dt;
      var nz = p.z + mz * speed * dt;
      var res = GTA.U.resolveAll(ctx, nx, nz, 0.42, p.interiorId);
      nx = res.x; nz = res.z;

      // Nicht durch geparkte Fahrzeuge laufen
      for (var i = 0; i < ctx.worldCars.length; i++) {
        var c = ctx.worldCars[i];
        var dx = nx - c.mesh.position.x, dz = nz - c.mesh.position.z;
        var rr = c.params.radius + 0.42;
        if (dx * dx + dz * dz < rr * rr) {
          var d = Math.hypot(dx, dz) || 0.001;
          nx = c.mesh.position.x + dx / d * rr;
          nz = c.mesh.position.z + dz / d * rr;
        }
      }

      var dC = Math.hypot(nx, nz);
      if (dC > CFG.WORLD_R) { nx *= CFG.WORLD_R / dC; nz *= CFG.WORLD_R / dC; }

      p.stats.distance += Math.hypot(nx - p.x, nz - p.z);
      p.x = nx; p.z = nz;
    } else {
      p.sprint = false;
    }
    p.speed = speed;

    if (p.mesh) {
      p.mesh.position.x = p.x;
      p.mesh.position.z = p.z;
      p.mesh.rotation.y = p.heading;
      GTA.Chars.animate(p.mesh, speed, dt);
    }
  };

  /* ---- Fahrzeug ---- */
  P.updateDriving = function (ctx, dt, In) {
    var p = ctx.player;
    var v = p.car.params;
    var a = In.actions;

    var thrT = (a.forward ? 1 : 0) - (a.back ? 1 : 0);
    p.throttleSm += (thrT - p.throttleSm) * Math.min(dt * 8, 1);
    var thr = p.throttleSm;
    var sIn = (a.left ? 1 : 0) - (a.right ? 1 : 0);

    var onRoad = GTA.U.isNearRoad(p.x, p.z, 0);
    var water = GTA.U.inLake(p.x, p.z);
    var gripMax = v.max * (onRoad ? 1 : v.offGrip) * (water ? 0.25 : 1);

    if (thr > 0.02) {
      p.speed += thr * v.accel * Math.max(0, 1 - p.speed / gripMax) * dt;
    } else if (thr < -0.02) {
      if (p.speed > 1.5) p.speed += thr * 30 * dt;
      else {
        p.speed += thr * v.accel * 0.5 * dt;
        if (p.speed < -gripMax * 0.3) p.speed = -gripMax * 0.3;
      }
    }

    var drag = (onRoad ? 0.32 : 0.9) + (water ? 4.5 : 0);
    p.speed -= p.speed * drag * dt;
    p.speed -= Math.sign(p.speed) * Math.min(Math.abs(p.speed), 0.6 * dt);
    if (Math.abs(p.speed) < 0.02 && Math.abs(thr) < 0.02) p.speed = 0;

    var maxSteer = v.steer / (1 + Math.abs(p.speed) * 0.045);
    p.steer += (sIn * maxSteer - p.steer) * Math.min(dt * 7, 1);
    if (Math.abs(p.speed) > 0.15) {
      p.heading += (p.speed / v.wb) * Math.tan(p.steer) * dt;
    }

    var nx = p.x + Math.sin(p.heading) * p.speed * dt;
    var nz = p.z + Math.cos(p.heading) * p.speed * dt;
    p.stats.distance += Math.abs(p.speed) * dt;

    // Kollision gegen Kreise und Wände
    var before = { x: nx, z: nz };
    var res = GTA.U.resolveAll(ctx, nx, nz, v.radius, null);
    nx = res.x; nz = res.z;
    if (res.hit) {
      var impact = Math.abs(p.speed);
      if (impact > 6) { if (GTA.Audio) GTA.Audio.crash(); }
      if (impact > 18) P.damage(ctx, (impact - 18) * 0.8, 'crash');
      p.speed *= -0.25;
    }

    // Andere Fahrzeuge
    for (var i = 0; i < ctx.worldCars.length; i++) {
      var c = ctx.worldCars[i];
      if (c === p.car) continue;
      var dx = nx - c.mesh.position.x, dz = nz - c.mesh.position.z;
      var rr = c.params.radius + v.radius;
      if (dx * dx + dz * dz < rr * rr) {
        var d = Math.hypot(dx, dz) || 0.001;
        nx = c.mesh.position.x + dx / d * rr;
        nz = c.mesh.position.z + dz / d * rr;
        if (Math.abs(p.speed) > 7 && GTA.Audio) GTA.Audio.crash();
        c.stun = 2.2;
        p.speed *= -0.22;
      }
    }

    // Fußgänger anfahren
    if (Math.abs(p.speed) > 5.5 && GTA.NPCs && GTA.NPCs.takeHit) {
      for (var n = 0; n < ctx.npcs.length; n++) {
        var npc = ctx.npcs[n];
        if (npc.dead || npc.state === 'down') continue;
        var ndx = npc.x - nx, ndz = npc.z - nz;
        if (ndx * ndx + ndz * ndz < 2.8) {
          GTA.NPCs.takeHit(ctx, npc, Math.abs(p.speed) > 14 ? 99 : 4, nx, nz);
          p.speed *= 0.86;
        }
      }
    }

    var dC = Math.hypot(nx, nz);
    if (dC > CFG.WORLD_R) { nx *= CFG.WORLD_R / dC; nz *= CFG.WORLD_R / dC; p.speed *= 0.2; }

    p.x = nx; p.z = nz;

    // Sichtbares Fahrzeug nachführen
    var m = p.car.mesh;
    m.position.set(p.x, 0, p.z);
    m.rotation.y = p.heading;
    var spNorm = Math.min(Math.abs(p.speed) / v.max, 1);
    var tilt = m.userData.tilt;
    if (tilt) {
      if (v.bike) {
        tilt.rotation.z += ((-p.steer * spNorm * 1.15) - tilt.rotation.z) * Math.min(dt * 6, 1);
      } else {
        tilt.rotation.z += ((p.steer * spNorm * 0.09) - tilt.rotation.z) * Math.min(dt * 5, 1);
        tilt.rotation.x += ((-thr * 0.035) - tilt.rotation.x) * Math.min(dt * 5, 1);
      }
    }
    var wheels = m.userData.wheels || [];
    for (var w = 0; w < wheels.length; w++) {
      if (wheels[w].userData.spin) {
        wheels[w].userData.spin.rotation.x += (p.speed / wheels[w].userData.radius) * dt;
      }
    }
    var fw = m.userData.frontWheels || [];
    for (var f = 0; f < fw.length; f++) fw[f].rotation.y = p.steer;
  };

  /* ---------------- Kamera ---------------- */
  P.updateCamera = function (ctx, dt) {
    var p = ctx.player;
    var In = GTA.Input;
    var inCar = !!p.car;

    // Beim Fahren zieht die Kamera sanft hinter das Fahrzeug,
    // solange der Spieler die Maus nicht bewegt.
    if (inCar && Math.abs(p.speed) > 3) {
      In.lookYaw += GTA.U.angDiff(p.heading, In.lookYaw) * Math.min(dt * 1.6, 1);
    }
    camYawSmooth += GTA.U.angDiff(In.lookYaw, camYawSmooth) * Math.min(dt * 14, 1);

    var dist, height, eye;
    if (inCar) {
      dist = p.car.params.bike ? 7.2 : 8.8;
      height = 1.2;
      eye = p.car.params.bike ? 1.5 : 1.7;
    } else {
      dist = 5.0;
      height = 0.9;
      eye = 1.6;
    }

    var pitch = In.lookPitch;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var dirX = Math.sin(camYawSmooth) * cp;
    var dirZ = Math.cos(camYawSmooth) * cp;

    var tx = p.x, ty = eye, tz = p.z;
    var desiredX = tx - dirX * dist;
    var desiredY = ty + height - sp * dist;
    var desiredZ = tz - dirZ * dist;

    // Kamera nicht unter den Boden und nicht durchs Dach eines Innenraums
    if (desiredY < 0.7) desiredY = 0.7;
    if (p.interiorId !== null && desiredY > 2.9) desiredY = 2.9;

    var lerp = 1 - Math.exp(-dt * (inCar ? 6.5 : 11));
    camPos.x += (desiredX - camPos.x) * lerp;
    camPos.y += (desiredY - camPos.y) * lerp;
    camPos.z += (desiredZ - camPos.z) * lerp;
    ctx.camera.position.copy(camPos);

    camLook.set(tx + dirX * 4, ty + sp * 4, tz + dirZ * 4);
    ctx.camera.lookAt(camLook);

    var fov = 66;
    if (inCar) fov += Math.min(Math.abs(p.speed) / p.car.params.max, 1) * 14;
    if (In.actions.aim && !inCar) fov = 52;
    if (Math.abs(ctx.camera.fov - fov) > 0.15) {
      ctx.camera.fov += (fov - ctx.camera.fov) * Math.min(dt * 6, 1);
      ctx.camera.updateProjectionMatrix();
    }
  };

  /* ---------------- Fahndung ---------------- */
  P.updateWanted = function (ctx, dt) {
    var p = ctx.player;
    var minD = 9999;
    for (var i = 0; i < ctx.npcs.length; i++) {
      var n = ctx.npcs[i];
      if (n.kind === 'cop' && n.state !== 'down') {
        minD = Math.min(minD, U.dist2d(n.x, n.z, p.x, p.z));
      }
    }
    for (var c = 0; c < ctx.copCars.length; c++) {
      minD = Math.min(minD, U.dist2d(ctx.copCars[c].x, ctx.copCars[c].z, p.x, p.z));
    }
    // Abkühlen, wenn niemand in der Nähe ist
    if (minD > 55 || ctx.heat < 1) {
      ctx.heat = Math.max(0, ctx.heat - dt * 0.08);
    }
  };

  /* ---------------- Speichern / Laden ---------------- */
  var saveTimer = null;
  P.save = function (ctx) {
    // Zusammenfassen, damit nicht jeder Cent einzeln geschrieben wird.
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      P.saveNow(ctx);
    }, 800);
  };

  P.saveNow = function (ctx) {
    var p = ctx.player;
    if (!p) return;
    var data = {
      version: 2,
      money: p.money,
      owned: p.owned,
      ownedVehicle: p.ownedVehicle,
      weapons: p.weapons,
      weapon: p.weapon,
      ammo: p.ammo,
      style: p.style,
      stats: p.stats,
      gfx: ctx.gfxIndex
    };
    try {
      if (window.gtaNative && window.gtaNative.save) window.gtaNative.save(data);
      else localStorage.setItem('gta_alpen_save', JSON.stringify(data));
    } catch (e) {
      console.warn('[GTA] Speichern fehlgeschlagen:', e.message);
    }
  };

  P.load = function () {
    if (window.gtaNative && window.gtaNative.load) {
      return window.gtaNative.load().catch(function () { return null; });
    }
    return Promise.resolve().then(function () {
      try {
        var raw = localStorage.getItem('gta_alpen_save');
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    });
  };

  P.clearSave = function () {
    try {
      if (window.gtaNative && window.gtaNative.clear) window.gtaNative.clear();
      else localStorage.removeItem('gta_alpen_save');
    } catch (e) {}
  };

  return P;
})();
