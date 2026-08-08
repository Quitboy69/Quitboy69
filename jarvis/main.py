"""Jarvis — Einstiegspunkt. Verbindet die gesamte Architektur:

    Wake Word (Jarvis)      Porcupine / OpenWake
            ↓
    Speech-to-Text          Whisper
            ↓
    Fable 5 Agent           Planung & Reasoning
            ↓        ↓
    Vision System    Ubuntu Tools
    YOLOv11          — Terminal
            ↓        — Dateien
    Text-to-Speech   — Browser
    Piper / Kokoro

Start:
    python -m jarvis.main            # mit GUI
    python -m jarvis.main --console  # ohne GUI (reines Terminal)
"""

from __future__ import annotations

import queue
import sys
import threading
import time

from .agent import JarvisAgent
from .config import CONFIG
from .speech import SpeechToText, TextToSpeech
from .system_stats import snapshot
from .vision import VisionSystem
from .wake_word import WakeWordListener


class JarvisCore:
    """Orchestriert Wake Word, STT, Agent, Vision und TTS."""

    def __init__(self, gui=None) -> None:
        self.gui = gui
        # Spracherkennung nur laden, wenn eingeschaltet (Standard: aus).
        self.stt = SpeechToText() if CONFIG.enable_voice_input else None
        self.tts = TextToSpeech()
        self.vision = VisionSystem()

        # Vision als zusätzliches Werkzeug für den Agenten registrieren.
        extra_tools = {"vision": self._vision_tool}
        extra_defs = [{
            "name": "vision",
            "description": (
                "Nutzt die Kamera zur Objekterkennung und beschreibt, was zu sehen ist."
            ),
            "input_schema": {"type": "object", "properties": {}},
        }]

        self.agent = JarvisAgent(
            confirm_cb=self._confirm,
            thought_cb=self._thought,
            tool_cb=self._tool_active,
            extra_tools=extra_tools,
            extra_tool_defs=extra_defs,
        )

        self._mic_active = False
        self._running = True
        self._request_q: queue.Queue[str] = queue.Queue()

    # ----------------------------------------------------------- Sprachausgabe
    def _speak(self, text: str) -> None:
        """Liest Text vor, wenn die Ausgabe aktiv und eine Stimme vorhanden ist."""
        if CONFIG.enable_voice_output and self.tts.backend != "none":
            self.tts.speak(text)

    # ----------------------------------------------------------- Werkzeuge
    def _vision_tool(self) -> str:
        if self.gui:
            self.gui.sig_cam.emit(True)
        description = self.vision.describe_scene()
        return description

    # ---------------------------------------------------------- Callbacks
    def _thought(self, text: str) -> None:
        if self.gui:
            self.gui.sig_thought.emit(text)
        else:
            print(f"[Gedanke] {text}")

    def _tool_active(self, name: str, tool_input: dict) -> None:
        if self.gui:
            self.gui.sig_tool.emit(name)
        else:
            print(f"[Tool] {name} {tool_input}")

    def _confirm(self, description: str) -> bool:
        """Bestätigung einholen (GUI-Dialog oder Konsole)."""
        if self.gui:
            result: queue.Queue[bool] = queue.Queue(maxsize=1)
            self.gui.sig_confirm.emit(description, result.put)
            return result.get()
        # Konsole
        self._speak(description + " Ausführen? Ja oder Nein.")
        answer = input(f"{description}\nAusführen? [Ja/Nein] ").strip().lower()
        return answer in ("ja", "j", "yes", "y")

    # -------------------------------------------------------------- Fluss
    def on_wake(self) -> None:
        """Wird ausgelöst, wenn das Aktivierungswort erkannt wurde."""
        if self.stt is None:
            return
        self._set_mic(True)
        self._thought("Aktivierungswort erkannt – ich höre zu …")
        self._speak("Ja?")
        user_text = self.stt.listen()
        self._set_mic(False)
        if not user_text:
            self._thought("Keine Sprache erkannt.")
            return
        self.submit(user_text)

    def submit(self, user_text: str) -> None:
        """Eine Nutzeräußerung in die Verarbeitungsschlange stellen."""
        self._request_q.put(user_text)

    def _set_mic(self, active: bool) -> None:
        self._mic_active = active
        if self.gui:
            self.gui.sig_mic.emit(active)

    def _process_loop(self) -> None:
        """Verarbeitet Anfragen seriell (eigener Thread)."""
        while self._running:
            try:
                user_text = self._request_q.get(timeout=0.5)
            except queue.Empty:
                continue
            if self.gui:
                self.gui.sig_conversation.emit("Du", user_text)
            answer = self.agent.ask(user_text)
            if self.gui:
                self.gui.sig_conversation.emit("Jarvis", answer)
                self.gui.sig_tool.emit("—")
            else:
                print(f"Jarvis: {answer}")
            self._speak(answer)

    def _stats_loop(self) -> None:
        while self._running:
            snap = snapshot(mic_active=self._mic_active, cam_active=False)
            if self.gui:
                self.gui.sig_stats.emit(snap.cpu_percent, snap.gpu_percent, snap.ram_percent)
            time.sleep(CONFIG.update_interval_ms / 1000)

    def _camera_loop(self) -> None:
        """Zeigt fortlaufend den Kamera-Feed in der GUI (falls verfügbar)."""
        if not self.gui or self.vision.backend == "none":
            return
        while self._running:
            frame = self.vision.read_frame()
            if frame is not None:
                self.gui.sig_frame.emit(frame)
                self.gui.sig_cam.emit(True)
            time.sleep(0.1)

    def start_background(self) -> None:
        threading.Thread(target=self._process_loop, daemon=True).start()
        threading.Thread(target=self._stats_loop, daemon=True).start()
        threading.Thread(target=self._camera_loop, daemon=True).start()

        self._wake = None
        if CONFIG.enable_voice_input and CONFIG.enable_wake_word:
            self._wake = WakeWordListener(on_wake=self.on_wake)
            self._thought(f"Wake-Word-Backend: {self._wake.backend}")
            threading.Thread(target=self._wake.listen_loop, daemon=True).start()
        else:
            self._thought("Sprachsteuerung ist aus – bitte tippe deine Nachricht.")

    def shutdown(self) -> None:
        self._running = False
        try:
            if self._wake is not None:
                self._wake.stop()
        except Exception:
            pass
        self.vision.release()


