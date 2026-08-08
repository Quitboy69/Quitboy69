"""Terminal-Tool: führt Shell-Befehle unter Ubuntu aus."""

from __future__ import annotations

import subprocess

# Befehle, die niemals ausgeführt werden (Sicherheitsnetz zusätzlich zur Bestätigung)
BLOCKLIST = (
    "rm -rf /",
    "mkfs",
    "dd if=",
    ":(){",  # Forkbombe
    "> /dev/sda",
)


def run_terminal_command(command: str, timeout: int = 60, cwd: str | None = None) -> str:
    """Führt einen Shell-Befehl aus und gibt stdout/stderr zurück."""
    lowered = command.strip().lower()
    for blocked in BLOCKLIST:
        if blocked in lowered:
            return f"Befehl blockiert (Sicherheitsregel): {command}"

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
    except subprocess.TimeoutExpired:
        return f"Zeitüberschreitung nach {timeout}s: {command}"

    output = ""
    if result.stdout:
        output += result.stdout
    if result.stderr:
        output += ("\n[stderr]\n" + result.stderr) if output else "[stderr]\n" + result.stderr
    if not output.strip():
        output = f"(kein Output, Exit-Code {result.returncode})"
    # Sehr lange Ausgaben kürzen, damit der Agent-Kontext schlank bleibt
    if len(output) > 8000:
        output = output[:8000] + f"\n… [gekürzt, insgesamt {len(output)} Zeichen]"
    return output
