#include "ui/Input.h"
#include "board_pins.h"
#include "config.h"

void Input::begin() {
  pinMode(PIN_BUTTON, INPUT_PULLUP);
}

bool Input::pressed() const {
  // Active low with pull-up.
  return digitalRead(PIN_BUTTON) == LOW;
}

InputEvent Input::poll() {
  const uint32_t now = millis();
  const bool down = pressed();

  // Edge: press down.
  if (down && !wasDown_) {
    wasDown_ = true;
    downAt_ = now;
    longFired_ = false;
  }

  // Held long enough -> fire LONG once, immediately.
  if (down && wasDown_ && !longFired_ &&
      (now - downAt_) >= UI_LONG_PRESS_MS) {
    longFired_ = true;
    pendingSingle_ = false;  // a long press cancels any pending single
    return InputEvent::Long;
  }

  // Edge: release.
  if (!down && wasDown_) {
    wasDown_ = false;
    if (longFired_) {
      // Long already reported on the way down; nothing to do on release.
      return InputEvent::None;
    }
    // A short tap. Decide single vs double using the gap to the previous tap.
    if (pendingSingle_ && (now - lastReleaseAt_) <= UI_DOUBLE_GAP_MS) {
      pendingSingle_ = false;
      lastReleaseAt_ = now;
      return InputEvent::Double;
    }
    pendingSingle_ = true;
    lastReleaseAt_ = now;
    return InputEvent::None;  // wait to see if a second tap arrives
  }

  // A pending single that never became a double -> emit it after the gap.
  if (pendingSingle_ && !down && (now - lastReleaseAt_) > UI_DOUBLE_GAP_MS) {
    pendingSingle_ = false;
    return InputEvent::Short;
  }

  return InputEvent::None;
}
