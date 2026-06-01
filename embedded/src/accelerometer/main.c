/*
 * accelerometer/main.c -- UABAMS Box 1, FreeRTOS v10.6.2 
 * (ETHERNET/TCP REMOVED VERSION)
 */

#include "FreeRTOS.h"
#include "task.h"
#include "queue.h"
#include "semphr.h"

#include "stm32f4xx.h"
#include "spi.h"
#include "adxl345.h"
#include "usart_debug.h"
#include "clock_config.h"
#include "delay.h"
#include "health.h"
#include "boot_info.h"
#include "accelerometer_health.h"
#include <sdio.h>
#include "gps.h"
#include "gps_health.h"

#include <math.h>
#include <string.h>
#include "ff.h"
#include "diskio.h"
#include <stdio.h>
#include "crc16.h"

FATFS fs;
FIL fil;
#define SW_VERSION   "v1.0.1"
#define BOX_ID       "BOX 1"
#define FREERTOS_VER "v10.6.2"

// -- Network config (kept for health check references)
uint8_t mac[] = {0x00, 0x08, 0xDC, 0x11, 0x22, 0x10};
uint8_t ip[]  = {192, 168, 1, 10};

// -- Sampling config (FAST LIVE DATA)
#define FS_HZ        200
#define WINDOW_MS    100 //500
#define SAMPLE_COUNT (FS_HZ * WINDOW_MS / 1000)   
#define EVENT_TH     2.0f                          
#define HEALTH_CHECK_MS  (1000*30)   

typedef struct {
    uint8_t s1_valid;   
    uint8_t s2_valid;   
    float s1_ax, s1_ay, s1_az;
    float s1_rms_v, s1_rms_l;
    float s1_sd_v, s1_sd_l;
    float s1_p2p_v, s1_p2p_l;
    float s1_peak;
    float s2_ax, s2_ay, s2_az;
    float s2_rms_v, s2_rms_l;
    float s2_sd_v, s2_sd_l;
    float s2_p2p_v, s2_p2p_l;
    float s2_peak;
} WindowStats_t;

// RTOS handles 
static QueueHandle_t     xAccelQueue;            
static QueueHandle_t     gpsQueue;      
static SemaphoreHandle_t xSPI1Mutex;    

// Task Prototypes
static void vAccelTask(void *pvParam);
static void vLogTask(void *pvParam);
static void vHealthTask(void *pvParam);
static void vGPSTask(void *pvParam);

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

