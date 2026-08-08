// WISP — Wireless Insight & Signal Platform
// Firmware entry point for the Heltec WiFi LoRa 32 V3.
//
// Boots the display, wires up the modules, and runs a cooperative loop.
// See README.md for the button gesture map and a description of each module.
#include <Arduino.h>

#include "config.h"
#include "core/App.h"
#include "hal/Board.h"
#include "ui/Display.h"
#include "ui/Input.h"

// Modules
#include "modules/BleScanner.h"
#include "modules/LoraChat.h"
#include "modules/LoraSpectrum.h"
#include "modules/SystemInfo.h"
#include "modules/WifiMonitor.h"
#include "modules/WifiScanner.h"

static Display g_display;
static Input g_input;
static App g_app(g_display, g_input);

static void splash() {
  auto& u = g_display.u8g2();
  g_display.clear();
  u.setFont(u8g2_font_7x13B_tf);
  const char* t = WISP_NAME;
  u.drawStr((Display::W - u.getStrWidth(t)) / 2, 28, t);
  u.setFont(u8g2_font_5x8_tf);
  const char* s = "Wireless Insight Platform";
  u.drawStr((Display::W - u.getStrWidth(s)) / 2, 42, s);
  u.drawStr((Display::W - u.getStrWidth(WISP_VERSION)) / 2, 56, WISP_VERSION);
  g_display.send();
}

void setup() {
  Serial.begin(115200);

  board::enableVext();   // power the OLED rail
  board::ledOff();
  g_display.begin();
  g_input.begin();

  splash();
  delay(1200);

  // Registration order == menu order.
  g_app.add(new WifiScanner());
  g_app.add(new WifiMonitor());
  g_app.add(new BleScanner());
  g_app.add(new LoraChat());
  g_app.add(new LoraSpectrum());
  g_app.add(new SystemInfo());

  g_app.begin();

  Serial.println(WISP_NAME " " WISP_VERSION " ready");
}

void loop() {
  g_app.loop();
}
