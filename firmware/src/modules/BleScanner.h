// BleScanner.h — Passive Bluetooth LE device survey.
//
// Runs a continuous BLE scan and lists advertising devices (name, address,
// RSSI). Receive-only: it does not connect, pair, or advertise.
#pragma once
#include <NimBLEDevice.h>

#include <vector>

#include "core/Module.h"

class BleScanner : public Module {
 public:
  const char* name() const override { return "BLE Scan"; }
  void onEnter() override;
  void onExit() override;
  void update() override;
  void draw(Display& d, int contentTop) override;
  bool onInput(InputEvent e) override;

 private:
  NimBLEScan* scan_ = nullptr;
  int cursor_ = 0;
  int top_ = 0;
};
