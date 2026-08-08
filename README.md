# JARVIS

Ein lokaler Sprachassistent für Ubuntu, der genau der Architektur aus dem Konzept
folgt. Wake Word, Spracherkennung, ein Fable-5-Agent für Planung und Reasoning,
Ubuntu-Steuerung, ein Kameramodul und eine moderne Oberfläche.

## Architektur

```
Wake Word (Jarvis)        Porcupine / OpenWakeWord
        ↓
Speech-to-Text            Whisper
        ↓
Fable 5 Agent             Planung & Reasoning
        ↓          ↓
Vision System      Ubuntu Tools
YOLOv11            — Terminal
        ↓          — Dateien
Text-to-Speech     — Browser
Piper / Kokoro
```

## Komponenten

| Konzept-Baustein        | Umsetzung                                   | Datei |
|-------------------------|---------------------------------------------|-------|
| Wake Word               | OpenWakeWord / Picovoice Porcupine          | `jarvis/wake_word.py` |
| Spracherkennung         | faster-whisper / whisper.cpp                | `jarvis/speech.py` |
| Sprachausgabe           | Piper TTS                                    | `jarvis/speech.py` |
| Agent (Planung/Reasoning) | Claude Fable 5, Tool-Use                   | `jarvis/agent.py` |
| Ubuntu-Steuerung        | `terminal`, `browser`, `filesystem`         | `jarvis/tools/` |
| Kameramodul             | Ultralytics YOLO (YOLOv11) + OpenCV         | `jarvis/vision.py` |
| GUI                     | PySide6 + PyQtGraph                          | `jarvis/gui/` |
| Systemdaten             | psutil + nvidia-smi                          | `jarvis/system_stats.py` |
| Orchestrierung          | verbindet den kompletten Ablauf             | `jarvis/main.py` |

## Sicherer Ansatz

Wie im Konzept behält der Nutzer die Kontrolle. Der Agent schlägt Aktionen vor:

```
Jarvis:
Ich möchte Firefox öffnen.
Ausführen? [Ja/Nein]
```

Sicherheitskritische Aktionen (Terminal-Befehle, schreibende Dateioperationen)
werden erst nach Bestätigung ausgeführt. Zusätzlich blockiert eine Blocklist
zerstörerische Befehle.

## GUI

Die Oberfläche zeigt Mikrofonstatus, Kamerastatus, CPU/GPU-Auslastung, den
aktuellen Gedankengang, aktive Tools, den Gesprächsverlauf, den Kamera-Feed und
Ubuntu-Systemdaten – im Layout aus dem Konzept:

```
┌──────────────────────────────┐
│            JARVIS            │
├──────────────────────────────┤
│ Gedanken                     │
├──────────────┬───────────────┤
│ Kamera Feed  │ Terminal /    │
│              │ Aktionen      │
├──────────────┴───────────────┤
│ Mikrofon aktiv · CPU · GPU   │
└──────────────────────────────┘
```

## Installation

```bash
cd jarvis
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Optional (Ubuntu-Pakete für Audio):
sudo apt install portaudio19-dev libportaudio2 xdg-utils

# API-Key für den Agenten:
export ANTHROPIC_API_KEY="sk-ant-..."

# Piper-Stimme (Deutsch) herunterladen, z. B.:
#   de_DE-thorsten-medium.onnx  ->  ~/.local/share/piper/
```

## Start

```bash
# Mit grafischer Oberfläche
python -m jarvis.main

# Reiner Konsolenmodus (ohne GUI)
python -m jarvis.main --console
```

Alle externen Abhängigkeiten (Whisper, Piper, YOLO, Wake-Word-Engines,
Audio-Stack) sind **optional** und werden erst bei Bedarf geladen. Fehlt eine
Komponente, schaltet Jarvis automatisch auf einen funktionierenden Fallback um
(z. B. Enter-Taste statt Wake Word, Text-Eingabe statt Mikrofon), sodass sich das
System auch Stück für Stück einrichten lässt.

## Konfiguration

Alle Einstellungen (Modell, Whisper-Größe, Piper-Stimme, Kamera-Index, YOLO-Modell,
Bestätigungspflicht) stehen zentral in `jarvis/config.py`.
