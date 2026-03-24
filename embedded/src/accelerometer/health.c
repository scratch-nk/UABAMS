/*
 * health.c — per-peripheral health tracking for UABAMS Box 1
 *
 * All state is in static variables; no extern globals.
 * Getters return uint8_t-sized values — atomic on Cortex-M4.
 *
 * health_print_all() is safe to call from any context that can call
 * usart_debug() (i.e., after USART2_Init() and with interrupts enabled).
 */

#include "health.h"
#include "usart_debug.h"

/* ── Static storage ─────────────────────────────────────────────────────── */
static HealthStatus_t s_sensor[2]    = {HEALTH_UNKNOWN, HEALTH_UNKNOWN};
static uint8_t        s_sensor_id[2] = {0x00, 0x00};
static HealthStatus_t s_w5500        = HEALTH_UNKNOWN;
static uint8_t        s_w5500_ver    = 0x00;
static HealthStatus_t s_phy          = HEALTH_UNKNOWN;
static HealthStatus_t s_tcp          = HEALTH_UNKNOWN;

/* ── Setters ────────────────────────────────────────────────────────────── */
void health_set_sensor(uint8_t id, HealthStatus_t s, uint8_t raw_id)
{
    if (id == 1 || id == 2) {
        s_sensor[id - 1]    = s;
        s_sensor_id[id - 1] = raw_id;
    }
}

void health_set_w5500(HealthStatus_t s, uint8_t raw_ver)
{
    s_w5500     = s;
    s_w5500_ver = raw_ver;
}

void health_set_phy(HealthStatus_t s) { s_phy = s; }
void health_set_tcp(HealthStatus_t s) { s_tcp = s; }

/* ── Getters ────────────────────────────────────────────────────────────── */
HealthStatus_t health_get_sensor(uint8_t id)
{
    if (id == 1 || id == 2) return s_sensor[id - 1];
    return HEALTH_UNKNOWN;
}

HealthStatus_t health_get_w5500(void) { return s_w5500; }
HealthStatus_t health_get_phy  (void) { return s_phy;   }
HealthStatus_t health_get_tcp  (void) { return s_tcp;   }

/* ── Display ────────────────────────────────────────────────────────────── */
static const char *hs(HealthStatus_t s)
{
    switch (s) {
        case HEALTH_OK:   return "OK  ";
        case HEALTH_FAIL: return "FAIL";
        default:          return "SKIP";
    }
}

void health_print_all(void)
{
    usart_debug("[HEALTH] Peripheral Status\r\n");
    usart_debug("  USART2    : OK\r\n");
    usart_debug("  SPI1      : OK\r\n");

    for (uint8_t i = 1; i <= 2; i++) {
        HealthStatus_t st = s_sensor[i - 1];
        if (st == HEALTH_UNKNOWN) {
            usart_debug("  ADXL345 S%u: SKIP\r\n", i);
        } else {
            usart_debug("  ADXL345 S%u: %s (ID=0x%02X)\r\n",
                        i, hs(st), s_sensor_id[i - 1]);
        }
    }

    if (s_w5500 == HEALTH_UNKNOWN) {
        usart_debug("  W5500     : SKIP\r\n");
    } else {
        usart_debug("  W5500     : %s (ver=0x%02X)\r\n", hs(s_w5500), s_w5500_ver);
    }

    usart_debug("  PHY Link  : %s\r\n", hs(s_phy));

    if (s_tcp == HEALTH_UNKNOWN) {
        usart_debug("  TCP       : PENDING\r\n");
    } else {
        usart_debug("  TCP       : %s\r\n", hs(s_tcp));
    }

    usart_debug("========================================\r\n");
}
