"""Jarvis-Agent — Planung & Reasoning mit Claude Fable 5.

Der Agent schlägt Aktionen vor:

    Jarvis:
    Ich möchte Firefox öffnen.
    Ausführen? [Ja/Nein]

So behält der Nutzer die Kontrolle (sicherer Ansatz aus dem Konzept).
"""

from __future__ import annotations

import json
from collections.abc import Callable

from .config import CONFIG
from .tools import CONFIRM_FILE_ACTIONS, CONFIRM_TOOLS, TOOLS

SYSTEM_PROMPT = """Du bist Jarvis, ein deutschsprachiger Sprachassistent, der einen
Ubuntu-Rechner steuert. Du planst und begründest Aktionen und nutzt Werkzeuge:

- terminal:   führt Shell-Befehle aus
- browser:    öffnet URLs oder eine Websuche
- filesystem: listet, liest, schreibt, verschiebt und löscht Dateien
- notes:      merkt sich Notizen dauerhaft ("merk dir", "was habe ich notiert")
- organize:   räumt einen Ordner auf und sortiert Dateien nach Typ

Antworte kurz und natürlich, so wie es vorgelesen werden soll. Vermeide Markdown,
Aufzählungszeichen und Sonderzeichen in deinen gesprochenen Antworten. Wenn eine
Aktion nötig ist, rufe das passende Werkzeug auf; der Nutzer wird bei
sicherheitskritischen Aktionen um Bestätigung gebeten, bevor sie ausgeführt werden.
"""

# Werkzeug-Definitionen für die Claude Messages API.
TOOL_DEFS = [
    {
        "name": "terminal",
        "description": (
            "Führt einen Shell-Befehl unter Ubuntu aus und gibt die Ausgabe zurück. "
            "Nutze dies für Systeminfos, Programme starten, Dateien verwalten per CLI."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Der auszuführende Shell-Befehl"},
            },
            "required": ["command"],
        },
    },
    {
        "name": "browser",
        "description": "Öffnet den Standardbrowser mit einer URL oder führt eine Websuche aus.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "Die zu öffnende URL (optional)"},
                "search": {"type": "string", "description": "Suchbegriff für eine Websuche (optional)"},
            },
        },
    },
    {
        "name": "filesystem",
        "description": "Verwaltet Dateien und Verzeichnisse auf dem Rechner.",
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["list", "read", "write", "append", "mkdir", "move", "delete"],
                    "description": "Die auszuführende Dateiaktion",
                },
                "path": {"type": "string", "description": "Ziel-Pfad"},
                "content": {"type": "string", "description": "Inhalt für write/append (optional)"},
                "destination": {"type": "string", "description": "Zielpfad für move (optional)"},
            },
            "required": ["action", "path"],
        },
    },
    {
        "name": "notes",
        "description": (
            "Dauerhafter Merkzettel. Nutze dies, wenn der Nutzer sagt 'merk dir …', "
            "'notier …', 'was habe ich mir gemerkt?' oder eine Notiz löschen will."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["add", "list", "delete", "clear"],
                    "description": "Die auszuführende Notiz-Aktion",
                },
                "text": {"type": "string", "description": "Notiztext für add (optional)"},
                "number": {"type": "integer", "description": "Nummer der Notiz für delete (optional)"},
            },
            "required": ["action"],
        },
    },
    {
        "name": "organize",
        "description": (
            "Räumt einen Ordner auf: sortiert lose Dateien in Unterordner wie "
            "Bilder, Dokumente, Musik, Videos, Archive. Erst mit apply=false eine "
            "Vorschau zeigen, dann auf Wunsch mit apply=true ausführen."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Der aufzuräumende Ordner, z. B. ~/Downloads"},
                "apply": {
                    "type": "boolean",
                    "description": "false = nur Vorschau, true = Dateien wirklich verschieben",
                },
            },
            "required": ["path"],
        },
    },
]


def _needs_confirmation(tool_name: str, tool_input: dict) -> bool:
    if not CONFIG.require_confirmation:
        return False
    if tool_name == "organize":
        return bool(tool_input.get("apply"))  # Vorschau ist unkritisch
    if tool_name in CONFIRM_TOOLS:
        return True
    if tool_name == "filesystem":
        return tool_input.get("action") in CONFIRM_FILE_ACTIONS
    return False


