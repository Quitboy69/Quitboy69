"""Ubuntu-Systemdaten: CPU/GPU-Auslastung, RAM, Mikrofon-/Kamerastatus."""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass


@dataclass
class SystemSnapshot:
    cpu_percent: float = 0.0
    gpu_percent: float = 0.0
    ram_percent: float = 0.0
    mic_active: bool = False
    cam_active: bool = False


def _cpu_percent() -> float:
    try:
        import psutil

        return float(psutil.cpu_percent(interval=None))
    except Exception:
        return 0.0


def _ram_percent() -> float:
    try:
        import psutil

        return float(psutil.virtual_memory().percent)
    except Exception:
        return 0.0


def _gpu_percent() -> float:
    """NVIDIA-GPU-Auslastung via nvidia-smi (falls vorhanden)."""
    if not shutil.which("nvidia-smi"):
        return 0.0
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        first = out.stdout.strip().splitlines()[0]
        return float(first)
    except Exception:
        return 0.0


def snapshot(mic_active: bool = False, cam_active: bool = False) -> SystemSnapshot:
    return SystemSnapshot(
        cpu_percent=_cpu_percent(),
        gpu_percent=_gpu_percent(),
        ram_percent=_ram_percent(),
        mic_active=mic_active,
        cam_active=cam_active,
    )
