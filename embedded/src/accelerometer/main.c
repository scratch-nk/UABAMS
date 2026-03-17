/*
 * accelerometer/main.c -- UABAMS Box 1, FreeRTOS v10.6.2
 *
 * Three-task architecture:
 *
 *   AccelTask   (priority 4, 1024 words)
 *     Samples both ADXL345 sensors at 200 Hz for 500 ms (100 samples).
 *     Sets s1_valid/s2_valid from health module. Computes RMS, SD, peak per
 *     window. Pushes WindowStats_t to xAccelQueue. Holds xSPI1Mutex during
 *     each sample pair.
 *
 *   LogTask     (priority 3, 640 words)
 *     On startup: reads health flags set in main() and attempts W5500 TCP
 *     connect if ETH is healthy. Receives WindowStats_t from xAccelQueue.
 *     Formats and outputs via USART and TCP only for valid (s1_valid/s2_valid)
 *     sensors -- no zeroed placeholder data is ever sent.
 *
 *   HealthTask  (priority 1, 256 words)
 *     Runs every 5 s. Re-reads ADXL345 WHO_AM_I bytes (via xSPI1Mutex) and
 *     W5500 version/PHY/socket status (via xSPI2Mutex). Updates health module.
 *     Reprints status table if anything changed.
 *
 * Init sequence (main, before scheduler):
 *   SystemClock_Config() -> USART2_Init(), spi1_init(), SPI2_Init()
 *   SysTick_Config() -> board info banner -> peripheral health checks
 *   -> xQueueCreate, xSemaphoreCreateMutex x2 -> xTaskCreate x3
 *   -> xSchedulerStarted=1 -> vTaskStartScheduler
 *
 * SysTick_Handler is a combined handler: increments ms_ticks (for delay_ms
 * compatibility) AND drives the FreeRTOS tick via xPortSysTickHandler().
 * xSchedulerStarted gates the FreeRTOS call -- before the scheduler starts,
 * pxCurrentTCB is NULL and calling xPortSysTickHandler() would HardFault.
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
#include "health.h"
#include "boot_info.h"
#include "accelerometer_health.h"
#include "ethernet_health.h"

#include <stdio.h>
#include <math.h>
#include <string.h>

/* -- Firmware identity ----------------------------------------------------- */
#define SW_VERSION   "v1.0.0"
#define BOX_ID       "BOX 1"
#define FREERTOS_VER "v10.6.2"

/* -- Sampling config -------------------------------------------------------- */
#define FS_HZ        200
#define WINDOW_MS    500
#define SAMPLE_COUNT (FS_HZ * WINDOW_MS / 1000)   /* 100 samples */
#define EVENT_TH     2.0f                          /* g -- vibration alert */
#define HEALTH_CHECK_MS  (1000*30)   /* HealthTask re-check interval. 30 seconds */

/* -- Network config --------------------------------------------------------- */
uint8_t mac[]       = {0x00, 0x08, 0xDC, 0x11, 0x22, 0x10};
uint8_t ip[]        = {192, 168, 1, 10};
static uint8_t sn[]        = {255, 255, 255, 0};
static uint8_t gw[]        = {0, 0, 0, 0};
static uint8_t server_ip[] = {192, 168, 1, 100};

/* -- WindowStats_t -- data passed from AccelTask to LogTask ---------------- */
typedef struct {
    uint8_t s1_valid;   /* 1 = sensor 1 data is good; 0 = skip (no output) */
    uint8_t s2_valid;   /* 1 = sensor 2 data is good; 0 = skip (no output) */

    float s1_rms_v, s1_rms_l;
    float s1_sd_v,  s1_sd_l;
    float s1_peak;
    float s1_last_x, s1_last_y, s1_last_z;

    float s2_rms_v, s2_rms_l;
    float s2_sd_v,  s2_sd_l;
    float s2_peak;
    float s2_last_x, s2_last_y, s2_last_z;
} WindowStats_t;

/* -- Shared ETH state (LogTask sets, HealthTask clears on link loss) ------- */
volatile uint8_t g_eth_ok = 0;

/* -- RTOS handles ---------------------------------------------------------- */
static QueueHandle_t     xAccelQueue;   /* WindowStats_t, depth 4            */
static SemaphoreHandle_t xSPI2Mutex;    /* guards W5500 SPI2 bus             */
static SemaphoreHandle_t xSPI1Mutex;    /* guards ADXL345 SPI1, shared with
                                           HealthTask for periodic ID reads  */

/* -- Helpers --------------------------------------------------------------- */
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

