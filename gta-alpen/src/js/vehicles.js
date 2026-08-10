'use strict';
/* ============================================================
   vehicles.js — Fahrzeug-Baukasten (Karosserien, Räder, Fahrer)
   Abhängig von: three.js, config.js, util.js, textures.js,
                 characters.js (nur optional/defensiv).
   Definiert GTA.Vehicles.

   Beim Laden entstehen NUR Datentabellen. Jede Geometrie wird
   erst in build(ctx) bzw. makeMesh() erzeugt, weil GTA.TEX.M
   vorher nicht existiert.

   Jedes gebaute Fahrzeug ist eine THREE.Group mit userData:
     {
       tilt          : THREE.Group  (Karosserie, wird geneigt)
       wheels        : [ Rad-Pivots ]      (alle Räder)
       frontWheels   : [ Rad-Pivots ]      (lenkbare Räder)
       headlights    : [ Mesh ]
       tailLights    : [ Mesh ]
       blinkers      : [ Mesh ]
       rider         : THREE.Group|null    (sichtbarer Fahrer, Zweiräder)
       hasDriver     : bool
       siren         : Mesh|null
       spec          : Fahrzeugdaten
     }
   Jedes Rad-Pivot hat userData.spin (Drehgruppe) und userData.radius.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.Vehicles = (function () {

  var V = {};
  var U = null;          // GTA.U, erst bei ensure() gesetzt
  var R = null;          // gemeinsame Materialien, erst bei ensure() gebaut
  var paintCache = {};   // Lackfarben, damit gleiche Farbe ein Material teilt

  /* ==========================================================
     RESSOURCEN — werden beim ersten Bauen einmalig erzeugt
     ========================================================== */

  function texM() {
    return (GTA.TEX && GTA.TEX.M) ? GTA.TEX.M : null;
  }

  // Gemeinsames Material aus GTA.TEX.M holen, sonst Notfarbe bauen.
  function shared(key, color, rough, metal, extra) {
    var m = texM();
    if (m && m[key]) return m[key];
    return GTA.U.mat(color, rough, metal, extra);
  }

  // Österreichisches Kennzeichen, prozedural gezeichnet.
  function plateTexture() {
    var cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    var c = cv.getContext('2d');
    c.fillStyle = '#f3f4f6'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#16357e'; c.fillRect(0, 0, 36, 64);
    c.fillStyle = '#f2d64b';
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      c.beginPath();
      c.arc(18 + Math.cos(a) * 10, 22 + Math.sin(a) * 10, 1.6, 0, 7);
      c.fill();
    }
    c.fillStyle = '#ffffff';
    c.font = 'bold 17px sans-serif';
    c.textAlign = 'center';
    c.fillText('A', 18, 56);
    c.fillStyle = '#c8102e';
    c.fillRect(44, 8, 7, 48);
    c.fillRect(58, 8, 7, 48);
    c.fillStyle = '#15171c';
    c.font = 'bold 36px sans-serif';
    c.textAlign = 'left';
    c.fillText('GTA 2000', 74, 47);
    c.strokeStyle = '#15171c'; c.lineWidth = 4;
    c.strokeRect(2, 2, 252, 60);
    var tx = new THREE.CanvasTexture(cv);
    if (GTA.TEX && GTA.TEX.maxAniso) tx.anisotropy = GTA.TEX.maxAniso;
    return tx;
  }

  // Ladeflächen-Plane / Warnstreifen für Nutzfahrzeuge
  function stripeTexture(colA, colB) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var c = cv.getContext('2d');
    c.fillStyle = colA; c.fillRect(0, 0, 64, 64);
    c.strokeStyle = colB; c.lineWidth = 12;
    for (var i = -64; i < 128; i += 24) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 64, 64); c.stroke();
    }
    var tx = new THREE.CanvasTexture(cv);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(3, 1);
    return tx;
  }

  function ensure() {
    if (R) return R;
    U = GTA.U;
    R = {};

    R.tire      = U.mat(0x17191d, 0.95, 0.0);
    R.rubber    = U.mat(0x24272c, 0.98, 0.0);
    R.rim       = U.mat(0xd7dde2, 0.20, 0.95);
    R.rimDark   = U.mat(0x363b42, 0.35, 0.85);
    R.rimGold   = U.mat(0xc9a24a, 0.25, 0.9);
    R.rimBlack  = U.mat(0x1c1f24, 0.5, 0.6);

    R.chrome    = shared('chrome', 0xe8ecf0, 0.08, 1.0, { envMapIntensity: 1.6 });
    R.dark      = shared('dark', 0x181b20, 0.85, 0.1);
    R.glass     = shared('darkGlass', 0x0d1420, 0.05, 0.9, { envMapIntensity: 1.5 });
    R.clear     = shared('glass', 0xbcd4e6, 0.05, 0.5, { transparent: true, opacity: 0.32 });
    R.metal     = shared('metal', 0x9fa6ad, 0.35, 0.85);
    R.white     = shared('white', 0xf4f6f8, 0.70, 0.0);
    R.wood      = shared('wood', 0x9a6b3f, 0.72, 0.0);

    R.leather   = U.mat(0x3a2c22, 0.75, 0.05);
    R.cloth     = U.mat(0x2a2f38, 0.9, 0.0);
    R.grille    = U.mat(0x101317, 0.55, 0.55);
    R.plastic   = U.mat(0x2a2e34, 0.8, 0.05);
    R.alu       = U.mat(0xb6bcc4, 0.28, 0.9);
    R.rust      = U.mat(0x7a4a2c, 0.95, 0.15);

    R.lightF    = U.mat(0x30302a, 0.40, 0.30, { emissive: 0xfff0b8, emissiveIntensity: 1.7 });
    R.lightR    = U.mat(0x2a1414, 0.40, 0.20, { emissive: 0xff2a22, emissiveIntensity: 1.4 });
    R.lightA    = U.mat(0x33240c, 0.40, 0.20, { emissive: 0xffa41c, emissiveIntensity: 1.2 });
    R.lightW    = U.mat(0x2c2e30, 0.35, 0.25, { emissive: 0xdfe8f0, emissiveIntensity: 0.9 });
    R.lightBlue = U.mat(0x0e1c46, 0.30, 0.20, { emissive: 0x2a62ff, emissiveIntensity: 1.6 });

    R.plate     = U.mat(0xffffff, 0.62, 0.0, { map: plateTexture() });
    R.warn      = U.mat(0xffffff, 0.8, 0.0, { map: stripeTexture('#e8a021', '#20242a') });

    return R;
  }

  // Klarlack / Mattlack — pro Farbe nur ein Material.
  function paint(color) {
    ensure();
    var k = 'g' + color;
    if (!paintCache[k]) paintCache[k] = U.mat(color, 0.16, 0.7, { envMapIntensity: 1.35 });
    return paintCache[k];
  }
  function paintMatte(color) {
    ensure();
    var k = 'm' + color;
    if (!paintCache[k]) paintCache[k] = U.mat(color, 0.55, 0.3, { envMapIntensity: 0.9 });
    return paintCache[k];
  }
  V.paint = paint;
  V.paintMatte = paintMatte;

  /* __PART2__ */

  return V;
})();
