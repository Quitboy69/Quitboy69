// ============================================================
//  RealisLite - Beleuchtungsmodell (Forward, im gbuffers-Pass)
//  Benoetigt: uniforms rainStrength, wetness, nightVision,
//             sunDirW/moonDirW als Parameter, shadow lib
// ============================================================
#ifndef LIB_LIGHTING
#define LIB_LIGHTING
#include "/lib/common.glsl"
#include "/lib/sky.glsl"

vec3 getTorchColor() {
#if TORCH_TEMPERATURE == 0
    return vec3(1.00, 0.80, 0.58);
#elif TORCH_TEMPERATURE == 1
    return vec3(1.00, 0.62, 0.32);
#else
    return vec3(1.00, 0.50, 0.20);
#endif
}

// Beleuchtet eine Oberflaeche.
// albedo: linear; normal: Welt-Normale; lm: remapped lightmap (x=block, y=sky)
// shadow: 0..1 (rgb); viewDirW: Richtung Kamera->Fragment (Welt), normalisiert
vec3 shadeSurface(vec3 albedo, vec3 normal, vec2 lm, vec3 shadow,
                  vec3 sunDirW, vec3 moonDirW, vec3 viewDirW,
                  float rain, float wet, float nv, float subsurface, float emissive)
{
#if defined DIM_NETHER
    vec3 sunL  = vec3(0.0);
    vec3 moonL = vec3(0.0);
    vec3 skyA  = vec3(0.0);
    vec3 dimAmbient = vec3(0.32, 0.17, 0.12) * 0.55 * AMBIENT_INTENSITY;
#elif defined DIM_END
    vec3 sunL  = vec3(0.0);
    vec3 moonL = vec3(0.0);
    vec3 skyA  = vec3(0.0);
    vec3 dimAmbient = vec3(0.30, 0.26, 0.40) * 0.45 * AMBIENT_INTENSITY;
#else
    vec3 sunL  = getSunLight(sunDirW, rain);
    vec3 moonL = getMoonLight(moonDirW, rain);
    vec3 skyA  = getSkyAmbient(sunDirW, rain);
    vec3 dimAmbient = vec3(0.0);
#endif

    // Welche Lichtquelle wirft gerade Schatten? (Sonne oder Mond)
    bool sunUp = sunDirW.y > -0.02;
    vec3 lightDir = sunUp ? sunDirW : moonDirW;
    vec3 lightCol = sunUp ? sunL : moonL;

    float NdotL = dot(normal, lightDir);
    // Subsurface: Blaetter/Gras lassen Licht durch -> weicheres Lambert
    float diff = mix(saturate(NdotL), saturate(NdotL * 0.5 + 0.5) * 0.85, subsurface);

    // Himmels-Sichtbarkeit aus Lightmap (Hoehlen dunkel)
    float skyVis = lm.y * lm.y;
    // Direktes Licht nur wo Himmel sichtbar (Shadowmap deckt nicht alles ab)
    vec3 direct = lightCol * diff * shadow * smoothstep(0.1, 0.9, lm.y);

    // Ambient: Himmel von oben etwas staerker, unten dunkler (billige Hemisphaere)
    float hemi = normal.y * 0.25 + 0.75;
    vec3 ambient = skyA * skyVis * hemi;
    // Minimal-Ambient damit Hoehlen nicht komplett schwarz sind
    ambient += vec3(0.010, 0.012, 0.018) * NIGHT_BRIGHTNESS;
    ambient += dimAmbient * (normal.y * 0.3 + 0.7);

    // Fackellicht: quadratischer Abfall, warm
    float torch = lm.x;
    torch = torch * torch * (0.55 + 0.45 * torch);
    vec3 block = getTorchColor() * torch * 1.9 * TORCH_INTENSITY;
    // Fackellicht abschwaechen wo Sonne stark ist (sonst ueberbelichtet)
    block *= 1.0 - saturate(luminance(direct)) * 0.5;

    vec3 light = direct + ambient + block;

    // Nachtsicht
    light += vec3(0.6, 0.75, 0.9) * nv * 0.8;

    vec3 color = albedo * light;

#ifdef SPECULAR
    // Guenstiges Blinn-Phong-Glanzlicht (nur Sonne/Mond), staerker bei Naesse
    vec3 h = normalize(lightDir - viewDirW);
    float NdotH = saturate(dot(normal, h));
    float gloss = 0.03;
#ifdef RAIN_WETNESS
    // Nur Oberflaechen unter freiem Himmel werden nass
    float wetMask = wet * smoothstep(0.7, 1.0, lm.y) * saturate(normal.y * 0.8 + 0.5);
    gloss += wetMask * 0.35;
    color *= 1.0 - wetMask * 0.25;   // nasse Flaechen wirken dunkler
#endif
    float specPow = mix(16.0, 96.0, saturate(gloss * 2.5));
    float spec = pow(NdotH, specPow) * gloss * (specPow + 2.0) / 8.0;
    color += lightCol * spec * shadow * step(0.0, NdotL) * smoothstep(0.3, 0.9, lm.y);
#endif

    // Emissive Bloecke (Lava, Glowstone, ...) leuchten von selbst
    color += albedo * emissive * 2.5;

    return color;
}
#endif
