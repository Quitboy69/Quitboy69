#include "/lib/common.glsl"
in vec4 vcolor;
/* DRAWBUFFERS:0 */
void main() {
    // Der komplette Himmel wird im Final-Pass prozedural gezeichnet.
    // Vanilla-Himmelskuppel, Void-Ebene, Sonnenaufgangsstreifen und Sterne
    // werden daher verworfen (Tiefe bleibt 1.0 = "Himmel").
    discard;
}
