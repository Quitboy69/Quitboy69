"""Tests für die einzelnen Werkzeuge — ohne Netzwerk und ohne API-Key."""

from __future__ import annotations

import os

import pytest

from jarvis.tools.notes import manage_notes
from jarvis.tools.organizer import organize_folder
from jarvis.tools.terminal import run_terminal_command


# ------------------------------------------------------------------ Terminal
@pytest.mark.parametrize("dangerous", [
    "rm -rf /",
    "rm -rf ~/",
    "sudo mkfs.ext4 /dev/sda1",
    "dd if=/dev/zero of=/dev/sda",
    "echo kaputt > /dev/sdb",
    "echo kaputt > /dev/nvme0n1",
    "wipefs -a /dev/sda",
    ":(){ :|:& };:",
])
def test_terminal_blocklist(dangerous):
    result = run_terminal_command(dangerous)
    assert "blockiert" in result.lower()


def test_terminal_runs_harmless_command():
    assert run_terminal_command("echo hallo").strip() == "hallo"


def test_terminal_reports_exit_code_without_output():
    assert "Exit-Code 3" in run_terminal_command("exit 3")


# --------------------------------------------------------------------- Notes
def test_notes_add_list_delete(tmp_path):
    store = str(tmp_path / "notes.json")

    assert "Milch kaufen" in manage_notes("add", text="Milch kaufen", path=store)
    manage_notes("add", text="Reifen wechseln", path=store)

    listing = manage_notes("list", path=store)
    assert "1. Milch kaufen" in listing and "2. Reifen wechseln" in listing

    assert "Milch kaufen" in manage_notes("delete", number=1, path=store)
    assert "Reifen wechseln" in manage_notes("list", path=store)
    assert "Milch kaufen" not in manage_notes("list", path=store)


def test_notes_survive_reload(tmp_path):
    """Notizen sind persistent, nicht nur im Speicher."""
    store = str(tmp_path / "notes.json")
    manage_notes("add", text="bleibt erhalten", path=store)
    assert os.path.exists(store)
    assert "bleibt erhalten" in manage_notes("list", path=store)


def test_notes_invalid_inputs(tmp_path):
    store = str(tmp_path / "notes.json")
    assert "Fehler" in manage_notes("add", text="   ", path=store)
    assert "Fehler" in manage_notes("delete", number=5, path=store)
    assert "Keine Notizen" in manage_notes("list", path=store)


def test_notes_clear(tmp_path):
    store = str(tmp_path / "notes.json")
    manage_notes("add", text="a", path=store)
    manage_notes("add", text="b", path=store)
    assert "2" in manage_notes("clear", path=store)
    assert "Keine Notizen" in manage_notes("list", path=store)


# ----------------------------------------------------------------- Organizer
def _make_files(folder, names):
    for name in names:
        (folder / name).write_text("x")


def test_organizer_dry_run_moves_nothing(tmp_path):
    _make_files(tmp_path, ["foto.jpg", "rechnung.pdf", "song.mp3"])

    result = organize_folder(str(tmp_path), apply=False)

    assert "Vorschau" in result
    assert "foto.jpg -> Bilder/" in result
    assert (tmp_path / "foto.jpg").exists(), "Dry-Run darf nichts verschieben"
    assert not (tmp_path / "Bilder").exists()


def test_organizer_apply_sorts_by_category(tmp_path):
    _make_files(tmp_path, ["foto.jpg", "rechnung.pdf", "song.mp3", "kram.xyz"])

    result = organize_folder(str(tmp_path), apply=True)

    assert "Verschoben" in result
    assert (tmp_path / "Bilder" / "foto.jpg").exists()
    assert (tmp_path / "Dokumente" / "rechnung.pdf").exists()
    assert (tmp_path / "Musik" / "song.mp3").exists()
    assert (tmp_path / "Sonstiges" / "kram.xyz").exists()


def test_organizer_skips_hidden_files_and_folders(tmp_path):
    (tmp_path / ".versteckt").write_text("x")
    (tmp_path / "Unterordner").mkdir()
    _make_files(tmp_path, ["doc.txt"])

    organize_folder(str(tmp_path), apply=True)

    assert (tmp_path / ".versteckt").exists()
    assert (tmp_path / "Unterordner").is_dir()
    assert (tmp_path / "Dokumente" / "doc.txt").exists()


def test_organizer_resolves_name_collisions(tmp_path):
    (tmp_path / "Bilder").mkdir()
    (tmp_path / "Bilder" / "foto.jpg").write_text("alt")
    _make_files(tmp_path, ["foto.jpg"])

    organize_folder(str(tmp_path), apply=True)

    assert (tmp_path / "Bilder" / "foto.jpg").read_text() == "alt", "Bestehende Datei überschrieben"
    assert (tmp_path / "Bilder" / "foto (2).jpg").exists()


def test_organizer_rejects_missing_folder(tmp_path):
    assert "Kein Verzeichnis" in organize_folder(str(tmp_path / "gibtsnicht"))
