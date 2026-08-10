'use strict';
/* ============================================================
   input.js — Desktop-Steuerung: Tastatur + Maus (Pointer Lock)
   Keine Touch-Bedienung. Definiert GTA.Input.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Input = (function () {
  var I = {};

  I.keys = {};              // rohe KeyboardEvent.code -> bool
  I.actions = {             // abgeleitete Spielaktionen
    forward: false, back: false, left: false, right: false,
    sprint: false, attack: false, aim: false, handbrake: false
  };
  I.mouse = { dx: 0, dy: 0, locked: false, leftDown: false, rightDown: false, wheel: 0 };
  I.lookYaw = 0;            // Kameradrehung um Y (vom Spieler gelesen)
  I.lookPitch = 0.0;        // Kameraneigung
  I.sensitivity = 0.0022;
  I.invertY = false;

  var pressed = {};         // einmalige Tastendrücke bis zum Abholen
  var ctxRef = null;
  var enabled = true;

  var MOVE = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back',    ArrowDown: 'back',
    KeyA: 'left',    ArrowLeft: 'left',
    KeyD: 'right',   ArrowRight: 'right'
  };

  /* Einmalige Aktionen: werden gesetzt und vom Spiel abgeholt. */
  var ONCE = {
    KeyE: 'interact',
    KeyF: 'pickup',
    KeyR: 'reload',
    KeyQ: 'weaponPrev',
    KeyG: 'garage',
    KeyM: 'map',
    KeyH: 'horn',
    KeyC: 'camera',
    KeyT: 'talk',
    Escape: 'pause',
    Tab: 'map',
    Enter: 'confirm',
    F11: 'fullscreen',
    Backquote: 'gfx'
  };

  I.init = function (ctx) {
    ctxRef = ctx;

    window.addEventListener('keydown', function (e) {
      if (!enabled) return;
      // Browser-Eigenheiten abfangen, die im Spiel stören
      if (e.code === 'Tab' || e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
      if (e.repeat) return;
      I.keys[e.code] = true;

      if (ONCE[e.code]) pressed[ONCE[e.code]] = true;
      if (e.code === 'Space') pressed.attackOnce = true;

      // Zifferntasten 1..9 wählen die Waffe direkt
      if (e.code.indexOf('Digit') === 0) {
        var n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) pressed['weapon' + n] = true;
      }
      if (GTA.Audio) GTA.Audio.init();
    });

    window.addEventListener('keyup', function (e) {
      I.keys[e.code] = false;
    });

    // Fenster verloren -> alle Tasten loslassen, sonst "klebt" die Bewegung
    window.addEventListener('blur', function () {
      I.keys = {};
      I.mouse.leftDown = false;
      I.mouse.rightDown = false;
    });

    var canvas = ctx.renderer.domElement;

    canvas.addEventListener('mousedown', function (e) {
      if (!enabled) return;
      if (e.button === 0) { I.mouse.leftDown = true; pressed.attackOnce = true; }
      if (e.button === 2) I.mouse.rightDown = true;
      if (GTA.Audio) GTA.Audio.init();
      if (!I.mouse.locked && !(GTA.UI && GTA.UI.isModalOpen && GTA.UI.isModalOpen())) I.requestLock(ctx);
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) I.mouse.leftDown = false;
      if (e.button === 2) I.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.addEventListener('mousemove', function (e) {
      if (!I.mouse.locked) return;
      I.mouse.dx += e.movementX || 0;
      I.mouse.dy += e.movementY || 0;
    });

    window.addEventListener('wheel', function (e) {
      if (!enabled) return;
      I.mouse.wheel += e.deltaY > 0 ? 1 : -1;
      if (e.deltaY > 0) pressed.weaponNext = true; else pressed.weaponPrev = true;
    }, { passive: true });

    document.addEventListener('pointerlockchange', function () {
      I.mouse.locked = (document.pointerLockElement === canvas);
      document.body.classList.toggle('playing', I.mouse.locked);
    });
    document.addEventListener('pointerlockerror', function () {
      console.warn('[GTA] Mauszeiger konnte nicht gefangen werden.');
    });
  };

  I.requestLock = function (ctx) {
    var canvas = (ctx || ctxRef).renderer.domElement;
    if (canvas.requestPointerLock) {
      var p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(function () {});
    }
  };

  I.releaseLock = function () {
    if (document.exitPointerLock) document.exitPointerLock();
  };

  I.setEnabled = function (b) {
    enabled = !!b;
    if (!enabled) { I.keys = {}; I.mouse.leftDown = false; }
  };

  /* Einmal-Aktion abholen (und zurücksetzen). */
  I.consumePressed = function (name) {
    if (pressed[name]) { pressed[name] = false; return true; }
    return false;
  };

  I.clearPressed = function () { pressed = {}; };

  /* Pro Frame: Maus-Delta in Blickwinkel umrechnen, Aktionen ableiten. */
  I.update = function (dt) {
    var a = I.actions;
    a.forward = false; a.back = false; a.left = false; a.right = false;

    for (var code in MOVE) {
      if (I.keys[code]) a[MOVE[code]] = true;
    }
    a.sprint = !!(I.keys.ShiftLeft || I.keys.ShiftRight);
    a.attack = !!I.keys.Space || I.mouse.leftDown;
    a.aim = I.mouse.rightDown;
    a.handbrake = !!(I.keys.Space && ctxRef && ctxRef.player && ctxRef.player.car);

    if (I.mouse.locked) {
      I.lookYaw -= I.mouse.dx * I.sensitivity;
      var dy = I.mouse.dy * I.sensitivity * (I.invertY ? -1 : 1);
      I.lookPitch = Math.max(-0.85, Math.min(0.7, I.lookPitch - dy));
    }
    I.mouse.dx = 0; I.mouse.dy = 0; I.mouse.wheel = 0;

    // Blickrichtung in [-PI, PI] halten
    while (I.lookYaw > Math.PI) I.lookYaw -= Math.PI * 2;
    while (I.lookYaw < -Math.PI) I.lookYaw += Math.PI * 2;
  };

  return I;
})();
