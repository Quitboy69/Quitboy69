#include "ui/Display.h"

#include <Wire.h>
#include <stdarg.h>

#include "board_pins.h"
#include "config.h"
#include "hal/Board.h"

// U8g2 rotation R0, no reset via constructor (we toggle RST ourselves).
Display::Display()
    : oled_(U8G2_R0, /*reset=*/U8X8_PIN_NONE, PIN_OLED_SCL, PIN_OLED_SDA) {}

void Display::begin() {
  // The panel's reset line needs a pulse after Vext is up.
  pinMode(PIN_OLED_RST, OUTPUT);
  digitalWrite(PIN_OLED_RST, LOW);
  delay(20);
  digitalWrite(PIN_OLED_RST, HIGH);
  delay(20);

  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  oled_.setBusClock(400000);
  oled_.begin();
  oled_.setFontMode(1);
  oled_.setDrawColor(1);
  oled_.setFont(u8g2_font_6x10_tf);
}

void Display::clear() { oled_.clearBuffer(); }
void Display::send() { oled_.sendBuffer(); }

void Display::text(int x, int y, const char* s) {
  oled_.setFont(u8g2_font_6x10_tf);
  oled_.drawStr(x, y, s);
}

void Display::textf(int x, int y, const char* fmt, ...) {
  char buf[64];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(buf, sizeof(buf), fmt, ap);
  va_end(ap);
  text(x, y, buf);
}

void Display::centered(const char* s) {
  oled_.setFont(u8g2_font_7x13B_tf);
  int w = oled_.getStrWidth(s);
  oled_.drawStr((W - w) / 2, H / 2 + 4, s);
}

int Display::drawStatusBar(const char* title) {
  oled_.setFont(u8g2_font_6x10_tf);
  oled_.drawStr(2, 9, title);

  // Battery pill on the right.
  float v = board::readBatteryVolts();
  int pct = board::batteryPercent(v);
  const int bw = 20, bh = 8;
  const int bx = W - bw - 4, by = 2;
  oled_.drawFrame(bx, by, bw, bh);
  oled_.drawBox(bx + bw, by + 2, 2, bh - 4);  // battery nub
  if (pct >= 0) {
    int fill = (int)((bw - 2) * (pct / 100.0f));
    if (fill > 0) oled_.drawBox(bx + 1, by + 1, fill, bh - 2);
  } else {
    // Unknown / USB powered: draw a small "?".
    oled_.drawStr(bx + 6, by + bh - 1, "?");
  }

  oled_.drawHLine(0, STATUS_H, W);
  return STATUS_H + 2;
}
