'use strict';
/* ============================================================
   audio.js — prozeduraler Klang über die WebAudio-API
   Abhängig von: nichts (three.js nicht nötig). Definiert GTA.Audio.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Audio = (function () {
  var A = {};
  var AC = null, master = null, noiseBuf = null;
  var engine = null;      // { gain, osc1, osc2, lp }
  var muted = false, volume = 0.7;

  A.isReady = function () { return !!AC; };

  A.init = function () {
    if (AC) {
      if (AC.state === 'suspended') AC.resume();
      return;
    }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(AC.destination);

      // Motorklang: zwei Oszillatoren durch ein Tiefpassfilter
      var lp = AC.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      var gain = AC.createGain();
      gain.gain.value = 0;
      var osc1 = AC.createOscillator();
      osc1.type = 'sawtooth'; osc1.frequency.value = 58;
      var osc2 = AC.createOscillator();
      osc2.type = 'square'; osc2.frequency.value = 58; osc2.detune.value = 14;
      var g2 = AC.createGain(); g2.gain.value = 0.35;
      osc1.connect(lp); osc2.connect(g2); g2.connect(lp);
      lp.connect(gain); gain.connect(master);
      osc1.start(); osc2.start();
      engine = { gain: gain, osc1: osc1, osc2: osc2, lp: lp };

      // Rauschpuffer für Schüsse, Schläge, Wind
      var len = Math.floor(AC.sampleRate * 0.4);
      noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) {
      console.warn('[GTA] Kein Audio verfügbar:', e.message);
      AC = null;
    }
  };

  A.setMuted = function (b) {
    muted = !!b;
    if (master) master.gain.setTargetAtTime(muted ? 0 : volume, AC.currentTime, 0.05);
  };
  A.isMuted = function () { return muted; };

  A.setVolume = function (v) {
    volume = Math.max(0, Math.min(1, v));
    if (master && !muted) master.gain.setTargetAtTime(volume, AC.currentTime, 0.05);
  };
  A.getVolume = function () { return volume; };

  /* ---------------- Bausteine ---------------- */
  A.beep = function (freq, dur, vol, type) {
    if (!AC || muted) return;
    try {
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(AC.currentTime + dur);
    } catch (e) {}
  };

  A.noise = function (dur, vol, freq, q) {
    if (!AC || muted || !noiseBuf) return;
    try {
      var s = AC.createBufferSource(); s.buffer = noiseBuf;
      var f = AC.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
      var g = AC.createGain();
      g.gain.setValueAtTime(vol, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(); s.stop(AC.currentTime + dur);
    } catch (e) {}
  };

  A.sweep = function (f0, f1, dur, vol, type) {
    if (!AC || muted) return;
    try {
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, AC.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), AC.currentTime + dur);
      g.gain.setValueAtTime(vol, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(AC.currentTime + dur);
    } catch (e) {}
  };

  /* ---------------- Spielklänge ---------------- */
  A.shot = function (kind) {
    if (kind === 'schrot') { A.noise(0.26, 0.6, 900, 0.7); A.beep(90, 0.16, 0.3, 'square'); }
    else if (kind === 'mp') { A.noise(0.09, 0.36, 2100, 1.4); A.beep(180, 0.06, 0.18, 'square'); }
    else if (kind === 'gewehr') { A.noise(0.2, 0.55, 1400, 1.0); A.beep(120, 0.14, 0.28, 'square'); }
    else if (kind === 'revolver') { A.noise(0.2, 0.58, 1200, 0.9); A.beep(105, 0.15, 0.3, 'square'); }
    else if (kind === 'leucht') { A.sweep(700, 2200, 0.4, 0.3, 'sawtooth'); A.noise(0.2, 0.25, 1800, 1); }
    else { A.noise(0.14, 0.5, 1600, 1.2); A.beep(140, 0.1, 0.25, 'square'); }
  };
  A.hit = function () { A.beep(150, 0.09, 0.3, 'square'); };
  A.thud = function () { A.beep(65, 0.18, 0.4, 'sine'); };
  A.crash = function () { A.noise(0.32, 0.45, 320, 0.6); A.beep(55, 0.28, 0.4, 'sine'); };
  A.swing = function () { A.noise(0.09, 0.18, 900, 1.5); };
  A.door = function () { A.beep(320, 0.06, 0.2, 'square'); };
  A.pickup = function () { A.beep(720, 0.07, 0.2); setTimeout(function () { A.beep(1080, 0.1, 0.2); }, 65); };
  A.cash = function () { A.beep(880, 0.09, 0.25); setTimeout(function () { A.beep(1320, 0.14, 0.25); }, 90); };
  A.jingle = function () {
    A.beep(523, 0.12, 0.22);
    setTimeout(function () { A.beep(659, 0.12, 0.22); }, 120);
    setTimeout(function () { A.beep(784, 0.2, 0.25); }, 240);
  };
  A.fail = function () {
    A.beep(300, 0.18, 0.25, 'sawtooth');
    setTimeout(function () { A.beep(210, 0.3, 0.25, 'sawtooth'); }, 170);
  };
  A.checkpoint = function () { A.beep(700, 0.08, 0.2); };
  A.reload = function () { A.beep(240, 0.05, 0.16, 'square'); setTimeout(function () { A.beep(180, 0.07, 0.16, 'square'); }, 110); };
  A.siren = function () { A.sweep(600, 950, 0.4, 0.09, 'sine'); };
  A.empty = function () { A.beep(120, 0.04, 0.15, 'square'); };

  /* ---------------- Motor ---------------- */
  A.updateEngine = function (ctx) {
    if (!AC || !engine) return;
    try {
      var p = ctx.player;
      if (p.car) {
        var sp = Math.abs(p.speed);
        var bike = !!p.car.params.bike;
        var base = bike ? 92 : 56;
        var f = base + sp * (bike ? 7.5 : 5.0) + p.throttleSm * 26;
        engine.osc1.frequency.setTargetAtTime(f, AC.currentTime, 0.04);
        engine.osc2.frequency.setTargetAtTime(f * 0.5, AC.currentTime, 0.04);
        engine.lp.frequency.setTargetAtTime(280 + sp * 42, AC.currentTime, 0.06);
        var vol = 0.03 + Math.min(sp / 85, 1) * 0.055 + Math.max(p.throttleSm, 0) * 0.022;
        engine.gain.gain.setTargetAtTime(vol, AC.currentTime, 0.08);
      } else {
        engine.gain.gain.setTargetAtTime(0, AC.currentTime, 0.1);
      }
    } catch (e) {}
  };

  return A;
})();
