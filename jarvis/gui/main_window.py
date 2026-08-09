"""Moderne Jarvis-Oberfläche (PySide6 + PyQtGraph).

Layout (aus dem Konzept):

    ┌──────────────────────────────┐
    │            JARVIS            │
    ├──────────────────────────────┤
    │ Gedanken                     │
    │ — Analysiere Kamera          │
    │ — Suche Ubuntu-Befehl        │
    │ — Bereite Antwort vor        │
    ├──────────────┬───────────────┤
    │ Kamera Feed  │ Terminal/     │
    │              │ Aktionen      │
    ├──────────────┴───────────────┤
    │ Mikrofon aktiv               │
    │ CPU 23%  GPU 41%             │
    └──────────────────────────────┘

Zeigt: Mikrofonstatus, Kamerastatus, CPU/GPU-Auslastung, aktueller
Gedankengang, aktive Tools, Gesprächsverlauf und Ubuntu-Systemdaten.
"""

from __future__ import annotations

from collections import deque

from PySide6 import QtCore, QtGui, QtWidgets

try:
    import pyqtgraph as pg
except Exception:  # pragma: no cover
    pg = None

from ..config import CONFIG

DARK = "#0d1117"
PANEL = "#161b22"
ACCENT = "#00d1ff"
TEXT = "#e6edf3"
MUTED = "#8b949e"
OK = "#3fb950"
WARN = "#d29922"


def _status_dot(active: bool) -> str:
    return OK if active else MUTED


class StatBadge(QtWidgets.QFrame):
    """Kleines Statuselement für Mikrofon/Kamera."""

    def __init__(self, label: str) -> None:
        super().__init__()
        self.setStyleSheet(f"background:{PANEL}; border-radius:8px;")
        layout = QtWidgets.QHBoxLayout(self)
        layout.setContentsMargins(10, 6, 10, 6)
        self.dot = QtWidgets.QLabel("●")
        self.dot.setStyleSheet(f"color:{MUTED}; font-size:14px;")
        self.text = QtWidgets.QLabel(label)
        self.text.setStyleSheet(f"color:{TEXT};")
        layout.addWidget(self.dot)
        layout.addWidget(self.text)
        layout.addStretch()

    def set_active(self, active: bool, label: str | None = None) -> None:
        self.dot.setStyleSheet(f"color:{_status_dot(active)}; font-size:14px;")
        if label:
            self.text.setText(label)


