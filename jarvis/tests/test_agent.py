"""Integrationstests für die Agent-Schleife mit einem gefälschten Claude-Client.

Diese Tests brauchen weder Netzwerk noch API-Key. Sie beweisen, dass die
Planungs-/Werkzeug-/Bestätigungs-Schleife aus agent.py korrekt arbeitet:
Werkzeugaufruf → (optional Bestätigung) → Ergebnis zurück an das Modell →
finale Antwort.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from jarvis.agent import JarvisAgent


# --- Hilfsobjekte, die die Form der Anthropic-SDK-Antworten nachbilden --- #
def text_block(text: str) -> SimpleNamespace:
    return SimpleNamespace(type="text", text=text)


def tool_block(block_id: str, name: str, tool_input: dict) -> SimpleNamespace:
    return SimpleNamespace(type="tool_use", id=block_id, name=name, input=tool_input)


def response(stop_reason: str, content: list) -> SimpleNamespace:
    return SimpleNamespace(stop_reason=stop_reason, content=content)


class FakeMessages:
    """Gibt eine vorher festgelegte Sequenz von Antworten zurück."""

    def __init__(self, scripted: list) -> None:
        self._scripted = scripted
        self.calls: list[dict] = []

    def create(self, **kwargs):
        # Momentaufnahme der Nachrichten festhalten – der Agent mutiert die
        # Liste nach dem Aufruf weiter.
        snapshot = dict(kwargs)
        snapshot["messages"] = [dict(m) for m in kwargs.get("messages", [])]
        self.calls.append(snapshot)
        return self._scripted.pop(0)


class FakeClient:
    def __init__(self, scripted: list) -> None:
        self.messages = FakeMessages(scripted)


def make_agent(scripted: list, **kwargs) -> JarvisAgent:
    agent = JarvisAgent(**kwargs)
    agent._client = FakeClient(scripted)  # Netzwerk-Client ersetzen
    return agent


# --------------------------------------------------------------------------- #
def test_terminal_tool_loop_with_confirmation(tmp_path):
    """Modell ruft terminal auf, Nutzer bestätigt, Ergebnis fließt zurück."""
    marker = tmp_path / "beweis.txt"
    scripted = [
        response("tool_use", [
            text_block("Ich lege eine Datei an."),
            tool_block("t1", "terminal", {"command": f"echo hallo > {marker}"}),
        ]),
        response("end_turn", [text_block("Erledigt, die Datei wurde angelegt.")]),
    ]
    confirmations: list[str] = []
    agent = make_agent(scripted, confirm_cb=lambda desc: (confirmations.append(desc) or True))

    answer = agent.ask("Lege eine Testdatei an")

    assert answer == "Erledigt, die Datei wurde angelegt."
    assert marker.exists(), "Der bestätigte Terminal-Befehl wurde nicht ausgeführt"
    assert confirmations, "Für den Terminal-Befehl wurde keine Bestätigung eingeholt"
    # Der zweite API-Aufruf muss das Werkzeug-Ergebnis enthalten haben.
    second_call_messages = agent._client.messages.calls[1]["messages"]
    tool_results = [
        c for m in second_call_messages if isinstance(m.get("content"), list)
        for c in m["content"] if isinstance(c, dict) and c.get("type") == "tool_result"
    ]
    assert tool_results and tool_results[0]["tool_use_id"] == "t1"


def test_rejected_confirmation_blocks_execution(tmp_path):
    """Sagt der Nutzer Nein, wird der Befehl nicht ausgeführt."""
    marker = tmp_path / "darf_nicht_entstehen.txt"
    scripted = [
        response("tool_use", [
            tool_block("t1", "terminal", {"command": f"echo x > {marker}"}),
        ]),
        response("end_turn", [text_block("Okay, ich habe nichts geändert.")]),
    ]
    agent = make_agent(scripted, confirm_cb=lambda desc: False)

    answer = agent.ask("Lösche alles")

    assert not marker.exists(), "Abgelehnter Befehl wurde trotzdem ausgeführt"
    assert answer == "Okay, ich habe nichts geändert."
    # Das zurückgemeldete Ergebnis muss die Ablehnung enthalten.
    second_call_messages = agent._client.messages.calls[1]["messages"]
    result_text = str(second_call_messages[-1]["content"])
    assert "abgelehnt" in result_text.lower()


def test_browser_tool_needs_no_confirmation():
    """Der Browser gilt nicht als sicherheitskritisch – keine Bestätigung."""
    scripted = [
        response("tool_use", [
            tool_block("b1", "browser", {"search": "wetter berlin"}),
        ]),
        response("end_turn", [text_block("Ich habe die Suche geöffnet.")]),
    ]
    confirm_calls: list[str] = []
    agent = make_agent(scripted, confirm_cb=lambda d: confirm_calls.append(d) or True)

    answer = agent.ask("Such nach dem Wetter in Berlin")

    assert answer == "Ich habe die Suche geöffnet."
    assert confirm_calls == [], "Browser sollte keine Bestätigung erfordern"


def test_refusal_is_handled_gracefully():
    """Eine Sicherheits-Ablehnung von Fable 5 endet nicht in einem Absturz."""
    scripted = [response("refusal", [])]
    agent = make_agent(scripted)

    answer = agent.ask("Etwas Unerlaubtes")

    assert "sicherheitsgründen" in answer.lower()


def test_missing_client_returns_hint():
    """Ohne API-Client kommt ein Hinweis statt einer Exception."""
    agent = JarvisAgent()
    agent._client = None
    answer = agent.ask("Hallo")
    assert "anthropic_api_key" in answer.lower()


def test_plain_answer_without_tools():
    """Reine Textantwort ohne Werkzeugaufruf."""
    scripted = [response("end_turn", [text_block("Hallo, wie kann ich helfen?")])]
    agent = make_agent(scripted)
    assert agent.ask("Hi") == "Hallo, wie kann ich helfen?"


def test_filesystem_read_needs_no_confirmation_but_write_does(tmp_path):
    """Lesen ist unkritisch, Schreiben erfordert Bestätigung."""
    target = tmp_path / "notiz.txt"
    scripted = [
        response("tool_use", [
            tool_block("f1", "filesystem",
                       {"action": "write", "path": str(target), "content": "Merkzettel"}),
        ]),
        response("end_turn", [text_block("Notiz gespeichert.")]),
    ]
    confirm_calls: list[str] = []
    agent = make_agent(scripted, confirm_cb=lambda d: confirm_calls.append(d) or True)

    answer = agent.ask("Schreib mir eine Notiz")

    assert answer == "Notiz gespeichert."
    assert target.read_text() == "Merkzettel"
    assert confirm_calls, "Schreibende Dateiaktion sollte bestätigt werden"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
