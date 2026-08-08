#include "hal/Board.h"
#include "board_pins.h"

namespace board {

void enableVext() {
  pinMode(PIN_VEXT, OUTPUT);
  digitalWrite(PIN_VEXT, LOW);  // active low
  delay(50);                    // let the rail settle before I2C init
}

void disableVext() {
  pinMode(PIN_VEXT, OUTPUT);
  digitalWrite(PIN_VEXT, HIGH);
}

void ledOn() {
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, HIGH);
}

void ledOff() {
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);
}

void ledToggle() {
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, !digitalRead(PIN_LED));
}

float readBatteryVolts() {
  // Cache the result: this is called from the status-bar draw path every
  // frame, but the raw read pulses a control pin and blocks ~10 ms. Refresh
  // only every few seconds so the UI stays responsive.
  static float cached = 0.0f;
  static uint32_t lastRead = 0;
  const uint32_t now = millis();
  if (lastRead != 0 && (now - lastRead) < 5000) return cached;
  lastRead = now;

  pinMode(PIN_VBAT_CTRL, OUTPUT);
  digitalWrite(PIN_VBAT_CTRL, LOW);  // enable the divider
  delay(10);

  // Average a few samples to smooth ADC noise. analogReadMilliVolts applies
  // the ESP32-S3 factory ADC calibration for us.
  uint32_t acc = 0;
  const int samples = 16;
  for (int i = 0; i < samples; i++) {
    acc += analogReadMilliVolts(PIN_VBAT_ADC);
  }
  digitalWrite(PIN_VBAT_CTRL, HIGH);  // stop draining the divider

  float dividedMv = acc / (float)samples;
  float volts = (dividedMv / 1000.0f) * VBAT_DIVIDER;

  if (volts < 2.0f || volts > 4.5f) volts = 0.0f;  // implausible / no cell
  cached = volts;
  return volts;
}

int batteryPercent(float volts) {
  if (volts <= 0.0f) return -1;  // unknown
  // Simple piecewise Li-ion curve; good enough for a status bar.
  static const float lut[][2] = {
      {4.20f, 100}, {4.10f, 90}, {4.00f, 80}, {3.90f, 70}, {3.80f, 60},
      {3.70f, 45},  {3.60f, 30}, {3.50f, 18}, {3.40f, 8},  {3.30f, 2},
      {3.00f, 0},
  };
  if (volts >= lut[0][0]) return 100;
  const int n = sizeof(lut) / sizeof(lut[0]);
  for (int i = 1; i < n; i++) {
    if (volts >= lut[i][0]) {
      float span = lut[i - 1][0] - lut[i][0];
      float frac = (volts - lut[i][0]) / span;
      return (int)(lut[i][1] + frac * (lut[i - 1][1] - lut[i][1]));
    }
  }
  return 0;
}

}  // namespace board