/* -- TCP Connection Management Function (from main.c1) --------------------- */
void TCP_Task(void)
{
    uint8_t status = W5500_GetSocketStatus(0);
    if (status == 0x17)
    {
        g_eth_ok = 1;
        health_set_tcp(HEALTH_OK);
    }
    else
    {
        g_eth_ok = 0;
        health_set_tcp(HEALTH_FAIL);
        // reconnect try
        W5500_TCP_Client_Connect(0, server_ip, 5000);
    }
}

/* -- SysTick -- combined handler ------------------------------------------ *
 * delay.c compiled with -DUSE_FREERTOS_SYSTICK suppresses its own handler.  *
 * ms_ticks keeps delay_ms() working during pre-scheduler init.              *
 *                                                                            *
 * xPortSysTickHandler() must NOT be called before the scheduler starts:     *
 * pxCurrentTCB is NULL until vTaskStartScheduler() runs, so                *
 * xTaskIncrementTick() would dereference it and cause a HardFault.         *
 * xSchedulerStarted gates the call.                                         */
extern void xPortSysTickHandler(void);
extern volatile uint32_t ms_ticks;
static volatile uint8_t xSchedulerStarted = 0;

void SysTick_Handler(void)
{
    ms_ticks++;
    if (xSchedulerStarted) {
        xPortSysTickHandler();
    }
}

/* -- AccelTask ------------------------------------------------------------- */
static void vAccelTask(void *pvParam)
{
    (void)pvParam;

    if (health_get_sensor(1) != HEALTH_OK && health_get_sensor(2) != HEALTH_OK) {
        usart_debug("[AccelTask] FATAL: no sensors operational\r\n");
        vTaskDelete(NULL);
        return;
    }

    /* Stack-allocated sample buffers: 4 x 100 x 4 B = 1600 B on task stack */
    float s1_x[SAMPLE_COUNT], s1_z[SAMPLE_COUNT];
    float s2_x[SAMPLE_COUNT], s2_z[SAMPLE_COUNT];

    usart_debug("[AccelTask] started\r\n");
    TickType_t xLastSampleTime = xTaskGetTickCount();

    for (;;) {
        WindowStats_t stats = {0};
        stats.s1_valid = (health_get_sensor(1) == HEALTH_OK) ? 1 : 0;
        stats.s2_valid = (health_get_sensor(2) == HEALTH_OK) ? 1 : 0;

        float sum_x1 = 0, sum_z1 = 0, sumsq_x1 = 0, sumsq_z1 = 0;
        float sum_x2 = 0, sum_z2 = 0, sumsq_x2 = 0, sumsq_z2 = 0;

        /* -- 100 samples at 200 Hz (5 ms per sample) -- */
        for (int i = 0; i < SAMPLE_COUNT; i++) {
            float x1 = 0.0f, y1 = 0.0f, z1 = 0.0f;
            float x2 = 0.0f, y2 = 0.0f, z2 = 0.0f;

            xSemaphoreTake(xSPI1Mutex, portMAX_DELAY);
            if (stats.s1_valid) adxl345_read_xyz_spi(1, &x1, &y1, &z1);
            if (stats.s2_valid) adxl345_read_xyz_spi(2, &x2, &y2, &z2);
            xSemaphoreGive(xSPI1Mutex);

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

            if (i == SAMPLE_COUNT - 1) {
                stats.s1_last_x = x1;  stats.s1_last_y = y1;  stats.s1_last_z = z1;
                stats.s2_last_x = x2;  stats.s2_last_y = y2;  stats.s2_last_z = z2;
            }

            /* yield until next 5 ms slot -- CPU free while waiting */
            vTaskDelayUntil(&xLastSampleTime, pdMS_TO_TICKS(1000 / FS_HZ));
        }

        /* -- RMS -- */
        stats.s1_rms_v = sqrtf(sumsq_z1 / SAMPLE_COUNT);
        stats.s1_rms_l = sqrtf(sumsq_x1 / SAMPLE_COUNT);
        stats.s2_rms_v = sqrtf(sumsq_z2 / SAMPLE_COUNT);
        stats.s2_rms_l = sqrtf(sumsq_x2 / SAMPLE_COUNT);

        /* -- SD -- */
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

        /* push to LogTask -- drop if queue full (LogTask is behind) */
        xQueueSend(xAccelQueue, &stats, 0);
    }
}

