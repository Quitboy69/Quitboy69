#include "hal/LoraRadio.h"

#include <SPI.h>

#include "board_pins.h"
#include "config.h"

namespace radio {

namespace {
// Dedicated SPI bus for the radio (VSPI-equivalent on the S3).
SPIClass loraSpi(HSPI);
SPISettings loraSpiSettings(2000000, MSBFIRST, SPI_MODE0);

Module mod(PIN_LORA_NSS, PIN_LORA_DIO1, PIN_LORA_RST, PIN_LORA_BUSY, loraSpi,
           loraSpiSettings);
SX1262 sx(&mod);

bool initialised = false;
volatile bool gotPacket = false;
}  // namespace

void IRAM_ATTR onDio1() { gotPacket = true; }

int16_t begin() {
  if (initialised) return RADIOLIB_ERR_NONE;

  loraSpi.begin(PIN_LORA_SCK, PIN_LORA_MISO, PIN_LORA_MOSI, PIN_LORA_NSS);

  int16_t st = sx.begin(LORA_FREQUENCY_MHZ, LORA_BANDWIDTH_KHZ,
                        LORA_SPREADING_FACTOR, LORA_CODING_RATE, LORA_SYNC_WORD,
                        LORA_TX_POWER_DBM, LORA_PREAMBLE_LEN);
  if (st != RADIOLIB_ERR_NONE) return st;

  sx.setDio1Action(onDio1);
  initialised = true;
  return RADIOLIB_ERR_NONE;
}

bool ready() { return initialised; }
SX1262& dev() { return sx; }

int16_t transmit(const uint8_t* data, size_t len) {
  return sx.transmit(const_cast<uint8_t*>(data), len);
}

int16_t transmitStr(const String& s) {
  // Use the const char* overload; RadioLib's transmit(String&) takes a
  // non-const reference, which a const argument can't bind to.
  return sx.transmit(s.c_str());
}

int16_t startReceive() { return sx.startReceive(); }

bool packetReady() { return gotPacket; }
void clearPacketFlag() { gotPacket = false; }

float currentRssi() { return sx.getRSSI(); }

}  // namespace radio
