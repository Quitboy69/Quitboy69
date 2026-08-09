"""Tests für den Wake-Word-Listener, insbesondere den Konsolen-Fallback."""

from __future__ import annotations

from jarvis.wake_word import WakeWordListener


def test_gui_mode_has_no_stdin_fallback():
    """In der GUI darf kein input()-Fallback laufen (dort gibt es den Mic-Button)."""
    listener = WakeWordListener(on_wake=lambda: None, allow_stdin_fallback=False)
    if listener.backend in ("openwakeword", "porcupine"):
        return  # echte Engine installiert – Fallback nicht relevant
    assert listener.backend == "aus"


def test_console_mode_uses_stdin_fallback():
    listener = WakeWordListener(on_wake=lambda: None, allow_stdin_fallback=True)
    if listener.backend in ("openwakeword", "porcupine"):
        return
    assert listener.backend == "fallback"


def test_disabled_listener_loop_returns_immediately():
    """Ohne Fallback beendet sich listen_loop sofort, statt auf input() zu warten."""
    listener = WakeWordListener(on_wake=lambda: None, allow_stdin_fallback=False)
    if listener.backend in ("openwakeword", "porcupine"):
        return
    listener.listen_loop()  # darf nicht blockieren
