"""Wake Word — lokales Aktivierungswort ("jarvis").

Architektur (aus dem Konzept):

    while True:
        audio = mic.listen()
        if wakeword_detected(audio, "jarvis"):
            activate_assistant()

Unterstützt zwei lokale Engines:
  - OpenWakeWord (openwakeword)
  - Picovoice Porcupine (pvporcupine)

Fällt auf einen einfachen Energie-/Sprach-Trigger zurück, wenn keine Engine
installiert ist, damit sich das System auch ohne Modelle testen lässt.
"""

from __future__ import annotations

import time
from collections.abc import Callable

from .config import CONFIG


class WakeWordListener:
    def __init__(
        self,
        on_wake: Callable[[], None],
        keyword: str | None = None,
        allow_stdin_fallback: bool = True,
    ) -> None:
        self.on_wake = on_wake
        self.keyword = keyword or CONFIG.wake_word
        # Der Enter-Taste-Fallback ergibt nur im Konsolenmodus Sinn. In der GUI
        # gibt es dafuer den Mikrofon-Button; ein input() im Hintergrund wuerde
        # dort nur unbemerkt das Terminal belegen.
        self.allow_stdin_fallback = allow_stdin_fallback
        self._running = False
        self._engine = None
        self._backend = "none"
        self._init_engine()

    def _init_engine(self) -> None:
        # 1) OpenWakeWord
        try:
            from openwakeword.model import Model  # type: ignore

            self._engine = Model()
            self._backend = "openwakeword"
            return
        except Exception:
            pass

        # 2) Picovoice Porcupine
        try:
            import pvporcupine  # type: ignore

            self._engine = pvporcupine.create(keywords=[self.keyword])
            self._backend = "porcupine"
            return
        except Exception:
            pass

        self._backend = "fallback" if self.allow_stdin_fallback else "aus"

    @property
    def backend(self) -> str:
        return self._backend

    def stop(self) -> None:
        self._running = False

    def listen_loop(self) -> None:
        """Blockierende Schleife. In eigenem Thread starten."""
        self._running = True
        if self._backend in ("openwakeword", "porcupine"):
            self._listen_with_engine()
        elif self._backend == "fallback":
            self._listen_fallback()
        # backend == "aus": keine Wake-Word-Erkennung (GUI nutzt den Mikrofon-Button)

    # -- Engine-basierte Erkennung --
    def _listen_with_engine(self) -> None:
        try:
            import numpy as np
            import sounddevice as sd
        except Exception:
            # Ohne Audio-Stack: Fallback (nur wenn erlaubt)
            self._backend = "fallback" if self.allow_stdin_fallback else "aus"
            if self.allow_stdin_fallback:
                self._listen_fallback()
            return

        frame = 1280 if self._backend == "openwakeword" else self._engine.frame_length
        with sd.InputStream(
            channels=1, samplerate=CONFIG.sample_rate, dtype="int16", blocksize=frame
        ) as stream:
            while self._running:
                audio, _ = stream.read(frame)
                samples = np.frombuffer(audio, dtype=np.int16)
                if self._backend == "openwakeword":
                    preds = self._engine.predict(samples)
                    if any(score >= CONFIG.wake_word_threshold for score in preds.values()):
                        self.on_wake()
                        time.sleep(1.0)
                else:  # porcupine
                    if self._engine.process(samples) >= 0:
                        self.on_wake()
                        time.sleep(1.0)

    # -- Fallback ohne Modelle: Enter-Taste als manueller Trigger --
    def _listen_fallback(self) -> None:
        print(f"[WakeWord: Fallback] Kein Modell gefunden – drücke Enter statt '{self.keyword}'.")
        while self._running:
            try:
                input()
            except (EOFError, KeyboardInterrupt):
                break
            if self._running:
                self.on_wake()
