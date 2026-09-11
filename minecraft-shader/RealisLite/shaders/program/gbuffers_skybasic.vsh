#include "/lib/common.glsl"
out vec4 vcolor;
void main() {
    gl_Position = ftransform();
    vcolor = gl_Color;
}
