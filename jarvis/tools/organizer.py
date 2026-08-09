"""Aufräum-Tool: sortiert einen Ordner (z. B. Downloads) automatisch nach Dateityp.

Als Jarvis-Werkzeug ("Jarvis, räum meine Downloads auf") und als eigenständiges CLI:

    python -m jarvis.tools.organizer ~/Downloads            # Vorschau (dry-run)
    python -m jarvis.tools.organizer ~/Downloads --apply    # wirklich verschieben
"""

from __future__ import annotations

import os
import shutil
import sys

# Zielordner je Dateiendung. Unbekannte Endungen landen in "Sonstiges".
CATEGORIES: dict[str, tuple[str, ...]] = {
    "Bilder": (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".heic"),
    "Dokumente": (".pdf", ".doc", ".docx", ".odt", ".txt", ".md", ".rtf",
                  ".xls", ".xlsx", ".ods", ".csv", ".ppt", ".pptx", ".odp"),
    "Musik": (".mp3", ".wav", ".flac", ".ogg", ".m4a", ".opus"),
    "Videos": (".mp4", ".mkv", ".avi", ".mov", ".webm"),
    "Archive": (".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar"),
    "Programme": (".deb", ".appimage", ".sh", ".run", ".exe", ".msi", ".flatpakref"),
}


def _category_for(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    for category, extensions in CATEGORIES.items():
        if ext in extensions:
            return category
    return "Sonstiges"


def _unique_destination(folder: str, filename: str) -> str:
    """Vermeidet Überschreiben: hängt bei Kollision (2), (3), … an."""
    dest = os.path.join(folder, filename)
    if not os.path.exists(dest):
        return dest
    stem, ext = os.path.splitext(filename)
    counter = 2
    while os.path.exists(os.path.join(folder, f"{stem} ({counter}){ext}")):
        counter += 1
    return os.path.join(folder, f"{stem} ({counter}){ext}")


def organize_folder(path: str, apply: bool = False) -> str:
    """Sortiert alle Dateien in `path` in Kategorie-Unterordner.

    apply=False zeigt nur an, was passieren würde (Vorschau).
    Unterordner und versteckte Dateien werden nicht angefasst.
    """
    path = os.path.expanduser(path)
    if not os.path.isdir(path):
        return f"Kein Verzeichnis: {path}"

    moves: list[tuple[str, str]] = []
    for name in sorted(os.listdir(path)):
        full = os.path.join(path, name)
        if name.startswith(".") or not os.path.isfile(full):
            continue
        category = _category_for(name)
        moves.append((name, category))

    if not moves:
        return f"Nichts zu tun – keine losen Dateien in {path}."

    counts: dict[str, int] = {}
    lines = []
    for name, category in moves:
        counts[category] = counts.get(category, 0) + 1
        if apply:
            target_dir = os.path.join(path, category)
            os.makedirs(target_dir, exist_ok=True)
            shutil.move(os.path.join(path, name), _unique_destination(target_dir, name))
        lines.append(f"  {name} -> {category}/")

    summary = ", ".join(f"{n}x {cat}" for cat, n in sorted(counts.items()))
    verb = "Verschoben" if apply else "Vorschau (noch nichts verschoben)"
    return f"{verb}: {len(moves)} Dateien ({summary})\n" + "\n".join(lines)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply = "--apply" in sys.argv
    folder = args[0] if args else "~/Downloads"
    print(organize_folder(folder, apply=apply))
    if not apply:
        print("\nZum Ausführen: --apply anhängen")


if __name__ == "__main__":
    main()