/* -- LogTask --------------------------------------------------------------- */
static void vLogTask(void *pvParam)
{
    (void)pvParam;
    usart_debug("[LogTask] started\r\n");

    /* -- W5500 TCP connect -- reads health flags set in main(), no re-probe - *
     * Reset already done in main() with delay_ms(). We only need             *
     * SetNetwork + Connect here, and only if ETH was found healthy.          */
    if (health_get_w5500() == HEALTH_OK && health_get_phy() == HEALTH_OK) {
        xSemaphoreTake(xSPI2Mutex, portMAX_DELAY);

        W5500_SetNetwork(mac, ip, sn, gw);
        vTaskDelay(pdMS_TO_TICKS(200));
        usart_debug("[LOG] connecting TCP...\r\n");

        if (W5500_TCP_Client_Connect(0, server_ip, 5000) == 0) {
            /* CONNECT command accepted; poll Sn_SR until ESTABLISHED (0x17).
             * The 3-way handshake is asynchronous — W5500_TCP_Client_Connect
             * only confirms the chip received the CONNECT command, not that
             * the server replied. Poll up to 5 s (500 x 10 ms). */
            uint8_t connected = 0;
            for (int t = 0; t < 500 && !connected; t++) {
                if (W5500_GetSocketStatus(0) == 0x17) {
                    connected = 1;
                } else {
                    xSemaphoreGive(xSPI2Mutex);
                    vTaskDelay(pdMS_TO_TICKS(10));
                    xSemaphoreTake(xSPI2Mutex, portMAX_DELAY);
                }
            }
            if (connected) {
                g_eth_ok = 1;
                health_set_tcp(HEALTH_OK);
            } else {
                health_set_tcp(HEALTH_FAIL);
            }
        } else {
            usart_debug("[LOG] W5500 CONNECT command timed out\r\n");
            health_set_tcp(HEALTH_FAIL);
        }

        health_print_all();   /* shows final TCP result */
        xSemaphoreGive(xSPI2Mutex);
    }

    /* -- Data loop --------------------------------------------------------- */
    WindowStats_t stats;
    char tcp_buf[512];

    for (;;) {
        /* block until AccelTask pushes a completed window */
        xQueueReceive(xAccelQueue, &stats, portMAX_DELAY);

        xSemaphoreTake(xSPI2Mutex, portMAX_DELAY);

        /* Call TCP_Task to maintain connection status */
        TCP_Task();

        usart_debug("\r\n----- UBMS CONTINUOUS DATA -----\r\n");

        /* -- S1 packet (only if sensor is operational) -- */
        if (stats.s1_valid) {
            usart_debug("Accelerometer : S1\r\n");
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
            if (g_eth_ok) UBMS_Send_TCP(tcp_buf);

            snprintf(tcp_buf, sizeof(tcp_buf),
                "X=%.3f Y=%.3f Z=%.3f\r\n",
                stats.s1_last_x, stats.s1_last_y, stats.s1_last_z);
            usart_debug(tcp_buf);
            if (g_eth_ok) UBMS_Send_TCP(tcp_buf);
        }

        /* -- S2 packet (only if sensor is operational) -- */
        if (stats.s2_valid) {
            usart_debug("Accelerometer : S2\r\n");
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
            if (g_eth_ok) UBMS_Send_TCP(tcp_buf);

            snprintf(tcp_buf, sizeof(tcp_buf),
                "X=%.3f Y=%.3f Z=%.3f\r\n",
                stats.s2_last_x, stats.s2_last_y, stats.s2_last_z);
            usart_debug(tcp_buf);
            if (g_eth_ok) UBMS_Send_TCP(tcp_buf);
        }

        /* -- FS / window line -- */
        snprintf(tcp_buf, sizeof(tcp_buf),
            "\r\nFS     : %d Hz\r\nWINDOW : %d ms\r\n",
            FS_HZ, WINDOW_MS);
        usart_debug(tcp_buf);
        if (g_eth_ok) UBMS_Send_TCP(tcp_buf);

        /* -- Event alert (only for valid sensors) -- */
        if ((stats.s1_valid && stats.s1_peak >= EVENT_TH) ||
            (stats.s2_valid && stats.s2_peak >= EVENT_TH)) {
            snprintf(tcp_buf, sizeof(tcp_buf),
                "\r\n*** EVENT: VIBRATION ALERT ***\r\n"
                "S1 PEAK : %.2f g (%s)\r\n"
                "S2 PEAK : %.2f g (%s)\r\n",
                stats.s1_peak, vib_level(stats.s1_peak),
                stats.s2_peak, vib_level(stats.s2_peak));
            usart_debug(tcp_buf);
            if (g_eth_ok) UBMS_Send_TCP(tcp_buf);
        }

        usart_debug("UBMS PACKET SENT\r\n");

        if (g_eth_ok) {
            usart_debug("TCP_Connected --------------------------------------\r\n");
        } else {
            usart_debug("TCP_NOT _Connected ----------------------------------\r\n");
        }

        xSemaphoreGive(xSPI2Mutex);
    }
}

