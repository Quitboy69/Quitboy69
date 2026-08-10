#!/usr/bin/env bash
# ============================================================
#  Grand Theft Alpen — Start unter Linux
#
#  ./run.sh            normal starten (Electron)
#  ./run.sh --software Software-Rendering (bei Grafikproblemen / VM)
#  ./run.sh --browser  ohne Electron, im installierten Browser
#  ./run.sh --dev      mit Entwicklerwerkzeugen
# ============================================================
set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HIER"

MODUS="electron"
EXTRA=()

for arg in "$@"; do
  case "$arg" in
    --software|-s) export GTA_SOFTWARE_GL=1 ;;
    --browser|-b)  MODUS="browser" ;;
    --dev|-d)      EXTRA+=("--dev") ;;
    --help|-h)
      sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) EXTRA+=("$arg") ;;
  esac
done

# ---------- Browser-Modus: kein Electron nötig ----------
if [ "$MODUS" = "browser" ]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "Fehler: node ist nicht installiert.  sudo apt install nodejs" >&2
    exit 1
  fi
  echo "Starte lokalen Server ..."
  node tools/serve.js &
  SERVER=$!
  trap 'kill $SERVER 2>/dev/null || true' EXIT
  sleep 1

  for BROWSER in chromium chromium-browser google-chrome brave-browser firefox; do
    if command -v "$BROWSER" >/dev/null 2>&1; then
      echo "Öffne in $BROWSER ..."
      if [ "$BROWSER" = "firefox" ]; then
        "$BROWSER" http://localhost:8080
      else
        "$BROWSER" --app=http://localhost:8080 --start-fullscreen
      fi
      wait $SERVER
      exit 0
    fi
  done
  echo "Kein Browser gefunden. Öffne von Hand:  http://localhost:8080"
  wait $SERVER
  exit 0
fi

# ---------- Electron-Modus ----------
if ! command -v node >/dev/null 2>&1; then
  echo "Fehler: node ist nicht installiert." >&2
  echo "  sudo apt update && sudo apt install -y nodejs npm" >&2
  exit 1
fi

if [ ! -d node_modules/electron ]; then
  echo "Electron fehlt — installiere Abhängigkeiten (einmalig, ca. 100 MB) ..."
  npm install
fi

if [ ! -f build/icon.png ]; then
  node tools/make-icon.js
fi

exec npx electron . "${EXTRA[@]}"
