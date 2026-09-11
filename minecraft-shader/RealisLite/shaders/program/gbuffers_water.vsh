// Durchsichtige Bloecke: Wasser, Glas, Eis, ...
#include "/lib/common.glsl"

in vec4 mc_Entity;

uniform mat4 gbufferModelViewInverse;
uniform mat4 shadowModelView;
uniform mat4 shadowProjection;
uniform vec3 cameraPosition;

out vec2 texcoord;
out vec2 lmcoord;
out vec4 vcolor;
out vec3 normalW;
out vec3 viewPos;
out vec3 worldPos;
out vec3 shadowPos;
flat out float isWater;

void main() {
    texcoord = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    lmcoord  = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    vcolor   = gl_Color;
    isWater  = (int(mc_Entity.x + 0.5) == 10008) ? 1.0 : 0.0;

    vec4 pos = gl_ModelViewMatrix * gl_Vertex;
    gl_Position = gl_ProjectionMatrix * pos;
    viewPos = pos.xyz;
    vec3 playerPos = (gbufferModelViewInverse * pos).xyz;
    worldPos = playerPos + cameraPosition;
    normalW = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));

#ifdef SHADOWS
    vec4 sp = shadowProjection * (shadowModelView * vec4(playerPos, 1.0));
    shadowPos = sp.xyz / sp.w;
#else
    shadowPos = vec3(0.0);
#endif
}
