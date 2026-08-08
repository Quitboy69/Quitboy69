// LoraChat.h — Minimal LoRa text messaging.
//
// Receives text frames continuously and logs them with RSSI/SNR. Because the
// board has a single button, outgoing messages are chosen from a small preset
// list rather than typed. Frames use a tiny plaintext protocol:
//   "WISP|<nodeid>|<text>"
// so multiple units can tell each other apart. This is a hobby/education
// messenger, not an authenticated or encrypted link.
#pragma once
#include <Arduino.h>

#include "core/Module.h"

class LoraChat : public Module {
 public:
  const char* name() const override { return "LoRa Chat"; }
  void onEnter() override;
  void onExit() override;
  void update() override;
  void draw(Display& d, int contentTop) override;
  bool onInput(InputEvent e) override;

 private:
  void pushLog(const String& s);
  void sendPreset();

  static constexpr int kLogLines = 4;
  String log_[kLogLines];
  int logCount_ = 0;
  int preset_ = 0;
  uint32_t nodeId_ = 0;
  int16_t lastTxStatus_ = 0;
  bool sending_ = false;
};
