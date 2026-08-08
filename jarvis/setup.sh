#!/usr/bin/env bash
# Richtet Jarvis auf einem frischen Ubuntu ein: Systempakete, Python-Abhängigkeiten
# und die Modelle (Piper-Stimme + YOLO-Gewichte). Idempotent – mehrfach ausführbar.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPER_DIR="${HOME}/.local/share/piper"
PIPER_VOICE="${PIPER_DIR}/de_DE-thorsten-medium.onnx"
PIPER_BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium"

echo "==> Ubuntu-Systempakete (Audio, Browser-Opener)"
if command -v apt >/dev/null 2>&1; then
  sudo apt update -y
  sudo apt install -y portaudio19-dev libportaudio2 xdg-utils ffmpeg
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

echo
echo "Fertig. Noch den API-Key setzen und starten:"
echo "   export ANTHROPIC_API_KEY=\"sk-ant-...\""
echo "   python -m jarvis.main            # mit GUI"
echo "   python -m jarvis.main --console  # ohne GUI"
