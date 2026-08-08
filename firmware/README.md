# WISP — Wireless Insight & Signal Platform

Eine eigenständige Multi-Tool-Firmware für das **Heltec WiFi LoRa 32 V3**
(ESP32-S3 + Semtech SX1262 + SSD1306 OLED). Konzeptionell verwandt mit
Projekten wie Marauder, aber mit eigenem, modularem Aufbau und einem klaren
Fokus: **passives Recon, Monitoring und LoRa-Kommunikation** — keine
störenden Angriffe.

> **Eigenes Konzept, bewusste Grenzen:** WISP hört zu, misst und
> kommuniziert. Es enthält **kein** Deauth, kein Beacon-/Probe-Spam, kein
> Jamming und keine anderen Funktionen, die fremde Funknetze stören. Solche
> Störangriffe sind in den meisten Ländern illegal und sind hier absichtlich
> nicht implementiert. WISP ist gedacht für **autorisierte Sicherheitstests
> an eigenen bzw. freigegebenen Systemen, Ausbildung und LoRa-Basteleien**.

## Hardware

| Komponente | Detail |
|-----------|--------|
| MCU | ESP32-S3FN8 (Dual-Core LX7, WiFi + BLE 5) |
| Funk (Sub-GHz) | Semtech SX1262 über SPI |
| Display | SSD1306 128×64 OLED über I2C |
| Bedienung | ein PRG-Taster (GPIO0) |
| Strom | Li-Ion über JST, Vext-gesteuerte Peripherie |

Die genaue Pinbelegung steht in [`src/board_pins.h`](src/board_pins.h) und
gilt **nur für die V3** (V2 hat andere Pins).

## Module

| Modul | Was es tut | Sendet? |
|-------|-----------|---------|
| **WiFi Scan** | Listet sichtbare Access Points (SSID, Kanal, RSSI, Verschlüsselung) | nein (passiv) |
| **WiFi Monitor** | Promiscuous-Mode: zählt Management-/Control-/Data-Frames, Beacons und Probe-Requests, Kanal-Hopping | nein (nur RX) |
| **BLE Scan** | Listet werbende BLE-Geräte (Name, Adresse, RSSI) | nein (passiv) |
| **LoRa Chat** | Kleiner Text-Messenger über LoRa (Preset-Nachrichten, RX-Log mit RSSI/SNR) | ja (LoRa TX) |
| **LoRa Spectrum** | RSSI-Sweep rund um die LoRa-Frequenz als Balkendiagramm mit Peak-Hold | nein (nur RX) |
| **System Info** | Akku, freier Heap, Uptime, Chip, MAC | — |

Neue Module lassen sich leicht ergänzen: Von `Module` ableiten
([`src/core/Module.h`](src/core/Module.h)) und in
[`src/main.cpp`](src/main.cpp) registrieren.

## Bedienung (ein Taster, drei Gesten)

| Geste | Im Menü | In einem Modul |
|-------|---------|----------------|
| **Kurz** tippen | nächster Eintrag | scrollen / Auswahl wechseln |
| **Lang** halten (≥600 ms) | Modul öffnen | Aktion (z. B. Rescan, Senden, Pause) |
| **Doppel**-tippen | vorheriger Eintrag | zurück ins Menü |

Die genaue Aktion pro Modul steht in dessen Quelldatei; die Timings sind in
[`src/config.h`](src/config.h) einstellbar.

## Bauen & Flashen

Voraussetzung: [PlatformIO](https://platformio.org/) (CLI oder VS-Code-Plugin).

```bash
cd firmware

# Kompilieren
pio run

# Auf das Board flashen (USB-C anstecken)
pio run -t upload

# Serielle Ausgabe ansehen
pio device monitor
```

Beim ersten Build lädt PlatformIO automatisch die ESP32-Toolchain und die
Bibliotheken (U8g2, RadioLib, NimBLE-Arduino) — dafür wird eine
Internetverbindung benötigt.

## Konfiguration

Alles Wichtige liegt in [`src/config.h`](src/config.h):

- **LoRa-Frequenz/Bandbreite/SF/Power** — Standard ist das EU-868-MHz-ISM-Band.
  Für die USA `LORA_FREQUENCY_MHZ` auf `915.0` setzen, für Asien `923.0` usw.
- **WiFi-Kanäle** — `WIFI_CHANNEL_MAX` auf `11` für die US-Regulierung.
- **UI-Timings** — Long-Press-Schwelle, Doppel-Tipp-Fenster, Framerate.

> **⚠️ Funkrecht:** LoRa sendet aktiv. Du bist selbst dafür verantwortlich,
> nur auf einer bei dir zugelassenen Frequenz, mit erlaubter Sendeleistung
> und zulässigem Duty-Cycle zu senden. Falsche Einstellungen können illegal
> sein.

## Projektstruktur

```
firmware/
├── platformio.ini          # Build-Konfiguration, Board, Libraries
├── src/
│   ├── main.cpp            # Einstieg: Setup, Modul-Registrierung, Loop
│   ├── config.h           # Alle einstellbaren Parameter
│   ├── board_pins.h       # Pinbelegung Heltec V3
│   ├── core/              # App-Steuerung + Modul-Interface
│   ├── ui/                # Display, Menü, Taster-Dekodierung
│   ├── hal/               # Board (Strom/LED/Akku) + LoRa-Radio-Wrapper
│   └── modules/           # Die einzelnen Tools
└── .github/workflows/     # CI: baut die Firmware bei jedem Push
```

## Rechtlicher & ethischer Hinweis

WISP ist ein Werkzeug für **autorisierte** Sicherheitstests, Lehre und
Amateurfunk-/LoRa-Experimente. Das passive Mitschneiden von Funkverkehr, das
Scannen fremder Netze und das Senden auf Funkbändern unterliegen je nach Land
unterschiedlichen Gesetzen. Setze WISP nur dort ein, wo du dazu berechtigt
bist — an eigenen Geräten oder mit ausdrücklicher Erlaubnis des Betreibers.

## Roadmap-Ideen

- Persistente Einstellungen (LittleFS) statt Compile-Zeit-Konfiguration
- CSV-/PCAP-Export der WiFi-Monitor-Zähler über Serial
- Einfacher, verschlüsselter LoRa-Mesh-Modus mit Store-and-Forward
- GPS-Anbindung für Standort-Tagging der Scans

## Lizenz

Noch nicht festgelegt — bei Bedarf eine `LICENSE` ergänzen (z. B. MIT).
