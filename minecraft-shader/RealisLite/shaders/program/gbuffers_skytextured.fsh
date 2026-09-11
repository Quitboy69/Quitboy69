// Sonne, Mond (Overworld) bzw. End-Himmel
#include "/lib/common.glsl"
uniform sampler2D gtexture;
uniform mat4 gbufferModelViewInverse;
uniform vec3 sunPosition;
uniform float rainStrength;
in vec2 texcoord;
in vec4 vcolor;
in vec3 viewPos;
/* DRAWBUFFERS:0 */
void main() {
    vec4 t = texture(gtexture, texcoord) * vcolor;
    vec3 lin = srgbToLinear(t.rgb);
#ifdef DIM_END
    gl_FragData[0] = vec4(lin * 0.25, t.a);
#else
    vec3 sunDirW = normalize(mat3(gbufferModelViewInverse) * sunPosition);
    bool isSun = dot(normalize(viewPos), normalize(sunPosition)) > 0.0;
    float h = sunDirW.y;
    vec3 col;
    if (isSun) {
        vec3 tint = mix(vec3(1.0, 0.42, 0.18), vec3(1.0, 0.96, 0.9), smoothstep(0.0, 0.3, h));
        float bright = mix(1.5, 14.0, smoothstep(-0.05, 0.25, h));
        col = lin * tint * bright;
    } else {
        col = lin * vec3(0.85, 0.9, 1.0) * 1.6 * NIGHT_BRIGHTNESS;
    }
    col *= 1.0 - rainStrength * 0.95;
    gl_FragData[0] = vec4(col, t.a);
#endif
}
