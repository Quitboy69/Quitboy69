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

## Nur in VS Code – alles per Klick

Kein Tippen im Terminal nötig. Ablauf komplett über die VS-Code-Oberfläche:

1. **Ordner öffnen:** `Datei → Ordner öffnen …` → den Projektordner wählen.
   Beim ersten Öffnen unten rechts die empfohlenen Erweiterungen installieren
   (Python, Pylance, debugpy).
2. **Einrichten (einmalig):** Befehlspalette öffnen mit `Strg + Shift + P` →
   `Tasks: Run Task` → **Jarvis: Einrichten (Text-Modus)**. Das legt die
   Umgebung an und installiert die leichten Pakete (dauert kurz).
3. **API-Key hinterlegen:** im Datei-Explorer links Rechtsklick auf
   `.env.example` → *Kopieren*, dann *Einfügen*, die Kopie in **`.env`**
   umbenennen und den `ANTHROPIC_API_KEY` eintragen. VS Code lädt `.env`
   beim Start automatisch.
4. **Interpreter wählen:** `Strg + Shift + P` → `Python: Select Interpreter`
   → den Eintrag mit **`.venv`** anklicken.
5. **Starten:** Taste **F5** → **Jarvis: GUI starten**. Das Fenster öffnet
   sich; unten ins Textfeld schreiben und auf *Senden* klicken.

Weitere Startknöpfe unter **Ausführen und Debuggen** (F5-Menü):
*Jarvis: Konsolenmodus*, *Jarvis: Tests (pytest)*, *Python: Aktuelle Datei*.

Die Tests laufen auch direkt im Test-Explorer (pytest ist vorkonfiguriert) und
brauchen weder API-Key noch Netzwerk.

> Für Stimme und Kamera später optional den Task
> **Jarvis: Voll-Setup (Sprache + Kamera)** ausführen – für den Textbetrieb
> nicht nötig.

## Bedienung: Text statt Stimme

Standardmäßig läuft Jarvis als **Text-Assistent**: du tippst eine Nachricht
(GUI-Textfeld oder Konsole), er reagiert. Es wird **nichts** mitgehört – kein
Wake-Word, keine Mikrofon-Aufnahme. Antworten werden nur dann vorgelesen, wenn
eine Piper-Stimme installiert ist; sonst bleibt es rein textbasiert.

Sprachsteuerung lässt sich jederzeit wieder einschalten in `jarvis/config.py`:

```python
enable_voice_input: bool = True    # Mikrofon + Whisper
enable_wake_word: bool = True      # Aktivierungswort "jarvis"
enable_voice_output: bool = True   # Antworten vorlesen
```

## Konfiguration

Alle Einstellungen (Modell, Whisper-Größe, Piper-Stimme, Kamera-Index, YOLO-Modell,
Bestätigungspflicht, Sprachsteuerung) stehen zentral in `jarvis/config.py`.
