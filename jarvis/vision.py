"""Kameramodul — Objekterkennung unter Ubuntu.

Ultralytics YOLO (YOLOv11) / OpenCV.

Beispielablauf:

    frame = webcam.read()
    results = model(frame)
    for obj in results:
        print(
            f"Das ist ein {obj.name}. "
            f"Man kann es verwenden für {knowledge[obj.name]}"
        )

Beispielausgabe:

    Erkannt: Tasse
    Verwendung:
    — Getränke trinken
    — Stifte aufbewahren
    — Dekoration
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .config import CONFIG

# Einfaches Wissen über Verwendungszwecke gängiger Objekte (COCO-Klassen, dt.)
KNOWLEDGE: dict[str, list[str]] = {
    "cup": ["Getränke trinken", "Stifte aufbewahren", "Dekoration"],
    "tasse": ["Getränke trinken", "Stifte aufbewahren", "Dekoration"],
    "bottle": ["Wasser trinken", "Flüssigkeiten aufbewahren"],
    "cell phone": ["Telefonieren", "Nachrichten schreiben", "Fotos machen"],
    "laptop": ["Arbeiten", "Programmieren", "Surfen"],
    "keyboard": ["Tippen", "Steuern von Programmen"],
    "mouse": ["Cursor steuern", "Klicken"],
    "book": ["Lesen", "Lernen", "Nachschlagen"],
    "person": ["Gespräch führen", "Zusammenarbeiten"],
    "chair": ["Sitzen", "Ablegen von Gegenständen"],
}


@dataclass
class Detection:
    name: str
    confidence: float
    box: tuple[int, int, int, int] = (0, 0, 0, 0)  # x1, y1, x2, y2
    uses: list[str] = field(default_factory=list)

    def describe(self) -> str:
        uses = ", ".join(self.uses) if self.uses else "verschiedene Zwecke"
        return f"Das ist ein {self.name}. Man kann es verwenden für {uses}."


class VisionSystem:
    def __init__(self) -> None:
        self._model = None
        self._cap = None
        self._backend = "none"
        try:
            from ultralytics import YOLO  # type: ignore

            self._model = YOLO(CONFIG.yolo_model)
            self._backend = "yolo"
        except Exception:
            self._backend = "none"

    @property
    def backend(self) -> str:
        return self._backend

    def _open_camera(self):
        if self._cap is not None:
            return self._cap
        try:
            import cv2  # type: ignore

            self._cap = cv2.VideoCapture(CONFIG.camera_index)
        except Exception:
            self._cap = None
        return self._cap

    def camera_available(self) -> bool:
        """True, wenn eine Kamera geöffnet werden kann — unabhängig von YOLO."""
        cap = self._open_camera()
        return cap is not None and cap.isOpened()

    def read_frame(self):
        cap = self._open_camera()
        if cap is None or not cap.isOpened():
            return None
        ok, frame = cap.read()
        return frame if ok else None

    def detect(self, frame=None) -> list[Detection]:
        """Erkennt Objekte in einem Frame (oder liest live von der Kamera)."""
        if self._model is None:
            return []
        if frame is None:
            frame = self.read_frame()
        if frame is None:
            return []

        detections: list[Detection] = []
        results = self._model(frame, verbose=False)
        for result in results:
            names = result.names
            for box in result.boxes:
                cls_id = int(box.cls[0])
                name = names.get(cls_id, str(cls_id))
                conf = float(box.conf[0])
                xyxy = tuple(int(v) for v in box.xyxy[0])
                detections.append(
                    Detection(
                        name=name,
                        confidence=conf,
                        box=xyxy,
                        uses=KNOWLEDGE.get(name.lower(), []),
                    )
                )
        return detections

    def describe_scene(self) -> str:
        """Erkennt Objekte und gibt eine sprechbare Beschreibung zurück."""
        detections = self.detect()
        if not detections:
            return "Ich sehe im Moment keine bekannten Objekte."
        lines = [d.describe() for d in detections[:5]]
        return " ".join(lines)

    def release(self) -> None:
        if self._cap is not None:
            try:
                self._cap.release()
            except Exception:
                pass
            self._cap = None
