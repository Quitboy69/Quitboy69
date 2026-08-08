"""Tool-Registry für den Jarvis-Agenten (sicherer Ansatz aus dem Konzept).

TOOLS = {
    "terminal":   run_terminal_command,
    "browser":    open_browser,
    "filesystem": manage_files,
}
"""

from .browser import open_browser
from .filesystem import manage_files
from .terminal import run_terminal_command

TOOLS = {
    "terminal": run_terminal_command,
    "browser": open_browser,
    "filesystem": manage_files,
}

# Tools, die vor der Ausführung eine Bestätigung erfordern ("Ausführen? [Ja/Nein]").
# Beim Dateisystem nur die destruktiven Aktionen.
CONFIRM_TOOLS = {"terminal"}
CONFIRM_FILE_ACTIONS = {"write", "append", "move", "delete", "mkdir"}

__all__ = [
    "TOOLS",
    "CONFIRM_TOOLS",
    "CONFIRM_FILE_ACTIONS",
    "run_terminal_command",
    "open_browser",
    "manage_files",
]