class MainWindow(QtWidgets.QMainWindow):
    # Signale, damit Worker-Threads die GUI thread-sicher aktualisieren.
    sig_thought = QtCore.Signal(str)
    sig_tool = QtCore.Signal(str)
    sig_conversation = QtCore.Signal(str, str)  # sprecher, text
    sig_stats = QtCore.Signal(float, float, float)  # cpu, gpu, ram
    sig_mic = QtCore.Signal(bool)
    sig_cam = QtCore.Signal(bool)
    sig_frame = QtCore.Signal(object)  # numpy-Frame für Kamera-Feed
    sig_confirm = QtCore.Signal(str, object)  # beschreibung, callback

    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("JARVIS")
        self.resize(1100, 720)
        self.setStyleSheet(f"background:{DARK}; color:{TEXT}; font-size:13px;")

        self._cpu_hist: deque[float] = deque([0.0] * 60, maxlen=60)
        self._gpu_hist: deque[float] = deque([0.0] * 60, maxlen=60)

        self._build_ui()
        self._connect_signals()

    # --------------------------------------------------------------- Aufbau
    def _build_ui(self) -> None:
        central = QtWidgets.QWidget()
        self.setCentralWidget(central)
        root = QtWidgets.QVBoxLayout(central)
        root.setSpacing(10)
        root.setContentsMargins(14, 14, 14, 14)

        root.addWidget(self._build_header())
        root.addWidget(self._build_thoughts(), stretch=0)

        middle = QtWidgets.QHBoxLayout()
        middle.setSpacing(10)
        middle.addWidget(self._build_camera_panel(), stretch=1)
        middle.addWidget(self._build_actions_panel(), stretch=1)
        root.addLayout(middle, stretch=1)

        root.addWidget(self._build_footer())

    def _panel(self, title: str) -> tuple[QtWidgets.QFrame, QtWidgets.QVBoxLayout]:
        frame = QtWidgets.QFrame()
        frame.setStyleSheet(f"background:{PANEL}; border-radius:12px;")
        layout = QtWidgets.QVBoxLayout(frame)
        layout.setContentsMargins(14, 12, 14, 12)
        if title:
            header = QtWidgets.QLabel(title)
            header.setStyleSheet(f"color:{ACCENT}; font-weight:600; font-size:14px;")
            layout.addWidget(header)
        return frame, layout

    def _build_header(self) -> QtWidgets.QWidget:
        frame = QtWidgets.QFrame()
        frame.setStyleSheet(f"background:{PANEL}; border-radius:12px;")
        layout = QtWidgets.QHBoxLayout(frame)
        layout.setContentsMargins(18, 10, 18, 10)
        title = QtWidgets.QLabel("J A R V I S")
        title.setStyleSheet(f"color:{ACCENT}; font-size:22px; font-weight:800; letter-spacing:4px;")
        layout.addWidget(title)
        layout.addStretch()
        self.model_label = QtWidgets.QLabel(f"Modell: {CONFIG.model}")
        self.model_label.setStyleSheet(f"color:{MUTED};")
        layout.addWidget(self.model_label)
        return frame

    def _build_thoughts(self) -> QtWidgets.QWidget:
        frame, layout = self._panel("Gedanken")
        self.thoughts = QtWidgets.QListWidget()
        self.thoughts.setStyleSheet(
            f"background:transparent; border:none; color:{TEXT};"
        )
        self.thoughts.setMaximumHeight(120)
        layout.addWidget(self.thoughts)

        tools_row = QtWidgets.QHBoxLayout()
        tools_lbl = QtWidgets.QLabel("Aktive Tools:")
        tools_lbl.setStyleSheet(f"color:{MUTED};")
        self.active_tool = QtWidgets.QLabel("—")
        self.active_tool.setStyleSheet(f"color:{WARN}; font-weight:600;")
        tools_row.addWidget(tools_lbl)
        tools_row.addWidget(self.active_tool)
        tools_row.addStretch()
        layout.addLayout(tools_row)
        return frame

    def _build_camera_panel(self) -> QtWidgets.QWidget:
        frame, layout = self._panel("Kamera Feed")
        self.camera_view = QtWidgets.QLabel("Kein Kamerabild")
        self.camera_view.setAlignment(QtCore.Qt.AlignCenter)
        self.camera_view.setMinimumHeight(240)
        self.camera_view.setStyleSheet(
            f"background:#000; border-radius:8px; color:{MUTED};"
        )
        layout.addWidget(self.camera_view, stretch=1)
        return frame

    def _build_actions_panel(self) -> QtWidgets.QWidget:
        frame, layout = self._panel("Terminal / Aktionen · Gesprächsverlauf")
        self.conversation = QtWidgets.QTextEdit()
        self.conversation.setReadOnly(True)
        self.conversation.setStyleSheet(
            f"background:#0b0f14; border-radius:8px; color:{TEXT}; padding:8px;"
        )
        layout.addWidget(self.conversation, stretch=1)

        input_row = QtWidgets.QHBoxLayout()
        self.text_input = QtWidgets.QLineEdit()
        self.text_input.setPlaceholderText("Nachricht an Jarvis eingeben …")
        self.text_input.setStyleSheet(
            f"background:#0b0f14; border:1px solid #30363d; border-radius:8px;"
            f" padding:8px; color:{TEXT};"
        )
        self.mic_button = QtWidgets.QPushButton("🎤")
        self.mic_button.setToolTip("Einmal zuhören (Push-to-Talk)")
        self.mic_button.setStyleSheet(
            f"background:#0b0f14; border:1px solid #30363d; border-radius:8px;"
            f" padding:8px 12px; color:{TEXT}; font-size:15px;"
        )
        self.send_button = QtWidgets.QPushButton("Senden")
        self.send_button.setStyleSheet(
            f"background:{ACCENT}; color:#001018; border-radius:8px;"
            f" padding:8px 16px; font-weight:600;"
        )
        input_row.addWidget(self.text_input, stretch=1)
        input_row.addWidget(self.mic_button)
        input_row.addWidget(self.send_button)
        layout.addLayout(input_row)
        return frame

    def _build_footer(self) -> QtWidgets.QWidget:
        frame = QtWidgets.QFrame()
        frame.setStyleSheet(f"background:{PANEL}; border-radius:12px;")
        layout = QtWidgets.QHBoxLayout(frame)
        layout.setContentsMargins(14, 10, 14, 10)
        layout.setSpacing(14)

        self.mic_badge = StatBadge("Mikrofon inaktiv")
        self.cam_badge = StatBadge("Kamera inaktiv")
        layout.addWidget(self.mic_badge)
        layout.addWidget(self.cam_badge)

        self.backend_label = QtWidgets.QLabel("")
        self.backend_label.setStyleSheet(f"color:{MUTED}; font-size:11px;")
        layout.addWidget(self.backend_label)

        self.cpu_label = QtWidgets.QLabel("CPU 0%")
        self.gpu_label = QtWidgets.QLabel("GPU 0%")
        self.ram_label = QtWidgets.QLabel("RAM 0%")
        for lbl in (self.cpu_label, self.gpu_label, self.ram_label):
            lbl.setStyleSheet(f"color:{TEXT}; font-weight:600;")

        layout.addStretch()
        if pg is not None:
            self.plot = pg.PlotWidget()
            self.plot.setFixedSize(220, 60)
            self.plot.setBackground(PANEL)
            self.plot.hideAxis("bottom")
            self.plot.hideAxis("left")
            self.plot.setYRange(0, 100)
            self._cpu_curve = self.plot.plot(pen=pg.mkPen(ACCENT, width=2))
            self._gpu_curve = self.plot.plot(pen=pg.mkPen(WARN, width=2))
            layout.addWidget(self.plot)
        layout.addWidget(self.cpu_label)
        layout.addWidget(self.gpu_label)
        layout.addWidget(self.ram_label)
        return frame

    # ------------------------------------------------------------- Signale
    def _connect_signals(self) -> None:
        self.sig_thought.connect(self._on_thought)
        self.sig_tool.connect(self.active_tool.setText)
        self.sig_conversation.connect(self._on_conversation)
        self.sig_stats.connect(self._on_stats)
        self.sig_mic.connect(lambda a: self.mic_badge.set_active(
            a, "Mikrofon aktiv" if a else "Mikrofon inaktiv"))
        self.sig_cam.connect(lambda a: self.cam_badge.set_active(
            a, "Kamera aktiv" if a else "Kamera inaktiv"))
        self.sig_frame.connect(self._on_frame)
        self.sig_confirm.connect(self._on_confirm)

    @QtCore.Slot(str)
    def _on_thought(self, text: str) -> None:
        item = QtWidgets.QListWidgetItem("— " + text)
        self.thoughts.addItem(item)
        self.thoughts.scrollToBottom()
        while self.thoughts.count() > 50:
            self.thoughts.takeItem(0)

    @QtCore.Slot(str, str)
    def _on_conversation(self, speaker: str, text: str) -> None:
        color = ACCENT if speaker == "Jarvis" else TEXT
        self.conversation.append(
            f'<span style="color:{color}; font-weight:600;">{speaker}:</span> {text}'
        )

    @QtCore.Slot(float, float, float)
    def _on_stats(self, cpu: float, gpu: float, ram: float) -> None:
        self.cpu_label.setText(f"CPU {cpu:.0f}%")
        self.gpu_label.setText(f"GPU {gpu:.0f}%")
        self.ram_label.setText(f"RAM {ram:.0f}%")
        self._cpu_hist.append(cpu)
        self._gpu_hist.append(gpu)
        if pg is not None:
            self._cpu_curve.setData(list(self._cpu_hist))
            self._gpu_curve.setData(list(self._gpu_hist))

    @QtCore.Slot(object)
    def _on_frame(self, frame) -> None:
        if frame is None:
            return
        try:
            import numpy as np

            rgb = frame[:, :, ::-1].copy()  # BGR -> RGB
            h, w, ch = rgb.shape
            img = QtGui.QImage(rgb.data, w, h, ch * w, QtGui.QImage.Format_RGB888)
            pix = QtGui.QPixmap.fromImage(img).scaled(
                self.camera_view.width(),
                self.camera_view.height(),
                QtCore.Qt.KeepAspectRatio,
                QtCore.Qt.SmoothTransformation,
            )
            self.camera_view.setPixmap(pix)
        except Exception:
            pass

    @QtCore.Slot(str, object)
    def _on_confirm(self, description: str, callback) -> None:
        reply = QtWidgets.QMessageBox.question(
            self, "Ausführen?",
            f"{description}\n\nAusführen? [Ja/Nein]",
            QtWidgets.QMessageBox.Yes | QtWidgets.QMessageBox.No,
        )
        callback(reply == QtWidgets.QMessageBox.Yes)
