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
        self.stt = SpeechToText()
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
        self._cam_active = False
        self._running = True
        self._request_q: queue.Queue[str] = queue.Queue()

    # ----------------------------------------------------------- Werkzeuge
    def _vision_tool(self) -> str:
        self._set_cam(True)
        return self.vision.describe_scene()

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
        self.tts.speak(description + " Ausführen? Ja oder Nein.")
        answer = input(f"{description}\nAusführen? [Ja/Nein] ").strip().lower()
        return answer in ("ja", "j", "yes", "y")

    # -------------------------------------------------------------- Fluss
    def on_wake(self) -> None:
        """Wird ausgelöst, wenn das Aktivierungswort erkannt wurde."""
        self._set_mic(True)
        self._thought("Aktivierungswort erkannt – ich höre zu …")
        self.tts.speak("Ja?")
        user_text = self.stt.listen()
        self._set_mic(False)
        if not user_text:
            self._thought("Keine Sprache erkannt.")
            return
        self.submit(user_text)

    def submit(self, user_text: str) -> None:
        """Eine Nutzeräußerung in die Verarbeitungsschlange stellen."""
        self._request_q.put(user_text)

    def listen_once(self) -> None:
        """Push-to-talk: einmal zuhören, ohne auf das Wake Word zu warten.

        Wird vom Mikrofon-Button der GUI genutzt (in eigenem Thread aufrufen).
        """
        if self.stt.backend == "none":
            self._thought(
                "Keine Spracherkennung verfügbar. Bitte installieren: "
                "pip install faster-whisper sounddevice numpy"
            )
            return
        self._set_mic(True)
        self._thought("Ich höre zu …")
        user_text = self.stt.listen()
        self._set_mic(False)
        if not user_text:
            self._thought("Keine Sprache erkannt.")
            return
        self.submit(user_text)

    def _set_mic(self, active: bool) -> None:
        self._mic_active = active
        if self.gui:
            self.gui.sig_mic.emit(active)

    def _set_cam(self, active: bool) -> None:
        # Nur bei echtem Wechsel senden, damit die GUI nicht 10x/s neu zeichnet.
        if active == self._cam_active:
            return
        self._cam_active = active
        if self.gui:
            self.gui.sig_cam.emit(active)

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
            self.tts.speak(answer)

    def _stats_loop(self) -> None:
        while self._running:
            snap = snapshot(mic_active=self._mic_active, cam_active=self._cam_active)
            if self.gui:
                self.gui.sig_stats.emit(snap.cpu_percent, snap.gpu_percent, snap.ram_percent)
            time.sleep(CONFIG.update_interval_ms / 1000)

    def _camera_loop(self) -> None:
        """Zeigt fortlaufend den Kamera-Feed in der GUI (falls verfügbar).

        Braucht nur OpenCV und eine Kamera — YOLO ist nur für die
        Objekterkennung nötig, nicht für das Live-Bild.
        """
        if not self.gui or not self.vision.camera_available():
            return
        while self._running:
            frame = self.vision.read_frame()
            if frame is not None:
                self.gui.sig_frame.emit(frame)
                self._set_cam(True)
            else:
                # Kamera abgezogen oder belegt – Status ehrlich zuruecksetzen.
                self._set_cam(False)
            time.sleep(0.1)

    def start_background(self) -> None:
        threading.Thread(target=self._process_loop, daemon=True).start()
        threading.Thread(target=self._stats_loop, daemon=True).start()
        threading.Thread(target=self._camera_loop, daemon=True).start()
        # Der Enter-Taste-Fallback gehoert in den Konsolenmodus; in der GUI
        # uebernimmt der Mikrofon-Button diese Rolle.
        self._wake = WakeWordListener(
            on_wake=self.on_wake, allow_stdin_fallback=self.gui is None
        )
        self._thought(f"Wake-Word-Backend: {self._wake.backend}")
        threading.Thread(target=self._wake.listen_loop, daemon=True).start()

    def shutdown(self) -> None:
        self._running = False
        try:
            self._wake.stop()
        except Exception:
            pass
        self.vision.release()


def run_console() -> None:
    core = JarvisCore(gui=None)
    print("Jarvis (Konsolenmodus). Tippe eine Nachricht oder 'exit'.")
    print(f"STT: {core.stt.backend} | TTS: {core.tts.backend} | Vision: {core.vision.backend}")
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
    window.mic_button.clicked.connect(
        lambda: threading.Thread(target=core.listen_once, daemon=True).start()
    )

    # Ohne Spracherkennung waere der Button wirkungslos – lieber sichtbar sperren.
    if core.stt.backend == "none":
        window.mic_button.setEnabled(False)
        window.mic_button.setToolTip(
            "Spracherkennung nicht installiert: pip install faster-whisper sounddevice numpy"
        )

    window.show()
    core.start_background()
    window.backend_label.setText(
        f"STT: {core.stt.backend} · TTS: {core.tts.backend}"
        f" · Wake: {core._wake.backend} · Vision: {core.vision.backend}"
    )
    if not core.agent.ready:
        window.sig_thought.emit(
            "Kein ANTHROPIC_API_KEY gefunden. Kopiere .env.example nach .env "
            "und trage deinen Schlüssel von console.anthropic.com ein."
        )
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
