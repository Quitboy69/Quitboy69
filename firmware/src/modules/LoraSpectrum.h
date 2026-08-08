// LoraSpectrum.h — Sub-GHz RSSI sweep / activity scanner.
//
// Steps the SX1262 across a small band around the configured centre frequency
// and samples RSSI at each step, drawing a live bar graph. Useful for spotting
// which channels are busy before choosing a LoRa frequency. Receive-only.
#pragma once
#include "core/Module.h"

class LoraSpectrum : public AppModule {
 public:
  const char* name() const override { return "LoRa Spectrum"; }
  void onEnter() override;
  void onExit() override;
  void update() override;
  void draw(Display& d, int contentTop) override;
  bool onInput(InputEvent e) override;

 private:
  static constexpr int kBins = 32;
  float rssi_[kBins];   // most recent sample per bin (dBm)
  float peak_[kBins];   // slow-decaying peak hold
  int bin_ = 0;
  float startMhz_ = 0;
  float stepMhz_ = 0;
  bool running_ = true;
};
