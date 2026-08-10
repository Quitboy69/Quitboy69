'use strict';
/* ============================================================
   ui.js — HUD, Minikarte, Hinweise, Garage, Pause, Karte
   Abhängig von: config.js, util.js, characters.js, vehicles.js,
                 weapons.js, player.js, audio.js. Definiert GTA.UI.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.UI = (function () {
  var UI = {};
  var U, CFG;
  var el = {};
  var toastT = null, speechT = null, hurtT = null;
  var offen = { garage: false, briefing: false, pause: false, karte: false };
  var briefDef = null;
  var ctxRef = null;
  var promptZuletzt = '';

  function ensure() { U = GTA.U; CFG = GTA.CFG; }
  function $(id) { return document.getElementById(id); }

  /* ============================================================
     1. Aufbau
     ============================================================ */
  UI.init = function (ctx) {
    ensure();
    ctxRef = ctx;
    [
      'hudMoney', 'hudHp', 'hudHpFill', 'hudArmorFill', 'hudWanted',
      'hudVehName', 'hudVehDot', 'hudWeapon', 'hudAmmo', 'hudWeaponIcon',
      'hudSpeed', 'hudSpeedWrap', 'hudObjective', 'hudObjName', 'hudObjText',
      'minimap', 'prompt', 'toast', 'speech', 'briefing', 'bName', 'bText',
      'bReward', 'bStart', 'bLater', 'garage', 'gMoney', 'gCards', 'gWeapons',
      'gChar', 'closeGarage', 'pauseMenu', 'pauseRows', 'pauseResume',
      'mapOverlay', 'mapCanvas', 'mapLegend', 'crosshair', 'hurtFlash'
    ].forEach(function (id) { el[id] = $(id); });

    if (el.minimap) UI.mapCtx = el.minimap.getContext('2d');
    if (el.mapCanvas) UI.bigMapCtx = el.mapCanvas.getContext('2d');

    if (el.closeGarage) el.closeGarage.addEventListener('click', function () { UI.closeGarage(); });
    if (el.bLater) el.bLater.addEventListener('click', function () { UI.hideBriefing(); });
    if (el.bStart) el.bStart.addEventListener('click', function () {
      var d = briefDef;
      UI.hideBriefing();
      if (d && GTA.Missions && GTA.Missions.start) GTA.Missions.start(ctx, d);
    });
    if (el.pauseResume) el.pauseResume.addEventListener('click', function () { UI.togglePause(ctx); });
    if (el.mapOverlay) el.mapOverlay.addEventListener('click', function (e) {
      if (e.target === el.mapOverlay) UI.toggleMap(ctx);
    });

    // Reiter in der Garage
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        var name = this.getAttribute('data-tab');
        var alle = document.querySelectorAll('.tab');
        for (var k = 0; k < alle.length; k++) alle[k].classList.remove('active');
        this.classList.add('active');
        var panes = { cars: 'gCars', weapons: 'gWeap', char: 'gCharPane' };
        for (var p in panes) {
          var pane = $(panes[p]);
          if (pane) pane.classList.toggle('active', p === name);
        }
      });
    }

    UI.buildPauseMenu(ctx);
    if (el.mapLegend) {
      el.mapLegend.innerHTML =
        '<span style="color:#ffd23c">■ Auftrag</span>' +
        '<span style="color:#35e07a">■ Ziel</span>' +
        '<span style="color:#8ed1ff">■ Haus</span>' +
        '<span style="color:#ff5544">■ Polizei</span>' +
        '<span style="color:#fff">▲ Du</span>';
    }
  };

  UI.isModalOpen = function () {
    return offen.garage || offen.briefing || offen.pause || offen.karte;
  };

  /* ============================================================
     2. Meldungen
     ============================================================ */
  UI.showToast = function (main, sub, farbe) {
    if (!el.toast) return;
    el.toast.innerHTML =
      '<span style="color:' + (farbe || '#fff') + '">' + main + '</span>' +
      (sub ? '<span class="sub">' + sub + '</span>' : '');
    el.toast.classList.add('on');
    if (toastT) clearTimeout(toastT);
    toastT = setTimeout(function () { el.toast.classList.remove('on'); }, 2300);
  };

  UI.showSpeech = function (ctx, npc, text) {
    if (!el.speech) return;
    el.speech.innerHTML = '<b>' + (npc.displayName || 'Jemand') + '</b>' + text;
    el.speech.classList.add('on');
    if (speechT) clearTimeout(speechT);
    speechT = setTimeout(function () { el.speech.classList.remove('on'); }, 4200);
  };

  UI.flashHurt = function () {
    if (!el.hurtFlash) return;
    el.hurtFlash.classList.add('on');
    if (hurtT) clearTimeout(hurtT);
    hurtT = setTimeout(function () { el.hurtFlash.classList.remove('on'); }, 90);
  };

  UI.showPrompt = function (html) {
    if (!el.prompt) return;
    if (html === promptZuletzt) return;      // spart DOM-Arbeit pro Frame
    promptZuletzt = html;
    el.prompt.innerHTML = html;
    el.prompt.classList.add('on');
  };

  UI.hidePrompt = function () {
    if (!el.prompt) return;
    if (promptZuletzt === '') return;
    promptZuletzt = '';
    el.prompt.classList.remove('on');
  };

  UI.setObjective = function (name, text) {
    if (!el.hudObjective) return;
    if (!name) { el.hudObjective.classList.remove('on'); return; }
    el.hudObjective.classList.add('on');
    el.hudObjName.textContent = String(name).toUpperCase();
    el.hudObjText.innerHTML = text || '';
  };

  /* ============================================================
     3. Briefing
     ============================================================ */
  UI.showBriefing = function (ctx, def) {
    if (!el.briefing) return;
    briefDef = def;
    offen.briefing = true;
    el.bName.textContent = def.name;
    el.bText.textContent = def.brief + (def.needCar ? '  (Fahrzeug nötig!)' : '');
    var wiederholt = ctx.player.stats.missionsDone[def.id] || 0;
    var lohn = wiederholt ? Math.round(def.reward * 0.5) : def.reward;
    el.bReward.textContent = 'Lohn: ' + U.fmtMoney(lohn) +
      (wiederholt ? '  (Wiederholung, ' + wiederholt + '× erledigt)' : '');
    el.briefing.classList.add('on');
    if (GTA.Input) GTA.Input.releaseLock();
  };

  UI.hideBriefing = function () {
    if (!el.briefing) return;
    offen.briefing = false;
    briefDef = null;
    el.briefing.classList.remove('on');
    if (GTA.Input && ctxRef) GTA.Input.requestLock(ctxRef);
  };

  /* ============================================================
     4. Garage
     ============================================================ */
  UI.toggleGarage = function (ctx) {
    if (offen.garage) UI.closeGarage(); else UI.openGarage(ctx);
  };

  UI.openGarage = function (ctx) {
    if (offen.briefing || offen.pause) return;
    offen.garage = true;
    UI.renderGarage(ctx);
    if (el.garage) el.garage.classList.add('on');
    if (GTA.Input) GTA.Input.releaseLock();
  };

  UI.closeGarage = function () {
    offen.garage = false;
    if (el.garage) el.garage.classList.remove('on');
    if (GTA.Input && ctxRef) GTA.Input.requestLock(ctxRef);
  };

  function balken(wert, max) {
    return '<div class="mini"><i style="width:' +
      Math.round(Math.max(0, Math.min(1, wert / max)) * 100) + '%"></i></div>';
  }

  function renderFahrzeuge(ctx) {
    if (!el.gCards) return;
    var p = ctx.player;
    var V = GTA.Vehicles;
    var html = '';
    var maxKmh = 300, maxAcc = 34;

    for (var i = 0; i < V.CATALOG.length; i++) {
      var v = V.CATALOG[i];
      var hat = !!p.owned[v.id];
      var gewaehlt = (p.ownedVehicle === v.id);
      var leistbar = p.money >= v.price;
      var klass = 'vcard' + (gewaehlt ? ' active' : '') + (hat ? '' : ' locked');
      var preisKlass = hat ? 'price owned' : (leistbar ? 'price' : 'price cant');
      var preisText = hat ? (gewaehlt ? 'AUSGEWÄHLT' : 'AUSWÄHLEN') : U.fmtMoney(v.price);
      html +=
        '<div class="' + klass + '" data-veh="' + v.id + '">' +
        '<div class="swatch" style="background:linear-gradient(160deg,' + U.hexCss(v.color) + ',rgba(0,0,0,.55))">' +
        (v.cls === 'bike' ? '🏍' : '🚗') + '</div>' +
        '<h4>' + v.name + '</h4><div class="desc">' + v.desc + '</div>' +
        '<div class="bl">TEMPO · ' + v.kmh + ' KM/H</div>' + balken(v.kmh, maxKmh) +
        '<div class="bl">BESCHLEUNIGUNG</div>' + balken(v.accel, maxAcc) +
        '<div class="bl">GELÄNDE</div>' + balken(v.offGrip, 1.2) +
        '<div class="' + preisKlass + '">' + preisText + '</div></div>';
    }
    el.gCards.innerHTML = html;

    var karten = el.gCards.querySelectorAll('.vcard');
    for (var k = 0; k < karten.length; k++) {
      karten[k].addEventListener('click', function () {
        UI.pickVehicle(ctx, this.getAttribute('data-veh'));
      });
    }
  }

  UI.pickVehicle = function (ctx, id) {
    var p = ctx.player;
    var v = GTA.Vehicles.byId(id);
    if (!v) return;
    if (!p.owned[id]) {
      if (p.money < v.price) {
        UI.showToast('ZU WENIG GELD', 'Mach Aufträge!', '#ff5544');
        return;
      }
      p.money -= v.price;
      p.owned[id] = true;
      if (GTA.Audio) GTA.Audio.cash();
      UI.showToast(v.name.toUpperCase() + ' GEKAUFT', '', '#2ecc71');
    }
    p.ownedVehicle = id;
    if (GTA.Traffic && GTA.Traffic.replaceOwnCar) GTA.Traffic.replaceOwnCar(ctx, id);
    GTA.Player.saveNow(ctx);
    UI.renderGarage(ctx);
  };

  function renderWaffen(ctx) {
    if (!el.gWeapons) return;
    var p = ctx.player;
    var html = '';
    for (var i = 0; i < GTA.Weapons.CATALOG.length; i++) {
      var w = GTA.Weapons.CATALOG[i];
      var hat = !!p.weapons[w.id];
      var inHand = (p.weapon === w.id);
      var leistbar = p.money >= w.price;
      var klass = 'vcard' + (inHand ? ' active' : '') + (hat ? '' : ' locked');
      var preisKlass = hat ? 'price owned' : (leistbar ? 'price' : 'price cant');
      var preisText = hat ? (inHand ? 'IN DER HAND' : 'NEHMEN') : U.fmtMoney(w.price);
      var art = w.typ === 'nah' ? 'Nahkampf' : (w.typ === 'wurf' ? 'Wurfwaffe' : 'Schusswaffe');
      html +=
        '<div class="vcard ' + klass.replace('vcard', '') + '" data-weap="' + w.id + '">' +
        '<div class="swatch" style="background:rgba(255,255,255,.07)">' + w.icon + '</div>' +
        '<h4>' + w.name + '</h4><div class="desc">' + w.desc + '</div>' +
        '<div class="bl">' + art.toUpperCase() + ' · SCHADEN ' + w.dmg + '</div>' + balken(w.dmg, 9) +
        '<div class="bl">REICHWEITE</div>' + balken(Math.min(w.range, 60), 60) +
        (w.ammoId ? '<div class="bl">VORRAT: ' + (p.ammo[w.ammoId] || 0) + '</div>' : '<div class="bl">&nbsp;</div>') +
        '<div class="' + preisKlass + '">' + preisText + '</div>' +
        (hat && w.ammoId ? '<div class="price" data-ammo="' + w.ammoId + '" style="margin-top:5px;background:rgba(255,255,255,.16);color:#fff">MUNITION € 200</div>' : '') +
        '</div>';
    }
    el.gWeapons.innerHTML = html;

    var karten = el.gWeapons.querySelectorAll('.vcard');
    for (var k = 0; k < karten.length; k++) {
      karten[k].addEventListener('click', function (e) {
        var ammoBtn = e.target.getAttribute('data-ammo');
        if (ammoBtn) { UI.buyAmmo(ctx, ammoBtn); return; }
        UI.pickWeapon(ctx, this.getAttribute('data-weap'));
      });
    }
  }

  UI.pickWeapon = function (ctx, id) {
    var p = ctx.player;
    var w = GTA.Weapons.byId(id);
    if (!w) return;
    if (!p.weapons[id]) {
      if (p.money < w.price) {
        UI.showToast('ZU WENIG GELD', 'Mach Aufträge!', '#ff5544');
        return;
      }
      p.money -= w.price;
      p.weapons[id] = true;
      if (w.ammoId) GTA.Player.giveAmmo(ctx, w.ammoId, w.clip ? w.clip * 3 : 10);
      if (GTA.Audio) GTA.Audio.cash();
      UI.showToast(w.name.toUpperCase() + ' GEKAUFT', '', '#2ecc71');
    }
    p.weapon = id;
    GTA.Player.refreshWeaponMesh(ctx);
    GTA.Player.saveNow(ctx);
    UI.renderGarage(ctx);
  };

  UI.buyAmmo = function (ctx, ammoId) {
    var p = ctx.player;
    if (p.money < 200) { UI.showToast('ZU WENIG GELD', '', '#ff5544'); return; }
    p.money -= 200;
    GTA.Player.giveAmmo(ctx, ammoId, 60);
    if (GTA.Audio) GTA.Audio.reload();
    UI.showToast('MUNITION GEKAUFT', '+60 Schuss', '#2ecc71');
    GTA.Player.saveNow(ctx);
    UI.renderGarage(ctx);
  };

  /* ---- Charakter-Editor ---- */
  function farbreihe(titel, farben, aktiv, attr) {
    var h = '<div class="charRow"><label>' + titel + '</label><div class="swatches">';
    for (var i = 0; i < farben.length; i++) {
      h += '<div class="sw' + (aktiv === i ? ' on' : '') + '" data-' + attr + '="' + i +
           '" style="background:' + U.hexCss(farben[i]) + '"></div>';
    }
    return h + '</div></div>';
  }

  function optionsreihe(titel, werte, aktiv, attr, beschriftung) {
    var h = '<div class="charRow"><label>' + titel + '</label><div class="opts">';
    for (var i = 0; i < werte.length; i++) {
      var t = beschriftung ? beschriftung[i] : werte[i];
      h += '<div class="opt' + (aktiv === werte[i] ? ' on' : '') + '" data-' + attr + '="' + werte[i] + '">' + t + '</div>';
    }
    return h + '</div></div>';
  }

  function renderCharakter(ctx) {
    if (!el.gChar) return;
    var s = ctx.player.style;
    var builds = Object.keys(GTA.Chars.BUILDS);
    var shirtFarben = CFG.SHIRT_COLORS;
    var html = '';

    html += farbreihe('HAUTTON', CFG.SKIN_TONES, s.skin, 'skin');
    html += farbreihe('SHIRT', shirtFarben, shirtFarben.indexOf(s.shirt), 'shirt');
    html += farbreihe('HOSE', CFG.PANTS_COLORS, CFG.PANTS_COLORS.indexOf(s.pants), 'pants');
    html += farbreihe('HAARE', CFG.HAIR_COLORS, s.hair, 'hair');
    html += optionsreihe('KOPFBEDECKUNG', GTA.Chars.HATS, s.hat, 'hat',
      ['keine', 'Kappe', 'Haube', 'Hut', 'Helm', 'Trachtenhut']);
    html += farbreihe('FARBE DER KOPFBEDECKUNG', shirtFarben, shirtFarben.indexOf(s.hatColor), 'hatcolor');
    html += optionsreihe('KÖRPERBAU', builds, s.build, 'build',
      ['normal', 'schlank', 'kräftig', 'stämmig', 'klein']);
    html += farbreihe('JACKENFARBE', CFG.PANTS_COLORS, CFG.PANTS_COLORS.indexOf(s.jacketColor), 'jacketcolor');
    html += optionsreihe('JACKE', ['aus', 'an'], s.jacket ? 'an' : 'aus', 'jacket', ['aus', 'an']);
    html += optionsreihe('BART', ['aus', 'an'], s.beard ? 'an' : 'aus', 'beard', ['aus', 'an']);
    html += optionsreihe('BRILLE', ['aus', 'an'], s.glasses ? 'an' : 'aus', 'glasses', ['aus', 'an']);

    el.gChar.innerHTML = html;

    function bind(attr, fn) {
      var nodes = el.gChar.querySelectorAll('[data-' + attr + ']');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].addEventListener('click', function () {
          fn(this.getAttribute('data-' + attr));
          GTA.Player.rebuildMesh(ctx);
          GTA.Player.saveNow(ctx);
          if (GTA.Audio) GTA.Audio.door();
          renderCharakter(ctx);
        });
      }
    }
    bind('skin', function (v) { s.skin = parseInt(v, 10); });
    bind('shirt', function (v) { s.shirt = shirtFarben[parseInt(v, 10)]; });
    bind('pants', function (v) { s.pants = CFG.PANTS_COLORS[parseInt(v, 10)]; });
    bind('hair', function (v) { s.hair = parseInt(v, 10); });
    bind('hat', function (v) { s.hat = v; });
    bind('hatcolor', function (v) { s.hatColor = shirtFarben[parseInt(v, 10)]; });
    bind('build', function (v) { s.build = v; });
    bind('jacketcolor', function (v) { s.jacketColor = CFG.PANTS_COLORS[parseInt(v, 10)]; });
    bind('jacket', function (v) { s.jacket = (v === 'an'); });
    bind('beard', function (v) { s.beard = (v === 'an'); });
    bind('glasses', function (v) { s.glasses = (v === 'an'); });
  }

  UI.renderGarage = function (ctx) {
    if (el.gMoney) el.gMoney.textContent = U.fmtMoney(ctx.player.money);
    renderFahrzeuge(ctx);
    renderWaffen(ctx);
    renderCharakter(ctx);
  };

  /* ============================================================
     5. Pausemenü
     ============================================================ */
  UI.buildPauseMenu = function (ctx) {
    if (!el.pauseRows) return;
    var html = '';
    html += '<div class="pauseRow"><span>Grafikstufe</span><div class="opts" id="pgfx"></div></div>';
    html += '<div class="pauseRow"><span>Ton</span><div class="opts">' +
            '<div class="opt" data-snd="an">an</div><div class="opt" data-snd="aus">stumm</div></div></div>';
    html += '<div class="pauseRow"><span>Vollbild</span><div class="opts">' +
            '<div class="opt" data-fs="1">umschalten (F11)</div></div></div>';
    html += '<div class="pauseRow"><span>Mausempfindlichkeit</span><div class="opts" id="psens"></div></div>';
    html += '<div class="pauseRow"><span>Spielstand</span><div class="opts">' +
            '<div class="opt" data-save="1">jetzt sichern</div>' +
            '<div class="opt" data-clear="1" style="color:#ff9a90">löschen</div></div></div>';
    html += '<div class="pauseRow" style="align-items:flex-start"><span>Steuerung</span>' +
            '<div class="tiny" style="text-align:right;line-height:1.7">' +
            'WASD bewegen · Maus umsehen · Shift sprinten<br>' +
            'E einsteigen / betreten / reden · F aufheben<br>' +
            'Leertaste angreifen · R nachladen · Q Waffe<br>' +
            'G Garage · M Karte · ` Grafik · Esc Pause</div></div>';
    el.pauseRows.innerHTML = html;

    function refresh() {
      var g = $('pgfx');
      if (g) {
        var h = '';
        for (var i = 0; i < CFG.GFX_LEVELS.length; i++) {
          h += '<div class="opt' + (ctx.gfxIndex === i ? ' on' : '') + '" data-gfx="' + i + '">' +
               CFG.GFX_LEVELS[i].name + '</div>';
        }
        g.innerHTML = h;
        var nodes = g.querySelectorAll('[data-gfx]');
        for (var k = 0; k < nodes.length; k++) {
          nodes[k].addEventListener('click', function () {
            GTA.Game.setGfx(parseInt(this.getAttribute('data-gfx'), 10));
            refresh();
          });
        }
      }
      var sn = $('psens');
      if (sn) {
        var stufen = [0.0012, 0.0022, 0.0038, 0.006];
        var namen = ['sehr niedrig', 'niedrig', 'mittel', 'hoch'];
        var sh = '';
        for (var s = 0; s < stufen.length; s++) {
          sh += '<div class="opt' + (Math.abs(GTA.Input.sensitivity - stufen[s]) < 0.0005 ? ' on' : '') +
                '" data-sens="' + stufen[s] + '">' + namen[s] + '</div>';
        }
        sn.innerHTML = sh;
        var sns = sn.querySelectorAll('[data-sens]');
        for (var q = 0; q < sns.length; q++) {
          sns[q].addEventListener('click', function () {
            GTA.Input.sensitivity = parseFloat(this.getAttribute('data-sens'));
            refresh();
          });
        }
      }
      var snd = el.pauseRows.querySelectorAll('[data-snd]');
      for (var m = 0; m < snd.length; m++) {
        snd[m].classList.toggle('on',
          (snd[m].getAttribute('data-snd') === 'aus') === GTA.Audio.isMuted());
      }
    }
    UI.refreshPause = refresh;

    el.pauseRows.addEventListener('click', function (e) {
      var t = e.target;
      if (t.getAttribute('data-snd')) {
        GTA.Audio.setMuted(t.getAttribute('data-snd') === 'aus');
        refresh();
      } else if (t.getAttribute('data-fs')) {
        GTA.Game.toggleFullscreen();
      } else if (t.getAttribute('data-save')) {
        GTA.Player.saveNow(ctx);
        UI.showToast('GESPEICHERT', '', '#2ecc71');
      } else if (t.getAttribute('data-clear')) {
        GTA.Player.clearSave();
        UI.showToast('SPIELSTAND GELÖSCHT', 'Beim nächsten Start leer', '#ff5544');
      }
    });
    refresh();
  };

  UI.togglePause = function (ctx) {
    // Esc schließt zuerst offene Fenster
    if (offen.garage) { UI.closeGarage(); return; }
    if (offen.briefing) { UI.hideBriefing(); return; }
    if (offen.karte) { UI.toggleMap(ctx); return; }

    offen.pause = !offen.pause;
    if (el.pauseMenu) el.pauseMenu.classList.toggle('on', offen.pause);
    if (offen.pause) {
      if (UI.refreshPause) UI.refreshPause();
      if (GTA.Input) GTA.Input.releaseLock();
      GTA.Player.saveNow(ctx);
    } else if (GTA.Input) {
      GTA.Input.requestLock(ctx);
    }
  };

  /* ============================================================
     6. Karte
     ============================================================ */
  function zeichneKarte(ctx, c, groesse, mitte, spanne) {
    var R = groesse / 2;
    c.clearRect(0, 0, groesse, groesse);

    // Hintergrund
    c.fillStyle = '#16202c';
    c.fillRect(0, 0, groesse, groesse);

    function px(wx) { return R + (wx - mitte.x) / spanne * R; }
    function py(wz) { return R + (wz - mitte.z) / spanne * R; }
    var s = R / spanne;

    // Wiese
    c.fillStyle = '#25402a';
    c.beginPath();
    c.arc(px(0), py(0), CFG.WORLD_R * s, 0, 7);
    c.fill();

    // See
    c.fillStyle = '#245a8c';
    c.beginPath();
    c.arc(px(CFG.LAKE.x), py(CFG.LAKE.z), CFG.LAKE.r * s, 0, 7);
    c.fill();

    // Straßen
    c.strokeStyle = '#4a5058';
    c.lineWidth = Math.max(1.5, CFG.ROAD_HALF * 2 * s);
    c.beginPath();
    c.moveTo(px(0), py(-CFG.ROAD_LEN / 2)); c.lineTo(px(0), py(CFG.ROAD_LEN / 2));
    c.moveTo(px(-CFG.ROAD_LEN / 2), py(0)); c.lineTo(px(CFG.ROAD_LEN / 2), py(0));
    c.stroke();
    c.beginPath();
    c.arc(px(0), py(0), CFG.RING_R * s, 0, 7);
    c.stroke();

    // Häuser
    c.fillStyle = '#8ed1ff';
    for (var i = 0; i < ctx.interiors.length; i++) {
      var it = ctx.interiors[i];
      c.fillRect(px(it.x) - 2, py(it.z) - 2, 4, 4);
    }

    // Auftragsmarker
    if (GTA.Missions && GTA.Missions.LIST) {
      c.fillStyle = '#ffd23c';
      for (var m = 0; m < GTA.Missions.LIST.length; m++) {
        var def = GTA.Missions.LIST[m];
        if (ctx.mission) break;
        c.beginPath();
        c.arc(px(def.spot[0]), py(def.spot[1]), 3.5, 0, 7);
        c.fill();
      }
    }

    // Polizei
    c.fillStyle = '#ff5544';
    for (var k = 0; k < ctx.copCars.length; k++) {
      c.beginPath(); c.arc(px(ctx.copCars[k].x), py(ctx.copCars[k].z), 2.5, 0, 7); c.fill();
    }
    for (var n = 0; n < ctx.npcs.length; n++) {
      if (ctx.npcs[n].kind !== 'cop' || ctx.npcs[n].state === 'down') continue;
      c.beginPath(); c.arc(px(ctx.npcs[n].x), py(ctx.npcs[n].z), 2, 0, 7); c.fill();
    }

    // Aktives Ziel
    var ziel = GTA.Missions ? GTA.Missions.targetPos : null;
    if (ziel) {
      c.strokeStyle = '#35e07a';
      c.lineWidth = 2;
      c.beginPath(); c.arc(px(ziel.x), py(ziel.z), 6, 0, 7); c.stroke();
      c.fillStyle = '#35e07a';
      c.beginPath(); c.arc(px(ziel.x), py(ziel.z), 2.5, 0, 7); c.fill();
    }

    // Spieler als Pfeil
    var p = ctx.player;
    var pxx = px(p.x), pyy = py(p.z);
    c.save();
    c.translate(pxx, pyy);
    c.rotate(-p.heading);          // Norden oben, Bildschirm-Y ist invertiert
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6);
    c.closePath();
    c.fill();
    c.restore();
  }

  UI.toggleMap = function (ctx) {
    if (offen.garage || offen.briefing || offen.pause) return;
    offen.karte = !offen.karte;
    if (el.mapOverlay) el.mapOverlay.classList.toggle('on', offen.karte);
    if (offen.karte) {
      if (UI.bigMapCtx) zeichneKarte(ctx, UI.bigMapCtx, el.mapCanvas.width, { x: 0, z: 0 }, CFG.WORLD_R + 40);
      if (GTA.Input) GTA.Input.releaseLock();
    } else if (GTA.Input) {
      GTA.Input.requestLock(ctx);
    }
  };

  /* ============================================================
     7. HUD
     ============================================================ */
  var hudZaehler = 0;
  UI.updateHud = function (ctx) {
    var p = ctx.player;
    if (!p) return;

    if (el.hudMoney) el.hudMoney.textContent = U.fmtMoney(p.money);
    if (el.hudHpFill) {
      el.hudHpFill.style.width = Math.max(0, Math.min(100, p.hp)) + '%';
      el.hudHpFill.style.background = p.hp > 40
        ? 'linear-gradient(90deg,#2ecc71,#a3e635)'
        : 'linear-gradient(90deg,#e74c3c,#f39c12)';
    }
    if (el.hudArmorFill) el.hudArmorFill.style.width = Math.max(0, Math.min(100, p.armor)) + '%';
    if (el.hudHp) el.hudHp.textContent = Math.round(p.hp) + ' HP' + (p.armor > 0 ? ' · ' + Math.round(p.armor) + ' Schutz' : '');

    // Fahndung
    if (el.hudWanted) {
      var stufe = GTA.Player.wantedLevel(ctx);
      var s = '';
      for (var i = 0; i < CFG.HEAT_STARS; i++) {
        s += '<span class="' + (i < stufe ? 'on' : 'off') + '">★</span>';
      }
      el.hudWanted.innerHTML = stufe > 0 ? s : '';
    }

    // Fahrzeug
    var inCar = !!p.car;
    if (el.hudVehName) {
      if (inCar) {
        var v = p.car.isOwn ? GTA.Vehicles.byId(p.ownedVehicle) : null;
        el.hudVehName.textContent = v ? v.name : (p.car.params.name || 'Fahrzeug');
        if (el.hudVehDot) el.hudVehDot.style.background = U.hexCss(v ? v.color : 0xffffff);
      } else {
        el.hudVehName.textContent = 'Zu Fuß';
        if (el.hudVehDot) el.hudVehDot.style.background = U.hexCss(p.style.shirt);
      }
    }

    // Tacho
    if (el.hudSpeedWrap) {
      el.hudSpeedWrap.classList.toggle('on', inCar);
      if (inCar && el.hudSpeed) el.hudSpeed.textContent = Math.round(Math.abs(p.speed) * 3.6);
    }

    // Waffe
    if (el.hudWeapon && GTA.Weapons) {
      var w = GTA.Weapons.byId(p.weapon);
      el.hudWeapon.textContent = w ? w.name : '—';
      if (el.hudWeaponIcon) el.hudWeaponIcon.textContent = w ? w.icon : '👊';
      if (el.hudAmmo) {
        el.hudAmmo.textContent = p.reloadT > 0 ? 'lädt nach …' : GTA.Weapons.ammoText(ctx);
      }
    }

    // Fadenkreuz beim Zielen
    if (el.crosshair) {
      var zielt = !inCar && GTA.Input && GTA.Input.actions.aim;
      el.crosshair.classList.toggle('on', !!zielt);
    }

    // Minikarte nur jedes zweite Mal neu zeichnen — spart Rechenzeit
    hudZaehler++;
    if (UI.mapCtx && (hudZaehler % 2 === 0)) {
      zeichneKarte(ctx, UI.mapCtx, el.minimap.width, { x: p.x, z: p.z }, 150);
    }
  };

  return UI;
})();
