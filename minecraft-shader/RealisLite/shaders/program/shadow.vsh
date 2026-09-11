// Shadow-Pass: Tiefe (und Farbe) aus Sicht der Sonne
#include "/lib/common.glsl"
#include "/lib/wave.glsl"

in vec4 mc_Entity;
in vec2 mc_midTexCoord;

uniform mat4 shadowModelViewInverse;
uniform vec3 cameraPosition;
uniform float frameTimeCounter;
uniform float rainStrength;

out vec2 texcoord;
out vec4 vcolor;

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vcolor = gl_Color;
    vec4 pos = gl_ModelViewMatrix * gl_Vertex;
    int id = int(mc_Entity.x + 0.5);

#if defined WAVING_PLANTS || defined WAVING_LEAVES
    vec3 worldPos = (shadowModelViewInverse * pos).xyz + cameraPosition;
    float skyLight = (gl_TextureMatrix[1] * gl_MultiTexCoord1).y;
    float wave = 0.0;
#ifdef WAVING_PLANTS
    bool topVertex = gl_MultiTexCoord0.t < mc_midTexCoord.t;
    if (id == 10001 && topVertex) wave = 1.0;          // kleine Pflanzen: nur oben
    if (id == 10002 && topVertex) wave = 1.0;          // hohe Pflanze unten: nur oben
    if (id == 10003) wave = topVertex ? 1.0 : 0.6;     // hohe Pflanze oben: ganz
#endif
#ifdef WAVING_LEAVES
    if (id == 10004) wave = 0.55;
#endif
    if (wave > 0.0) {
        vec3 off = windOffset(worldPos, frameTimeCounter, wave, rainStrength, skyLight);
        pos.xyz += mat3(gl_ModelViewMatrix) * off;
    }
#endif
    vec4 clip = gl_ProjectionMatrix * pos;
    clip.xyz = distortShadow(clip.xyz);
    gl_Position = clip;
#if defined DIM_NETHER || defined DIM_END
    // Keine Sonne -> Shadow-Pass leer lassen (spart GPU-Zeit)
    gl_Position = vec4(0.0, 0.0, 10.0, 1.0);
#endif
}