// -- AccelTask 
static void vAccelTask(void *pvParam)
{
    usart_debug("[AccelTask] started\r\n");
    TickType_t xLastSampleTime = xTaskGetTickCount();

    for (;;) {
        WindowStats_t stats = {0};
        stats.s1_valid = (health_get_sensor(1) == HEALTH_OK) ? 1 : 0;
        stats.s2_valid = (health_get_sensor(2) == HEALTH_OK) ? 1 : 0;

        float s1_sum_x = 0, s1_sum_y = 0, s1_sum_z = 0;
        float s1_sumsq_x = 0, s1_sumsq_z = 0;
        float s1_min_x = 100, s1_max_x = -100;
        float s1_min_z = 100, s1_max_z = -100;

        float s2_sum_x = 0, s2_sum_y = 0, s2_sum_z = 0;
        float s2_sumsq_x = 0, s2_sumsq_z = 0;
        float s2_min_x = 100, s2_max_x = -100;
        float s2_min_z = 100, s2_max_z = -100;

        for (int i = 0; i < SAMPLE_COUNT; i++) {
            float x1 = 0, y1 = 0, z1 = 0;
            float x2 = 0, y2 = 0, z2 = 0;

            xSemaphoreTake(xSPI1Mutex, portMAX_DELAY);
            if (stats.s1_valid) adxl345_read_xyz_spi(1, &x1, &y1, &z1);
            if (stats.s2_valid) adxl345_read_xyz_spi(2, &x2, &y2, &z2);
            xSemaphoreGive(xSPI1Mutex);

            if (stats.s1_valid) {
                s1_sum_x += x1; s1_sum_y += y1; s1_sum_z += z1;
                s1_sumsq_x += x1*x1; s1_sumsq_z += z1*z1;
                if (x1 < s1_min_x) s1_min_x = x1; if (x1 > s1_max_x) s1_max_x = x1;
                if (z1 < s1_min_z) s1_min_z = z1; if (z1 > s1_max_z) s1_max_z = z1;
                float mag1 = sqrtf(x1*x1 + y1*y1 + z1*z1);
                if (mag1 > stats.s1_peak) stats.s1_peak = mag1;
            }

            if (stats.s2_valid) {
                s2_sum_x += x2; s2_sum_y += y2; s2_sum_z += z2;
                s2_sumsq_x += x2*x2; s2_sumsq_z += z2*z2;
                if (x2 < s2_min_x) s2_min_x = x2; if (x2 > s2_max_x) s2_max_x = x2;
                if (z2 < s2_min_z) s2_min_z = z2; if (z2 > s2_max_z) s2_max_z = z2;
                float mag2 = sqrtf(x2*x2 + y2*y2 + z2*z2);
                if (mag2 > stats.s2_peak) stats.s2_peak = mag2;
            }

            vTaskDelayUntil(&xLastSampleTime, pdMS_TO_TICKS(1000 / FS_HZ));
        }

        if (stats.s1_valid) {
            stats.s1_ax = s1_sum_x / SAMPLE_COUNT;
            stats.s1_ay = s1_sum_y / SAMPLE_COUNT;
            stats.s1_az = s1_sum_z / SAMPLE_COUNT;
            stats.s1_rms_v = sqrtf(s1_sumsq_z / SAMPLE_COUNT);
            stats.s1_rms_l = sqrtf(s1_sumsq_x / SAMPLE_COUNT);
            float var_v = (s1_sumsq_z / SAMPLE_COUNT) - (stats.s1_az * stats.s1_az);
            float var_l = (s1_sumsq_x / SAMPLE_COUNT) - (stats.s1_ax * stats.s1_ax);
            stats.s1_sd_v = sqrtf(fabsf(var_v));
            stats.s1_sd_l = sqrtf(fabsf(var_l));
            stats.s1_p2p_v = s1_max_z - s1_min_z;
            stats.s1_p2p_l = s1_max_x - s1_min_x;
        }

        if (stats.s2_valid) {
            stats.s2_ax = s2_sum_x / SAMPLE_COUNT;
            stats.s2_ay = s2_sum_y / SAMPLE_COUNT;
            stats.s2_az = s2_sum_z / SAMPLE_COUNT;
            stats.s2_rms_v = sqrtf(s2_sumsq_z / SAMPLE_COUNT);
            stats.s2_rms_l = sqrtf(s2_sumsq_x / SAMPLE_COUNT);
            float var_v = (s2_sumsq_z / SAMPLE_COUNT) - (stats.s2_az * stats.s2_az);
            float var_l = (s2_sumsq_x / SAMPLE_COUNT) - (stats.s2_ax * stats.s2_ax);
            stats.s2_sd_v = sqrtf(fabsf(var_v));
            stats.s2_sd_l = sqrtf(fabsf(var_l));
            stats.s2_p2p_v = s2_max_z - s2_min_z;
            stats.s2_p2p_l = s2_max_x - s2_min_x;
        }

        xQueueSend(xAccelQueue, &stats, 0);
    }
}

static const char* get_range_str(float peak)
{
    if (peak < 2.0f) return "NORMAL";
    if (peak < 4.0f) return "2G";
    if (peak < 8.0f) return "4G";
    if (peak < 16.0f) return "8G";
    return "16G";
}

