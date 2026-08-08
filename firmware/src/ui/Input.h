// Input.h — Single-button input decoder.
//
// The V3 only has one usable user button (PRG). We derive three gestures:
//   - SHORT  : quick tap                -> "next / scroll"
//   - LONG   : hold >= UI_LONG_PRESS_MS -> "select / confirm"
//   - DOUBLE : two quick taps           -> "back / exit"
#pragma once
#include <Arduino.h>

enum class InputEvent { None, Short, Long, Double };

class Input {
 public:
  void begin();
  // Poll the button and return at most one decoded event per call.
  InputEvent poll();

 private:
  bool pressed() const;

  bool wasDown_ = false;
  uint32_t downAt_ = 0;
  bool longFired_ = false;
  uint32_t lastReleaseAt_ = 0;
  bool pendingSingle_ = false;
};
