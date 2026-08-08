#include "modules/WifiScanner.h"

static const char* encName(wifi_auth_mode_t m) {
  switch (m) {
    case WIFI_AUTH_OPEN: return "OPEN";
    case WIFI_AUTH_WEP: return "WEP";
    case WIFI_AUTH_WPA_PSK: return "WPA";
    case WIFI_AUTH_WPA2_PSK: return "WPA2";
    case WIFI_AUTH_WPA_WPA2_PSK: return "WPA/2";
    case WIFI_AUTH_WPA3_PSK: return "WPA3";
    case WIFI_AUTH_WPA2_WPA3_PSK: return "WPA2/3";
    default: return "?";
  }
}

void WifiScanner::startScan() {
  WiFi.scanDelete();
  WiFi.scanNetworks(/*async=*/true, /*show_hidden=*/true);
  scanning_ = true;
  startedAt_ = millis();
}

void WifiScanner::onEnter() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  count_ = 0;
  cursor_ = 0;
  top_ = 0;
  startScan();
}

void WifiScanner::onExit() {
  WiFi.scanDelete();
  WiFi.mode(WIFI_OFF);
}

void WifiScanner::update() {
  if (!scanning_) return;
  int n = WiFi.scanComplete();
  if (n >= 0) {
    count_ = n;
    scanning_ = false;
    if (cursor_ >= count_) cursor_ = count_ ? count_ - 1 : 0;
  }
}

void WifiScanner::draw(Display& d, int top) {
  auto& u = d.u8g2();
  u.setFont(u8g2_font_5x8_tf);

  if (scanning_) {
    d.textf(4, top + 12, "Scanning... %us",
            (millis() - startedAt_) / 1000);
    return;
  }
  if (count_ == 0) {
    d.text(4, top + 12, "No networks. Long=rescan");
    return;
  }

  const int rowH = 9;
  const int visible = (Display::H - top) / rowH;
  if (cursor_ < top_) top_ = cursor_;
  if (cursor_ >= top_ + visible) top_ = cursor_ - visible + 1;

  for (int i = 0; i < visible && (top_ + i) < count_; i++) {
    int idx = top_ + i;
    int y = top + rowH * (i + 1);
    char line[40];
    String ssid = WiFi.SSID(idx);
    if (ssid.length() == 0) ssid = "<hidden>";
    snprintf(line, sizeof(line), "%c%.14s c%d %ddBm %s",
             idx == cursor_ ? '>' : ' ', ssid.c_str(), WiFi.channel(idx),
             WiFi.RSSI(idx), encName(WiFi.encryptionType(idx)));
    u.drawStr(0, y, line);
  }
}

bool WifiScanner::onInput(InputEvent e) {
  if (scanning_) return e != InputEvent::Double;  // block back only if busy? no
  switch (e) {
    case InputEvent::Short:
      if (count_ > 0) cursor_ = (cursor_ + 1) % count_;
      return true;
    case InputEvent::Long:
      startScan();
      return true;
    default:
      return false;  // Double -> back to menu
  }
}
