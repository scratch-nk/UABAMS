/*
 * accelerometer/main.c — UABAMS Box 1, FreeRTOS v10.6.2
 *
 * Two-task architecture replacing the bare-metal blocking loop:
 *
 *   AccelTask   (priority 4, 1024 words)
 *     Samples both ADXL345 sensors at 200 Hz for 500 ms (100 samples).
 *     Computes RMS, SD, peak per window. Pushes WindowStats_t to xAccelQueue.
 *     Uses vTaskDelayUntil() for timing — CPU free during each 5 ms gap.
 *
 *   NetworkTask (priority 3, 512 words)
 *     Waits on xAccelQueue. Takes xSPI2Mutex, formats TCP packets (identical
 *     format to original firmware), sends via W5500_Send(), releases mutex.
 *
 * SysTick_Handler is a combined handler: increments ms_ticks (for delay_ms
 * compatibility) AND drives the FreeRTOS tick via xPortSysTickHandler().
 *
 * init sequence:
 *   SystemClock_Config() → PLL 96 MHz (must be first)
 *   USART2_Init(), spi1_init(), SPI2_Init()
 *   SysTick_Config() → 1ms tick (FreeRTOS reconfigures same rate)
 *   W5500 reset + network config
 *   adxl345_init() x2
 *   xQueueCreate, xSemaphoreCreateMutex
 *   xTaskCreate x2 → vTaskStartScheduler
 */

#include "FreeRTOS.h"
#include "task.h"
#include "queue.h"
#include "semphr.h"

#include "stm32f4xx.h"
#include "spi.h"
#include "spi_eth.h"
#include "adxl345.h"
#include "w5500.h"
#include "usart_debug.h"
#include "clock_config.h"
#include "delay.h"

#include <stdio.h>
#include <math.h>
#include <string.h>

/* ── Sampling config ────────────────────────────────────────────────────── */
#define FS_HZ        200
#define WINDOW_MS    500
#define SAMPLE_COUNT (FS_HZ * WINDOW_MS / 1000)   /* 100 samples */
#define EVENT_TH     2.0f                          /* g — vibration alert */

/* ── Network config ─────────────────────────────────────────────────────── */
static uint8_t mac[]       = {0x00, 0x08, 0xDC, 0x11, 0x22, 0x10};
static uint8_t ip[]        = {192, 168, 1, 10};
static uint8_t sn[]        = {255, 255, 255, 0};
static uint8_t gw[]        = {0, 0, 0, 0};
static uint8_t server_ip[] = {192, 168, 1, 100};

/* ── WindowStats_t — data passed from AccelTask to NetworkTask ──────────── */
typedef struct {
    /* Sensor 1 (left axle box) */
    float s1_rms_v, s1_rms_l;
    float s1_sd_v,  s1_sd_l;
    float s1_peak;
    float s1_last_x, s1_last_y, s1_last_z;

    /* Sensor 2 (right axle box) */
    float s2_rms_v, s2_rms_l;
    float s2_sd_v,  s2_sd_l;
    float s2_peak;
    float s2_last_x, s2_last_y, s2_last_z;
} WindowStats_t;

/* ── RTOS handles ───────────────────────────────────────────────────────── */
static QueueHandle_t     xAccelQueue;   /* WindowStats_t, depth 4           */
static SemaphoreHandle_t xSPI2Mutex;    /* guards W5500 SPI2 bus            */

/* ── Helpers ────────────────────────────────────────────────────────────── */
static const char *vib_level(float peak)
{
    if (peak >= 16.0f) return "16G";
    if (peak >= 8.0f)  return "8G";
    if (peak >= 4.0f)  return "4G";
    if (peak >= 2.0f)  return "2G";
    return "NORMAL";
}

static void UBMS_Send_TCP(char *data)
{
    W5500_Send(0, (uint8_t *)data, strlen(data));
}

/* ── SysTick — combined handler ─────────────────────────────────────────── *
 * delay.c compiled with -DUSE_FREERTOS_SYSTICK suppresses its own handler. *
 * ms_ticks keeps delay_ms() working during pre-scheduler init.             */
