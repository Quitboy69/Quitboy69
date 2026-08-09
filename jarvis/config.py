"""Zentrale Konfiguration für Jarvis."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def load_dotenv(path: str | None = None) -> None:
    """Lädt Variablen aus einer .env-Datei in die Umgebung.

    Ohne Argument wird die .env im Projektstamm gesucht (neben pyproject.toml).
    Bereits gesetzte Umgebungsvariablen werden nie überschrieben, damit ein
    `export ANTHROPIC_API_KEY=…` immer Vorrang hat. VS Code lädt die Datei
    ebenfalls — dieser Loader macht sie auch beim direkten Start wirksam.
    """
    if path is None:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path = os.path.join(root, ".env")
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        pass


load_dotenv()


@dataclass
class Config:
    # --- Agent (Claude Fable 5) ---
    model: str = "claude-fable-5"
    max_tokens: int = 16000
    effort: str = "high"  # low | medium | high | xhigh | max

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
