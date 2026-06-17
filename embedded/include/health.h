#ifndef HEALTH_H
#define HEALTH_H

#include <stdint.h>

/* ── Peripheral health status ───────────────────────────────────────────── */
typedef enum {
    HEALTH_UNKNOWN = 0,   /* not yet checked / skipped (shows as SKIP/PENDING) */
    HEALTH_OK,
    HEALTH_FAIL
} HealthStatus_t;

/* ── Setters ────────────────────────────────────────────────────────────── *
 * Called from main() during init and from HealthTask every 5 s.            *
 * raw_id / raw_ver are stored for display in health_print_all().           */
void health_set_sensor(uint8_t id, HealthStatus_t s, uint8_t raw_id);
void health_set_w5500 (HealthStatus_t s, uint8_t raw_ver);
void health_set_phy   (HealthStatus_t s);
void health_set_tcp   (HealthStatus_t s);

/* ── Getters ────────────────────────────────────────────────────────────── *
 * uint8_t reads are atomic on Cortex-M4 — no mutex needed for these.      */
HealthStatus_t health_get_sensor(uint8_t id);
HealthStatus_t health_get_w5500 (void);
HealthStatus_t health_get_phy   (void);
HealthStatus_t health_get_tcp   (void);

/* ── Display ────────────────────────────────────────────────────────────── *
 * Prints the current status of every peripheral via usart_debug().         *
 * Called at boot (after init checks) and by HealthTask when state changes. */
void health_print_all(void);

#endif /* HEALTH_H */