extern void xPortSysTickHandler(void);
extern volatile uint32_t ms_ticks;

void SysTick_Handler(void)
{
    ms_ticks++;
    xPortSysTickHandler();
}

/* ── AccelTask ──────────────────────────────────────────────────────────── */
static void vAccelTask(void *pvParam)
{
    (void)pvParam;

    /* Stack-allocated sample buffers — 4 × 100 × 4 B = 1600 B on task stack */
    float s1_x[SAMPLE_COUNT], s1_z[SAMPLE_COUNT];
    float s2_x[SAMPLE_COUNT], s2_z[SAMPLE_COUNT];

    TickType_t xLastSampleTime = xTaskGetTickCount();

    for (;;) {
        WindowStats_t stats = {0};

        float sum_x1 = 0, sum_z1 = 0, sumsq_x1 = 0, sumsq_z1 = 0;
        float sum_x2 = 0, sum_z2 = 0, sumsq_x2 = 0, sumsq_z2 = 0;

        /* ── 100 samples at 200 Hz (5 ms per sample) ── */
        for (int i = 0; i < SAMPLE_COUNT; i++) {
            float x1, y1, z1, x2, y2, z2;

            adxl345_read_xyz_spi(1, &x1, &y1, &z1);
            adxl345_read_xyz_spi(2, &x2, &y2, &z2);

            s1_x[i] = x1;  s1_z[i] = z1;
            s2_x[i] = x2;  s2_z[i] = z2;

            float mag1 = sqrtf(x1*x1 + y1*y1 + z1*z1);
            float mag2 = sqrtf(x2*x2 + y2*y2 + z2*z2);
            if (mag1 > stats.s1_peak) stats.s1_peak = mag1;
            if (mag2 > stats.s2_peak) stats.s2_peak = mag2;

            sum_x1 += x1;  sum_z1 += z1;
            sum_x2 += x2;  sum_z2 += z2;
            sumsq_x1 += x1*x1;  sumsq_z1 += z1*z1;
            sumsq_x2 += x2*x2;  sumsq_z2 += z2*z2;

            /* save last sample for reporting */
            if (i == SAMPLE_COUNT - 1) {
                stats.s1_last_x = x1;  stats.s1_last_y = y1;  stats.s1_last_z = z1;
                stats.s2_last_x = x2;  stats.s2_last_y = y2;  stats.s2_last_z = z2;
            }

            /* yield until next 5 ms slot — CPU free while waiting */
            vTaskDelayUntil(&xLastSampleTime, pdMS_TO_TICKS(1000 / FS_HZ));
        }

        /* ── RMS ── */
        stats.s1_rms_v = sqrtf(sumsq_z1 / SAMPLE_COUNT);
        stats.s1_rms_l = sqrtf(sumsq_x1 / SAMPLE_COUNT);
        stats.s2_rms_v = sqrtf(sumsq_z2 / SAMPLE_COUNT);
        stats.s2_rms_l = sqrtf(sumsq_x2 / SAMPLE_COUNT);

        /* ── SD ── */
        float mean_x1 = sum_x1 / SAMPLE_COUNT,  mean_z1 = sum_z1 / SAMPLE_COUNT;
        float mean_x2 = sum_x2 / SAMPLE_COUNT,  mean_z2 = sum_z2 / SAMPLE_COUNT;
        float sd_x1 = 0, sd_z1 = 0, sd_x2 = 0, sd_z2 = 0;

        for (int i = 0; i < SAMPLE_COUNT; i++) {
            sd_z1 += (s1_z[i] - mean_z1) * (s1_z[i] - mean_z1);
            sd_x1 += (s1_x[i] - mean_x1) * (s1_x[i] - mean_x1);
            sd_z2 += (s2_z[i] - mean_z2) * (s2_z[i] - mean_z2);
            sd_x2 += (s2_x[i] - mean_x2) * (s2_x[i] - mean_x2);
        }
        stats.s1_sd_v = sqrtf(sd_z1 / SAMPLE_COUNT);
        stats.s1_sd_l = sqrtf(sd_x1 / SAMPLE_COUNT);
        stats.s2_sd_v = sqrtf(sd_z2 / SAMPLE_COUNT);
        stats.s2_sd_l = sqrtf(sd_x2 / SAMPLE_COUNT);

        /* push to NetworkTask — drop if queue full (NetworkTask is behind) */
        xQueueSend(xAccelQueue, &stats, 0);
    }
}

