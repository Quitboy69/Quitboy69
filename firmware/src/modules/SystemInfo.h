// SystemInfo.h — Device status: battery, heap, uptime, chip, MAC.
#pragma once
#include "core/Module.h"

class SystemInfo : public AppModule {
 public:
  const char* name() const override { return "System Info"; }
  void draw(Display& d, int contentTop) override;
  bool onInput(InputEvent e) override;
};
