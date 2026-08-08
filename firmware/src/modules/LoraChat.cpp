#include "modules/LoraChat.h"

#include "config.h"
#include "hal/LoraRadio.h"

static const char* kPresets[] = {"ping", "hello", "ack", "here", "sos"};
static const int kNumPresets = sizeof(kPresets) / sizeof(kPresets[0]);

void LoraChat::onEnter() {
  logCount_ = 0;
  preset_ = 0;
  lastTxStatus_ = 0;

  // Derive a short node id from the efuse MAC so units are distinguishable.
  uint64_t mac = ESP.getEfuseMac();
  nodeId_ = (uint32_t)(mac & 0xFFFF);

  if (radio::begin() == RADIOLIB_ERR_NONE) {
    radio::startReceive();
  }
}

void LoraChat::onExit() {
  // Leave the radio initialised; just drop back to standby-receive is fine.
  if (radio::ready()) radio::dev().standby();
}

void LoraChat::pushLog(const String& s) {
  if (logCount_ < kLogLines) {
    log_[logCount_++] = s;
  } else {
    for (int i = 1; i < kLogLines; i++) log_[i - 1] = log_[i];
    log_[kLogLines - 1] = s;
  }
}

void LoraChat::sendPreset() {
  if (!radio::ready()) return;
  sending_ = true;
  String frame = String("WISP|") + String(nodeId_, HEX) + "|" + kPresets[preset_];
  lastTxStatus_ = radio::transmitStr(frame);
  pushLog(String("TX> ") + kPresets[preset_]);
  radio::startReceive();  // back to listening after TX
  sending_ = false;
}

void LoraChat::update() {
  if (!radio::ready()) return;
  if (!radio::packetReady()) return;
  radio::clearPacketFlag();

  String data;
  int16_t st = radio::dev().readData(data);
  if (st == RADIOLIB_ERR_NONE) {
    float rssi = radio::dev().getRSSI();
    float snr = radio::dev().getSNR();
    // Strip our protocol prefix for display if present.
    String text = data;
    int p1 = data.indexOf('|');
    int p2 = data.indexOf('|', p1 + 1);
    String who = "?";
    if (p1 > 0 && p2 > p1) {
      who = data.substring(p1 + 1, p2);
      text = data.substring(p2 + 1);
    }
    char meta[24];
    snprintf(meta, sizeof(meta), " %d/%d", (int)rssi, (int)snr);
    pushLog(who + ": " + text + meta);
  }
  radio::startReceive();
}

void LoraChat::draw(Display& d, int top) {
  auto& u = d.u8g2();
  u.setFont(u8g2_font_5x8_tf);

  if (!radio::ready()) {
    d.text(0, top + 12, "Radio init failed");
    return;
  }

  d.textf(0, top + 8, "Node %04X  Send:[%s]", (unsigned)nodeId_,
          kPresets[preset_]);
  u.drawHLine(0, top + 10, Display::W);

  int y = top + 20;
  for (int i = 0; i < logCount_; i++) {
    // Truncate to panel width.
    char line[36];
    snprintf(line, sizeof(line), "%.34s", log_[i].c_str());
    u.drawStr(0, y, line);
    y += 9;
  }

  if (lastTxStatus_ != 0 && lastTxStatus_ != RADIOLIB_ERR_NONE) {
    d.textf(0, Display::H - 1, "TX err %d", lastTxStatus_);
  }
}

bool LoraChat::onInput(InputEvent e) {
  switch (e) {
    case InputEvent::Short:  // cycle the preset message
      preset_ = (preset_ + 1) % kNumPresets;
      return true;
    case InputEvent::Long:  // send it
      sendPreset();
      return true;
    default:
      return false;  // Double -> back
  }
}
