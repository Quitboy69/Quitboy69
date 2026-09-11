// ============================================================
//  RealisLite - gemeinsame Hilfsfunktionen
// ============================================================
#ifndef LIB_COMMON
#define LIB_COMMON

#include "/lib/settings.glsl"

// Nether/End: keine Sonne -> keine Schatten (Wrapper in world-1/world1 definieren DIM_*)
#if defined DIM_NETHER || defined DIM_END
#undef SHADOWS
#endif

#define PI 3.14159265359
#define EPS 1e-5

// sRGB <-> linear (Farbe wird intern immer linear verrechnet)
vec3 srgbToLinear(vec3 c) { return pow(max(c, vec3(0.0)), vec3(GAMMA)); }
vec3 linearToSrgb(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / GAMMA)); }

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3  saturate(vec3 x)  { return clamp(x, 0.0, 1.0); }

// Billige Hash-/Rauschfunktionen (keine Textur noetig)
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Interleaved-Gradient-Noise: dithert Schatten/Nebel ohne Textur
float igNoise(vec2 fragCoord) {
    return fract(52.9829189 * fract(0.06711056 * fragCoord.x + 0.00583715 * fragCoord.y));
}

// Vanilla-Lightmap (0..1) in nutzbare Werte umrechnen
vec2 remapLightmap(vec2 lm) {
    lm = (lm * 33.05 / 32.0) - (1.05 / 32.0);
    return clamp(lm, 0.0, 1.0);
}

// Schatten-Verzerrung: mehr Aufloesung nahe am Spieler
vec3 distortShadow(vec3 pos) {
    float dist = length(pos.xy);
    float factor = mix(1.0, dist, SHADOW_DISTORTION);
    pos.xy /= factor;
    pos.z *= 0.25;
    return pos;
}

#endif
