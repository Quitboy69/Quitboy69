# RealisLite 1.0 - Realistischer Minecraft-Shader

Eine leichte, realistische Shader-Suite fuer Minecraft mit **Intel UHD 620** (HP EliteBook 850 G5, i5-8250U/8350U) als Zielhardware.

## Features

- **Dynamische Schatten** – Sun/Moon mit weicher PCF-Filterung
- **Stimmungsvolle Beleuchtung** – Tag/Nacht-Zyklen, Fackellicht, Ambient Occlusion
- **Realistisches Wasser** – Wellen-Animation, Reflexionen (ohne Screen-Space-Overhead)
- **Atmosphaere** – Nebel, Bodenleuchten, prozedurale Sterne, Daemmerungseffekte
- **Bewegung** – Wehende Pflanzen, flatternde Blaetter (kostet wenig)
- **Post-Processing** – Optional Bloom, Filmkorn, Vignette
- **3 Dimensionen** – Overworld, Nether, End mit angepassten Lichtern
- **Sehr guenstig** – 60+ FPS auf UHD 620, auch auf Niedrig-Profile <120 FPS moeglich

## Hardware-Anforderungen

**Empfohlen:**
- Intel UHD 620 oder besser (iGPU moderne CPUs)
- Mind. 4 GB VRAM
- Iris oder OptiFine

**Kompatibel:**
- GTX 1050 Ti und hoeher
- Snapdragon Adreno (mobile via Iris)

**Nicht empfohlen:**
- Integrierte Grafik aelter als UHD 620
- sehr schwache Systeme (Atom, Braswell)

## Installation

1. Speichern Sie `RealisLite.zip` im Shader-Ordner:
   - **Iris (empfohlen):** `.minecraft/shaderpacks/`
   - **OptiFine:** `%AppData%/.minecraft/shaderpacks/`

2. In Minecraft in den **Video-Einstellungen** waehlen.

3. (Optional) Einstellungen im Shader-Menue feinabstimmen.

## Einstellungs-Profile

| Profil | Zielgeraet | Shadow Res | Samples | Bloom | Grain |
|--------|-----------|-----------|---------|-------|-------|
| **Niedrig** | Schwache iGPU | 512 | 1 | Nein | Nein |
| **Mittel** | UHD 620 (STANDARD) | 1024 | 2 | Nein | Nein |
| **Hoch** | GTX 1660 + | 2048 | 3 | Ja | Nein |
| **Ultra** | RTX 3080+ | 4096 | 4 | Ja | Ja |

Waehlen Sie oben im Shader-Menue `profile=...` zum schnellen Umschalten.

## Wichtige Einstellungen

- **SHADOWS** – Der Grossteil des Realismus. Deaktivieren zum Beschleunigen.
- **COLORED_SHADOWS** – Farbige Schatten durch Glas/Wasser (+5-10% FPS-Kosten).
- **BLOOM** – Einfacher Nachbearbeitungs-Pass, optional.
- **FOG_HEIGHT** – Bodenleuchten in tiefen (schoen aber kostet ~2% FPS).
- **SPECULAR** – Glaenzende Oberflaechen bei Regen (0-2% Overhead).
- **WATER_REFLECTION** – Himmel in Wasser (guenstig, kein Ray-Tracing).

## Kompatibilitaet

- **Minecraft Java 1.16+** (getestet bis 1.20.4)
- **Iris** 1.6+ (empfohlen, bessere API)
- **OptiFine Q8+**
- **Dimensionen:** Overworld, Nether, The End

## Lizenz & Kredit

Public Domain. Verwenden, veraendern, weitergeben nach Wunsch.

Danksagungen: Inspired by Continuum, SEUS, Ebin Shaders.

---

Viel Spass!