// -- LogTask 
static void vLogTask(void *pvParam)
{
    WindowStats_t stats;
    gps_data_t gps_local;
    char line[512];
    UINT bw;
    uint8_t sd_mounted = 0;
    FRESULT res;

    vTaskDelay(pdMS_TO_TICKS(1000)); // Wait for SD to settle
    
    usart_debug("[LogTask] Mounting SD...\r\n");
    res = f_mount(&fs, "", 1);
    if (res == FR_OK) {
        usart_debug("[LogTask] SD Mounted OK\r\n");
        res = f_open(&fil, "data.txt", FA_OPEN_ALWAYS | FA_WRITE);
        if (res == FR_OK) {
            f_lseek(&fil, f_size(&fil));
            sd_mounted = 1;
            usart_debug("[LogTask] File 'data.txt' opened OK\r\n");
        } else {
            snprintf(line, sizeof(line), "[LogTask] f_open FAIL: %d\r\n", res);
            usart_debug(line);
        }
    } else {
        snprintf(line, sizeof(line), "[LogTask] f_mount FAIL: %d\r\n", res);
        usart_debug(line);
    }

    for (;;) {
        if (xQueueReceive(xAccelQueue, &stats, portMAX_DELAY) == pdTRUE) {
            uint32_t time_ms = xTaskGetTickCount() * portTICK_PERIOD_MS;
            gps_get_copy(&gps_local);
            float speed_kmh = gps_local.speed_cms * 0.036f;

            // CFG Line
            int len = snprintf(line, sizeof(line), "CFG,%d,%d", FS_HZ, WINDOW_MS);
            uint16_t crc = crc16_ccitt((uint8_t*)line, len);
            snprintf(line + len, sizeof(line) - len, ",CRC:0x%04X\r\n", crc);
            
            usart_puts(line);
            if (sd_mounted) {
                res = f_write(&fil, line, strlen(line), &bw);
                if (res != FR_OK && res != 0) { /* handle */ }
            }

            // Print S1 Data
            if (stats.s1_valid) {
                len = snprintf(line, sizeof(line), "S1,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%lu,LAT:%ld,LON:%ld,SAT:%d,TIME:%02d:%02d:%02d,DATE:%02d/%02d/%04d,SPEED:%.1f",
                        stats.s1_ax, stats.s1_ay, stats.s1_az,
                        stats.s1_rms_v, stats.s1_rms_l,
                        stats.s1_sd_v, stats.s1_sd_l,
                        stats.s1_p2p_v, stats.s1_p2p_l,
                        stats.s1_peak, time_ms,
                        gps_local.lat_i, gps_local.lon_i, gps_local.satellites,
                        gps_local.hour, gps_local.minute, gps_local.second,
                        gps_local.day, gps_local.month, gps_local.year,
                        speed_kmh);
                crc = crc16_ccitt((uint8_t*)line, len);
                snprintf(line + len, sizeof(line) - len, ",CRC:0x%04X\r\n", crc);

                usart_puts(line);
                if (sd_mounted) f_write(&fil, line, strlen(line), &bw);
            }

            // Print S2 Data
            if (stats.s2_valid) {
                len = snprintf(line, sizeof(line), "S2,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%lu,LAT:%ld,LON:%ld,SAT:%d,TIME:%02d:%02d:%02d,DATE:%02d/%02d/%04d,SPEED:%.1f",
                        stats.s2_ax, stats.s2_ay, stats.s2_az,
                        stats.s2_rms_v, stats.s2_rms_l,
                        stats.s2_sd_v, stats.s2_sd_l,
                        stats.s2_p2p_v, stats.s2_p2p_l,
                        stats.s2_peak, time_ms,
                        gps_local.lat_i, gps_local.lon_i, gps_local.satellites,
                        gps_local.hour, gps_local.minute, gps_local.second,
                        gps_local.day, gps_local.month, gps_local.year,
                        speed_kmh);
                crc = crc16_ccitt((uint8_t*)line, len);
                snprintf(line + len, sizeof(line) - len, ",CRC:0x%04X\r\n", crc);

                usart_puts(line);
                if (sd_mounted) f_write(&fil, line, strlen(line), &bw);
            }

            // EVENT Line
            len = snprintf(line, sizeof(line), "EVENT,%lu,S1=%.2f(%s),S2=%.2f(%s)",
                    time_ms, 
                    stats.s1_peak, get_range_str(stats.s1_peak),
                    stats.s2_peak, get_range_str(stats.s2_peak));
            crc = crc16_ccitt((uint8_t*)line, len);
            snprintf(line + len, sizeof(line) - len, ",CRC:0x%04X\r\n", crc);

            usart_puts(line);
            if (sd_mounted) f_write(&fil, line, strlen(line), &bw);

            // Sync SD every 1 second (every 10 windows of 100ms)
            static int sc = 0;
            if (sd_mounted && ++sc >= 10) { 
                if (f_sync(&fil) != FR_OK) {
                    usart_debug("[LogTask] f_sync FAIL\r\n");
                    // sd_mounted = 0; // Optional: disable if it keeps failing
                }
                sc = 0; 
            }
        }
    }
}

