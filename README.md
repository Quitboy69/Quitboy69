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
| Merkzettel              | `notes` — persistente Notizen               | `jarvis/tools/notes.py` |
| Aufräum-Automatik       | `organize` — sortiert Ordner nach Dateityp  | `jarvis/tools/organizer.py` |
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

Sicherheitskritische Aktionen (Terminal-Befehle, schreibende Dateioperationen,
Aufräumen mit `apply=true`) werden erst nach Bestätigung ausgeführt. Zusätzlich
blockiert eine Blocklist zerstörerische Befehle. Über
`require_confirmation = False` in `jarvis/config.py` lässt sich die Rückfrage
bewusst abschalten.

## Notizen & Aufräumen

Zwei Alltags-Werkzeuge, die Jarvis per Stimme nutzt:

- **Notizen**: „Jarvis, merk dir: Milch kaufen“ / „Was habe ich mir gemerkt?“ —
  gespeichert unter `~/.local/share/jarvis/notes.json`, überlebt Neustarts.
- **Aufräumen**: „Räum meine Downloads auf“ — sortiert lose Dateien in
  Unterordner (Bilder, Dokumente, Musik, Videos, Archive, Programme, Sonstiges).
  Jarvis zeigt erst eine Vorschau und verschiebt erst nach Bestätigung.

Das Aufräumen funktioniert auch ohne Jarvis als eigenständiges Kommando:

```bash
python -m jarvis.tools.organizer ~/Downloads            # Vorschau
python -m jarvis.tools.organizer ~/Downloads --apply    # wirklich verschieben
```

## Projekt-Website (GitHub Pages)

Unter `docs/` liegt eine fertige Landing-Page für das Projekt. Veröffentlichen:

1. GitHub → Repository → **Settings** → **Pages**
2. Source: *Deploy from a branch*, Branch: `main`, Ordner: `/docs`
3. Nach kurzer Zeit ist die Seite unter `https://quitboy69.github.io/Quitboy69/` erreichbar.

Die Seite enthält bereits eine „Unterstützen“-Sektion (GitHub-Stern, Sponsoring,
Einrichtung als Dienstleistung) — Links zu Ko-fi/GitHub Sponsors einfach in
`docs/index.html` eintragen, sobald vorhanden.

## GUI

Die Oberfläche zeigt Mikrofonstatus, Kamerastatus, CPU/GPU-Auslastung, den
aktuellen Gedankengang, aktive Tools, den Gesprächsverlauf, den Kamera-Feed und
Ubuntu-Systemdaten – im Layout aus dem Konzept.

- **🎤-Button (Push-to-Talk)**: einmal zuhören, ohne auf das Wake Word zu
  warten — praktisch, solange keine Wake-Word-Engine installiert ist. Fehlt die
  Spracherkennung, ist der Button ausgegraut und nennt im Tooltip das fehlende Paket.
- **Kamera-Feed** funktioniert schon mit OpenCV allein
  (`pip install opencv-python`); YOLO ist nur für die Objekterkennung nötig.
- **Backend-Anzeige** in der Fußzeile: zeigt, welche Engines gerade aktiv
  sind (STT/TTS/Wake/Vision) — steht dort `none`, fehlt das jeweilige Paket.
- **Fehlt der API-Key**, sagt es die GUI direkt im Gedanken-Panel.

### GUI startet nicht?

Häufigste Ursache auf frischem Ubuntu sind fehlende Qt-Bibliotheken
(`ImportError: libEGL.so.1: cannot open shared object file`):

```bash
sudo apt install -y libegl1 libgl1 libxkbcommon0 libxkbcommon-x11-0 \
  libdbus-1-3 libfontconfig1 libxrender1 libxi6 libxcb-cursor0 \
  libxcb-icccm4 libxcb-keysyms1 libxcb-shape0 libxcb-xkb1 \
  libxcb-randr0 libxcb-render-util0 libxcb-image0
```

`jarvis/setup.sh` installiert diese Pakete mit und prüft am Ende selbst, ob
sich die Oberfläche aufbauen lässt. Schnelltest von Hand:

```bash
QT_QPA_PLATFORM=offscreen python -m pytest jarvis/tests/test_gui.py -v
```

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

# API-Key für den Agenten (siehe Abschnitt "API-Key besorgen"):
cp ../.env.example ../.env   # und den Schlüssel in .env eintragen
# oder direkt exportieren:
export ANTHROPIC_API_KEY="sk-ant-..."

# Piper-Stimme (Deutsch) herunterladen, z. B.:
#   de_DE-thorsten-medium.onnx  ->  ~/.local/share/piper/
```

## API-Key besorgen

Jarvis braucht einen Anthropic-API-Schlüssel für den Agenten:

1. [console.anthropic.com](https://console.anthropic.com) öffnen und einloggen
   (oder ein Konto anlegen).
2. Im Menü **API Keys** → **Create Key** wählen.
3. Den Schlüssel (`sk-ant-…`) kopieren — er wird nur einmal angezeigt.
4. `.env.example` nach `.env` kopieren und den Schlüssel dort eintragen.
   Jarvis lädt die `.env` beim Start automatisch; ein `export
   ANTHROPIC_API_KEY=…` in der Shell hat Vorrang.

Die Nutzung kostet API-Guthaben — unter **Billing** in der Console aufladen
und den Verbrauch einsehen.

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

## In VS Code entwickeln

Das Projekt bringt eine fertige `.vscode`-Konfiguration mit.

1. Ordner in VS Code öffnen und die empfohlenen Erweiterungen installieren
   (Python, Pylance, debugpy – Vorschlag erscheint automatisch).
2. Umgebung anlegen und Abhängigkeiten installieren – über die Befehlspalette
   `Tasks: Run Task` → *Jarvis: venv anlegen*, dann *Jarvis: Abhängigkeiten
   installieren* (oder *Jarvis: Voll-Setup (setup.sh)* für Stimme + YOLO-Modell).
3. `.env.example` nach `.env` kopieren und den `ANTHROPIC_API_KEY` eintragen –
   VS Code lädt die Datei bei Start und Debug automatisch.
4. Interpreter wählen: `Python: Select Interpreter` → `.venv`.
5. Über **Ausführen und Debuggen** (F5) starten. Verfügbare Konfigurationen:
   - **Jarvis: GUI starten**
   - **Jarvis: Konsolenmodus (ohne GUI)**
   - **Jarvis: Tests (pytest)**
   - **Python: Aktuelle Datei**

Die Tests laufen auch direkt im Test-Explorer (pytest ist vorkonfiguriert) und
brauchen weder API-Key noch Netzwerk.

## Konfiguration

Alle Einstellungen (Modell, Whisper-Größe, Piper-Stimme, Kamera-Index, YOLO-Modell,
Bestätigungspflicht) stehen zentral in `jarvis/config.py`.
