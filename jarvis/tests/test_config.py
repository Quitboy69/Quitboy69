"""Tests für den .env-Loader in der Konfiguration."""

from __future__ import annotations

import os

from jarvis.config import load_dotenv


def test_dotenv_loads_values(tmp_path, monkeypatch):
    monkeypatch.delenv("JARVIS_TEST_KEY", raising=False)
    env = tmp_path / ".env"
    env.write_text(
        "# Kommentar\n"
        "\n"
        'JARVIS_TEST_KEY="sk-ant-test-123"\n'
        "kaputte zeile ohne gleichheitszeichen\n"
    )

    load_dotenv(str(env))

    assert os.environ["JARVIS_TEST_KEY"] == "sk-ant-test-123"
    monkeypatch.delenv("JARVIS_TEST_KEY", raising=False)


def test_dotenv_never_overrides_existing_env(tmp_path, monkeypatch):
    """Ein exportierter Schlüssel hat immer Vorrang vor der .env."""
    monkeypatch.setenv("JARVIS_TEST_KEY", "aus-der-shell")
    env = tmp_path / ".env"
    env.write_text("JARVIS_TEST_KEY=aus-der-datei\n")

    load_dotenv(str(env))

    assert os.environ["JARVIS_TEST_KEY"] == "aus-der-shell"


def test_dotenv_missing_file_is_harmless(tmp_path):
    load_dotenv(str(tmp_path / "gibtsnicht.env"))  # darf keine Exception werfen