def run_console() -> None:
    core = JarvisCore(gui=None)
    print("Jarvis (Konsolenmodus). Tippe eine Nachricht oder 'exit'.")
    stt_backend = core.stt.backend if core.stt else "aus"
    print(f"STT: {stt_backend} | TTS: {core.tts.backend} | Vision: {core.vision.backend}")
    core.start_background()
    try:
        while True:
            text = input("> ").strip()
            if text.lower() in ("exit", "quit", "beenden"):
                break
            if text:
                core.submit(text)
                # kurz warten, damit die Antwort erscheint, bevor der Prompt kommt
                time.sleep(0.2)
    except (KeyboardInterrupt, EOFError):
        pass
    finally:
        core.shutdown()


def run_gui() -> None:
    from PySide6 import QtWidgets

    from .gui.main_window import MainWindow

    app = QtWidgets.QApplication(sys.argv)
    window = MainWindow()
    core = JarvisCore(gui=window)

    window.send_button.clicked.connect(
        lambda: (core.submit(window.text_input.text().strip()), window.text_input.clear())
        if window.text_input.text().strip() else None
    )
    window.text_input.returnPressed.connect(window.send_button.click)

    window.show()
    core.start_background()
    exit_code = app.exec()
    core.shutdown()
    sys.exit(exit_code)


def main() -> None:
    if "--console" in sys.argv:
        run_console()
    else:
        try:
            run_gui()
        except Exception as exc:  # noqa: BLE001
            print(f"GUI konnte nicht gestartet werden ({exc}). Wechsel in Konsolenmodus.")
            run_console()


if __name__ == "__main__":
    main()
