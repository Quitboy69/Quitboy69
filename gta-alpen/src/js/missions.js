'use strict';
/* ============================================================
   missions.js — Aufträge mit mehreren Etappen
   Abhängig von: config.js, util.js, player.js, npcs.js, items.js,
                 vehicles.js, traffic.js, ui.js, audio.js
   Definiert GTA.Missions.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Missions = (function () {
  var M = {};
  var U, CFG;
  var marker = [];
  var beam = null, pfeil = null;

  M.targetPos = null;

  function ensure() { U = GTA.U; CFG = GTA.CFG; }

  /* Kurzschreibweisen für die Auftragsdefinitionen */
  function ziel(ctx, x, z) { M.setTarget(ctx, x, z); }
  function text(name, t) { if (GTA.UI) GTA.UI.setObjective(name, t); }
  function dist(ctx, x, z) { return U.dist2d(ctx.player.x, ctx.player.z, x, z); }
  function meter(d) { return Math.round(d) + ' m'; }
  function haus(ctx, kind) {
    for (var i = 0; i < ctx.interiors.length; i++) {
      if (ctx.interiors[i].kind === kind) return ctx.interiors[i];
    }
    return ctx.interiors[0] || null;
  }

  /* ============================================================
     Die Aufträge
     ============================================================ */
  M.LIST = [
    /* 1 */ {
      id: 'taxi', name: 'Taxi Traunsee', spot: GTA.CFG.MISSION_SPOTS[0], reward: 400, needCar: true,
      giver: 'Wirtin Marlene',
      brief: 'A Fahrgast wartet und hat\'s eilig. Bring ihn rechtzeitig ans Ziel — und fahr anständig, der zahlt sonst nix.',
      start: function (ctx, s) {
        var ziele = [
          [96, -116, 'zur Kirche'], [CFG.LAKE.x - 85, CFG.LAKE.z, 'zum Badesee'],
          [0, 300, 'zur Nordkreuzung'], [-230, -40, 'zur Westausfahrt'], [-150, 150, 'zur Tankstelle']
        ];
        var d = U.pick(ziele);
        s.tx = d[0]; s.tz = d[1]; s.label = d[2];
        s.t = 26 + dist(ctx, s.tx, s.tz) / 11;
        ziel(ctx, s.tx, s.tz);
        if (GTA.UI) GTA.UI.showToast('FAHRGAST EINGESTIEGEN', 'Gib Gas!', '#ffd23c');
      },
      update: function (ctx, s, dt) {
        s.t -= dt;
        var d = dist(ctx, s.tx, s.tz);
        text(this.name, 'Fahrgast ' + s.label + ' bringen · ' + meter(d) + ' · ⏱ ' + U.fmtTime(s.t));
        if (s.t <= 0) return M.fail(ctx, 'Zu spät — der Fahrgast ist ausgestiegen.');
        if (!ctx.player.car) return M.fail(ctx, 'Ohne Fahrzeug geht das nicht.');
        if (d < 7 && Math.abs(ctx.player.speed) < 3) return M.complete(ctx);
      }
    },

    /* 2 */ {
      id: 'kurier', name: 'Kurier-Blitz', spot: GTA.CFG.MISSION_SPOTS[1], reward: 600, needCar: true,
      giver: 'Postler Ferdl',
      brief: 'Drei Pakete, drei Adressen, eine Deadline. Der Kunde zahlt nur bei Pünktlichkeit.',
      start: function (ctx, s) {
        s.stops = [[0, 320], [-240, 10], [170, 170]];
        s.i = 0; s.t = 150;
        ziel(ctx, s.stops[0][0], s.stops[0][1]);
      },
      update: function (ctx, s, dt) {
        s.t -= dt;
        var st = s.stops[s.i];
        var d = dist(ctx, st[0], st[1]);
        text(this.name, 'Paket ' + (s.i + 1) + '/3 abliefern · ' + meter(d) + ' · ⏱ ' + U.fmtTime(s.t));
        if (s.t <= 0) return M.fail(ctx, 'Deadline verpasst.');
        if (d < 7) {
          s.i++;
          if (GTA.Audio) GTA.Audio.cash();
          if (s.i >= 3) return M.complete(ctx);
          ziel(ctx, s.stops[s.i][0], s.stops[s.i][1]);
          if (GTA.UI) GTA.UI.showToast('PAKET ' + s.i + '/3 GELIEFERT', '', '#2ecc71');
        }
      }
    },

    /* 3 */ {
      id: 'eintreiber', name: 'Der Eintreiber', spot: GTA.CFG.MISSION_SPOTS[2], reward: 700, needCar: false,
      giver: 'Wirt Sepp',
      brief: 'Zwei Typen schulden dem Wirt Geld und wollen nicht zahlen. Überzeug sie — auf die unfeine Tour.',
      start: function (ctx, s) {
        s.targets = [
          GTA.NPCs.spawnEnemy(ctx, -58, 210, 6),
          GTA.NPCs.spawnEnemy(ctx, 40, 250, 6)
        ];
      },
      update: function (ctx, s, dt) {
        var lebend = null, n = 0;
        for (var i = 0; i < s.targets.length; i++) {
          var t = s.targets[i];
          if (!t.dead && t.state !== 'down') { n++; if (!lebend) lebend = t; }
        }
        if (n === 0) return M.complete(ctx);
        ziel(ctx, lebend.x, lebend.z);
        text(this.name, 'Schuldner überzeugen · noch ' + n + ' übrig');
      }
    },

    /* 4 */ {
      id: 'rennen', name: 'Ring-Rennen', spot: GTA.CFG.MISSION_SPOTS[3], reward: 900, needCar: true,
      giver: 'Die Dorfjugend',
      brief: 'Inoffizielles Rennen am Ring. Zwölf Kontrollpunkte gegen die Uhr — halb Oberösterreich schaut zu.',
      start: function (ctx, s) {
        s.cps = [];
        var a0 = Math.atan2(ctx.player.z, ctx.player.x);
        for (var i = 1; i <= 12; i++) {
          var a = a0 + i * (Math.PI / 6);
          s.cps.push([Math.cos(a) * CFG.RING_R, Math.sin(a) * CFG.RING_R]);
        }
        s.i = 0; s.t = 112;
        ziel(ctx, s.cps[0][0], s.cps[0][1]);
      },
      update: function (ctx, s, dt) {
        s.t -= dt;
        var cp = s.cps[s.i];
        var d = dist(ctx, cp[0], cp[1]);
        text(this.name, 'Kontrollpunkt ' + (s.i + 1) + '/12 · ' + meter(d) + ' · ⏱ ' + U.fmtTime(s.t));
        if (s.t <= 0) return M.fail(ctx, 'Zeit abgelaufen.');
        if (d < 11) {
          s.i++;
          if (GTA.Audio) GTA.Audio.checkpoint();
          if (s.i >= 12) return M.complete(ctx);
          ziel(ctx, s.cps[s.i][0], s.cps[s.i][1]);
        }
      }
    },

    /* 5 */ {
      id: 'fracht', name: 'Heiße Fracht', spot: GTA.CFG.MISSION_SPOTS[4], reward: 1200, needCar: true,
      giver: 'Ein Unbekannter',
      brief: 'Du fährst etwas durch die Gegend, wonach die Polizei besser nicht fragt. Sie fragt trotzdem. Überleb 70 Sekunden.',
      start: function (ctx, s) {
        s.t = 70;
        ctx.heat = Math.max(ctx.heat, 2.4);
      },
      update: function (ctx, s, dt) {
        s.t -= dt;
        ctx.heat = Math.max(ctx.heat, 2.0);
        text(this.name, 'Der Polizei entkommen · ⏱ ' + U.fmtTime(s.t));
        if (s.t <= 0) { ctx.heat = 0; return M.complete(ctx); }
      }
    },

    /* 6 */ {
      id: 'seeraeuber', name: 'Seeräuber', spot: GTA.CFG.MISSION_SPOTS[5], reward: 1000, needCar: false,
      giver: 'Bademeister Kurt',
      brief: 'Eine Gang hat sich am Badesee breitgemacht und zockt Badegäste ab. Räum auf — die wehren sich.',
      start: function (ctx, s) {
        var L = CFG.LAKE;
        s.targets = [
          GTA.NPCs.spawnEnemy(ctx, L.x - 90, L.z + 20, 7),
          GTA.NPCs.spawnEnemy(ctx, L.x - 70, L.z - 40, 7),
          GTA.NPCs.spawnEnemy(ctx, L.x - 110, L.z - 15, 6),
          GTA.NPCs.spawnEnemy(ctx, L.x - 60, L.z + 55, 6)
        ];
      },
      update: function (ctx, s, dt) {
        var lebend = null, n = 0;
        for (var i = 0; i < s.targets.length; i++) {
          var t = s.targets[i];
          if (!t.dead && t.state !== 'down') { n++; if (!lebend) lebend = t; }
        }
        if (n === 0) return M.complete(ctx);
        ziel(ctx, lebend.x, lebend.z);
        text(this.name, 'Die Gang vertreiben · noch ' + n + ' übrig');
      }
    },

    /* 7 */ {
      id: 'coup', name: 'Der große Coup', spot: GTA.CFG.MISSION_SPOTS[6], reward: 1800, needCar: false,
      giver: 'Hehler Wastl',
      brief: 'Drei Akte: Schnapp dir den schwarzen Oldtimer, bring ihn zum Hehler bei der Kirche — und verschwinde, bevor dich die Polizei kassiert.',
      start: function (ctx, s) {
        s.stage = 1;
        var c = GTA.Traffic.addCar(ctx, GTA.Vehicles.build('classic', 0x101418),
          GTA.Vehicles.byId('classic'), 'parked');
        c.mesh.position.set(-240, 0, 160);
        c.mesh.rotation.y = 1.2;
        s.car = c;
        ziel(ctx, -240, 160);
        if (GTA.UI) GTA.UI.showToast('AKT 1', 'Hol den schwarzen Oldtimer', '#ffd23c');
      },
      update: function (ctx, s, dt) {
        if (s.stage === 1) {
          text(this.name, 'Akt 1/3 · Oldtimer holen · ' + meter(dist(ctx, -240, 160)));
          if (ctx.player.car === s.car) {
            s.stage = 2; s.t = 85;
            GTA.Player.addHeat(ctx, 1.6);
            ziel(ctx, 96, -116);
            if (GTA.UI) GTA.UI.showToast('AKT 2', 'Zum Hehler bei der Kirche!', '#ffd23c');
          }
        } else if (s.stage === 2) {
          s.t -= dt;
          if (ctx.player.car !== s.car) return M.fail(ctx, 'Du hast den Oldtimer stehen lassen.');
          var d = dist(ctx, 96, -116);
          text(this.name, 'Akt 2/3 · Wagen abliefern · ' + meter(d) + ' · ⏱ ' + U.fmtTime(s.t));
          if (s.t <= 0) return M.fail(ctx, 'Zu langsam — der Hehler ist weg.');
          if (d < 9 && Math.abs(ctx.player.speed) < 3) {
            s.stage = 3; s.t = 35;
            GTA.Player.exitCar(ctx);
            s.car.isMissionTarget = true;
            ctx.heat = Math.max(ctx.heat, 2.4);
            M.setTarget(ctx, null);
            if (GTA.UI) GTA.UI.showToast('AKT 3', 'Schüttel die Polizei ab!', '#ffd23c');
          }
        } else {
          s.t -= dt;
          text(this.name, 'Akt 3/3 · Fahndung überstehen · ⏱ ' + U.fmtTime(s.t));
          if (s.t <= 0) { ctx.heat = 0; return M.complete(ctx); }
        }
      },
      cleanup: function (ctx, s) {
        if (s.car) {
          if (ctx.player.car === s.car) GTA.Player.exitCar(ctx);
          U.removeFromScene(ctx.scene, s.car.mesh);
          var i = ctx.worldCars.indexOf(s.car);
          if (i >= 0) ctx.worldCars.splice(i, 1);
        }
      }
    },

    /* 8 */ {
      id: 'blitzer', name: 'Blitzer-Jagd', spot: GTA.CFG.MISSION_SPOTS[7], reward: 1400, needCar: true,
      giver: 'Der halbe Ort',
      brief: 'Ein mobiler Blitzer-Van kassiert die halbe Gemeinde ab. Ramm ihn dreimal von der Straße — er dreht seine Runden am Ring.',
      start: function (ctx, s) {
        var c = GTA.Traffic.addCar(ctx, GTA.Vehicles.build('van', 0xe8e8e8),
          GTA.Vehicles.byId('van'), 'parked');
        c.isMissionTarget = true;
        s.car = c;
        s.angle = Math.atan2(ctx.player.z, ctx.player.x) + 0.9;
        s.hits = 3; s.hitCd = 0; s.tempo = 16;
      },
      update: function (ctx, s, dt) {
        s.hitCd -= dt;
        s.angle += (s.tempo / CFG.RING_R) * dt;
        var x = Math.cos(s.angle) * CFG.RING_R, z = Math.sin(s.angle) * CFG.RING_R;
        s.car.mesh.position.set(x, 0, z);
        s.car.mesh.rotation.y = Math.atan2(-Math.sin(s.angle), Math.cos(s.angle));
        ziel(ctx, x, z);
        var d = dist(ctx, x, z);
        text(this.name, 'Blitzer-Van rammen · noch ' + s.hits + '× · ' + meter(d));

        var reich = s.car.params.radius + (ctx.player.car ? ctx.player.car.params.radius : 0.6) + 0.5;
        if (d < reich && s.hitCd <= 0 && Math.abs(ctx.player.speed) > 9) {
          s.hits--; s.hitCd = 1.6;
          s.tempo = Math.max(6, s.tempo - 4);
          ctx.player.speed *= 0.45;
          if (GTA.Audio) GTA.Audio.crash();
          GTA.Player.addHeat(ctx, 0.7);
          if (GTA.UI) GTA.UI.showToast('TREFFER!', s.hits > 0 ? 'Noch ' + s.hits + '×' : '', '#ffd23c');
          if (s.hits <= 0) return M.complete(ctx);
        }
      },
      cleanup: function (ctx, s) {
        if (s.car) {
          U.removeFromScene(ctx.scene, s.car.mesh);
          var i = ctx.worldCars.indexOf(s.car);
          if (i >= 0) ctx.worldCars.splice(i, 1);
        }
      }
    },

    /* 9 — spielt im Haus */
    {
      id: 'einbruch', name: 'Stille Nacht', spot: GTA.CFG.MISSION_SPOTS[8], reward: 1600, needCar: false,
      giver: 'Hehler Wastl',
      brief: 'In der Villa vom Bürgermeister liegt was, das ihm nicht gehört. Geh rein, hol die drei Wertsachen und verschwinde wieder.',
      start: function (ctx, s) {
        s.haus = haus(ctx, 'buero') || haus(ctx, 'bibliothek');
        if (!s.haus) { s.abbruch = true; return; }
        s.items = [];
        var arten = ['koffer', 'geld', 'werkzeug'];
        for (var i = 0; i < 3; i++) {
          var a = (i / 3) * Math.PI * 2;
          var ix = s.haus.x + Math.cos(a) * (s.haus.w * 0.24);
          var iz = s.haus.z + Math.sin(a) * (s.haus.d * 0.24);
          var it = GTA.Items.spawn(ctx, arten[i], ix, iz, 0.7, true);
          if (it) s.items.push(it);
        }
        s.phase = 1;
        ziel(ctx, s.haus.doorX, s.haus.doorZ);
        if (GTA.UI) GTA.UI.showToast('EINBRUCH', s.haus.name + ' — leise sein', '#ffd23c');
      },
      update: function (ctx, s, dt) {
        if (s.abbruch) return M.fail(ctx, 'Kein passendes Haus gefunden.');
        var offen = 0, naechstes = null;
        for (var i = 0; i < s.items.length; i++) {
          if (!s.items[i].taken) { offen++; if (!naechstes) naechstes = s.items[i]; }
        }
        if (s.phase === 1) {
          if (offen === 0) {
            s.phase = 2;
            ziel(ctx, s.haus.doorX, s.haus.doorZ);
            GTA.Player.addHeat(ctx, 1.2);
            if (GTA.UI) GTA.UI.showToast('ALLES EINGESACKT', 'Jetzt raus hier!', '#ffd23c');
          } else {
            ziel(ctx, naechstes.x, naechstes.z);
            text(this.name, 'Im ' + s.haus.name + ' · noch ' + offen + ' Wertsachen');
          }
        } else {
          var d = dist(ctx, s.haus.doorX, s.haus.doorZ);
          text(this.name, 'Raus aus dem Haus · ' + meter(d));
          if (ctx.player.interiorId === null && d > 6) return M.complete(ctx);
        }
      },
      cleanup: function (ctx, s) {
        if (!s.items) return;
        for (var i = 0; i < s.items.length; i++) {
          if (!s.items[i].taken) GTA.Items.remove(ctx, s.items[i]);
        }
      }
    },

    /* 10 — spielt im Haus */
    {
      id: 'werkstatt', name: 'Das fehlende Werkzeug', spot: GTA.CFG.MISSION_SPOTS[9], reward: 1100, needCar: false,
      giver: 'Mechaniker Poldi',
      brief: 'Jemand hat mir das Werkzeug aus der Werkstatt getragen. Ich weiß auch, wer: die zwei Halbstarken. Hol\'s zurück.',
      start: function (ctx, s) {
        s.haus = haus(ctx, 'werkstatt') || haus(ctx, 'garage');
        if (!s.haus) { s.abbruch = true; return; }
        s.wachen = [
          GTA.NPCs.spawnEnemy(ctx, s.haus.doorX + 4, s.haus.doorZ + 3, 6),
          GTA.NPCs.spawnEnemy(ctx, s.haus.doorX - 4, s.haus.doorZ + 3, 6)
        ];
        s.item = GTA.Items.spawn(ctx, 'werkzeug', s.haus.x, s.haus.z, 0.7, true);
        s.phase = 1;
        ziel(ctx, s.haus.doorX, s.haus.doorZ);
      },
      update: function (ctx, s, dt) {
        if (s.abbruch) return M.fail(ctx, 'Keine Werkstatt gefunden.');
        var wach = 0;
        for (var i = 0; i < s.wachen.length; i++) {
          if (!s.wachen[i].dead && s.wachen[i].state !== 'down') wach++;
        }
        if (s.phase === 1) {
          if (wach > 0) {
            text(this.name, 'Die Wachen vor der Werkstatt · noch ' + wach);
            ziel(ctx, s.haus.doorX, s.haus.doorZ);
          } else {
            s.phase = 2;
            if (GTA.UI) GTA.UI.showToast('LUFT IST REIN', 'Hol das Werkzeug', '#2ecc71');
          }
        } else if (s.phase === 2) {
          if (s.item && s.item.taken) {
            s.phase = 3;
            ziel(ctx, this.spot[0], this.spot[1]);
            if (GTA.UI) GTA.UI.showToast('WERKZEUG GEFUNDEN', 'Zurück zu Poldi', '#ffd23c');
          } else {
            ziel(ctx, s.haus.x, s.haus.z);
            text(this.name, 'Werkzeugkasten im ' + s.haus.name + ' holen');
          }
        } else {
          var d = dist(ctx, this.spot[0], this.spot[1]);
          text(this.name, 'Zurück zu Poldi · ' + meter(d));
          if (d < 5) return M.complete(ctx);
        }
      },
      cleanup: function (ctx, s) {
        if (s.wachen) {
          for (var i = 0; i < s.wachen.length; i++) {
            if (!s.wachen[i].dead) GTA.NPCs.remove(ctx, s.wachen[i]);
          }
        }
        if (s.item && !s.item.taken) GTA.Items.remove(ctx, s.item);
      }
    },

    /* 11 — Sammelauftrag */
    {
      id: 'edelweiss', name: 'Fünf Edelweiß', spot: GTA.CFG.MISSION_SPOTS[10], reward: 1300, needCar: false,
      giver: 'Botanikerin Dr. Falk',
      brief: 'Ich brauche fünf Edelweiß für meine Sammlung. Sie wachsen weit draußen an den Hängen. Zehn Minuten hast du.',
      start: function (ctx, s) {
        s.start = ctx.player.stats.collected.edelweiss || 0;
        s.t = 600;
        s.naechstes = null;
      },
      update: function (ctx, s, dt) {
        s.t -= dt;
        var jetzt = ctx.player.stats.collected.edelweiss || 0;
        var haben = jetzt - s.start;
        if (s.t <= 0) return M.fail(ctx, 'Die Zeit ist um.');
        if (haben >= 5) return M.complete(ctx);

        // Zum nächsten noch vorhandenen Edelweiß führen
        var best = null, bd = 99999;
        for (var i = 0; i < ctx.items.length; i++) {
          var it = ctx.items[i];
          if (it.type !== 'edelweiss' || it.taken) continue;
          var d = dist(ctx, it.x, it.z);
          if (d < bd) { bd = d; best = it; }
        }
        if (best) ziel(ctx, best.x, best.z); else M.setTarget(ctx, null);
        text(this.name, 'Edelweiß pflücken · ' + haben + '/5 · ⏱ ' + U.fmtTime(s.t) +
          (best ? ' · nächstes ' + meter(bd) : ''));
      }
    },

    /* 12 — Rettungsfahrt */
    {
      id: 'rettung', name: 'Rettungsfahrt', spot: GTA.CFG.MISSION_SPOTS[11], reward: 1500, needCar: true,
      giver: 'Sanitäter Andi',
      brief: 'Ein Wanderer ist am Hang gestürzt. Fahr hin, dann so schnell wie möglich zur Kirche — dort wartet der Arzt. Und fahr vorsichtig, sonst wird\'s schlimmer.',
      start: function (ctx, s) {
        var a = U.rand(0, Math.PI * 2);
        s.px = Math.cos(a) * 380;
        s.pz = Math.sin(a) * 380;
        s.phase = 1;
        s.zustand = 100;
        ziel(ctx, s.px, s.pz);
        if (GTA.UI) GTA.UI.showToast('NOTRUF', 'Verletzten abholen', '#ff5544');
      },
      update: function (ctx, s, dt) {
        if (!ctx.player.car) return M.fail(ctx, 'Ohne Fahrzeug geht das nicht.');
        if (s.phase === 1) {
          var d = dist(ctx, s.px, s.pz);
          text(this.name, 'Verletzten abholen · ' + meter(d));
          if (d < 8 && Math.abs(ctx.player.speed) < 4) {
            s.phase = 2;
            ziel(ctx, 96, -116);
            if (GTA.UI) GTA.UI.showToast('EINGELADEN', 'Jetzt zum Arzt — vorsichtig!', '#ffd23c');
          }
        } else {
          // Harte Stöße verschlechtern den Zustand des Verletzten
          if (Math.abs(ctx.player.speed) > 24) s.zustand -= dt * 3.5;
          s.zustand -= dt * 1.6;
          var d2 = dist(ctx, 96, -116);
          text(this.name, 'Zur Kirche · ' + meter(d2) + ' · Zustand ' + Math.max(0, Math.round(s.zustand)) + '%');
          if (s.zustand <= 0) return M.fail(ctx, 'Der Verletzte hat es nicht geschafft.');
          if (d2 < 9 && Math.abs(ctx.player.speed) < 4) return M.complete(ctx);
        }
      }
    }
  ];

  /* ============================================================
     Zielmarkierung
     ============================================================ */
  M.setTarget = function (ctx, x, z) {
    if (x === null || x === undefined) {
      M.targetPos = null;
      if (beam) beam.visible = false;
      if (pfeil) pfeil.visible = false;
      return;
    }
    M.targetPos = { x: x, z: z };
    if (beam) { beam.position.set(x, 16, z); beam.visible = true; }
    if (pfeil) pfeil.visible = true;
  };

  /* ============================================================
     Aufbau
     ============================================================ */
  M.build = function (ctx) {
    ensure();

    beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 32, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x35e07a, transparent: true, opacity: 0.34,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    beam.position.y = 16;
    beam.visible = false;
    ctx.scene.add(beam);

    pfeil = new THREE.Group();
    var kegel = new THREE.Mesh(
      new THREE.ConeGeometry(0.38, 0.95, 7),
      new THREE.MeshBasicMaterial({ color: 0x35e07a })
    );
    kegel.rotation.x = Math.PI / 2;
    kegel.position.z = 0.6;
    pfeil.add(kegel);
    pfeil.visible = false;
    ctx.scene.add(pfeil);

    var markerMat = new THREE.MeshBasicMaterial({
      color: 0xffd23c, transparent: true, opacity: 0.32,
      side: THREE.DoubleSide, depthWrite: false
    });
    marker.length = 0;
    for (var i = 0; i < M.LIST.length; i++) {
      var def = M.LIST[i];
      var g = new THREE.Group();
      var saeule = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 5.5, 16, 1, true), markerMat);
      saeule.position.y = 2.75;
      g.add(saeule);
      var spitze = new THREE.Mesh(
        new THREE.ConeGeometry(0.62, 1.15, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd23c })
      );
      spitze.position.y = 6.4;
      spitze.rotation.x = Math.PI;
      g.add(spitze);
      g.position.set(def.spot[0], 0, def.spot[1]);
      ctx.scene.add(g);
      marker.push({ group: g, spitze: spitze, def: def, drin: false });
    }
    return marker;
  };

  /* ============================================================
     Ablauf
     ============================================================ */
  M.start = function (ctx, def) {
    if (ctx.mission) return false;
    if (def.needCar && !ctx.player.car) {
      if (GTA.UI) GTA.UI.showToast('DU BRAUCHST EIN FAHRZEUG', 'Komm mit Auto oder Motorrad wieder', '#ffd23c');
      return false;
    }
    ctx.mission = { def: def, s: {} };
    def.start.call(def, ctx, ctx.mission.s);
    if (GTA.Audio) GTA.Audio.jingle();
    for (var i = 0; i < marker.length; i++) marker[i].group.visible = false;
    return true;
  };

  function beenden(ctx) {
    var m = ctx.mission;
    if (m) {
      if (m.s.targets) {
        for (var i = 0; i < m.s.targets.length; i++) {
          var t = m.s.targets[i];
          if (t && !t.dead) GTA.NPCs.remove(ctx, t);
        }
      }
      if (m.def.cleanup) m.def.cleanup.call(m.def, ctx, m.s);
    }
    ctx.mission = null;
    M.setTarget(ctx, null);
    if (GTA.UI) GTA.UI.setObjective(null);
    for (var k = 0; k < marker.length; k++) {
      marker[k].group.visible = true;
      // Wer nach dem Ende noch in der Säule steht, soll nicht sofort
      // wieder das Auftragsfenster ins Gesicht bekommen — erst rausgehen.
      var dd = U.dist2d(ctx.player.x, ctx.player.z, marker[k].def.spot[0], marker[k].def.spot[1]);
      marker[k].drin = (dd < 3.8);
    }
  }

  M.complete = function (ctx) {
    var m = ctx.mission;
    if (!m) return;
    var def = m.def;
    var wiederholt = ctx.player.stats.missionsDone[def.id] || 0;
    var lohn = wiederholt ? Math.round(def.reward * 0.5) : def.reward;
    ctx.player.money += lohn;
    ctx.player.stats.missionsDone[def.id] = wiederholt + 1;
    GTA.Player.saveNow(ctx);
    if (GTA.UI) GTA.UI.showToast('AUFTRAG ERLEDIGT', '+' + U.fmtMoney(lohn), '#2ecc71');
    if (GTA.Audio) { GTA.Audio.cash(); GTA.Audio.jingle(); }
    beenden(ctx);
  };

  M.fail = function (ctx, grund) {
    if (!ctx.mission) return;
    if (GTA.UI) GTA.UI.showToast('AUFTRAG GESCHEITERT', grund || '', '#ff5544');
    if (GTA.Audio) GTA.Audio.fail();
    beenden(ctx);
  };

  M.update = function (ctx, dt) {
    ensure();

    // Marker drehen und wippen
    for (var i = 0; i < marker.length; i++) {
      var mk = marker[i];
      if (!mk.group.visible) continue;
      mk.spitze.rotation.y += dt * 2;
      mk.spitze.position.y = 6.4 + Math.sin(ctx.elapsed * 2 + i) * 0.26;
    }

    // Richtungspfeil über dem Spieler
    if (M.targetPos && pfeil) {
      var p = ctx.player;
      pfeil.position.set(p.x, 2.7 + Math.sin(ctx.elapsed * 3) * 0.14, p.z);
      pfeil.rotation.y = Math.atan2(M.targetPos.x - p.x, M.targetPos.z - p.z);
    }

    if (ctx.mission) {
      ctx.mission.def.update.call(ctx.mission.def, ctx, ctx.mission.s, dt);
      return;
    }

    // Steht der Spieler in einem Marker?
    if (GTA.UI && GTA.UI.isModalOpen && GTA.UI.isModalOpen()) return;
    for (var k = 0; k < marker.length; k++) {
      var m = marker[k];
      var d = U.dist2d(ctx.player.x, ctx.player.z, m.def.spot[0], m.def.spot[1]);
      if (d < 3.8) {
        if (!m.drin) {
          m.drin = true;
          if (GTA.UI) GTA.UI.showBriefing(ctx, m.def);
        }
      } else {
        m.drin = false;
      }
    }
  };

  M.byId = function (id) {
    for (var i = 0; i < M.LIST.length; i++) if (M.LIST[i].id === id) return M.LIST[i];
    return null;
  };

  return M;
})();