// GPS Task
void vGPSTask(void *pvParam)
{
    uint8_t ch;
    for (;;) {
        if (xQueueReceive(gpsQueue, &ch, portMAX_DELAY) == pdTRUE) {
            gps_feed((char)ch);
        }
    }
}

// Health Task
static void vHealthTask(void *pvParam)
{
    for (;;) {
        vTaskDelay(pdMS_TO_TICKS(5000));
        xSemaphoreTake(xSPI1Mutex, portMAX_DELAY);
        uint8_t id1 = adxl345_read_id(1);
        uint8_t id2 = adxl345_read_id(2);
        xSemaphoreGive(xSPI1Mutex);

        health_set_sensor(1, id1 == 0xE5 ? HEALTH_OK : HEALTH_FAIL, id1);
        health_set_sensor(2, id2 == 0xE5 ? HEALTH_OK : HEALTH_FAIL, id2);
        
        usart_puts("[SYSTEM] Health Check OK\r\n");
    }
}

void USART6_IRQHandler(void)
{
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;
    if (USART6->SR & USART_SR_RXNE) {
        uint8_t ch = USART6->DR;
        xQueueSendFromISR(gpsQueue, &ch, &xHigherPriorityTaskWoken);
    }
    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

int main(void)
{
    SystemClock_Config();
    USART2_Init();

    SDIO_Init();
    SDIO_CardInit();
    
    uint16_t rca = SD_GetRCA();
    if (rca == 0) {
        usart_debug("SD RCA FAILED\r\n");
    } else {
        g_sd_rca = rca;
        SD_SelectCard(rca);
    }

    spi1_init();    
    sensor_max_range_check(1);
    sensor_max_range_check(2);
    sensor_static_check();

    SysTick_Config(SystemCoreClock / 1000);
    
    usart_debug("========================================\r\n");
    usart_debug("  UABAMS %s (NO-TCP)\r\n", BOX_ID);
    usart_debug("========================================\r\n");

    uint8_t id1 = adxl345_read_id(1);
    health_set_sensor(1, id1 == 0xE5 ? HEALTH_OK : HEALTH_FAIL, id1);
    if (health_get_sensor(1) == HEALTH_OK) adxl345_init(1);
    
    uint8_t id2 = adxl345_read_id(2);
    health_set_sensor(2, id2 == 0xE5 ? HEALTH_OK : HEALTH_FAIL, id2);
    if (health_get_sensor(2) == HEALTH_OK) adxl345_init(2);

    xAccelQueue = xQueueCreate(10, sizeof(WindowStats_t));
    xSPI1Mutex  = xSemaphoreCreateMutex();

    xTaskCreate(vAccelTask,  "Accel",  1024, NULL, 4, NULL);
    xTaskCreate(vLogTask,    "Log",    1024, NULL, 3, NULL);
    xTaskCreate(vHealthTask, "Health", 512,  NULL, 1, NULL);

    gpsQueue = xQueueCreate(512, sizeof(uint8_t));
    gps_usart6_init();
    gps_rtc_init();
    xTaskCreate(vGPSTask, "GPS", 512, NULL, 3, NULL);

    xSchedulerStarted = 1; 
    USART6->CR1 |= USART_CR1_RXNEIE;
    NVIC_SetPriority(USART6_IRQn, 6);
    NVIC_EnableIRQ(USART6_IRQn);

    vTaskStartScheduler();   
    for (;;);
}

void vApplicationMallocFailedHook(void) { for (;;); }
void vApplicationStackOverflowHook(TaskHandle_t x, char *n) { (void)x; (void)n; for (;;); }
void HardFault_Handler(void) { for (;;); }