/* -- HealthTask ------------------------------------------------------------ */
static void vHealthTask(void *pvParam)
{
    (void)pvParam;
    usart_debug("[HealthTask] started\r\n");

    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(HEALTH_CHECK_MS));

        /* snapshot current state to detect changes */
        HealthStatus_t prev_s1  = health_get_sensor(1);
        HealthStatus_t prev_s2  = health_get_sensor(2);
        HealthStatus_t prev_w55 = health_get_w5500();
        HealthStatus_t prev_phy = health_get_phy();
        HealthStatus_t prev_tcp = health_get_tcp();

        /* -- Sensor re-check (SPI1) -- */
        xSemaphoreTake(xSPI1Mutex, portMAX_DELAY);
        uint8_t id1 = adxl345_read_id(1);
        uint8_t id2 = adxl345_read_id(2);
        xSemaphoreGive(xSPI1Mutex);

        health_set_sensor(1, id1 == 0xE5 ? HEALTH_OK : HEALTH_FAIL, id1);
        health_set_sensor(2, id2 == 0xE5 ? HEALTH_OK : HEALTH_FAIL, id2);

        /* -- ETH re-check (SPI2) -- */
        xSemaphoreTake(xSPI2Mutex, portMAX_DELAY);
        uint8_t ver = W5500_ReadVersion();
        uint8_t phy = W5500_GetPHYStatus();
        uint8_t eth_health_flag = ( ((ver == 0x04) && (phy & 0x01))  ? HEALTH_OK : HEALTH_FAIL);
        health_set_w5500 (eth_health_flag, ver);
        health_set_phy (eth_health_flag);

        /* If PHY/MAC is gone, stop LogTask sending on a dead socket.
         * g_eth_ok is only re-armed by LogTask on a successful reconnect. */
        if (eth_health_flag == HEALTH_FAIL) {
            g_eth_ok = 0;
            health_set_tcp(HEALTH_FAIL);
        }

        xSemaphoreGive(xSPI2Mutex);

        /* reprint only when something changed */
        if (health_get_sensor(1) != prev_s1 || health_get_sensor(2) != prev_s2 ||
            health_get_w5500()   != prev_w55 || health_get_phy()    != prev_phy ||
            health_get_tcp()     != prev_tcp) {
            usart_debug("[HEALTH] Status changed:\r\n");
            health_print_all();
        }
    }
}

/* -- HardFault handler ----------------------------------------------------- */
void HardFault_Handler(void)
{
    usart_debug("FATAL: HardFault\r\n");
    for (;;);
}

/* -- FreeRTOS hooks -------------------------------------------------------- */
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

