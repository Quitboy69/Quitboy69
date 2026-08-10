'use strict';
/* ============================================================
   main.js — Aufbau, Interaktion, Hauptschleife
   Lädt zuletzt. Definiert GTA.Game.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Game = (function () {
  var G = {};
  var ctx = null;
  var last = 0, hudT = 0, fixT = 0, running = false, started = false;

  /* ---------------- Fehleranzeige ---------------- */
  function fatal(title, err) {
    console.error('[GTA]', title, err);
    var box = document.getElementById('fatal');
    if (!box) return;
    box.className = 'on';
    box.innerHTML = '';
    var h = document.createElement('h2');
    h.textContent = title;
    var pre = document.createElement('pre');
    pre.textContent = (err && err.stack) ? err.stack : String(err);
    var hint = document.createElement('div');
    hint.className = 'tiny';
    hint.textContent = 'Bei Grafikproblemen: GTA_SOFTWARE_GL=1 vor dem Start setzen.';
    box.appendChild(h); box.appendChild(pre); box.appendChild(hint);
  }

  /* ---------------- Aufbau ---------------- */
  G.init = function () {
    var gfxIndex = 0;
    try {
      var stored = localStorage.getItem('gta_alpen_gfx');
      if (stored !== null) gfxIndex = Math.max(0, Math.min(GTA.CFG.GFX_LEVELS.length - 1, parseInt(stored, 10) || 0));
    } catch (e) {}

    var gfx = GTA.CFG.GFX_LEVELS[gfxIndex];

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      fatal('WebGL konnte nicht gestartet werden', e);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, gfx.px));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = gfx.softShadow ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    document.body.insertBefore(renderer.domElement, document.body.firstChild);

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xcfe6f5, 180, gfx.fogFar);
    var camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(0, 6, -12);

    ctx = {
      scene: scene, camera: camera, renderer: renderer,
      gfx: gfx, gfxIndex: gfxIndex,
      obstacles: [], walls: [],
      worldCars: [], npcs: [], items: [], interiors: [], copCars: [],
      player: null, elapsed: 0, heat: 0,
      activeInterior: null, mission: null,
      paused: false
    };
    GTA.ctx = ctx;

    GTA.TEX.init(renderer, gfx);

    // Reihenfolge ist wichtig: erst Gebäude (setzen Wände), dann Vegetation,
    // damit keine Bäume in Häusern wachsen.
    GTA.World.build(ctx);
    if (GTA.Buildings && GTA.Buildings.build) GTA.Buildings.build(ctx);
    GTA.World.buildVegetation(ctx);

    return GTA.Player.load().then(function (saved) {
      if (saved && typeof saved.gfx === 'number' && saved.gfx !== gfxIndex) {
        // Grafikwunsch aus dem Spielstand übernehmen
        G.setGfx(saved.gfx, true);
      }
      GTA.Player.create(ctx, saved);

      if (GTA.Traffic) { GTA.Traffic.placeOwnCar(ctx); GTA.Traffic.build(ctx); }
      if (GTA.NPCs && GTA.NPCs.build) GTA.NPCs.build(ctx);
      if (GTA.Items && GTA.Items.build) GTA.Items.build(ctx);
      if (GTA.Missions && GTA.Missions.build) GTA.Missions.build(ctx);
      if (GTA.UI && GTA.UI.init) GTA.UI.init(ctx);
      GTA.Input.init(ctx);

      // Farbraum aller erzeugten Materialien geraderücken (siehe U.fixMaterial).
      GTA.U.fixMaterials(ctx.scene);

      window.addEventListener('resize', G.onResize);
      G.setupSplash();
      running = true;
      last = performance.now();
      requestAnimationFrame(G.loop);
      return ctx;
    });
  };

  G.onResize = function () {
    if (!ctx) return;
    ctx.renderer.setSize(window.innerWidth, window.innerHeight);
    ctx.camera.aspect = window.innerWidth / window.innerHeight;
    ctx.camera.updateProjectionMatrix();
  };

  /* ---------------- Grafikstufe ---------------- */
  G.setGfx = function (index, silent) {
    if (!ctx) return;
    index = Math.max(0, Math.min(GTA.CFG.GFX_LEVELS.length - 1, index));
    ctx.gfxIndex = index;
    ctx.gfx = GTA.CFG.GFX_LEVELS[index];
    ctx.renderer.setPixelRatio(Math.min(window.devicePixelRatio, ctx.gfx.px));
    ctx.renderer.setSize(window.innerWidth, window.innerHeight);
    ctx.renderer.shadowMap.type = ctx.gfx.softShadow ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    ctx.scene.fog.far = ctx.gfx.fogFar;
    GTA.World.applyGfx(ctx);
    GTA.TEX.applyAniso(ctx.renderer, ctx.gfx);
    try { localStorage.setItem('gta_alpen_gfx', String(index)); } catch (e) {}
    if (!silent && GTA.UI) GTA.UI.showToast('GRAFIK: ' + ctx.gfx.name, '', '#8ed1ff');
  };

  /* ---------------- Startbildschirm ---------------- */
  G.setupSplash = function () {
    var splash = document.getElementById('splash');
    var btn = document.getElementById('splashStart');
    var note = document.getElementById('splashNote');
    if (note) {
      note.textContent = window.gtaNative
        ? 'Nativer Linux-Build · Spielstand im Nutzerprofil'
        : 'Browser-Modus · Spielstand im lokalen Speicher';
    }
    function go() {
      if (started) return;
      started = true;
      if (splash) splash.classList.add('hide');
      setTimeout(function () { if (splash) splash.style.display = 'none'; }, 500);
      GTA.Audio.init();
      GTA.Input.requestLock(ctx);
    }
    if (btn) btn.addEventListener('click', go);
    if (splash) splash.addEventListener('click', function (e) {
      if (e.target === splash) go();
    });
    window.addEventListener('keydown', function (e) {
      if (!started && (e.code === 'Enter' || e.code === 'Space')) go();
    });
  };

  /* ============================================================
     INTERAKTION — bestimmt, was [E] und [F] gerade tun
     ============================================================ */
  function bestInteraction() {
    var p = ctx.player;

    if (p.car) {
      var name = p.car.isOwn && GTA.Vehicles
        ? (GTA.Vehicles.byId(p.ownedVehicle) || {}).name
        : p.car.params.name;
      return { key: 'E', text: (name || 'Fahrzeug') + ' verlassen', act: 'exit' };
    }

    // 1) Fahrzeug in Reichweite
    var car = GTA.Player.nearestCar(ctx, 4.2);
    var carD = car ? GTA.U.dist2d(p.x, p.z, car.mesh.position.x, car.mesh.position.z) : 99;

    // 2) NPC zum Reden
    var npc = (GTA.NPCs && GTA.NPCs.nearestTalkable) ? GTA.NPCs.nearestTalkable(ctx, 3.2) : null;
    var npcD = npc ? GTA.U.dist2d(p.x, p.z, npc.x, npc.z) : 99;

    // 3) Haustür
    var door = null, doorD = 99;
    for (var i = 0; i < ctx.interiors.length; i++) {
      var it = ctx.interiors[i];
      if (it.doorX === undefined) continue;
      var d = GTA.U.dist2d(p.x, p.z, it.doorX, it.doorZ);
      if (d < 3.4 && d < doorD) { doorD = d; door = it; }
    }

    if (car && carD <= npcD && carD <= doorD) {
      var vn = car.isOwn && GTA.Vehicles
        ? (GTA.Vehicles.byId(p.ownedVehicle) || {}).name
        : car.params.name;
      var verb = (car.kind === 'traffic') ? ' kurzschließen' : ' einsteigen';
      return { key: 'E', text: (vn || 'Fahrzeug') + verb, act: 'enter', car: car };
    }
    if (npc && npcD <= doorD) {
      return { key: 'E', text: 'Mit ' + (npc.displayName || 'jemandem') + ' reden', act: 'talk', npc: npc };
    }
    if (door) {
      var drin = (p.interiorId === door.id);
      return {
        key: 'E',
        text: drin ? (door.name || 'Haus') + ' verlassen' : (door.name || 'Haus') + ' betreten',
        act: 'door', door: door
      };
    }
    return null;
  }

  function handleInteraction(inter) {
    if (!inter) return;
    var p = ctx.player;
    if (inter.act === 'exit') GTA.Player.exitCar(ctx);
    else if (inter.act === 'enter') GTA.Player.enterCar(ctx, inter.car);
    else if (inter.act === 'talk' && GTA.NPCs && GTA.NPCs.talkTo) GTA.NPCs.talkTo(ctx, inter.npc);
    else if (inter.act === 'door') {
      // Durch die Tür schieben — bequemer als exakt durch die Lücke zu zielen.
      var it = inter.door;
      var drin = (p.interiorId === it.id);
      var toCx = it.x - it.doorX, toCz = it.z - it.doorZ;
      var len = Math.hypot(toCx, toCz) || 1;
      var step = drin ? -2.4 : 2.4;
      p.x = it.doorX + (toCx / len) * step;
      p.z = it.doorZ + (toCz / len) * step;
      GTA.Player.updateInterior(ctx);
    }
  }

  /* ---------------- Hauptschleife ---------------- */
  G.loop = function (t) {
    requestAnimationFrame(G.loop);
    if (!running || !ctx) return;

    var dt = (t - last) / 1000;
    last = t;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;

    var modal = (GTA.UI && GTA.UI.isModalOpen) ? GTA.UI.isModalOpen() : false;
    document.body.classList.toggle('modal', modal);

    if (!modal && started) {
      ctx.elapsed += dt;
      GTA.Input.update(dt);

      // --- Einmalige Tasten ---
      var inter = bestInteraction();
      if (GTA.Input.consumePressed('interact')) handleInteraction(inter);

      if (GTA.Input.consumePressed('pickup') && GTA.Items && GTA.Items.collectNearest) {
        GTA.Items.collectNearest(ctx);
      }
      if (GTA.Input.consumePressed('reload') && GTA.Weapons && GTA.Weapons.reload) {
        GTA.Weapons.reload(ctx);
      }
      if (GTA.Input.consumePressed('weaponNext') && GTA.Weapons && GTA.Weapons.cycle) {
        GTA.Weapons.cycle(ctx, 1);
      }
      if (GTA.Input.consumePressed('weaponPrev') && GTA.Weapons && GTA.Weapons.cycle) {
        GTA.Weapons.cycle(ctx, -1);
      }
      for (var n = 1; n <= 9; n++) {
        if (GTA.Input.consumePressed('weapon' + n) && GTA.Weapons && GTA.Weapons.selectSlot) {
          GTA.Weapons.selectSlot(ctx, n - 1);
        }
      }
      if (GTA.Input.consumePressed('attackOnce') && GTA.Weapons && GTA.Weapons.attack) {
        if (!ctx.player.car) GTA.Weapons.attack(ctx, ctx.player.weapon);
      }
      // Dauerfeuer für automatische Waffen
      if (GTA.Input.actions.attack && !ctx.player.car && GTA.Weapons && GTA.Weapons.attackAuto) {
        GTA.Weapons.attackAuto(ctx);
      }
      if (GTA.Input.consumePressed('gfx')) G.setGfx((ctx.gfxIndex + 1) % GTA.CFG.GFX_LEVELS.length);
      if (GTA.Input.consumePressed('fullscreen')) G.toggleFullscreen();

      // --- Simulation ---
      GTA.Player.update(ctx, dt);
      if (GTA.Weapons && GTA.Weapons.update) GTA.Weapons.update(ctx, dt);
      if (GTA.NPCs && GTA.NPCs.update) GTA.NPCs.update(ctx, dt);
      if (GTA.Traffic) { GTA.Traffic.update(ctx, dt); GTA.Traffic.updateCopCars(ctx, dt); }
      if (GTA.Items && GTA.Items.update) GTA.Items.update(ctx, dt);
      if (GTA.Buildings && GTA.Buildings.update) GTA.Buildings.update(ctx, dt);
      if (GTA.Missions && GTA.Missions.update) GTA.Missions.update(ctx, dt);
      GTA.Player.updateWanted(ctx, dt);
      GTA.World.update(ctx, dt);
      GTA.Player.updateCamera(ctx, dt);
      GTA.Audio.updateEngine(ctx);

      // --- Hinweis unten anzeigen ---
      if (GTA.UI) {
        var itemHint = (GTA.Items && GTA.Items.hintFor) ? GTA.Items.hintFor(ctx) : null;
        if (itemHint) GTA.UI.showPrompt('<span class="key">F</span>' + itemHint);
        else if (inter) GTA.UI.showPrompt('<span class="key">' + inter.key + '</span>' + inter.text);
        else GTA.UI.hidePrompt();
      }
    } else {
      // Im Menü: nur Kamera weich nachziehen, Motor leise stellen
      GTA.Audio.updateEngine(ctx);
    }

    // Menütasten funktionieren auch im Menü
    if (GTA.Input.consumePressed('pause') && GTA.UI && GTA.UI.togglePause) GTA.UI.togglePause(ctx);
    if (GTA.Input.consumePressed('map') && GTA.UI && GTA.UI.toggleMap) GTA.UI.toggleMap(ctx);
    if (GTA.Input.consumePressed('garage') && GTA.UI && GTA.UI.toggleGarage) GTA.UI.toggleGarage(ctx);

    hudT += dt;
    if (hudT > 0.08) {
      hudT = 0;
      if (GTA.UI && GTA.UI.updateHud) GTA.UI.updateHud(ctx);
    }

    // Nachzügler beim Farbraum einfangen: alles, was nach dem Aufbau
    // entsteht (Passanten, Gegenstände, Streifenwagen). Bereits behandelte
    // Materialien werden übersprungen, der Durchlauf kostet daher fast nichts.
    fixT += dt;
    if (fixT > 2) { fixT = 0; GTA.U.fixMaterials(ctx.scene); }

    try {
      ctx.renderer.render(ctx.scene, ctx.camera);
    } catch (e) {
      running = false;
      fatal('Fehler beim Zeichnen', e);
    }
  };

  G.toggleFullscreen = function () {
    if (window.gtaNative && window.gtaNative.toggleFullscreen) {
      window.gtaNative.toggleFullscreen();
      return;
    }
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  G.getCtx = function () { return ctx; };

  return G;
})();

/* ---------------- Start ---------------- */
window.addEventListener('DOMContentLoaded', function () {
  if (typeof THREE === 'undefined') {
    var box = document.getElementById('fatal');
    if (box) {
      box.className = 'on';
      box.innerHTML = '<h2>three.js fehlt</h2><pre>src/vendor/three.min.js konnte nicht geladen werden.</pre>';
    }
    return;
  }
  try {
    var r = GTA.Game.init();
    if (r && r.catch) r.catch(function (e) { console.error('[GTA] Startfehler', e); });
  } catch (e) {
    console.error('[GTA] Startfehler', e);
    var b = document.getElementById('fatal');
    if (b) {
      b.className = 'on';
      b.innerHTML = '<h2>Startfehler</h2><pre>' + (e.stack || e) + '</pre>';
    }
  }
});
