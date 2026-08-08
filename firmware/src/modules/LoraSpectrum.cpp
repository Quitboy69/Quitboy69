#include "modules/LoraSpectrum.h"

#include "config.h"
#include "hal/LoraRadio.h"

void LoraSpectrum::onEnter() {
  // Sweep +/- 1 MHz around the configured centre.
  const float spanMhz = 2.0f;
  startMhz_ = LORA_FREQUENCY_MHZ - spanMhz / 2.0f;
  stepMhz_ = spanMhz / kBins;
  bin_ = 0;
  running_ = true;
  for (int i = 0; i < kBins; i++) {
    rssi_[i] = -130.0f;
    peak_[i] = -130.0f;
  }
  if (radio::begin() == RADIOLIB_ERR_NONE) {
    radio::dev().startReceive();
  }
}

void LoraSpectrum::onExit() {
  if (radio::ready()) radio::dev().standby();
}

void LoraSpectrum::update() {
  if (!running_ || !radio::ready()) return;

  float f = startMhz_ + stepMhz_ * bin_;
  radio::dev().setFrequency(f);
  radio::dev().startReceive();
  delayMicroseconds(500);  // let the PLL settle and AGC sample

  float r = radio::dev().getRSSI();
  rssi_[bin_] = r;
  if (r > peak_[bin_]) peak_[bin_] = r;
  else peak_[bin_] -= 0.5f;  // slow decay

  bin_ = (bin_ + 1) % kBins;
}

void LoraSpectrum::draw(Display& d, int top) {
  auto& u = d.u8g2();
  u.setFont(u8g2_font_5x8_tf);

  d.textf(0, top + 8, "%.1f-%.1fMHz %s", startMhz_,
          startMhz_ + stepMhz_ * kBins, running_ ? "run" : "hold");

  // Map RSSI range [-130, -30] dBm to bar height.
  const int graphTop = top + 12;
  const int graphH = Display::H - graphTop - 1;
  const int barW = Display::W / kBins;

  auto toH = [&](float dbm) -> int {
    float norm = (dbm + 130.0f) / 100.0f;  // 0..1
    if (norm < 0) norm = 0;
    if (norm > 1) norm = 1;
    return (int)(norm * graphH);
  };

  for (int i = 0; i < kBins; i++) {
    int x = i * barW;
    int h = toH(rssi_[i]);
    int hp = toH(peak_[i]);
    if (h > 0) u.drawBox(x, Display::H - h, barW - 1, h);
    // peak-hold marker
    u.drawHLine(x, Display::H - hp, barW - 1);
  }
}

bool LoraSpectrum::onInput(InputEvent e) {
  switch (e) {
    case InputEvent::Short:  // reset peak hold
      for (int i = 0; i < kBins; i++) peak_[i] = -130.0f;
      return true;
    case InputEvent::Long:  // pause / resume sweep
      running_ = !running_;
      return true;
    default:
      return false;  // Double -> back
  }
}
