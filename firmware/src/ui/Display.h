// Display.h — Thin wrapper around U8g2 for the onboard SSD1306.
#pragma once
#include <U8g2lib.h>

// Full-buffer HW-I2C driver for the 128x64 SSD1306. Custom pins are passed at
// begin() time via Wire.
using OledDriver = U8G2_SSD1306_128X64_NONAME_F_HW_I2C;

class Display {
 public:
  Display();
  void begin();

  OledDriver& u8g2() { return oled_; }

  static constexpr int W = 128;
  static constexpr int H = 64;
  static constexpr int STATUS_H = 12;  // top status bar height

  // Frame helpers.
  void clear();
  void send();  // push the buffer to the panel

  // Draw the top status bar (title left, battery right). Returns the y offset
  // below the bar where module content can start.
  int drawStatusBar(const char* title);

  // Convenience text helpers using the default font.
  void text(int x, int y, const char* s);
  void textf(int x, int y, const char* fmt, ...);

  // Centered single-line message (used for splash / empty states).
  void centered(const char* s);

 private:
  OledDriver oled_;
};
