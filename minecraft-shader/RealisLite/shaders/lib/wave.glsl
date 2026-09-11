// ============================================================
//  RealisLite - Wind-Animation fuer Pflanzen und Blaetter
// ============================================================
#ifndef LIB_WAVE
#define LIB_WAVE
#include "/lib/common.glsl"

// worldPos: absolute Weltposition, strength: 0..1, skyLight: Himmelslicht (kein Wind in Hoehlen)
vec3 windOffset(vec3 worldPos, float time, float strength, float rain, float skyLight) {
    float t = time * WAVING_SPEED;
    // Zwei ueberlagerte Wellen: grosse Boe + kleines Zittern
    float gust  = sin(worldPos.x * 0.35 + worldPos.z * 0.25 + t * 0.9);
    float gust2 = sin(worldPos.x * 0.9 - worldPos.z * 0.6 + t * 1.7) * 0.5;
    float flutter = sin(worldPos.x * 3.1 + worldPos.z * 2.3 + t * 4.5) * 0.15;
    float wind = (gust + gust2 + flutter) * 0.5;
    float wind2 = cos(worldPos.z * 0.45 - worldPos.x * 0.2 + t * 1.1) * 0.5
                + sin(worldPos.z * 1.3 + t * 2.3) * 0.25;
    vec3 off = vec3(wind * 0.07, (gust2 + flutter) * 0.012, wind2 * 0.05);
    float amount = strength * WAVING_STRENGTH * (1.0 + rain * 1.2) * smoothstep(0.2, 0.9, skyLight);
    return off * amount;
}
#endif
