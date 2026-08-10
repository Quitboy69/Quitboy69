'use strict';
/* ============================================================
   config.js — Weltmaße, Paletten, Grafikstufen
   Keine Abhängigkeiten. Definiert GTA.CFG.
   ============================================================ */
window.GTA = window.GTA || {};

GTA.CFG = {
  // --- Weltgeometrie ---
  WORLD_R: 640,          // begehbarer Radius
  GROUND_R: 1100,        // sichtbarer Bodenteller
  ROAD_HALF: 13,         // halbe Straßenbreite
  ROAD_LEN: 1120,        // Länge der Kreuzstraßen
  RING_R: 220,           // Radius der Ringstraße
  LAKE: { x: 380, z: -320, r: 72 },

  // --- Missionsplätze (Marker-Säulen) ---
  MISSION_SPOTS: [
    [30, 70], [76, -84], [-30, 160], [210, 10],
    [-160, -30], [30, -200], [-70, -120], [130, 120],
    [-210, 90], [250, -150], [-120, 220], [180, -230]
  ],

  // --- Dorf: Grundstücke. rot = Rotation in Vierteldrehungen (0..3),
  //     damit alle Wände achsenparallel bleiben (wichtig für Kollision). ---
  HOUSE_SPOTS: [
    { x: 52,   z: 42,   rot: 0, kind: 'wohnzimmer' },
    { x: 88,   z: 58,   rot: 1, kind: 'kueche' },
    { x: 64,   z: 92,   rot: 2, kind: 'schlafzimmer' },
    { x: 126,  z: 76,   rot: 3, kind: 'werkstatt' },
    { x: -58,  z: 46,   rot: 0, kind: 'buero' },
    { x: -94,  z: 72,   rot: 1, kind: 'bauernstube' },
    { x: -64,  z: -54,  rot: 2, kind: 'kinderzimmer' },
    { x: 46,   z: -62,  rot: 3, kind: 'laden' },
    { x: 98,   z: -46,  rot: 0, kind: 'wirtshaus' },
    { x: -46,  z: 98,   rot: 1, kind: 'atelier' },
    { x: 152,  z: -64,  rot: 2, kind: 'jagdhuette' },
    { x: -124, z: -84,  rot: 3, kind: 'waschkueche' },
    { x: 168,  z: 44,   rot: 0, kind: 'musikzimmer' },
    { x: -160, z: 60,   rot: 1, kind: 'bibliothek' },
    { x: 120,  z: -140, rot: 2, kind: 'garage' },
    { x: -180, z: -130, rot: 3, kind: 'gewaechshaus' },
    { x: 30,   z: 150,  rot: 0, kind: 'fitnessraum' },
    { x: -30,  z: -170, rot: 1, kind: 'dachboden' }
  ],

  // --- Farbpaletten ---
  SKIN_TONES: [0xe8b98a, 0xd9a06b, 0xb87e50, 0x8a5a36, 0xf0c9a0, 0x6b4429],
  SHIRT_COLORS: [0x3a7bd5, 0xd94f4f, 0x35a06b, 0xe0a132, 0x8e5bc4, 0x4aa3a3, 0xd3689a, 0xe8632d],
  PANTS_COLORS: [0x2b3242, 0x4a3b2e, 0x1e2c22, 0x5b6472, 0x6d5a3f, 0x38343a],
  HAIR_COLORS: [0x2a1c10, 0x0e0d0c, 0x8a5a24, 0xc9a15a, 0x6e6e72, 0xa33b2a],
  TRAFFIC_COLORS: [0x9aa5ae, 0x5b7a99, 0x7c4a4a, 0x4a6b4f, 0xc2b280, 0x8e6fb0, 0x3f6f78, 0xb8b0a0],

  // --- Grafikstufen. Reihenfolge = Umschaltreihenfolge im HUD. ---
  GFX_LEVELS: [
    { name: 'ULTRA',  px: 2.0,  shadow: 4096, aniso: 16, fogFar: 1150, npcs: 46, traffic: 16, trees: 190, shadowRadius: 3, softShadow: true },
    { name: 'HOCH',   px: 1.5,  shadow: 2048, aniso: 8,  fogFar: 950,  npcs: 34, traffic: 12, trees: 140, shadowRadius: 2, softShadow: true },
    { name: 'MITTEL', px: 1.0,  shadow: 1024, aniso: 4,  fogFar: 780,  npcs: 24, traffic: 9,  trees: 100, shadowRadius: 1, softShadow: false },
    { name: 'NIEDRIG',px: 0.75, shadow: 512,  aniso: 1,  fogFar: 600,  npcs: 16, traffic: 6,  trees: 70,  shadowRadius: 1, softShadow: false }
  ],

  // --- Spielbalance ---
  START_MONEY: 500,
  MAX_HP: 100,
  MAX_ARMOR: 100,
  WALK_SPEED: 4.2,
  SPRINT_SPEED: 8.4,
  BACK_SPEED: 2.4,
  HEAT_MAX: 5.4,        // 5 Fahndungssterne
  HEAT_STARS: 5,
  REGEN_DELAY: 6,
  REGEN_RATE: 3,

  // Sonnenrichtung (auch fuer Himmels-Shader)
  SUN: { x: 0.55, y: 0.62, z: 0.35 }
};

GTA.CFG.sunDir = function () {
  var s = GTA.CFG.SUN;
  return new THREE.Vector3(s.x, s.y, s.z).normalize();
};
