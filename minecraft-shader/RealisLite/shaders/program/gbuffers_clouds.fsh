#include "/lib/common.glsl"
#include "/lib/sky.glsl"
uniform sampler2D gtexture;
uniform mat4 gbufferModelViewInverse;
uniform vec3 sunPosition;
uniform vec3 moonPosition;
uniform float rainStrength;
in vec2 texcoord;
in vec4 vcolor;
in vec3 viewPos;
/* DRAWBUFFERS:0 */
void main() {
    vec4 t = texture(gtexture, texcoord) * vcolor;
    if (t.a < 0.05) discard;
    vec3 sunDirW  = normalize(mat3(gbufferModelViewInverse) * sunPosition);
    vec3 moonDirW = normalize(mat3(gbufferModelViewInverse) * moonPosition);
    vec3 alb = srgbToLinear(t.rgb);
    vec3 light = getSkyAmbient(sunDirW, rainStrength) * 1.6
               + (getSunLight(sunDirW, rainStrength) + getMoonLight(moonDirW, rainStrength)) * 0.42;
    vec3 col = alb * light * CLOUD_BRIGHTNESS;
    col *= 1.0 - rainStrength * 0.35;
    gl_FragData[0] = vec4(col, t.a * 0.85);
}
