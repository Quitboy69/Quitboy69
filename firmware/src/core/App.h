// App.h — Top-level controller: main menu + active module dispatch.
#pragma once
#include <vector>

#include "core/Module.h"
#include "ui/Display.h"
#include "ui/Input.h"

class App {
 public:
  App(Display& display, Input& input) : display_(display), input_(input) {}

  // Takes ownership of the module pointer.
  void add(Module* m) { modules_.push_back(m); }

  void begin();
  void loop();

 private:
  enum class State { Menu, Module };

  void handleMenuInput(InputEvent e);
  void drawMenu();
  void enterModule(int index);
  void exitModule();

  Display& display_;
  Input& input_;
  std::vector<Module*> modules_;

  State state_ = State::Menu;
  int menuIndex_ = 0;
  int menuTop_ = 0;  // first visible row for scrolling
  Module* active_ = nullptr;
  uint32_t lastFrame_ = 0;
};
