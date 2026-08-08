"""Dateisystem-Tool: Dateien auflisten, lesen, schreiben, verschieben, löschen."""

from __future__ import annotations

import os
import shutil


def manage_files(
    action: str,
    path: str,
    content: str = "",
    destination: str = "",
) -> str:
    """Verwaltet Dateien und Verzeichnisse.

    action: list | read | write | append | mkdir | move | delete
    """
    path = os.path.expanduser(path)
    destination = os.path.expanduser(destination) if destination else ""

    try:
        if action == "list":
            target = path or "."
            entries = sorted(os.listdir(target))
            lines = []
            for name in entries[:200]:
                full = os.path.join(target, name)
                marker = "/" if os.path.isdir(full) else ""
                lines.append(name + marker)
            more = f"\n… ({len(entries) - 200} weitere)" if len(entries) > 200 else ""
            return "\n".join(lines) + more if lines else "(leeres Verzeichnis)"

        if action == "read":
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                data = f.read()
            if len(data) > 8000:
                data = data[:8000] + f"\n… [gekürzt, insgesamt {len(data)} Zeichen]"
            return data

        if action == "write":
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            return f"Geschrieben: {path} ({len(content)} Zeichen)"

        if action == "append":
            with open(path, "a", encoding="utf-8") as f:
                f.write(content)
            return f"Angehängt an: {path}"

        if action == "mkdir":
            os.makedirs(path, exist_ok=True)
            return f"Verzeichnis erstellt: {path}"

        if action == "move":
            if not destination:
                return "Fehler: 'destination' fehlt für move."
            shutil.move(path, destination)
            return f"Verschoben: {path} -> {destination}"

        if action == "delete":
            if os.path.isdir(path):
                shutil.rmtree(path)
                return f"Verzeichnis gelöscht: {path}"
            os.remove(path)
            return f"Datei gelöscht: {path}"

        return f"Unbekannte Aktion: {action}"
    except FileNotFoundError:
        return f"Nicht gefunden: {path}"
    except PermissionError:
        return f"Keine Berechtigung: {path}"
    except OSError as exc:
        return f"Fehler: {exc}"
