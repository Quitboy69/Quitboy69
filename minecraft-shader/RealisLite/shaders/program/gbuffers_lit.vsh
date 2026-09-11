// Gemeinsamer Vertex-Shader fuer Terrain, Entities, Hand, Bloecke, Partikel, Wetter
// Aktiv je nach Wrapper: PROGRAM_TERRAIN, PROGRAM_ENTITIES, PROGRAM_HAND,
//                        PROGRAM_TEXTURED, PROGRAM_WEATHER, PROGRAM_EMISSIVE
#include "/lib/common.glsl"
#include "/lib/wave.glsl"

#ifdef PROGRAM_TERRAIN
in vec4 mc_Entity;
in vec2 mc_midTexCoord;
#endif

uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;
uniform vec3 cameraPosition;
uniform float frameTimeCounter;
uniform float rainStrength;

out vec2 texcoord;
out vec2 lmcoord;
out vec4 vcolor;
out vec3 normalW;
out vec3 viewPos;
out vec3 shadowPos;
flat out float subsurface;
flat out float emissive;

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    vcolor   = gl_Color;
    subsurface = 0.0;
    emissive = 0.0;

    vec4 pos = gl_ModelViewMatrix * gl_Vertex;

#ifdef PROGRAM_TERRAIN
    int id = int(mc_Entity.x + 0.5);
    if (id == 10001 || id == 10002 || id == 10003) subsurface = 1.0;
    if (id == 10004) subsurface = 0.6;
    if (id == 10010) emissive = 1.0;

#if defined WAVING_PLANTS || defined WAVING_LEAVES
    vec3 worldPos = (gbufferModelViewInverse * pos).xyz + cameraPosition;
    float wave = 0.0;
#ifdef WAVING_PLANTS
    bool topVertex = gl_MultiTexCoord0.t < mc_midTexCoord.t;
    if (id == 10001 && topVertex) wave = 1.0;
    if (id == 10002 && topVertex) wave = 1.0;
    if (id == 10003) wave = topVertex ? 1.0 : 0.6;
#endif
#ifdef WAVING_LEAVES
    if (id == 10004) wave = 0.55;
#endif
    if (wave > 0.0) {
        vec3 off = windOffset(worldPos, frameTimeCounter, wave, rainStrength, lmcoord.y);
        pos.xyz += mat3(gbufferModelView) * off;
    }
#endif
#endif

    gl_Position = gl_ProjectionMatrix * pos;
    viewPos = pos.xyz;
    normalW = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));

#ifdef SHADOWS
    vec3 playerPos = (gbufferModelViewInverse * pos).xyz;
    vec4 sp = shadowProjection * (shadowModelView * vec4(playerPos, 1.0));
    shadowPos = sp.xyz / sp.w;
#else
    shadowPos = vec3(0.0);
#endif
}
