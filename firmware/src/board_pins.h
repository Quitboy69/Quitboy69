// board_pins.h — Hardware pin map for the Heltec WiFi LoRa 32 V3.
//
// Reference: Heltec WiFi LoRa 32 (V3) schematic. MCU is an ESP32-S3FN8
// (dual-core LX7, WiFi + BLE 5). Radio is a Semtech SX1262 on SPI.
// Display is an SSD1306 128x64 on I2C. These pins are specific to the V3
// revision and differ from V2 — do not reuse a V2 pin map here.
#pragma once

// ---- OLED (SSD1306, I2C) ----
#define PIN_OLED_SDA 17
#define PIN_OLED_SCL 18
#define PIN_OLED_RST 21

// ---- Power / peripherals ----
// Vext gates power to the OLED and other onboard peripherals. Active LOW.
#define PIN_VEXT 36
// User LED (white).
#define PIN_LED 35
// PRG / user button. Active LOW, has an external pull-up. Also GPIO0 (boot).
#define PIN_BUTTON 0

// ---- Battery measurement ----
// ADC_Ctrl must be driven LOW to enable the battery voltage divider,
// then the divided voltage is read on VBAT_ADC.
#define PIN_VBAT_ADC 1
#define PIN_VBAT_CTRL 37
// Resistor divider ratio on the V3 (390k + 100k). Tune per unit if needed.
#define VBAT_DIVIDER 4.9f

// ---- LoRa radio (SX1262, SPI) ----
#define PIN_LORA_NSS 8
#define PIN_LORA_SCK 9
#define PIN_LORA_MOSI 10
#define PIN_LORA_MISO 11
#define PIN_LORA_RST 12
#define PIN_LORA_BUSY 13
#define PIN_LORA_DIO1 14
