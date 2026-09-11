// Bloom: helle Bereiche extrahieren (laeuft nur wenn BLOOM aktiv ist,
// siehe program.composite.enabled in shaders.properties)
#include "/lib/common.glsl"
uniform sampler2D colortex0;
in vec2 texcoord;
/* DRAWBUFFERS:1 */
void main() {
    vec3 c = texture(colortex0, texcoord).rgb;
    float l = luminance(c);
    vec3 bright = c * smoothstep(1.0, 3.0, l);
    // in 8 Bit komprimiert speichern
    bright = bright / (1.0 + bright);
    gl_FragData[0] = vec4(bright, 1.0);
}
