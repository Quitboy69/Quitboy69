// ============================================================
//  RealisLite - Tonemapping & Farbkorrektur
// ============================================================
#ifndef LIB_TONEMAP
#define LIB_TONEMAP
#include "/lib/common.glsl"

vec3 tonemapReinhard(vec3 x) { return x / (1.0 + luminance(x)); }

// ACES (Narkowicz-Fit) - filmischer Look, sehr guenstig
vec3 tonemapACES(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return saturate((x * (a * x + b)) / (x * (c * x + d) + e));
}

vec3 uncharted2Partial(vec3 x) {
    const float A = 0.15, B = 0.50, C = 0.10, D = 0.20, E = 0.02, F = 0.30;
    return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}
vec3 tonemapUncharted2(vec3 x) {
    const float W = 11.2;
    vec3 curr = uncharted2Partial(x * 2.0);
    vec3 white = uncharted2Partial(vec3(W));
    return curr / white;
}

vec3 applyTonemap(vec3 hdr) {
    hdr *= EXPOSURE;
#if TONEMAP == 0
    vec3 c = tonemapReinhard(hdr);
#elif TONEMAP == 1
    vec3 c = tonemapACES(hdr * 0.8);
#else
    vec3 c = tonemapUncharted2(hdr);
#endif
    return saturate(c);
}

vec3 colorGrade(vec3 c) {
    // Saettigung
    float l = luminance(c);
    c = mix(vec3(l), c, SATURATION);
    // Kontrast um Mittelgrau
    c = mix(vec3(0.5), c, CONTRAST);
    return saturate(c);
}
#endif
