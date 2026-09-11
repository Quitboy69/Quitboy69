// ============================================================
//  RealisLite - Schatten-Abfrage (Hardware-PCF, sehr guenstig)
//  Erwartet: uniform sampler2DShadow shadowtex0, shadowtex1;
//            uniform sampler2D shadowcolor0;
// ============================================================
#ifndef LIB_SHADOW
#define LIB_SHADOW
#include "/lib/common.glsl"

// shadowClip: Position im Shadow-Clip-Space (undistorted), NdotL fuer Bias
vec3 sampleShadow(vec3 shadowClip, float NdotL, vec2 fragCoord) {
#ifndef SHADOWS
    return vec3(1.0);
#else
    // Ausserhalb der Shadow-Map -> voll beleuchtet
    float edge = length(shadowClip.xy);
    if (edge > 1.15) return vec3(1.0);
    float fade = 1.0 - smoothstep(0.85, 1.1, edge);

    vec3 pos = distortShadow(shadowClip) * 0.5 + 0.5;
    float bias = (0.00035 + 0.0009 * (1.0 - NdotL)) * (2048.0 / float(shadowMapResolution));
    pos.z -= bias;

    float texel = 1.0 / float(shadowMapResolution);
    float radius = texel * SHADOW_SOFTNESS * 1.5;
    float rot = igNoise(fragCoord) * 2.0 * PI;
    float cr = cos(rot), sr = sin(rot);
    mat2 rotM = mat2(cr, -sr, sr, cr);

    float lit = 0.0;
    float total = 0.0;
    vec3 tint = vec3(0.0);
    for (int i = 0; i < SHADOW_SAMPLES; i++) {
        float fi = (float(i) + 0.5) / float(SHADOW_SAMPLES);
        float ang = fi * 2.0 * PI * 1.618;
        vec2 off = rotM * vec2(cos(ang), sin(ang)) * radius * sqrt(fi);
        vec2 uv = pos.xy + off;
        float opaque = texture(shadowtex1, vec3(uv, pos.z));
#ifdef COLORED_SHADOWS
        float all = texture(shadowtex0, vec3(uv, pos.z));
        vec3 c = texture(shadowcolor0, uv).rgb;
        // all==0 && opaque==1 -> nur durchsichtiges im Weg -> faerben
        vec3 s = mix(vec3(all), c * c, opaque - all);
        tint += s * opaque;
#else
        tint += vec3(opaque);
#endif
        total += 1.0;
    }
    tint /= total;
    return mix(vec3(1.0), tint, fade);
#endif
}
#endif
