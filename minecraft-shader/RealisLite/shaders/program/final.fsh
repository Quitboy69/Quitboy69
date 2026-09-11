// Final-Pass: Himmel, Nebel, Bloom, Tonemapping, Farbkorrektur, Vignette
#include "/lib/common.glsl"
#include "/lib/sky.glsl"
#include "/lib/tonemap.glsl"

uniform sampler2D colortex0;
uniform sampler2D colortex1;
uniform sampler2D depthtex0;
uniform mat4 gbufferProjectionInverse;
uniform mat4 gbufferModelViewInverse;
uniform vec3 sunPosition;
uniform vec3 moonPosition;
uniform vec3 cameraPosition;
uniform vec3 fogColor;
uniform float rainStrength;
uniform float frameTimeCounter;
uniform float blindness;
uniform float darknessFactor;
uniform float nightVision;
uniform float far;
uniform float viewWidth;
uniform float viewHeight;
uniform int isEyeInWater;
uniform ivec2 eyeBrightnessSmooth;

#ifdef BLOOM
const bool colortex1MipmapEnabled = true;
#endif

in vec2 texcoord;

void main() {
    vec2 uv = texcoord;
    float depth = texture(depthtex0, uv).r;
    vec3 color = texture(colortex0, uv).rgb;

    vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 vp = gbufferProjectionInverse * ndc;
    vec3 viewPos = vp.xyz / vp.w;
    vec3 playerPos = mat3(gbufferModelViewInverse) * viewPos;
    vec3 dirW = normalize(playerPos);
    vec3 sunDirW  = normalize(mat3(gbufferModelViewInverse) * sunPosition);
    vec3 moonDirW = normalize(mat3(gbufferModelViewInverse) * moonPosition);
    float eyeSky = float(eyeBrightnessSmooth.y) / 240.0;

#if defined DIM_NETHER
    vec3 skyCol = srgbToLinear(fogColor) * 0.9 + vec3(0.02, 0.005, 0.0);
    vec3 fogCol = skyCol;
#elif defined DIM_END
    vec3 skyCol = vec3(0.045, 0.03, 0.07) + vec3(0.9, 0.8, 1.0) * getStars(dirW, frameTimeCounter) * 0.5;
    vec3 fogCol = vec3(0.05, 0.035, 0.08);
#else
    vec3 skyCol = getSkyColor(dirW, sunDirW, moonDirW, rainStrength, frameTimeCounter);
    vec3 fogCol = getFogColor(dirW, sunDirW, moonDirW, rainStrength, frameTimeCounter);
#endif

    bool isSky = depth >= 1.0;
    float dist = length(viewPos);

    if (isSky) {
        // colortex0 enthaelt hier nur Sonne/Mond (additiv), der Rest ist unser Himmel
        color += skyCol;
    } else {
        float fog = 0.0;
#ifdef FOG
#if defined DIM_NETHER
        float density = 0.028 * FOG_DENSITY;
#elif defined DIM_END
        float density = 0.010 * FOG_DENSITY;
#else
        float dusk = 1.0 - smoothstep(0.0, 0.3, abs(sunDirW.y));
        float density = (0.0055 + rainStrength * 0.016 + dusk * 0.004) * FOG_DENSITY;
#endif
        fog = 1.0 - exp(-dist * density);
        // Nebel nur wo der Himmel "hinkommt" (Hoehlen bleiben klar)
        fog *= mix(0.35, 1.0, eyeSky);
#ifdef FOG_HEIGHT
#if !defined DIM_NETHER && !defined DIM_END
        float worldY = cameraPosition.y + playerPos.y;
        float hf = exp(-max(worldY - FOG_HEIGHT_LEVEL, 0.0) * 0.045);
        hf *= 1.0 - exp(-dist * 0.03);
        hf *= 0.35 + dusk * 0.9 + rainStrength * 0.6;
        fog = max(fog, hf * 0.6 * eyeSky);
#endif
#endif
#endif
        // Render-Distanz-Kante immer weich ausblenden
        float edge = smoothstep(far * 0.70, far * 0.98, dist);
        fog = max(fog, edge);
        color = mix(color, fogCol, saturate(fog));

        // Unterwasser / Lava / Pulverschnee
        if (isEyeInWater == 1) {
            vec3 wcol = vec3(0.02, 0.10, 0.22) * (0.15 + eyeSky * 1.3) * (1.0 + nightVision);
            float wf = 1.0 - exp(-dist * 0.09);
            color = mix(color, wcol, wf);
        } else if (isEyeInWater == 2) {
            color = mix(color, vec3(2.0, 0.35, 0.05), 1.0 - exp(-dist * 2.5));
        } else if (isEyeInWater == 3) {
            color = mix(color, vec3(0.9, 0.9, 0.95), 1.0 - exp(-dist * 1.5));
        }
    }
    if (isSky && isEyeInWater == 1) {
        color = mix(color, vec3(0.02, 0.10, 0.22) * (0.15 + eyeSky * 1.3), 0.9);
    }

#ifdef BLOOM
    vec2 px = 1.0 / vec2(viewWidth, viewHeight) * 6.0;
    vec3 b = textureLod(colortex1, uv, 3.0).rgb * 0.4
           + textureLod(colortex1, uv + vec2( px.x, 0.0), 3.5).rgb * 0.15
           + textureLod(colortex1, uv + vec2(-px.x, 0.0), 3.5).rgb * 0.15
           + textureLod(colortex1, uv + vec2(0.0,  px.y), 3.5).rgb * 0.15
           + textureLod(colortex1, uv + vec2(0.0, -px.y), 3.5).rgb * 0.15;
    b = b / max(1.0 - b, 0.05);
    color += b * BLOOM_STRENGTH;
#endif

    // Blindheit / Dunkelheit-Effekt
    color *= 1.0 - blindness * 0.95;
    color *= 1.0 - darknessFactor * 0.85;

    color = applyTonemap(color);
    color = colorGrade(color);

    if (VIGNETTE > 0.0) {
        float vd = length((uv - 0.5) * vec2(1.0, viewHeight / viewWidth) * 2.0);
        color *= 1.0 - VIGNETTE * smoothstep(0.55, 1.35, vd);
    }
#ifdef GRAIN
    float g = igNoise(gl_FragCoord.xy + fract(frameTimeCounter) * 1000.0) - 0.5;
    color += g * GRAIN_STRENGTH;
#endif

    gl_FragData[0] = vec4(linearToSrgb(color), 1.0);
}
