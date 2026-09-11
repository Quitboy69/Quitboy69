#include "/lib/common.glsl"
out vec2 texcoord;
out vec4 vcolor;
out vec3 viewPos;
void main() {
    vec4 pos = gl_ModelViewMatrix * gl_Vertex;
    gl_Position = gl_ProjectionMatrix * pos;
    viewPos = pos.xyz;
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vcolor = gl_Color;
}
