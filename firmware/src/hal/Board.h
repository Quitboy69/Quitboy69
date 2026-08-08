// Board.h — Onboard peripherals: power gate (Vext), LED, battery.
#pragma once
#include <Arduino.h>

namespace board {

// Enable/disable the Vext rail that powers the OLED. Call enableVext() early
// in setup(), before initialising the display.
void enableVext();
void disableVext();

void ledOn();
void ledOff();
void ledToggle();

// Returns the (approximate) battery voltage in volts. Reads the divided VBAT
// line while pulsing the ADC control pin low. Returns 0 if measurement looks
// implausible (e.g. USB powered with no cell attached on some units).
float readBatteryVolts();

// Rough state-of-charge estimate (0..100) for a single Li-ion cell.
int batteryPercent(float volts);

}  // namespace board
