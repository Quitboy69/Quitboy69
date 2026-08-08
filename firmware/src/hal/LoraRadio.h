// LoraRadio.h — Shared SX1262 radio wrapper built on RadioLib.
//
// A single global instance is shared by the LoRa modules (chat, spectrum).
// Modules must call begin() before use and are responsible for putting the
// radio into the mode they need (receive vs. standby).
#pragma once
#include <Arduino.h>
#include <RadioLib.h>

namespace radio {

// Initialise the SX1262 with the parameters from config.h. Returns the
// RadioLib status code (RADIOLIB_ERR_NONE on success). Safe to call twice.
int16_t begin();

bool ready();

// Access the underlying RadioLib object for advanced operations
// (scanning RSSI, channel activity detection, etc.).
SX1262& dev();

// Convenience: transmit a text payload (blocking). Returns RadioLib status.
int16_t transmit(const uint8_t* data, size_t len);
int16_t transmitStr(const String& s);

// Put the radio into continuous receive with DIO1 interrupt.
int16_t startReceive();

// Set the ISR-driven "packet available" flag. Call from your DIO1 ISR.
void IRAM_ATTR onDio1();
bool packetReady();
void clearPacketFlag();

// Instantaneous RSSI of the current channel (dBm). Valid in RX mode.
float currentRssi();

}  // namespace radio
