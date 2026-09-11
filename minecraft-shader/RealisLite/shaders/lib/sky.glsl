// ============================================================
//  RealisLite - Himmel, Tageszeit-Farben, Sterne
//  Benoetigt die Uniforms: rainStrength, frameTimeCounter
// ============================================================
#ifndef LIB_SKY
#define LIB_SKY
#include "/lib/common.glsl"

// Alle Farben linear. sunDir/moonDir sind normalisierte Weltvektoren.

// Wie hoch steht die Sonne (0 = Horizont, 1 = Zenit) und "Daempfung" unter dem Horizont
float sunHeight(vec3 sunDir) { return saturate(sunDir.y); }

// Sonnenlicht (direktes Licht) je nach Sonnenstand
vec3 getSunLight(vec3 sunDir, float rain) {
    float h = sunDir.y;
    float above = smoothstep(-0.06, 0.12, h);                 // Auf-/Untergang
    vec3 noon    = vec3(1.00, 0.97, 0.92) * 3.2;
    vec3 sunset  = vec3(1.00, 0.52, 0.22) * 2.0;
    vec3 col = mix(sunset, noon, smoothstep(0.0, 0.45, h));
    col *= above;
    col *= 1.0 - rain * 0.85;
    return col * SUN_INTENSITY;
}

// Mondlicht
vec3 getMoonLight(vec3 moonDir, float rain) {
    float above = smoothstep(-0.05, 0.15, moonDir.y);
    vec3 col = vec3(0.32, 0.42, 0.62) * 0.16 * above;
    col *= 1.0 - rain * 0.8;
    return col * NIGHT_BRIGHTNESS;
}

// Himmelslicht (ambient) - Sichtbarkeit am Zenit
vec3 getSkyAmbient(vec3 sunDir, float rain) {
    float h = sunDir.y;
    float day   = smoothstep(-0.1, 0.25, h);
    vec3 dayAmb   = vec3(0.50, 0.66, 1.00) * 0.62;
    vec3 duskAmb  = vec3(0.60, 0.45, 0.42) * 0.30;
    vec3 nightAmb = vec3(0.12, 0.16, 0.28) * 0.10 * NIGHT_BRIGHTNESS;
    vec3 col = mix(nightAmb, mix(duskAmb, dayAmb, smoothstep(0.0, 0.4, h)), day);
    col = mix(col, vec3(luminance(col)) * vec3(0.85, 0.9, 1.0), rain * 0.6);
    col *= 1.0 - rain * 0.45;
    return col * AMBIENT_INTENSITY;
}

// Sternenfeld (billig, hashbasiert, in Weltrichtung)
float getStars(vec3 dir, float time) {
#ifdef STARS
    if (dir.y < 0.0) return 0.0;
    // Himmel drehen lassen (langsam)
    float a = time * 0.002;
    float ca = cos(a), sa = sin(a);
    dir.xz = mat2(ca, -sa, sa, ca) * dir.xz;
    vec3 p = dir * 180.0;
    vec3 cell = floor(p);
    float h = hash13(cell);
    float star = step(0.985, h);                            // ~1.5% der Zellen
    vec3 f = fract(p) - 0.5;
    float d = length(f);
    float size = mix(0.18, 0.34, hash13(cell + 7.1));
    float shape = saturate(1.0 - d / size);
    shape *= shape;
    float twinkle = 0.7 + 0.3 * sin(time * (1.5 + h * 3.0) + h * 40.0);
    return star * shape * twinkle * smoothstep(0.0, 0.25, dir.y) * STAR_BRIGHTNESS;
#else
    return 0.0;
#endif
}

// Himmelsfarbe fuer eine Blickrichtung (linear, HDR)
vec3 getSkyColor(vec3 dir, vec3 sunDir, vec3 moonDir, float rain, float time) {
    float h  = sunDir.y;
    float up = dir.y;
    float day = smoothstep(-0.12, 0.2, h);
    float dusk = 1.0 - smoothstep(0.0, 0.35, abs(h));       // um den Horizont der Sonne

    // Grundfarben Tag
    vec3 zenithDay  = vec3(0.16, 0.38, 0.92) * 0.85;
    vec3 horizonDay = vec3(0.66, 0.80, 1.00) * 0.95;
    // Nacht
    vec3 zenithNight  = vec3(0.012, 0.02, 0.05) * NIGHT_BRIGHTNESS;
    vec3 horizonNight = vec3(0.04, 0.06, 0.11) * NIGHT_BRIGHTNESS;
    // Daemmerung
    vec3 zenithDusk  = vec3(0.10, 0.16, 0.40);
    vec3 horizonDusk = vec3(0.95, 0.45, 0.22);

    vec3 zenith  = mix(zenithNight,  mix(zenithDusk,  zenithDay,  smoothstep(0.0, 0.35, h)), day);
    vec3 horizon = mix(horizonNight, mix(horizonDusk, horizonDay, smoothstep(0.0, 0.35, h)), day);

    // Horizont-Verlauf: unterhalb des Horizonts leicht abdunkeln (Boden-Dunst)
    float t = saturate(up);
    float grad = pow(1.0 - t, 3.5);
    vec3 col = mix(zenith, horizon, grad);
    col = mix(col, horizon * 0.75, smoothstep(0.0, -0.35, up));

    // Sonnenglow / Daemmerungsstreifen in Sonnenrichtung
    float sd = max(dot(dir, sunDir), 0.0);
    float glow = pow(sd, 6.0) * 0.35 + pow(sd, 48.0) * 0.6;
    vec3 glowCol = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.85, 0.6), smoothstep(0.0, 0.3, h));
    col += glowCol * glow * (0.35 + dusk * 1.2) * day * SUN_GLOW;
    // Daemmerungsband am Horizont in Sonnennaehe
    float band = pow(saturate(1.0 - abs(up) * 3.0), 2.0) * pow(sd * 0.5 + 0.5, 3.0);
    col += vec3(1.0, 0.38, 0.12) * band * dusk * 0.8 * SUN_GLOW;

    // Mondschein
    float md = max(dot(dir, moonDir), 0.0);
    col += vec3(0.5, 0.6, 0.9) * pow(md, 24.0) * 0.06 * (1.0 - day) * NIGHT_BRIGHTNESS;

    // Sterne nur nachts und bei klarem Himmel
    col += vec3(0.9, 0.95, 1.0) * getStars(dir, time) * (1.0 - day) * 0.6;

    // Regen: entsaettigen, abdunkeln, grau
    vec3 rainSky = vec3(luminance(col)) * vec3(0.8, 0.85, 0.95) * 0.55;
    col = mix(col, rainSky, rain * 0.85);

    return col;
}

// Nebelfarbe = Himmelsfarbe nahe Horizont in Blickrichtung
vec3 getFogColor(vec3 dir, vec3 sunDir, vec3 moonDir, float rain, float time) {
    vec3 d = normalize(vec3(dir.x, max(dir.y, 0.0) * 0.15 + 0.02, dir.z));
    return getSkyColor(d, sunDir, moonDir, rain, time);
}
#endif
