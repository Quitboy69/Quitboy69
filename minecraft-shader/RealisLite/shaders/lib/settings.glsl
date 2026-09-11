// ============================================================
//  RealisLite - Einstellungen / Settings
//  Alle Optionen sind im Shader-Menue von Iris/OptiFine aenderbar.
//  Standardwerte sind auf Intel UHD 620 (HP EliteBook 850 G5) abgestimmt.
// ============================================================

// ---- Schatten / Shadows ----
const int   shadowMapResolution   = 1024;   // [512 768 1024 1536 2048 3072 4096]
const float shadowDistance        = 96.0;   // [48.0 64.0 80.0 96.0 128.0 160.0 192.0 256.0]
const float shadowDistanceRenderMul = 1.0;
const bool  shadowHardwareFiltering = true;
const float sunPathRotation       = -32.0;  // [-60.0 -50.0 -40.0 -32.0 -25.0 -15.0 0.0 15.0 25.0 32.0 40.0 50.0 60.0]
const float shadowIntervalSize    = 1.0;

#define SHADOWS                 // Dynamische Schatten (groesster Realismus-Gewinn)
#define SHADOW_SAMPLES 2        // [1 2 3 4]
#define SHADOW_SOFTNESS 1.0     // [0.5 0.75 1.0 1.5 2.0 3.0]
#define SHADOW_DISTORTION 0.85  // [0.7 0.8 0.85 0.9]
//#define COLORED_SHADOWS       // Farbige Schatten durch Glas/Wasser (kostet etwas)
#define ENTITY_SHADOWS          // Schatten von Mobs und Spielern

// ---- Beleuchtung / Lighting ----
#define SUN_INTENSITY 1.0       // [0.6 0.8 1.0 1.2 1.4 1.6]
#define AMBIENT_INTENSITY 1.0   // [0.6 0.8 1.0 1.2 1.4]
#define TORCH_INTENSITY 1.0     // [0.5 0.75 1.0 1.25 1.5 2.0]
#define TORCH_TEMPERATURE 1     // [0 1 2]  0 = kuehl, 1 = warm, 2 = sehr warm
#define NIGHT_BRIGHTNESS 1.0    // [0.5 0.75 1.0 1.5 2.0 3.0]
#define SPECULAR                // Glanzlichter auf Oberflaechen (Sonne/Regen)
#define RAIN_WETNESS            // Nasse, glaenzende Oberflaechen bei Regen

// ---- Himmel & Nebel / Sky & Fog ----
#define STARS                   // Prozedurale Sterne bei Nacht
#define STAR_BRIGHTNESS 1.0     // [0.5 0.75 1.0 1.5 2.0]
#define SUN_GLOW 1.0            // [0.0 0.5 1.0 1.5 2.0]
#define FOG                     // Atmosphaerischer Nebel
#define FOG_DENSITY 1.0         // [0.25 0.5 0.75 1.0 1.25 1.5 2.0 3.0]
#define FOG_HEIGHT              // Bodennebel in Taelern (morgens/abends staerker)
#define FOG_HEIGHT_LEVEL 64.0   // [40.0 48.0 56.0 64.0 72.0 80.0 96.0]
#define CLOUD_BRIGHTNESS 1.0    // [0.5 0.75 1.0 1.25 1.5]

// ---- Wasser / Water ----
#define WATER_WAVES             // Animierte Wellen
#define WATER_WAVE_HEIGHT 1.0   // [0.25 0.5 0.75 1.0 1.5 2.0]
#define WATER_REFLECTION        // Himmels- und Sonnenreflexion (guenstig, kein SSR)
#define WATER_ALPHA 0.72        // [0.5 0.6 0.66 0.72 0.8 0.9]
#define WATER_COLOR_MODE 0      // [0 1]  0 = Biom-Farbe, 1 = klares Tropenwasser

// ---- Bewegung / Animation ----
#define WAVING_PLANTS           // Gras, Blumen, Getreide wehen im Wind
#define WAVING_LEAVES           // Blaetter wehen im Wind
#define WAVING_STRENGTH 1.0     // [0.25 0.5 0.75 1.0 1.25 1.5 2.0]
#define WAVING_SPEED 1.0        // [0.5 0.75 1.0 1.25 1.5 2.0]

// ---- Bildlook / Post ----
#define TONEMAP 1               // [0 1 2]  0 = Reinhard, 1 = ACES (filmisch), 2 = Uncharted 2
#define EXPOSURE 1.0            // [0.6 0.7 0.8 0.9 1.0 1.1 1.2 1.3 1.5]
#define SATURATION 1.05         // [0.8 0.9 1.0 1.05 1.1 1.2 1.3]
#define CONTRAST 1.0            // [0.85 0.9 0.95 1.0 1.05 1.1 1.2]
#define VIGNETTE 0.25           // [0.0 0.15 0.25 0.35 0.5]
//#define BLOOM                 // Leichtes Leuchten heller Flaechen (1 Extra-Pass, ~5-10% FPS)
#define BLOOM_STRENGTH 0.12     // [0.05 0.08 0.12 0.16 0.2 0.3]
//#define GRAIN                 // Feines Filmkorn gegen Banding
#define GRAIN_STRENGTH 0.02     // [0.01 0.02 0.03 0.05]
#define GAMMA 2.2               // [2.0 2.1 2.2 2.3 2.4]

// ---- Puffer / Buffers ----
