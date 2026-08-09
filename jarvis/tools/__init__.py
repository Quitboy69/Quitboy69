"""Tool-Registry für den Jarvis-Agenten (sicherer Ansatz aus dem Konzept).

TOOLS = {
    "terminal":   run_terminal_command,
    "browser":    open_browser,
    "filesystem": manage_files,
    "notes":      manage_notes,
    "organize":   organize_folder,
}
"""

from .browser import open_browser
from .filesystem import manage_files
from .notes import manage_notes
from .organizer import organize_folder
from .terminal import run_terminal_command

TOOLS = {
    "terminal": run_terminal_command,
    "browser": open_browser,
    "filesystem": manage_files,
    "notes": manage_notes,
    "organize": organize_folder,
}

# Tools, die vor der Ausführung eine Bestätigung erfordern ("Ausführen? [Ja/Nein]").
# Beim Dateisystem nur die destruktiven Aktionen; beim Aufräumen nur apply=true
# (beides wird in agent._needs_confirmation feiner entschieden).
CONFIRM_TOOLS = {"terminal"}
CONFIRM_FILE_ACTIONS = {"write", "append", "move", "delete", "mkdir"}

__all__ = [
    "TOOLS",
    "CONFIRM_TOOLS",
    "CONFIRM_FILE_ACTIONS",
    "run_terminal_command",
    "open_browser",
    "manage_files",
    "manage_notes",
    "organize_folder",
]
