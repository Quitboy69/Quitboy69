"""Browser-Tool: öffnet URLs oder Anwendungen im Standardbrowser."""

from __future__ import annotations

import shutil
import subprocess
import webbrowser


def open_browser(url: str = "", search: str = "") -> str:
    """Öffnet den Browser mit einer URL oder einer Websuche."""
    if search and not url:
        url = "https://duckduckgo.com/?q=" + search.replace(" ", "+")
    if not url:
        url = "about:blank"
    if not url.startswith(("http://", "https://", "about:")):
        url = "https://" + url

    # Unter Ubuntu bevorzugt xdg-open (öffnet den Standardbrowser der Session)
    if shutil.which("xdg-open"):
        subprocess.Popen(
            ["xdg-open", url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return f"Browser geöffnet: {url}"

    if webbrowser.open(url):
        return f"Browser geöffnet: {url}"
    return f"Konnte keinen Browser öffnen für: {url}"
