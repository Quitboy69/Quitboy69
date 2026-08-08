#include "core/App.h"

#include "config.h"

void App::begin() {
  state_ = State::Menu;
  menuIndex_ = 0;
  menuTop_ = 0;
}

void App::loop() {
  // Decode input first so module logic reacts the same frame.
  InputEvent e = input_.poll();

  if (state_ == State::Menu) {
    if (e != InputEvent::None) handleMenuInput(e);
  } else if (active_) {
    if (e != InputEvent::None) {
      bool consumed = active_->onInput(e);
      if (!consumed && e == InputEvent::Double) {
        exitModule();
      }
    }
    if (state_ == State::Module && active_) active_->update();
  }

  // Frame-rate limited redraw.
  uint32_t now = millis();
  if (now - lastFrame_ < UI_FRAME_INTERVAL_MS) return;
  lastFrame_ = now;

  display_.clear();
  if (state_ == State::Menu) {
    drawMenu();
  } else if (active_) {
    int top = display_.drawStatusBar(active_->name());
    active_->draw(display_, top);
  }
  display_.send();
}

void App::handleMenuInput(InputEvent e) {
  const int n = (int)modules_.size();
  if (n == 0) return;
  switch (e) {
    case InputEvent::Short:  // next
      menuIndex_ = (menuIndex_ + 1) % n;
      break;
    case InputEvent::Double:  // previous (wrap)
      menuIndex_ = (menuIndex_ - 1 + n) % n;
      break;
    case InputEvent::Long:  // select
      enterModule(menuIndex_);
      break;
    default:
      break;
  }
}

void App::drawMenu() {
  int top = display_.drawStatusBar(WISP_NAME " " WISP_VERSION);
  auto& u = display_.u8g2();
  u.setFont(u8g2_font_6x10_tf);

  const int rowH = 12;
  const int visible = (Display::H - top) / rowH;
  const int n = (int)modules_.size();

  // Keep the cursor within the visible window.
  if (menuIndex_ < menuTop_) menuTop_ = menuIndex_;
  if (menuIndex_ >= menuTop_ + visible) menuTop_ = menuIndex_ - visible + 1;

  for (int i = 0; i < visible && (menuTop_ + i) < n; i++) {
    int idx = menuTop_ + i;
    int y = top + rowH * (i + 1) - 3;
    if (idx == menuIndex_) {
      u.drawBox(0, top + rowH * i, Display::W, rowH);
      u.setDrawColor(0);
      u.drawStr(4, y, modules_[idx]->name());
      u.setDrawColor(1);
    } else {
      u.drawStr(4, y, modules_[idx]->name());
    }
  }
}

void App::enterModule(int index) {
  active_ = modules_[index];
  state_ = State::Module;
  active_->onEnter();
}

void App::exitModule() {
  if (active_) active_->onExit();
  active_ = nullptr;
  state_ = State::Menu;
}
