#include "/lib/common.glsl"
#include "/lib/sky.glsl"
#include "/lib/shadow.glsl"
#include "/lib/lighting.glsl"

uniform sampler2D gtexture;
//
//
//

uniform mat4 gbufferModelViewInverse;
uniform vec3 sunPosition;
uniform vec3 moonPosition;
uniform float rainStrength;
uniform float wetness;
uniform float nightVision;
uniform float frameTimeCounter;
uniform int isEyeInWater;

in vec2 texcoord;
in vec2 lmcoord;
in vec4 vcolor;
in vec3 normalW;
in vec3 viewPos;
in vec3 worldPos;
in vec3 shadowPos;
flat in float isWater;

/* DRAWBUFFERS:0 */

// Wellen-Gradient (analytisch, 4 Sinuswellen) -> Normale ohne Textur
vec2 waveGradient(vec2 p, float t) {
    vec2 g = vec2(0.0);
    // (Richtung, Frequenz, Geschwindigkeit, Amplitude)
    vec2 d1 = normalize(vec2(1.0, 0.6));  float f1 = 1.4; float s1 = 1.6; float a1 = 1.0;
    vec2 d2 = normalize(vec2(-0.7, 1.0)); float f2 = 2.3; float s2 = 2.1; float a2 = 0.55;
    vec2 d3 = normalize(vec2(0.3, -1.0)); float f3 = 4.1; float s3 = 3.0; float a3 = 0.28;
    vec2 d4 = normalize(vec2(-1.0, -0.4));float f4 = 7.5; float s4 = 4.2; float a4 = 0.12;
    g += d1 * f1 * a1 * cos(dot(d1, p) * f1 + t * s1);
    g += d2 * f2 * a2 * cos(dot(d2, p) * f2 + t * s2);
    g += d3 * f3 * a3 * cos(dot(d3, p) * f3 + t * s3);
    g += d4 * f4 * a4 * cos(dot(d4, p) * f4 + t * s4);
    return g * 0.028 * WATER_WAVE_HEIGHT;
}

void main() {
    vec4 tex = texture(gtexture, texcoord);
    vec4 albedo = tex * vcolor;
    vec2 lm = remapLightmap(lmcoord);
    vec3 sunDirW  = normalize(mat3(gbufferModelViewInverse) * sunPosition);
    vec3 moonDirW = normalize(mat3(gbufferModelViewInverse) * moonPosition);
    vec3 viewDirW = normalize(mat3(gbufferModelViewInverse) * viewPos);
    vec3 normal = normalize(normalW);

    bool sunUp = sunDirW.y > -0.02;
    vec3 lightDir = sunUp ? sunDirW : moonDirW;
    vec3 lightCol = sunUp ? getSunLight(sunDirW, rainStrength) : getMoonLight(moonDirW, rainStrength);
    vec3 skyA = getSkyAmbient(sunDirW, rainStrength);
    float skyVis = lm.y * lm.y;

    vec3 color;
    float alpha = albedo.a;

    if (isWater > 0.5) {
        // ---------- Wasser ----------
#if WATER_COLOR_MODE == 1
        vec3 waterTint = vec3(0.16, 0.55, 0.72);
#else
        vec3 waterTint = srgbToLinear(vcolor.rgb);
#endif
        float detail = mix(0.75, 1.25, tex.r);
        vec3 alb = waterTint * 0.55 * detail;

        float fromBelow = (normal.y < -0.5) ? 1.0 : 0.0;
#ifdef WATER_WAVES
        if (abs(normal.y) > 0.5) {
            vec2 g = waveGradient(worldPos.xz, frameTimeCounter);
            normal = normalize(vec3(-g.x, 1.0, -g.y));
            if (fromBelow > 0.5) normal.y = -normal.y;
        }
#endif
        float NdotL = dot(normal, lightDir);
        vec3 shadow = vec3(1.0);
        float torch = lm.x * lm.x;
        vec3 diffuse = alb * (skyA * skyVis * 1.1 + lightCol * shadow * saturate(NdotL) * 0.35
                             + getTorchColor() * torch * 1.2 * TORCH_INTENSITY + vec3(0.01, 0.012, 0.018));

        float cosT = saturate(dot(-viewDirW, normal));
        float fresnel = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
        if (isEyeInWater == 1) fresnel *= 0.3;

        vec3 refl = vec3(0.0);
#ifdef WATER_REFLECTION
        vec3 R = reflect(viewDirW, normal);
        vec3 Rsky = normalize(vec3(R.x, max(R.y, 0.03), R.z));
        refl = getSkyColor(Rsky, sunDirW, moonDirW, rainStrength, frameTimeCounter) * smoothstep(0.2, 0.9, lm.y);
        // Sonnen-/Mond-Glanz auf den Wellen
        float RdotL = saturate(dot(R, lightDir));
        float spec = pow(RdotL, 600.0) * 2.5 + pow(RdotL, 48.0) * 0.12;
        refl += lightCol * spec * shadow * smoothstep(0.2, 0.9, lm.y);
#else
        refl = skyA * skyVis;
#endif
        color = mix(diffuse, refl, fresnel);
        alpha = mix(WATER_ALPHA, 1.0, fresnel);
        if (isEyeInWater == 1) alpha = 0.55;
    } else {
        // ---------- Glas, Eis, Portale, ... ----------
        if (albedo.a < 0.02) discard;
        vec3 alb = srgbToLinear(albedo.rgb);
        float NdotL = dot(normal, lightDir);
        vec3 shadow = vec3(1.0);
#ifdef SHADOWS
#endif
        color = shadeSurface(alb, normal, lm, shadow, sunDirW, moonDirW, viewDirW,
                             rainStrength, wetness, nightVision, 0.0, 0.0);
        // Glas: leichter Himmelsglanz an flachen Winkeln
        float cosT = saturate(dot(-viewDirW, normal));
        float fresnel = 0.04 + 0.6 * pow(1.0 - cosT, 5.0);
        color += skyA * skyVis * fresnel * 0.5;
        alpha = saturate(albedo.a + fresnel * 0.3);
    }

    gl_FragData[0] = vec4(color, alpha);
}