/* ── NetworkTask ────────────────────────────────────────────────────────── */
static void vNetworkTask(void *pvParam)
{
    (void)pvParam;
    WindowStats_t stats;
    char tcp_buf[512];

    for (;;) {
        /* block until AccelTask pushes a completed window */
        xQueueReceive(xAccelQueue, &stats, portMAX_DELAY);

        xSemaphoreTake(xSPI2Mutex, portMAX_DELAY);

        /* ── USART continuous report header ── */
        usart_debug("\r\n----- UBMS CONTINUOUS DATA -----\r\n");
        usart_debug("COACH_ID : C1\r\nBOGIE_ID : B1\r\n");

        /* ── S1 stats packet ── */
        snprintf(tcp_buf, sizeof(tcp_buf),
            "\r\n[AXLE BOX LEFT - S1]\r\n"
            "Ax : %.3f g  Ay : %.3f g  Az : %.3f g\r\n"
            "RMS-V : %.3f g\r\n"
            "RMS-L : %.3f g\r\n"
            "SD-V  : %.3f g\r\n"
            "SD-L  : %.3f g\r\n"
            "P2P-V : %.3f g\r\n"
            "P2P-L : %.3f g\r\n"
            "PEAK  : %.3f g\r\n",
            stats.s1_last_x, stats.s1_last_y, stats.s1_last_z,
            stats.s1_rms_v,  stats.s1_rms_l,
            stats.s1_sd_v,   stats.s1_sd_l,
            2.0f * stats.s1_sd_v, 2.0f * stats.s1_sd_l,
            stats.s1_peak);
        usart_debug(tcp_buf);
        UBMS_Send_TCP(tcp_buf);

        /* S1 raw xyz (front-end format) */
        snprintf(tcp_buf, sizeof(tcp_buf),
            "X=%.3f Y=%.3f Z=%.3f\r\n",
            stats.s1_last_x, stats.s1_last_y, stats.s1_last_z);
        usart_debug(tcp_buf);
        UBMS_Send_TCP(tcp_buf);

        /* ── S2 stats packet ── */
        snprintf(tcp_buf, sizeof(tcp_buf),
            "\r\n[AXLE BOX RIGHT - S2]\r\n"
            "Ax : %.3f g  Ay : %.3f g  Az : %.3f g\r\n"
            "RMS-V : %.3f g\r\n"
            "RMS-L : %.3f g\r\n"
            "SD-V  : %.3f g\r\n"
            "SD-L  : %.3f g\r\n"
            "P2P-V : %.3f g\r\n"
            "P2P-L : %.3f g\r\n"
            "PEAK  : %.3f g\r\n",
            stats.s2_last_x, stats.s2_last_y, stats.s2_last_z,
            stats.s2_rms_v,  stats.s2_rms_l,
            stats.s2_sd_v,   stats.s2_sd_l,
            2.0f * stats.s2_sd_v, 2.0f * stats.s2_sd_l,
            stats.s2_peak);
        usart_debug(tcp_buf);
        UBMS_Send_TCP(tcp_buf);

        /* S2 raw xyz */
        snprintf(tcp_buf, sizeof(tcp_buf),
            "X=%.3f Y=%.3f Z=%.3f\r\n",
            stats.s2_last_x, stats.s2_last_y, stats.s2_last_z);
        usart_debug(tcp_buf);
        UBMS_Send_TCP(tcp_buf);

        /* ── FS / window line ── */
        snprintf(tcp_buf, sizeof(tcp_buf),
            "\r\nFS     : %d Hz\r\nWINDOW : %d ms\r\n",
            FS_HZ, WINDOW_MS);
        usart_debug(tcp_buf);
        UBMS_Send_TCP(tcp_buf);

        /* ── Event alert ── */
        if (stats.s1_peak >= EVENT_TH || stats.s2_peak >= EVENT_TH) {
            snprintf(tcp_buf, sizeof(tcp_buf),
                "\r\n*** EVENT: VIBRATION ALERT ***\r\n"
                "S1 PEAK : %.2f g (%s)\r\n"
                "S2 PEAK : %.2f g (%s)\r\n",
                stats.s1_peak, vib_level(stats.s1_peak),
                stats.s2_peak, vib_level(stats.s2_peak));
            usart_debug(tcp_buf);
            UBMS_Send_TCP(tcp_buf);
        }

        usart_debug("UBMS PACKET SENT\r\n");

        xSemaphoreGive(xSPI2Mutex);
    }
}

