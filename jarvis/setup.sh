#!/usr/bin/env bash
# Richtet Jarvis auf einem frischen Ubuntu ein: Systempakete, Python-Abhängigkeiten
# und die Modelle (Piper-Stimme + YOLO-Gewichte). Idempotent – mehrfach ausführbar.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPER_DIR="${HOME}/.local/share/piper"
PIPER_VOICE="${PIPER_DIR}/de_DE-thorsten-medium.onnx"
PIPER_BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium"

echo "==> Ubuntu-Systempakete (Audio, Qt/GUI, Browser-Opener)"
if command -v apt >/dev/null 2>&1; then
  sudo apt update -y
  # Audio + Browser
  sudo apt install -y portaudio19-dev libportaudio2 xdg-utils ffmpeg
  # Qt-Laufzeitbibliotheken – ohne diese startet die GUI nicht
  # ("ImportError: libEGL.so.1: cannot open shared object file").
  sudo apt install -y libegl1 libgl1 libxkbcommon0 libxkbcommon-x11-0 \
    libdbus-1-3 libfontconfig1 libxrender1 libxi6 libxcb-cursor0 \
    libxcb-icccm4 libxcb-keysyms1 libxcb-shape0 libxcb-xkb1 \
    libxcb-randr0 libxcb-render-util0 libxcb-image0
else
  echo "   apt nicht gefunden – Systempakete bitte manuell installieren."
fi

echo "==> Python-Abhängigkeiten"
python3 -m pip install -r "${HERE}/requirements.txt"

echo "==> Piper-Stimme (Deutsch, Thorsten)"
mkdir -p "${PIPER_DIR}"
if [ ! -f "${PIPER_VOICE}" ]; then
  curl -L -o "${PIPER_VOICE}" "${PIPER_BASE}/de_DE-thorsten-medium.onnx"
  curl -L -o "${PIPER_VOICE}.json" "${PIPER_BASE}/de_DE-thorsten-medium.onnx.json"
else
  echo "   bereits vorhanden: ${PIPER_VOICE}"
fi

echo "==> YOLO-Gewichte (YOLOv11 nano)"
python3 - <<'PY'
try:
    from ultralytics import YOLO
    YOLO("yolo11n.pt")  # lädt die Gewichte beim ersten Aufruf herunter
    print("   YOLO-Modell bereit.")
except Exception as exc:
    print(f"   YOLO-Download übersprungen ({exc}).")
PY

echo "==> GUI-Selbsttest"
if QT_QPA_PLATFORM=offscreen python3 -c "
import sys; sys.path.insert(0, '$(dirname "${HERE}")')
from PySide6 import QtWidgets
from jarvis.gui.main_window import MainWindow
app = QtWidgets.QApplication([]); MainWindow()
print('   GUI laesst sich aufbauen.')
" 2>/dev/null; then
  :
else
  echo "   GUI-Test fehlgeschlagen – fehlen Qt-Bibliotheken? Siehe README."
fi

echo
echo "Fertig. Noch den API-Key setzen und starten:"
echo "   API-Key holen: https://console.anthropic.com -> API Keys -> Create Key"
echo "   cp .env.example .env   # und den Schluessel dort eintragen"
echo "   python -m jarvis.main            # mit GUI"
echo "   python -m jarvis.main --console  # ohne GUI"
