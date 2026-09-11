#include "/lib/common.glsl"
uniform sampler2D gtexture;
in vec2 texcoord;
in vec4 vcolor;

void main() {
    vec4 col = texture(gtexture, texcoord) * vcolor;
    if (col.a < 0.1) discard;
    // shadowcolor0: Farbe fuer farbige Schatten (Glas, Wasser)
    gl_FragData[0] = vec4(col.rgb, col.a);
}