/* ── FreeRTOS hooks ─────────────────────────────────────────────────────── */
void vApplicationMallocFailedHook(void)
{
    usart_debug("FATAL: FreeRTOS heap exhausted\r\n");
    for (;;);
}

void vApplicationStackOverflowHook(TaskHandle_t xTask, char *pcTaskName)
{
    (void)xTask;
    usart_debug("FATAL: stack overflow in task: ");
    usart_debug(pcTaskName);
    usart_debug("\r\n");
    for (;;);
}

/* ── main ───────────────────────────────────────────────────────────────── */
int main(void)
{
    /* PLL → 96 MHz. Must be first — all peripheral baud/timing depends on it */
    SystemClock_Config();

    USART2_Init();
    spi1_init();   /* ADXL345 x2 on SPI1 */
    SPI2_Init();   /* W5500 on SPI2       */

    /* 1 ms SysTick — FreeRTOS reconfigures to same rate, combined handler above */
    SysTick_Config(SystemCoreClock / 1000);

    usart_debug("\r\nUABAMS BOX 1 — FreeRTOS v10.6.2\r\n");
    usart_debug("========================================\r\n");
    usart_debug("UBMS AXLE BOX MONITORING SYSTEM\r\n");
    usart_debug("LEFT (S1) & RIGHT (S2)\r\n");
    usart_debug("========================================\r\n");

    /* W5500 reset + network config */
    W5500_RST_LOW();  delay_ms(50);
    W5500_RST_HIGH(); delay_ms(300);

    W5500_SetNetwork(mac, ip, sn, gw);
    delay_ms(1000);

    usart_debug("CONNECT REQUEST SENT\r\n");
    W5500_TCP_Client_Connect(0, server_ip, 5000);
    W5500_GetSocketStatus(0);
    usart_debug("TCP CONNECTED\r\n");

    adxl345_init(1);
    adxl345_init(2);
    usart_debug("ADXL345 x2 init done\r\n");

    /* Queue depth 4: AccelTask produces one every ~500 ms;
     * NetworkTask consumes one at a time. Depth 4 handles brief TCP stalls. */
    xAccelQueue = xQueueCreate(4, sizeof(WindowStats_t));
    xSPI2Mutex  = xSemaphoreCreateMutex();

    /* AccelTask: priority 4 (highest) — must not be preempted during sampling.
     * Stack 1024 words = 4096 B — covers 4×float[100] = 1600 B + FPU context. */
    xTaskCreate(vAccelTask,   "Accel", 1024, NULL, 4, NULL);

    /* NetworkTask: priority 3 — runs when AccelTask is delaying between samples.
     * Stack 512 words = 2048 B — covers snprintf(512 B) + W5500 call frames.  */
    xTaskCreate(vNetworkTask, "Net",    512, NULL, 3, NULL);

    usart_debug("Starting FreeRTOS scheduler...\r\n");
    vTaskStartScheduler();   /* never returns if heap is sufficient */

    usart_debug("FATAL: scheduler returned\r\n");
    for (;;);
}
