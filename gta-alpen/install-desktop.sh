#!/usr/bin/env bash
# ============================================================
#  Trägt Grand Theft Alpen ins Ubuntu-Anwendungsmenü ein.
#  Danach ist das Spiel über die Aktivitäten-Suche startbar.
#
#  ./install-desktop.sh            eintragen
#  ./install-desktop.sh --remove   wieder entfernen
# ============================================================
set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZIEL="$HOME/.local/share/applications/grand-theft-alpen.desktop"
ICON_ZIEL="$HOME/.local/share/icons/grand-theft-alpen.png"

if [ "${1:-}" = "--remove" ]; then
  rm -f "$ZIEL" "$ICON_ZIEL"
  update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
  echo "Eintrag entfernt."
  exit 0
fi

mkdir -p "$(dirname "$ZIEL")" "$(dirname "$ICON_ZIEL")"

if [ ! -f "$HIER/build/icon.png" ]; then
  node "$HIER/tools/make-icon.js"
fi
cp "$HIER/build/icon.png" "$ICON_ZIEL"

cat > "$ZIEL" <<EOF
[Desktop Entry]
Type=Application
Name=Grand Theft Alpen
GenericName=Open-World-Spiel
Comment=Open-World-Spiel im oberösterreichischen Alpenraum
Exec=$HIER/run.sh
Path=$HIER
Icon=$ICON_ZIEL
Terminal=false
Categories=Game;ActionGame;
Keywords=Spiel;Auto;Alpen;OpenWorld;
StartupWMClass=Grand Theft Alpen
EOF

chmod +x "$ZIEL"
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo "Eingetragen: $ZIEL"
echo "Das Spiel ist jetzt im Anwendungsmenü unter „Grand Theft Alpen“ zu finden."
