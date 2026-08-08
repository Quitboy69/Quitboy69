// WifiMonitor.h — Passive 802.11 traffic monitor.
//
// Puts the radio into promiscuous (monitor) mode and counts management/
// control/data frames while hopping channels. This is receive-only: it never
// injects frames. Useful for gauging channel activity and airtime during an
// authorised site survey.
#pragma once
#include "core/Module.h"

class WifiMonitor : public Module {
 public:
  const char* name() const override { return "WiFi Monitor"; }
  void onEnter() override;
  void onExit() override;
  void update() override;
  void draw(Display& d, int contentTop) override;
  bool onInput(InputEvent e) override;

 private:
  bool paused_ = false;
  bool locked_ = false;   // if true, stay on the current channel
  int channel_ = 1;
  uint32_t lastHop_ = 0;
  uint32_t startedAt_ = 0;
};
