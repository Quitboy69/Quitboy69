#include "modules/SystemInfo.h"

#include <Arduino.h>

#include "config.h"
#include "hal/Board.h"

void SystemInfo::draw(Display& d, int top) {
  auto& u = d.u8g2();
  u.setFont(u8g2_font_5x8_tf);

  float v = board::readBatteryVolts();
  int pct = board::batteryPercent(v);

  uint32_t up = millis() / 1000;
  uint32_t h = up / 3600, m = (up % 3600) / 60, s = up % 60;
  uint64_t mac = ESP.getEfuseMac();

  int y = top + 8;
  if (v > 0)
    d.textf(0, y, "Batt: %.2fV (%d%%)", v, pct);
  else
    d.text(0, y, "Batt: USB / n/a");
  y += 9;
  d.textf(0, y, "Heap: %u KB free", ESP.getFreeHeap() / 1024);
  y += 9;
  d.textf(0, y, "Uptime: %02u:%02u:%02u", h, m, s);
  y += 9;
  d.textf(0, y, "Chip: %s r%d", ESP.getChipModel(), ESP.getChipRevision());
  y += 9;
  d.textf(0, y, "MAC: %04X%08X", (uint16_t)(mac >> 32), (uint32_t)mac);
  y += 9;
  d.text(0, y, "FW " WISP_NAME " " WISP_VERSION);
}

bool SystemInfo::onInput(InputEvent e) {
  (void)e;
  return false;  // any gesture except Double is ignored; Double -> back
}
