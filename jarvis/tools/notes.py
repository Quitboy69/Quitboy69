"""Notiz-Tool: Jarvis merkt sich Dinge dauerhaft.

"Jarvis, merk dir: Milch kaufen" — die Notizen überleben Neustarts, weil sie
als JSON unter ~/.local/share/jarvis/notes.json gespeichert werden.
"""

from __future__ import annotations

import json
import os
from datetime import datetime

# Standard-Speicherort; Tests können den Pfad über die Umgebung umbiegen.
NOTES_FILE = os.environ.get(
    "JARVIS_NOTES_FILE",
    os.path.expanduser("~/.local/share/jarvis/notes.json"),
)


def _load(path: str) -> list[dict]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save(path: str, notes: list[dict]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(notes, f, ensure_ascii=False, indent=2)


def manage_notes(action: str, text: str = "", number: int = 0, path: str = "") -> str:
    """Verwaltet die Merkliste.

    action: add | list | delete | clear
    number: 1-basierte Nummer der Notiz für delete
    """
    store = path or NOTES_FILE
    notes = _load(store)

    if action == "add":
        if not text.strip():
            return "Fehler: keine Notiz angegeben."
        notes.append({"text": text.strip(), "created": datetime.now().isoformat(timespec="minutes")})
        _save(store, notes)
        return f"Gemerkt (Notiz {len(notes)}): {text.strip()}"

    if action == "list":
        if not notes:
            return "Keine Notizen gespeichert."
        lines = [f"{i}. {n['text']} ({n.get('created', '?')})" for i, n in enumerate(notes, 1)]
        return "\n".join(lines)

    if action == "delete":
        if not 1 <= number <= len(notes):
            return f"Fehler: Notiz {number} gibt es nicht (1 bis {len(notes)})."
        removed = notes.pop(number - 1)
        _save(store, notes)
        return f"Gelöscht: {removed['text']}"

    if action == "clear":
        _save(store, [])
        return f"Alle {len(notes)} Notizen gelöscht."

    return f"Unbekannte Aktion: {action}"
