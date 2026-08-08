#include "modules/BleScanner.h"

// A compact record kept for each seen device, updated in place on repeat
// sightings so RSSI stays fresh and the list doesn't grow without bound.
namespace {
struct Seen {
  std::string addr;
  std::string name;
  int rssi;
};
std::vector<Seen> g_seen;
const size_t kMaxSeen = 40;

class ScanCB : public NimBLEAdvertisedDeviceCallbacks {
  void onResult(NimBLEAdvertisedDevice* dev) override {
    std::string addr = dev->getAddress().toString();
    std::string name = dev->haveName() ? dev->getName() : std::string("");
    int rssi = dev->getRSSI();
    for (auto& s : g_seen) {
      if (s.addr == addr) {
        s.rssi = rssi;
        if (!name.empty()) s.name = name;
        return;
      }
    }
    if (g_seen.size() < kMaxSeen) g_seen.push_back({addr, name, rssi});
  }
};
ScanCB g_cb;
}  // namespace

void BleScanner::onEnter() {
  g_seen.clear();
  cursor_ = 0;
  top_ = 0;

  NimBLEDevice::init("");
  scan_ = NimBLEDevice::getScan();
  scan_->setAdvertisedDeviceCallbacks(&g_cb, /*wantDuplicates=*/false);
  scan_->setActiveScan(true);   // request scan responses (names)
  scan_->setInterval(100);
  scan_->setWindow(90);
  scan_->start(0, nullptr, false);  // 0 = scan continuously
}

void BleScanner::onExit() {
  if (scan_) scan_->stop();
  NimBLEDevice::deinit(true);
  scan_ = nullptr;
}

void BleScanner::update() {
  // Scanning runs in the NimBLE task; nothing to poll here. Keep the cursor
  // valid as new devices appear.
  if (cursor_ >= (int)g_seen.size()) {
    cursor_ = g_seen.empty() ? 0 : (int)g_seen.size() - 1;
  }
}

void BleScanner::draw(Display& d, int top) {
  auto& u = d.u8g2();
  u.setFont(u8g2_font_5x8_tf);

  d.textf(0, top + 8, "Devices: %d", (int)g_seen.size());
  int listTop = top + 10;

  if (g_seen.empty()) {
    d.text(0, listTop + 10, "Listening...");
    return;
  }

  const int rowH = 9;
  const int visible = (Display::H - listTop) / rowH;
  if (cursor_ < top_) top_ = cursor_;
  if (cursor_ >= top_ + visible) top_ = cursor_ - visible + 1;

  for (int i = 0; i < visible && (top_ + i) < (int)g_seen.size(); i++) {
    int idx = top_ + i;
    const Seen& s = g_seen[idx];
    int y = listTop + rowH * (i + 1);
    const char* label = s.name.empty() ? s.addr.c_str() : s.name.c_str();
    char line[48];
    snprintf(line, sizeof(line), "%c%-17.17s %ddBm",
             idx == cursor_ ? '>' : ' ', label, s.rssi);
    u.drawStr(0, y, line);
  }
}

bool BleScanner::onInput(InputEvent e) {
  switch (e) {
    case InputEvent::Short:
      if (!g_seen.empty()) cursor_ = (cursor_ + 1) % g_seen.size();
      return true;
    case InputEvent::Long:
      g_seen.clear();  // clear the list, keep scanning
      cursor_ = top_ = 0;
      return true;
    default:
      return false;  // Double -> back
  }
}
