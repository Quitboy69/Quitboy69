#include "modules/WifiMonitor.h"

#include <WiFi.h>
#include <esp_wifi.h>

#include "config.h"

// Counters are updated from the promiscuous callback (runs in Wi-Fi task
// context), read from the UI. They are simple monotonic counters so a plain
// volatile read is fine for a status display.
namespace {
volatile uint32_t cntMgmt = 0;
volatile uint32_t cntCtrl = 0;
volatile uint32_t cntData = 0;
volatile uint32_t cntBeacon = 0;
volatile uint32_t cntProbeReq = 0;
volatile int32_t lastRssi = 0;

void IRAM_ATTR sniffer(void* buf, wifi_promiscuous_pkt_type_t type) {
  auto* pkt = (wifi_promiscuous_pkt_t*)buf;
  lastRssi = pkt->rx_ctrl.rssi;

  switch (type) {
    case WIFI_PKT_MGMT: {
      cntMgmt++;
      // Frame control subtype lives in the first payload byte.
      uint8_t fc = pkt->payload[0];
      uint8_t subtype = (fc & 0xF0) >> 4;
      if (subtype == 0x8) cntBeacon++;      // beacon
      else if (subtype == 0x4) cntProbeReq++;  // probe request
      break;
    }
    case WIFI_PKT_CTRL: cntCtrl++; break;
    case WIFI_PKT_DATA: cntData++; break;
    default: break;
  }
}
}  // namespace

void WifiMonitor::onEnter() {
  cntMgmt = cntCtrl = cntData = cntBeacon = cntProbeReq = 0;
  lastRssi = 0;
  channel_ = WIFI_CHANNEL_MIN;
  paused_ = false;
  locked_ = false;
  startedAt_ = millis();
  lastHop_ = millis();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_promiscuous(true);
  esp_wifi_set_promiscuous_rx_cb(&sniffer);
  esp_wifi_set_channel(channel_, WIFI_SECOND_CHAN_NONE);
}

void WifiMonitor::onExit() {
  esp_wifi_set_promiscuous(false);
  WiFi.mode(WIFI_OFF);
}

void WifiMonitor::update() {
  if (paused_ || locked_) return;
  uint32_t now = millis();
  if (now - lastHop_ >= WIFI_HOP_INTERVAL_MS) {
    lastHop_ = now;
    channel_++;
    if (channel_ > WIFI_CHANNEL_MAX) channel_ = WIFI_CHANNEL_MIN;
    esp_wifi_set_channel(channel_, WIFI_SECOND_CHAN_NONE);
  }
}

void WifiMonitor::draw(Display& d, int top) {
  auto& u = d.u8g2();
  u.setFont(u8g2_font_6x10_tf);
  uint32_t secs = (millis() - startedAt_) / 1000;

  d.textf(2, top + 10, "Ch %2d %s  %lus", channel_,
          locked_ ? "LOCK" : (paused_ ? "PAUSE" : "hop"), secs);
  d.textf(2, top + 22, "Beacon %lu  Probe %lu", (uint32_t)cntBeacon,
          (uint32_t)cntProbeReq);
  d.textf(2, top + 34, "Mgmt %lu  Ctrl %lu", (uint32_t)cntMgmt,
          (uint32_t)cntCtrl);
  d.textf(2, top + 46, "Data %lu  RSSI %ld", (uint32_t)cntData,
          (long)lastRssi);
}

bool WifiMonitor::onInput(InputEvent e) {
  switch (e) {
    case InputEvent::Short:  // toggle channel lock on current channel
      locked_ = !locked_;
      return true;
    case InputEvent::Long:  // pause / resume counting-view hop
      paused_ = !paused_;
      return true;
    default:
      return false;  // Double -> back
  }
}
