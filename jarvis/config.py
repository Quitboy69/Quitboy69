"""Zentrale Konfiguration für Jarvis."""

from __future__ import annotations

import os
import pathlib
from dataclasses import dataclass, field


def _load_dotenv() -> None:
    """Liest eine .env-Datei ein (ohne Zusatzpaket) und setzt Umgebungsvariablen.

    Sucht im aktuellen Ordner und im Projekt-Stammverzeichnis. Bereits gesetzte
    Variablen werden nicht überschrieben, damit ein Terminal-Export Vorrang hat.
    """
    candidates = [
        pathlib.Path.cwd() / ".env",
        pathlib.Path(__file__).resolve().parent.parent / ".env",
    ]
    seen: set[pathlib.Path] = set()
    for path in candidates:
        if path in seen or not path.is_file():
            continue
        seen.add(path)
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_dotenv()


@dataclass
class Config:
    # --- Agent (Claude Fable 5) ---
    model: str = "claude-fable-5"
    max_tokens: int = 16000
    effort: str = "high"  # low | medium | high | xhigh | max

    # --- Sprachsteuerung (an/aus) ---
    # Standard: reine Text-Bedienung. Jarvis reagiert auf getippte Nachrichten,
    # hört aber nichts mit (kein Wake-Word, keine Mikrofon-Aufnahme).
    enable_voice_input: bool = False     # Mikrofon + Whisper (Spracherkennung)
    enable_wake_word: bool = False       # Aktivierungswort "jarvis"
    enable_voice_output: bool = True     # Antworten vorlesen, wenn eine Stimme da ist

    # --- Wake Word ---
    wake_word: str = "jarvis"
    wake_word_threshold: float = 0.5

    # --- Sprachverarbeitung ---
    whisper_model: str = "base"          # tiny | base | small | medium | large-v3
    whisper_language: str = "de"
    record_seconds: float = 6.0
    sample_rate: int = 16000

    # --- Sprachausgabe (Piper) ---
    piper_voice: str = os.path.expanduser(
        os.environ.get("JARVIS_PIPER_VOICE", "~/.local/share/piper/de_DE-thorsten-medium.onnx")
    )

    # --- Kamera / Vision ---
    camera_index: int = 0
    yolo_model: str = "yolo11n.pt"

    # --- Verhalten ---
    require_confirmation: bool = True    # Aktionen erst nach [Ja/Nein] ausführen
    workdir: str = os.path.expanduser("~")

    # --- GUI ---
    update_interval_ms: int = 1000       # Systemdaten-Aktualisierung

    extra: dict = field(default_factory=dict)


CONFIG = Config()
