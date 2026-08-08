"""Sprachverarbeitung.

Spracherkennung (Speech-to-Text): Whisper.cpp / faster-whisper (lokal).
Sprachausgabe (Text-to-Speech): Piper TTS (lokal).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import wave

from .config import CONFIG


# --------------------------------------------------------------------------- #
# Speech-to-Text (Whisper)
# --------------------------------------------------------------------------- #
class SpeechToText:
    def __init__(self) -> None:
        self._model = None
        self._backend = "none"
        try:
            from faster_whisper import WhisperModel  # type: ignore

            self._model = WhisperModel(CONFIG.whisper_model, compute_type="int8")
            self._backend = "faster-whisper"
        except Exception:
            # whisper.cpp per CLI wird bei Bedarf im transcribe() genutzt
            if shutil.which("whisper-cpp") or shutil.which("main"):
                self._backend = "whisper.cpp"

    @property
    def backend(self) -> str:
        return self._backend

    def record(self, seconds: float | None = None) -> str | None:
        """Nimmt vom Mikrofon auf und gibt den Pfad zu einer WAV-Datei zurück."""
        seconds = seconds or CONFIG.record_seconds
        try:
            import numpy as np
            import sounddevice as sd
        except Exception:
            return None

        frames = int(seconds * CONFIG.sample_rate)
        audio = sd.rec(frames, samplerate=CONFIG.sample_rate, channels=1, dtype="int16")
        sd.wait()

        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        with wave.open(tmp.name, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(CONFIG.sample_rate)
            wf.writeframes(audio.tobytes())
        return tmp.name

    def transcribe(self, wav_path: str) -> str:
        if not wav_path or not os.path.exists(wav_path):
            return ""
        if self._backend == "faster-whisper" and self._model is not None:
            segments, _ = self._model.transcribe(wav_path, language=CONFIG.whisper_language)
            return " ".join(seg.text for seg in segments).strip()
        if self._backend == "whisper.cpp":
            binary = shutil.which("whisper-cpp") or shutil.which("main")
            try:
                out = subprocess.run(
                    [binary, "-f", wav_path, "-l", CONFIG.whisper_language, "-nt"],
                    capture_output=True, text=True, timeout=120,
                )
                return out.stdout.strip()
            except Exception:
                return ""
        return ""

    def listen(self, seconds: float | None = None) -> str:
        """Aufnehmen + transkribieren in einem Schritt."""
        wav = self.record(seconds)
        if not wav:
            return ""
        try:
            return self.transcribe(wav)
        finally:
            try:
                os.remove(wav)
            except OSError:
                pass


# --------------------------------------------------------------------------- #
# Text-to-Speech (Piper)
# --------------------------------------------------------------------------- #
class TextToSpeech:
    def __init__(self) -> None:
        self._backend = "none"
        self._piper = None
        try:
            from piper.voice import PiperVoice  # type: ignore

            if os.path.exists(CONFIG.piper_voice):
                self._piper = PiperVoice.load(CONFIG.piper_voice)
                self._backend = "piper"
        except Exception:
            if shutil.which("piper") and os.path.exists(CONFIG.piper_voice):
                self._backend = "piper-cli"

    @property
    def backend(self) -> str:
        return self._backend

    def speak(self, text: str) -> None:
        if not text:
            return
        if self._backend == "piper" and self._piper is not None:
            self._speak_lib(text)
        elif self._backend == "piper-cli":
            self._speak_cli(text)
        else:
            print(f"[TTS] {text}")

    def _speak_lib(self, text: str) -> None:
        try:
            import numpy as np
            import sounddevice as sd

            chunks = [np.frombuffer(c.audio_int16_bytes, dtype=np.int16)
                      for c in self._piper.synthesize(text)]
            if chunks:
                audio = np.concatenate(chunks)
                sd.play(audio, self._piper.config.sample_rate)
                sd.wait()
        except Exception as exc:
            print(f"[TTS-Fehler] {exc} :: {text}")

    def _speak_cli(self, text: str) -> None:
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        try:
            subprocess.run(
                ["piper", "--model", CONFIG.piper_voice, "--output_file", tmp.name],
                input=text, text=True, capture_output=True, timeout=60,
            )
            player = shutil.which("aplay") or shutil.which("paplay")
            if player:
                subprocess.run([player, tmp.name], capture_output=True, timeout=60)
        except Exception as exc:
            print(f"[TTS-Fehler] {exc} :: {text}")
        finally:
            try:
                os.remove(tmp.name)
            except OSError:
                pass
