"""Zentrale Konfiguration für Jarvis."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


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
