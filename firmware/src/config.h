// config.h — Compile-time configuration for WISP.
#pragma once

#ifndef WISP_VERSION
#define WISP_VERSION "0.0.0-dev"
#endif

#define WISP_NAME "WISP"

// ---- LoRa regional settings -------------------------------------------------
// IMPORTANT: LoRa is a licensed/ISM band radio. You are responsible for
// choosing a frequency, bandwidth, and duty cycle that are legal where you
// operate. The defaults below target the EU 868 MHz ISM band. For US set
// 915.0, for AS 923.0, etc. Transmitting outside your permitted band/power
// can be illegal.
#define LORA_FREQUENCY_MHZ 868.0f
#define LORA_BANDWIDTH_KHZ 125.0f
#define LORA_SPREADING_FACTOR 9
#define LORA_CODING_RATE 7          // 4/7
#define LORA_SYNC_WORD 0x2B         // private network sync word
#define LORA_TX_POWER_DBM 14        // keep within regional EIRP limits
#define LORA_PREAMBLE_LEN 8

// ---- UI ---------------------------------------------------------------------
#define UI_LONG_PRESS_MS 600        // hold time that counts as a "select"
#define UI_DOUBLE_GAP_MS 350        // max gap between taps for a double-press
#define UI_FRAME_INTERVAL_MS 40     // ~25 fps redraw cap

// ---- WiFi monitor -----------------------------------------------------------
#define WIFI_CHANNEL_MIN 1
#define WIFI_CHANNEL_MAX 13         // set 11 for US regulatory domain
#define WIFI_HOP_INTERVAL_MS 250
