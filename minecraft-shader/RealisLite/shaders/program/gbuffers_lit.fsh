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
uniform float alphaTestRef;
#ifdef PROGRAM_ENTITIES
uniform vec4 entityColor;
#endif

in vec2 texcoord;
in vec2 lmcoord;
in vec4 vcolor;
in vec3 normalW;
in vec3 viewPos;
in vec3 shadowPos;
flat in float subsurface;
flat in float emissive;

/* DRAWBUFFERS:0 */

void main() {
    vec4 tex = texture(gtexture, texcoord);
    vec4 albedo = tex * vcolor;
#ifdef PROGRAM_WEATHER
    albedo.a *= 0.5;
#endif
    if (albedo.a < 0.1) discard;

#ifdef PROGRAM_ENTITIES
    albedo.rgb = mix(albedo.rgb, entityColor.rgb, entityColor.a);
#endif

    vec3 alb = srgbToLinear(albedo.rgb);
    vec2 lm = remapLightmap(lmcoord);
    vec3 sunDirW  = normalize(mat3(gbufferModelViewInverse) * sunPosition);
    vec3 moonDirW = normalize(mat3(gbufferModelViewInverse) * moonPosition);
    vec3 viewDirW = normalize(mat3(gbufferModelViewInverse) * viewPos);

#if defined PROGRAM_TEXTURED || defined PROGRAM_WEATHER
    // Partikel / Regen: keine brauchbare Normale -> nur Lightmap-Beleuchtung
    vec3 sunL  = getSunLight(sunDirW, rainStrength);
    vec3 moonL = getMoonLight(moonDirW, rainStrength);
    vec3 skyA  = getSkyAmbient(sunDirW, rainStrength);
    float skyVis = lm.y * lm.y;
    float torch = lm.x * lm.x;
    vec3 light = (sunL * 0.35 + moonL * 0.5) * skyVis + skyA * skyVis * 1.2
               + getTorchColor() * torch * 1.6 * TORCH_INTENSITY
               + vec3(0.01, 0.012, 0.018) + vec3(0.6, 0.75, 0.9) * nightVision * 0.8;
    vec3 color = alb * light;
#ifdef PROGRAM_EMISSIVE
    color = alb * 3.0;
#endif
#else
    vec3 normal = normalize(normalW);
    // Pflanzen/Blaetter sind zweiseitig: Normale zur Kamera drehen
    if (subsurface > 0.0 && dot(normal, viewDirW) > 0.0) normal = -normal;

    bool sunUp = sunDirW.y > -0.02;
    vec3 lightDir = sunUp ? sunDirW : moonDirW;
    float NdotL = dot(normal, lightDir);
    vec3 shadow = vec3(1.0);
    vec3 color = shadeSurface(alb, normal, lm, shadow, sunDirW, moonDirW, viewDirW,
                              rainStrength, wetness, nightVision, subsurface, emissive);
#ifdef PROGRAM_EMISSIVE
    color = alb * 3.0;
#endif
#endif

    gl_FragData[0] = vec4(color, albedo.a);
}
