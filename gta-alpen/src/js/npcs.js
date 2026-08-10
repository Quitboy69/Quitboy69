'use strict';
/* ============================================================
   npcs.js — Passanten, Polizei, Gegner
   Abhängig von: config.js, util.js, characters.js, player.js, audio.js
   Definiert GTA.NPCs.

   NPC:
   { mesh, kind:'civ'|'cop'|'enemy', archetype, displayName,
     x, z, heading, speed, hp, maxHp, state, timer, targetX, targetZ,
     downT, hitCd, talk:[], talkCd, interiorId, tempo }
   ============================================================ */
window.GTA = window.GTA || {};

GTA.NPCs = (function () {
  var N = {};
  var U, CFG;
  var laufId = 0;

  function ensure() { U = GTA.U; CFG = GTA.CFG; }

  /* ============================================================
     1. Archetypen
     ============================================================ */
  N.ARCHETYPES = [
    {
      id: 'bauer', name: 'Bauer', tempo: 1.25, hp: 4,
      namen: ['Sepp', 'Hansi', 'Toni', 'Franz', 'Alois'],
      look: { shirt: 0x4a6b4f, pants: 0x4a3b2e, hat: 'trachtenhut', hatColor: 0x3f5a34, build: 'kraeftig', beard: true },
      talk: ['Grüß di. Schee\'s Wetter heut, oder?',
             'De Kühe san scho auf da Weid.',
             'Host du an Traktor gsehn? Meiner is weg.',
             'Wennst Milch brauchst, kimm am Hof vorbei.']
    },
    {
      id: 'jogger', name: 'Läuferin', tempo: 3.6, hp: 3,
      namen: ['Bea', 'Nina', 'Kathi', 'Sonja'],
      look: { shirt: 0xd3689a, pants: 0x38343a, build: 'schlank', hat: 'keine' },
      talk: ['Nur no drei Kilometer, dann hob i\'s.',
             'Geh weiter, i bin im Rhythmus!',
             'Die Runde um\'n See is a Wahnsinn.']
    },
    {
      id: 'tourist', name: 'Tourist', tempo: 0.9, hp: 3,
      namen: ['Herr Meier', 'Frau Schulz', 'Herr Krause', 'Frau Weber'],
      look: { shirt: 0x4aa3a3, pants: 0xd8c79a, hat: 'kappe', hatColor: 0xe0a132, glasses: true, build: 'staemmig' },
      talk: ['Entschuldigung, wo geht\'s zum See?',
             'Wunderschön habt ihr\'s hier!',
             'Können Sie ein Foto von uns machen?',
             'Gibt es hier irgendwo einen Geldautomaten?']
    },
    {
      id: 'wirtin', name: 'Wirtin', tempo: 1.1, hp: 5,
      namen: ['Marlene', 'Resi', 'Traudl', 'Gerti'],
      look: { shirt: 0xd94f4f, pants: 0x2b3242, build: 'normal', hair: 0x8a5a24 },
      talk: ['A Kaffee? Oder gleich a Bier?',
             'Der Stammtisch is heut wieder laut.',
             'Küche is bis neune offen, merk da\'s.',
             'Zoin kannst am Schluss, i kenn di eh.']
    },
    {
      id: 'jaeger', name: 'Jäger', tempo: 1.35, hp: 6,
      namen: ['Förster Huber', 'Jäger Moser', 'Revierjäger Stadler'],
      look: { shirt: 0x4a5535, pants: 0x3a4030, hat: 'trachtenhut', hatColor: 0x2f3d28, jacket: true, jacketColor: 0x3a4030, beard: true, build: 'kraeftig' },
      talk: ['Pscht — da Hirsch is grad drüben.',
             'Im Revier wird ned gschossn, klar?',
             'Da Wald ghört ned dir alloa.']
    },
    {
      id: 'rentner', name: 'Rentner', tempo: 0.7, hp: 3,
      namen: ['Opa Berger', 'Herr Gruber', 'Frau Pichler', 'Opa Leitner'],
      look: { shirt: 0x5b6472, pants: 0x38343a, hat: 'hut', hatColor: 0x4a4038, glasses: true, build: 'klein' },
      talk: ['Früher war do no a Wiesn.',
             'Fahrts ned so schnell, ihr Lausbuam!',
             'Mei Hüfte spürt\'s Wetter besser ois da Fernseher.',
             'Host a Minutn? I erzähl da was.']
    },
    {
      id: 'schuelerin', name: 'Schülerin', tempo: 2.1, hp: 2,
      namen: ['Lena', 'Emma', 'Sarah', 'Jonas', 'Felix'],
      look: { shirt: 0x8e5bc4, pants: 0x2b3242, build: 'schlank' },
      talk: ['Der Bus kommt eh wieder z\'spät.',
             'Hast du die Mathe-Hausübung?',
             'Am Wochenend gehn ma an See, kimmst mit?']
    },
    {
      id: 'bauarbeiter', name: 'Bauarbeiter', tempo: 1.2, hp: 6,
      namen: ['Poldi', 'Kurt', 'Miki', 'Bernd'],
      look: { shirt: 0xe0a132, pants: 0x5b6472, hat: 'helm', hatColor: 0xe8a020, build: 'kraeftig' },
      talk: ['Achtung, do wird grod grobn!',
             'Jausn is um zehne, keine Minutn später.',
             'Des Material kummt eh wieder ned.']
    },
    {
      id: 'radfahrer', name: 'Radfahrer', tempo: 2.6, hp: 3,
      namen: ['Micha', 'Andi', 'Steffi', 'Rudi'],
      look: { shirt: 0x1e5fc0, pants: 0x1d1f24, hat: 'helm', hatColor: 0xd8342c, glasses: true, build: 'schlank' },
      talk: ['Die Steigung zum Ring is brutal.',
             'Radweg? Wos is a Radweg?',
             'Sechzig Kilometer heut scho.']
    },
    {
      id: 'hundebesitzer', name: 'Hundehalter', tempo: 1.4, hp: 3,
      namen: ['Frau Wimmer', 'Herr Ebner', 'Frau Haas'],
      look: { shirt: 0x35a06b, pants: 0x4a3b2e, build: 'normal' },
      talk: ['Der beißt ned, der will nur spün.',
             'Bello! BELLO! … er hört nix.',
             'Dreimal am Tag raus, ob i wui oder ned.']
    },
    {
      id: 'marktfrau', name: 'Marktfrau', tempo: 0.95, hp: 4,
      namen: ['Frau Aigner', 'Frau Brunner', 'Frau Steger'],
      look: { shirt: 0xe0a132, pants: 0x6d5a3f, hat: 'kappe', hatColor: 0xd94f4f, build: 'staemmig' },
      talk: ['Frische Äpfel, direkt vom Baum!',
             'Zwa Euro\'s Kilo, für di ans fuchzg.',
             'Am Samstag is Markt am Hauptplatz.']
    },
    {
      id: 'musiker', name: 'Musikant', tempo: 1.0, hp: 3,
      namen: ['Wastl', 'Hubsi', 'Ferdl'],
      look: { shirt: 0xf4f2ec, pants: 0x2f3d28, hat: 'trachtenhut', hatColor: 0x2f5d34, build: 'normal' },
      talk: ['Heut spün ma beim Wirt auf.',
             'Kennst an Landler? Na? Schod.',
             'De Trompetn muass i no stimmen.']
    }
  ];

  var byArch = null;
  function archById(id) {
    if (!byArch) {
      byArch = {};
      for (var i = 0; i < N.ARCHETYPES.length; i++) byArch[N.ARCHETYPES[i].id] = N.ARCHETYPES[i];
    }
    return byArch[id] || N.ARCHETYPES[0];
  }

  /* ============================================================
     2. Erzeugen
     ============================================================ */
  function freierPunkt(ctx) {
    for (var i = 0; i < 60; i++) {
      var a = U.rand(0, Math.PI * 2), r = U.rand(28, 260);
      var x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (U.isNearRoad(x, z, -7)) continue;             // nicht mitten auf der Fahrbahn
      if (U.inLake(x, z)) continue;
      if (!U.isFree(ctx, x, z, 0.8)) continue;
      if (GTA.Interiors && GTA.Interiors.at && GTA.Interiors.at(x, z)) continue;
      return { x: x, z: z };
    }
    return { x: 24, z: 24 };
  }

  function basis(ctx, mesh, kind, x, z) {
    mesh.position.set(x, 0, z);
    ctx.scene.add(mesh);
    laufId++;
    return {
      id: 'npc' + laufId,
      mesh: mesh, kind: kind,
      x: x, z: z, heading: U.rand(0, Math.PI * 2), speed: 0,
      hp: 3, maxHp: 3, state: 'wander', timer: U.rand(0, 3),
      targetX: x, targetZ: z, downT: 0, hitCd: 0, talkCd: 0,
      interiorId: null, tempo: 1, talk: [], dead: false
    };
  }

  N.spawnCiv = function (ctx, x, z, archId) {
    ensure();
    var arch = archId ? archById(archId) : U.pick(N.ARCHETYPES);
    if (x === undefined || z === undefined) {
      var p = freierPunkt(ctx);
      x = p.x; z = p.z;
    }
    var look = GTA.Chars.randomLook(arch.look);
    var mesh = GTA.Chars.makeHuman(look);
    var n = basis(ctx, mesh, 'civ', x, z);
    n.archetype = arch.id;
    n.displayName = U.pick(arch.namen);
    n.talk = arch.talk;
    n.tempo = arch.tempo;
    n.hp = n.maxHp = arch.hp;
    n.state = Math.random() < 0.25 ? 'idle' : 'wander';
    ctx.npcs.push(n);
    return n;
  };

  N.spawnCop = function (ctx, x, z) {
    ensure();
    if (x === undefined) {
      var a = U.rand(0, Math.PI * 2);
      x = ctx.player.x + Math.cos(a) * 42;
      z = ctx.player.z + Math.sin(a) * 42;
    }
    var mesh = GTA.Chars.makeHuman({
      shirt: 0x1c3a6e, pants: 0x14213a, skin: U.pick(CFG.SKIN_TONES),
      hair: 0x0e0d0c, hat: 'kappe', hatColor: 0x14213a,
      jacket: true, jacketColor: 0x16294d, build: U.pick(['normal', 'kraeftig'])
    });
    var n = basis(ctx, mesh, 'cop', x, z);
    n.archetype = 'polizist';
    n.displayName = 'Polizist';
    n.talk = ['Stehnbleiben!', 'Hände wo i sie seh!', 'Des war\'s für di.'];
    n.tempo = 1.6;
    n.hp = n.maxHp = 8;
    n.state = 'chase';
    ctx.npcs.push(n);
    return n;
  };

  N.spawnEnemy = function (ctx, x, z, hp) {
    ensure();
    var mesh = GTA.Chars.makeHuman({
      shirt: 0x1d1f24, pants: 0x1d1f24, skin: U.pick(CFG.SKIN_TONES),
      hair: 0x0e0d0c, hat: U.pick(['beanie', 'kappe']), hatColor: 0x8b1a1a,
      jacket: true, jacketColor: 0x24262b,
      build: U.pick(['kraeftig', 'staemmig', 'normal']), beard: Math.random() < 0.5
    });
    var n = basis(ctx, mesh, 'enemy', x, z);
    n.archetype = 'schlaeger';
    n.displayName = 'Schläger';
    n.talk = ['Do host nix verlorn.', 'Hau ab, sonst gibt\'s wos.'];
    n.tempo = 1.5;
    n.hp = n.maxHp = hp || 6;
    n.state = 'guard';
    ctx.npcs.push(n);
    return n;
  };

  N.build = function (ctx) {
    ensure();
    var soll = ctx.gfx.npcs;
    for (var i = 0; i < soll; i++) N.spawnCiv(ctx);
    return ctx.npcs;
  };

  /* ============================================================
     3. Bewegung
     ============================================================ */
  function bewege(ctx, n, tempo, dt) {
    n.speed = tempo;
    var nx = n.x + Math.sin(n.heading) * tempo * dt;
    var nz = n.z + Math.cos(n.heading) * tempo * dt;

    var res = U.resolveAll(ctx, nx, nz, 0.45, n.interiorId);
    if (res.hit) {
      // Vor einem Hindernis: ausweichen statt kleben bleiben
      n.heading += (Math.random() < 0.5 ? 1 : -1) * U.rand(0.8, 1.6);
      n.speed = 0;
      n.timer = Math.min(n.timer, 0.4);
    }
    nx = res.x; nz = res.z;

    var dC = Math.hypot(nx, nz);
    if (dC > CFG.WORLD_R) {
      n.heading += Math.PI;
      nx = n.x; nz = n.z;
    }
    n.x = nx; n.z = nz;
  }

  function zielSuchen(ctx, n) {
    // Passanten bleiben gern in der Nähe von Wegen, aber nicht darauf.
    for (var i = 0; i < 14; i++) {
      var a = U.rand(0, Math.PI * 2), r = U.rand(7, 26);
      var tx = n.x + Math.cos(a) * r, tz = n.z + Math.sin(a) * r;
      if (Math.hypot(tx, tz) > CFG.WORLD_R - 20) continue;
      if (U.isNearRoad(tx, tz, -8)) continue;
      if (U.inLake(tx, tz)) continue;
      n.targetX = tx; n.targetZ = tz;
      return;
    }
    n.targetX = n.x; n.targetZ = n.z;
  }

  /* ============================================================
     4. Treffer
     ============================================================ */
  N.takeHit = function (ctx, n, dmg, fromX, fromZ) {
    if (!n || n.dead || n.state === 'down') return;
    n.hp -= dmg;

    // Rückstoß
    var dx = n.x - fromX, dz = n.z - fromZ;
    var d = Math.hypot(dx, dz) || 0.01;
    n.x += dx / d * 0.8;
    n.z += dz / d * 0.8;
    if (GTA.Audio) GTA.Audio.hit();

    if (n.hp <= 0) {
      n.state = 'down';
      n.downT = 0;
      n.speed = 0;
      if (n.kind === 'civ') GTA.Player.addHeat(ctx, 1.3);
      if (n.kind === 'cop') GTA.Player.addHeat(ctx, 1.8);
      ctx.player.stats.kills = (ctx.player.stats.kills || 0) + 1;
      // Umstehende erschrecken
      N.scare(ctx, n.x, n.z, 22, true);
      if (typeof N.onDown === 'function') N.onDown(ctx, n);
    } else {
      if (n.kind === 'civ') {
        n.state = 'flee'; n.timer = 9;
        GTA.Player.addHeat(ctx, 0.7);
        N.scare(ctx, n.x, n.z, 14);
      } else {
        n.state = 'chase';
      }
    }
  };

  /* Alle Zivilisten im Umkreis aufschrecken. */
  N.scare = function (ctx, x, z, radius, stark) {
    for (var i = 0; i < ctx.npcs.length; i++) {
      var n = ctx.npcs[i];
      if (n.kind !== 'civ' || n.dead || n.state === 'down') continue;
      var d = U.dist2d(n.x, n.z, x, z);
      if (d > radius) continue;
      if (!stark && n.state === 'flee') continue;
      n.state = 'flee';
      n.timer = stark ? 9 : 4.5;
    }
  };

  N.clearHostiles = function (ctx) {
    for (var i = ctx.npcs.length - 1; i >= 0; i--) {
      var n = ctx.npcs[i];
      if (n.kind === 'cop' || n.kind === 'enemy') {
        U.removeFromScene(ctx.scene, n.mesh);
        ctx.npcs.splice(i, 1);
      }
    }
  };

  N.remove = function (ctx, n) {
    var i = ctx.npcs.indexOf(n);
    if (i >= 0) ctx.npcs.splice(i, 1);
    n.dead = true;
    U.removeFromScene(ctx.scene, n.mesh);
  };

  /* ============================================================
     5. Reden
     ============================================================ */
  N.nearestTalkable = function (ctx, maxDist) {
    var p = ctx.player;
    if (p.car) return null;
    var best = null, bd = maxDist === undefined ? 3.2 : maxDist;
    for (var i = 0; i < ctx.npcs.length; i++) {
      var n = ctx.npcs[i];
      if (n.dead || n.state === 'down') continue;
      if (n.kind !== 'civ') continue;
      if (!n.talk || !n.talk.length) continue;
      var d = U.dist2d(p.x, p.z, n.x, n.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };

  N.talkTo = function (ctx, n) {
    if (!n || n.dead) return false;
    var satz = U.pick(n.talk);
    n.state = 'idle';
    n.timer = 3.5;
    // Zum Spieler drehen
    n.heading = U.headingTo(n.x, n.z, ctx.player.x, ctx.player.z);
    if (GTA.UI && GTA.UI.showSpeech) GTA.UI.showSpeech(ctx, n, satz);
    if (GTA.Audio) GTA.Audio.beep(U.rand(360, 520), 0.05, 0.1, 'sine');
    return true;
  };

  /* ============================================================
     6. Zustände
     ============================================================ */
  function updateCiv(ctx, n, dt) {
    var p = ctx.player;

    if (n.state === 'flee') {
      n.timer -= dt;
      n.heading = U.headingTo(p.x, p.z, n.x, n.z);   // vom Spieler weg
      bewege(ctx, n, 6.2, dt);
      if (n.timer <= 0) n.state = 'wander';
      return;
    }

    if (n.state === 'idle') {
      n.timer -= dt;
      n.speed = 0;
      // sich umsehen
      n.heading += Math.sin(ctx.elapsed * 0.8 + n.x) * dt * 0.5;
      if (n.timer <= 0) { n.state = 'wander'; zielSuchen(ctx, n); n.timer = U.rand(3, 7); }
      return;
    }

    if (n.state === 'chat') {
      n.timer -= dt;
      n.speed = 0;
      if (n.partner && !n.partner.dead && n.partner.state === 'chat') {
        n.heading = U.headingTo(n.x, n.z, n.partner.x, n.partner.z);
      }
      if (n.timer <= 0) { n.state = 'wander'; n.partner = null; zielSuchen(ctx, n); }
      return;
    }

    // wander
    n.timer -= dt;
    if (n.timer <= 0) {
      n.timer = U.rand(3, 8);
      if (Math.random() < 0.3) { n.state = 'idle'; n.timer = U.rand(2, 5); return; }
      zielSuchen(ctx, n);
    }
    var dx = n.targetX - n.x, dz = n.targetZ - n.z;
    var d = Math.hypot(dx, dz);
    if (d > 1.1) {
      n.heading = Math.atan2(dx / d, dz / d);
      bewege(ctx, n, n.tempo, dt);
    } else {
      n.speed = 0;
      n.timer = Math.min(n.timer, 0.6);
    }

    // Schnelles Fahrzeug in der Nähe? Wegspringen.
    if (p.car && Math.abs(p.speed) > 9 && U.dist2d(n.x, n.z, p.x, p.z) < 11) {
      n.state = 'flee'; n.timer = 3.5;
    }
  }

  function updateHostile(ctx, n, dt) {
    var p = ctx.player;
    var dx = p.x - n.x, dz = p.z - n.z;
    var d = Math.hypot(dx, dz) || 0.01;

    if (n.kind === 'enemy' && n.state === 'guard') {
      if (d < 17) n.state = 'chase';
      else { n.speed = 0; return; }
    }

    // Polizei gibt auf, wenn die Fahndung erloschen ist
    if (n.kind === 'cop' && GTA.Player.wantedLevel(ctx) <= 0) {
      n.state = 'down';
      n.downT = 6.5;
      return;
    }

    var reichweite = 1.9;
    if (d > reichweite) {
      n.heading = Math.atan2(dx / d, dz / d);
      var tempo = n.kind === 'cop' ? 6.6 : 6.0;
      // Bei hoher Fahndung werden Polizisten schneller.
      if (n.kind === 'cop') tempo += Math.min(GTA.Player.wantedLevel(ctx), 5) * 0.22;
      bewege(ctx, n, tempo, dt);
    } else {
      n.speed = 0;
      n.heading = Math.atan2(dx / d, dz / d);
      n.hitCd -= dt;
      if (n.hitCd <= 0) {
        n.hitCd = 1.0;
        var u = n.mesh.userData;
        u.armLock = true;
        u.armR.rotation.x = -1.5;
        (function (uu) {
          setTimeout(function () {
            if (uu && uu.armR) { uu.armR.rotation.x = 0; uu.armLock = false; }
          }, 180);
        })(u);
        GTA.Player.damage(ctx, n.kind === 'cop' ? 10 : 8, n.kind);
        if (GTA.Audio) GTA.Audio.hit();
      }
    }
  }

  function updateDown(ctx, n, dt) {
    n.downT += dt;
    n.speed = 0;
    // umkippen
    n.mesh.rotation.x = Math.max(n.mesh.rotation.x - dt * 5, -Math.PI / 2);
    if (n.downT > 9) {
      if (n.kind === 'civ') {
        var p = freierPunkt(ctx);
        n.x = p.x; n.z = p.z;
        n.hp = n.maxHp;
        n.state = 'wander';
        n.mesh.rotation.x = 0;
        n.downT = 0;
        n.timer = U.rand(1, 4);
      } else {
        N.remove(ctx, n);
      }
    }
  }

  /* Zwei Passanten in der Nähe fangen ein Gespräch an. */
  function vielleichtPlaudern(ctx, n) {
    if (n.kind !== 'civ' || n.state !== 'wander') return;
    if (Math.random() > 0.004) return;
    for (var i = 0; i < ctx.npcs.length; i++) {
      var m = ctx.npcs[i];
      if (m === n || m.kind !== 'civ' || m.state !== 'wander') continue;
      if (U.dist2d(n.x, n.z, m.x, m.z) > 4.5) continue;
      n.state = 'chat'; n.partner = m; n.timer = U.rand(5, 11);
      m.state = 'chat'; m.partner = n; m.timer = n.timer;
      return;
    }
  }

  /* ============================================================
     7. Hauptschleife
     ============================================================ */
  N.update = function (ctx, dt) {
    ensure();
    var p = ctx.player;

    for (var i = ctx.npcs.length - 1; i >= 0; i--) {
      var n = ctx.npcs[i];
      if (n.dead) { ctx.npcs.splice(i, 1); continue; }

      n.talkCd -= dt;

      if (n.state === 'down') {
        updateDown(ctx, n, dt);
      } else if (n.kind === 'civ') {
        updateCiv(ctx, n, dt);
        vielleichtPlaudern(ctx, n);
      } else {
        updateHostile(ctx, n, dt);
      }

      // Innenraum merken, damit Innenwände richtig kollidieren
      if (GTA.Interiors && GTA.Interiors.at) {
        var rec = GTA.Interiors.at(n.x, n.z);
        n.interiorId = rec ? rec.id : null;
      }

      n.mesh.position.x = n.x;
      n.mesh.position.z = n.z;
      if (n.state !== 'down') n.mesh.rotation.y = n.heading;
      GTA.Chars.animate(n.mesh, n.speed, dt);
    }

    // Fahndung: genug Polizei vor Ort?
    var stufe = GTA.Player.wantedLevel(ctx);
    if (stufe >= 1) {
      var zuFuss = 0;
      for (var k = 0; k < ctx.npcs.length; k++) {
        if (ctx.npcs[k].kind === 'cop' && ctx.npcs[k].state !== 'down') zuFuss++;
      }
      if (zuFuss < stufe * 2) N.spawnCop(ctx);
    }

    // Bevölkerung auffüllen, falls Passanten verschwunden sind
    var zivil = 0;
    for (var z = 0; z < ctx.npcs.length; z++) if (ctx.npcs[z].kind === 'civ') zivil++;
    if (zivil < ctx.gfx.npcs && Math.random() < dt * 0.5) N.spawnCiv(ctx);
  };

  return N;
})();