def _describe_action(tool_name: str, tool_input: dict) -> str:
    if tool_name == "terminal":
        return f"Ich möchte diesen Befehl ausführen: {tool_input.get('command', '')}"
    if tool_name == "browser":
        if tool_input.get("search"):
            return f"Ich möchte im Web suchen nach: {tool_input['search']}"
        return f"Ich möchte diese Seite öffnen: {tool_input.get('url', '')}"
    if tool_name == "filesystem":
        return f"Ich möchte '{tool_input.get('action')}' ausführen auf: {tool_input.get('path', '')}"
    if tool_name == "organize":
        return f"Ich möchte den Ordner aufräumen und Dateien verschieben: {tool_input.get('path', '')}"
    return f"Ich möchte {tool_name} verwenden."


class JarvisAgent:
    """Kapselt die Claude-Fable-5-Konversation und die Werkzeug-Schleife."""

    def __init__(
        self,
        confirm_cb: Callable[[str], bool] | None = None,
        thought_cb: Callable[[str], None] | None = None,
        tool_cb: Callable[[str, dict], None] | None = None,
        extra_tools: dict[str, Callable] | None = None,
        extra_tool_defs: list[dict] | None = None,
    ) -> None:
        # Bestätigungs-Callback: gibt True zurück, wenn der Nutzer "Ja" sagt.
        self.confirm_cb = confirm_cb or (lambda desc: True)
        # Callbacks für die GUI (Gedankengang / aktive Tools).
        self.thought_cb = thought_cb or (lambda text: None)
        self.tool_cb = tool_cb or (lambda name, inp: None)

        self.tools = dict(TOOLS)
        self.tool_defs = list(TOOL_DEFS)
        if extra_tools:
            self.tools.update(extra_tools)
        if extra_tool_defs:
            self.tool_defs.extend(extra_tool_defs)

        self.messages: list[dict] = []
        self._client = None
        self._init_client()

    def _init_client(self) -> None:
        try:
            import anthropic

            self._client = anthropic.Anthropic()
        except Exception as exc:  # noqa: BLE001
            self._client = None
            self._client_error = str(exc)

    @property
    def ready(self) -> bool:
        return self._client is not None

    def _run_tool(self, name: str, tool_input: dict) -> str:
        func = self.tools.get(name)
        if func is None:
            return f"Unbekanntes Werkzeug: {name}"
        try:
            return str(func(**tool_input))
        except TypeError as exc:
            return f"Ungültige Parameter für {name}: {exc}"
        except Exception as exc:  # noqa: BLE001
            return f"Fehler bei {name}: {exc}"

    def ask(self, user_text: str) -> str:
        """Verarbeitet eine Nutzeräußerung und gibt Jarvis' finale Antwort zurück."""
        if not self.ready:
            return (
                "Ich kann den Sprachdienst nicht erreichen. "
                "Bitte prüfe den ANTHROPIC_API_KEY."
            )

        self.messages.append({"role": "user", "content": user_text})
        self.thought_cb("Analysiere die Anfrage …")

        while True:
            response = self._client.messages.create(
                model=CONFIG.model,
                max_tokens=CONFIG.max_tokens,
                output_config={"effort": CONFIG.effort},
                system=SYSTEM_PROMPT,
                tools=self.tool_defs,
                messages=self.messages,
            )

            # Sicherheits-Ablehnung von Claude Fable 5 abfangen.
            if response.stop_reason == "refusal":
                self.messages.append({"role": "assistant", "content": response.content})
                return "Diese Anfrage kann ich aus Sicherheitsgründen nicht ausführen."

            self.messages.append({"role": "assistant", "content": response.content})

            tool_uses = [b for b in response.content if b.type == "tool_use"]
            text_parts = [b.text for b in response.content if b.type == "text"]

            if response.stop_reason != "tool_use" or not tool_uses:
                return " ".join(text_parts).strip() or "Erledigt."

            # Werkzeuge ausführen (mit Bestätigung, wenn nötig).
            tool_results = []
            for block in tool_uses:
                name, tool_input = block.name, dict(block.input)
                self.tool_cb(name, tool_input)
                if text_parts:
                    self.thought_cb(" ".join(text_parts))

                if _needs_confirmation(name, tool_input):
                    desc = _describe_action(name, tool_input)
                    self.thought_cb(desc + " Ausführen? [Ja/Nein]")
                    if not self.confirm_cb(desc):
                        result = "Aktion vom Nutzer abgelehnt."
                    else:
                        result = self._run_tool(name, tool_input)
                else:
                    result = self._run_tool(name, tool_input)

                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    }
                )

            self.messages.append({"role": "user", "content": tool_results})
            # Schleife läuft weiter, bis Claude ohne Werkzeugaufruf antwortet.
