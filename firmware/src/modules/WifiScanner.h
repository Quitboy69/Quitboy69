// WifiScanner.h — Passive Wi-Fi access-point survey.
//
// Uses the Arduino WiFi.scanNetworks() API. This is a passive listen: it
// reports APs that are already broadcasting beacons. It does not transmit,
// deauth, or associate.
#pragma once
#include <WiFi.h>

#include "core/Module.h"

class WifiScanner : public Module {
 public:
  const char* name() const override { return "WiFi Scan"; }
  void onEnter() override;
  void onExit() override;
  void update() override;
  void draw(Display& d, int contentTop) override;
  bool onInput(InputEvent e) override;

 private:
  void startScan();

  bool scanning_ = false;
  int count_ = 0;
  int cursor_ = 0;
  int top_ = 0;
  uint32_t startedAt_ = 0;
};