static void vBootTask(void *pvParam)
{
    (void)pvParam;
 for (;;)
    {
    // 30 sec delay
    vTaskDelay(pdMS_TO_TICKS(30000));

    print_boot_info("DATA LOGGER UNIT");
    usart_debug("SYSTEM Health INITIALIZATION...\r\n");

    // sensor_spi_health_check();
    // sensor_max_range_check(1);
    // sensor_max_range_check(2);
    // sensor_static_check();

    // spi2_w5500_check();
    // ethernet_hardware_check();

    // usart_debug("\r\nDATA LOGGER BOOT\r\n");

    health_print_all();

    //vTaskDelete(NULL); // ek baar run karke delete
    }
}
/* -- main ------------------------------------------------------------------ */
int main(void)
{
    /* PLL -> 96 MHz. Must be first -- all peripheral baud/timing depends on it */
    SystemClock_Config();

    USART2_Init();
    print_boot_info("DATA LOGGER UNIT");  /* From boot_info.h */
    usart_debug("SYSTEM INITIALIZATION...\r\n");

    spi1_init();    /* ADXL345 x2 on SPI1 */
    
    /* Sensor health checks from accelerometer_health.h */

    //sensor_spi_health_check();
    sensor_max_range_check(1);
    sensor_max_range_check(2);
    sensor_static_check();
    
    SPI2_Init();    /* W5500 on SPI2       */
    
    /* Ethernet health checks from ethernet_health.h */
    spi2_w5500_check();
    ethernet_hardware_check();

    /* 1 ms SysTick -- FreeRTOS reconfigures to same rate; combined handler above */
    SysTick_Config(SystemCoreClock / 1000);
    usart_debug("\r\nDATA LOGGER BOOT\r\n");

    /* ── Board info banner ─────────────────────────────────────────────────── */
    usart_debug("========================================\r\n");
    usart_debug("  UABAMS %s -- FreeRTOS %s\r\n", BOX_ID, FREERTOS_VER);
    usart_debug("  UBMS Axle Box Monitoring System\r\n");
    usart_debug("  SW: %s\r\n", SW_VERSION);
    usart_debug("========================================\r\n");
    usart_debug("[BOARD]\r\n");
    usart_debug("  CPU  : STM32F411RE  Cortex-M4F @ %u MHz\r\n",
                (unsigned)(SystemCoreClock / 1000000UL));
    usart_debug("  Flash: %u KB\r\n", *(volatile uint16_t *)0x1FFF7A22U);
    usart_debug("  RAM  : 128 KB\r\n");
    usart_debug("  FPU  : Enabled (hard-ABI)\r\n");
    usart_debug("  Buses: SPI1 (ADXL345 x2), SPI2 (W5500), USART2\r\n");
    usart_debug("========================================\r\n");

    /* ── W5500 INIT (from main.c1) ──────────────────────────────────────── */
    W5500_RST_LOW();  delay_ms(50);
    W5500_RST_HIGH(); delay_ms(300);

    /* ── Peripheral health checks ────────────────────────────────────────── *
     * ADXL345: read WHO_AM_I (0xE5 expected) -- init only on ID pass.        *
     * W5500:   reset with delay_ms() (safe pre-scheduler, SysTick configured) *
     *          then read version (0x04 expected) and PHY link status.        *
     * TCP:     stays HEALTH_UNKNOWN -- LogTask sets it after connect attempt. */

    uint8_t id1 = adxl345_read_id(1);
    health_set_sensor(1, id1 == 0xE5 ? HEALTH_OK : HEALTH_FAIL, id1);
    if (health_get_sensor(1) == HEALTH_OK) adxl345_init(1);

    uint8_t id2 = adxl345_read_id(2);
    health_set_sensor(2, id2 == 0xE5 ? HEALTH_OK : HEALTH_FAIL, id2);
    if (health_get_sensor(2) == HEALTH_OK) adxl345_init(2);

    uint8_t ver = W5500_ReadVersion();
    uint8_t phy = W5500_GetPHYStatus();
    uint8_t eth_health_flag = ((ver == 0x04) &&  (phy & 0x01)) ? HEALTH_OK : HEALTH_FAIL;
    health_set_w5500(eth_health_flag, ver);
    health_set_phy(eth_health_flag);

    W5500_SetNetwork(mac, ip, sn, gw);
    delay_ms(1000);

    usart_debug("CONNECT REQUEST SENT\r\n");
    W5500_TCP_Client_Connect(0, server_ip, 5000);

   // health_print_all();   /* TCP shows PENDING; LogTask will update and reprint */
    usart_debug("[INIT] Ready. Starting scheduler...\r\n");

    /* ── RTOS objects ──────────────────────────────────────────────────────── */
    xAccelQueue = xQueueCreate(4, sizeof(WindowStats_t));
    xSPI2Mutex  = xSemaphoreCreateMutex();
    xSPI1Mutex  = xSemaphoreCreateMutex();

    /* AccelTask: priority 4 (highest) -- 200 Hz timing; must not be starved.
     * Stack 1024 words = 4096 B -- covers 4 x float[100] = 1600 B + FPU ctx. */
    xTaskCreate(vAccelTask,  "Accel",  1024, NULL, 4, NULL);

    /* LogTask: priority 3 -- runs when AccelTask is delaying between samples.
     * Stack 640 words = 2560 B -- covers snprintf(512 B) + W5500 init frames. */
    xTaskCreate(vLogTask,    "Log",     640, NULL, 3, NULL);
    xTaskCreate(vBootTask, "Boot", 512, NULL, 2, NULL);

    /* HealthTask: priority 1 (lowest) -- runs every 5 s during idle periods.
     * Stack 256 words = 1024 B -- only calls driver reads + usart_debug.    */
    xTaskCreate(vHealthTask, "Health",  256, NULL, 1, NULL);

    usart_debug("Starting FreeRTOS scheduler...\r\n");
    xSchedulerStarted = 1;   /* allow SysTick_Handler to call xPortSysTickHandler */
    vTaskStartScheduler();   /* never returns if heap is sufficient */

    usart_debug("FATAL: scheduler returned\r\n");
    for (;;);
}