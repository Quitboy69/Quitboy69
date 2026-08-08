// Module.h — Base interface every tool implements.
//
// A module is a self-contained screen: a scanner, a chat, an info page. The
// App owns the lifecycle. Gestures map to onInput(); Double is handled by the
// App as "back to menu" unless a module consumes it.
#pragma once
#include "ui/Display.h"
#include "ui/Input.h"

// Named AppModule (not Module) to avoid clashing with RadioLib's global
// `Module` class, which our LoRa tools also pull in.
class AppModule {
 public:
  virtual ~AppModule() = default;

  // Short label shown in the main menu.
  virtual const char* name() const = 0;

  // Called when the module becomes active / inactive.
  virtual void onEnter() {}
  virtual void onExit() {}

  // Called every loop iteration while active. Do non-blocking work here.
  virtual void update() {}

  // Render the current frame. The status bar is already drawn; content should
  // start at contentTop.
  virtual void draw(Display& d, int contentTop) = 0;

  // Handle an input gesture. Return true if the gesture was consumed. If a
  // module returns false for InputEvent::Double, the App exits to the menu.
  virtual bool onInput(InputEvent e) {
    (void)e;
    return false;
  }
};
