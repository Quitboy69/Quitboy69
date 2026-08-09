"""GUI-Tests — startet die echte Oberfläche headless (offscreen).

Wird übersprungen, wenn PySide6 nicht installiert ist, damit die übrige
Test-Suite auch in einer schlanken Umgebung läuft.
"""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

pytest.importorskip("PySide6", reason="PySide6 nicht installiert")

from PySide6 import QtWidgets  # noqa: E402

from jarvis.gui.main_window import MainWindow  # noqa: E402


@pytest.fixture(scope="module")
def app():
    """Eine QApplication pro Testmodul (Qt erlaubt nur eine)."""
    existing = QtWidgets.QApplication.instance()
    yield existing or QtWidgets.QApplication([])


@pytest.fixture
def window(app):
    win = MainWindow()
    yield win
    win.close()


def test_window_builds_with_all_panels(window):
    """Die Oberfläche baut sich vollständig auf."""
    for attr in ("thoughts", "conversation", "camera_view", "text_input",
                 "send_button", "mic_button", "mic_badge", "cam_badge",
                 "cpu_label", "gpu_label", "ram_label", "backend_label"):
        assert hasattr(window, attr), f"GUI-Element fehlt: {attr}"


def test_thought_signal_appends_and_caps_history(window):
    for i in range(60):
        window.sig_thought.emit(f"Gedanke {i}")
    assert window.thoughts.count() == 50, "Gedanken-Liste wächst unbegrenzt"
    assert "Gedanke 59" in window.thoughts.item(49).text()


def test_conversation_signal_shows_both_speakers(window):
    window.sig_conversation.emit("Du", "Hallo Jarvis")
    window.sig_conversation.emit("Jarvis", "Hallo, wie kann ich helfen?")
    text = window.conversation.toPlainText()
    assert "Hallo Jarvis" in text and "Hallo, wie kann ich helfen?" in text


def test_stats_signal_updates_labels(window):
    window.sig_stats.emit(42.0, 73.0, 55.0)
    assert window.cpu_label.text() == "CPU 42%"
    assert window.gpu_label.text() == "GPU 73%"
    assert window.ram_label.text() == "RAM 55%"


def test_mic_and_cam_badges_toggle(window):
    window.sig_mic.emit(True)
    window.sig_cam.emit(True)
    assert window.mic_badge.text.text() == "Mikrofon aktiv"
    assert window.cam_badge.text.text() == "Kamera aktiv"

    window.sig_mic.emit(False)
    window.sig_cam.emit(False)
    assert window.mic_badge.text.text() == "Mikrofon inaktiv"
    assert window.cam_badge.text.text() == "Kamera inaktiv"


def test_camera_frame_is_rendered(window):
    """Ein BGR-Frame landet als sichtbares Bild im Kamera-Panel."""
    np = pytest.importorskip("numpy")
    frame = np.zeros((120, 160, 3), dtype=np.uint8)
    frame[:, :, 2] = 200  # roter Kanal in BGR

    window.sig_frame.emit(frame)

    pixmap = window.camera_view.pixmap()
    assert pixmap is not None and not pixmap.isNull(), "Kamerabild wurde nicht gezeichnet"


def test_camera_frame_none_is_ignored(window):
    window.sig_frame.emit(None)  # darf nicht abstürzen


def test_tool_signal_updates_label(window):
    window.sig_tool.emit("organize")
    assert window.active_tool.text() == "organize"
