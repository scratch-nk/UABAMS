#include "stm32f4xx.h"
#include "spi_eth.h"
#include "w5500.h"
#include "usart_debug.h"
#include "clock_config.h"
#include "gps.h"
#include "delay.h"
#include "boot_info.h"
#include "health.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
// FreeRTOS headers 
#include "FreeRTOS.h" 
#include "task.h"
#include "queue.h" 
#include <stdarg.h>
#include "gps_health.h"

#include <sdio.h>
#include <math.h>
#include "ff.h"
#include "diskio.h"


FATFS fs;

volatile uint8_t debug_monitor = 0;
extern volatile uint32_t ms_ticks;
// FreeRTOS scheduler start flag for SysTick handler
static volatile uint8_t xSchedulerStarted = 0;

/* ================= UART RX ================= */
static QueueHandle_t uartQueue;
static QueueHandle_t gpsQueue;

uint8_t rx_byte;

// Network config
uint8_t mac[] = {0x00, 0x08, 0xDC, 0x11, 0x22, 0x01};
uint8_t ip[]  = {192, 168, 1, 100};
uint8_t sn[]  = {255, 255, 255, 0};
uint8_t gw[]  = {192, 168, 1, 1};

// SysTick -- combined handler
extern void xPortSysTickHandler(void);

void SysTick_Handler(void)
{
    ms_ticks++;
    if (xSchedulerStarted) {
        xPortSysTickHandler();
    }
}


// delay function (kept for compatibility)
void delay(void)
{
    for (volatile int i = 0; i < 500000; i++);
}

// HardFault handler with details
void HardFault_Handler(void)
{
    uint32_t *sp;

    __asm volatile(
        "TST LR, #4\n"
        "ITE EQ\n"
        "MRSEQ %0, MSP\n"
        "MRSNE %0, PSP\n"
        : "=r" (sp) : : "memory"
    );
    usart_debug("\r\n=== HARDFAULT DETAILS ===\r\n");
    usart_debug("R0: 0x%08x\r\n", sp[0]);
    usart_debug("R1: 0x%08x\r\n", sp[1]);
    usart_debug("R2: 0x%08x\r\n", sp[2]);
    usart_debug("R3: 0x%08x\r\n", sp[3]);
    usart_debug("R12: 0x%08x\r\n", sp[4]);
    usart_debug("LR: 0x%08x\r\n", sp[5]);
    usart_debug("PC: 0x%08x\r\n", sp[6]);
    usart_debug("PSR: 0x%08x\r\n", sp[7]);
    for (;;);
}

// FreeRTOS hooks
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

//  Task 2: TCP
void vTCPEthernetTask(void *pvParam)
{
    (void)pvParam;
    FIL fil_local;
    UINT bw;
    char log_line[512];
    uint8_t file_opened = 0;

    if (f_open(&fil_local, "data1.txt", FA_OPEN_ALWAYS | FA_WRITE) == FR_OK) {
        f_lseek(&fil_local, f_size(&fil_local));
        // open files : 
        file_opened = 1;
        usart_debug("FILE OPEN OK\r\n");
    } else {
        usart_debug("FILE OPEN FAIL\r\n");
    }

    uint8_t rx_buf[512];
    uint8_t connected = 0;

    usart_debug("[TCPSimpleTask] started\r\n");

    // W5500
    W5500_RST_LOW();
    vTaskDelay(pdMS_TO_TICKS(200));
    W5500_RST_HIGH();
    vTaskDelay(pdMS_TO_TICKS(500));

   // W5500 version cheek
    uint8_t ver = W5500_ReadVersion();
    usart_debug("W5500 Version: 0x%02x ", ver);

    if (ver == 0x04) {
        usart_debug("- OK\r\n");
    } else {
        usart_debug("- ERROR: Wrong version!\r\n");
    }

    W5500_SetNetwork(mac, ip, sn, gw);

   //  TCP server start
    W5500_TCP_Server_Init(0, 5000);
    usart_debug("TCP SERVER LISTENING on port 5000...\r\n");
    usart_debug("IP: %d.%d.%d.%d\r\n", ip[0], ip[1], ip[2], ip[3]);
    
    uint32_t last_sync = xTaskGetTickCount();
    for (;;) {
        uint8_t status = W5500_GetSocketStatus(0);

        switch (status) {
            case 0x17:  // SOCK_ESTABLISHED
                if (!connected) {
                    usart_debug("\r\n*** CLIENT CONNECTED! ***\r\n");
                    connected = 1;
                }
                int len;
                gps_data_t gps_local;
                static char tcp_line_buf[1024]; // Larger buffer for line assembly
                static int tcp_line_idx = 0;

                // Receive data (leave 1 byte for null terminator)
                while((len = W5500_Recv(0, rx_buf, sizeof(rx_buf) - 1)) > 0)
                {
                    for (int i = 0; i < len; i++) {
                        char c = rx_buf[i];
                        
                        // Buffer character
                        if (tcp_line_idx < sizeof(tcp_line_buf) - 1) {
                            tcp_line_buf[tcp_line_idx++] = c;
                        }

                        // On newline, process the complete line
                        if (c == '\n') {
                            tcp_line_buf[tcp_line_idx] = '\0';
                            
                            // Remove \r if present at the end
                            if (tcp_line_idx > 0 && tcp_line_buf[tcp_line_idx-1] == '\r') {
                                tcp_line_buf[tcp_line_idx-1] = '\0';
                            }

                            // Prepare log string
                            // We look for 'FS :' which usually appears at the end of Axle Box blocks
                            if (strstr(tcp_line_buf, "FS ") || strstr(tcp_line_buf, "UBMS")) {
                                gps_get_copy(&gps_local);
                                snprintf(log_line, sizeof(log_line), 
                                    "%s | GPS:T-%02d:%02d:%02d SAT:%d LAT:%ld LON:%ld\r\n", 
                                    tcp_line_buf,
                                    gps_local.hour, gps_local.minute, gps_local.second,
                                    gps_local.satellites, gps_local.lat_i, gps_local.lon_i);
                            } else {
                                // If the line is not empty, print it
                                if (strlen(tcp_line_buf) > 0) {
                                    snprintf(log_line, sizeof(log_line), "%s\r\n", tcp_line_buf);
                                } else {
                                    log_line[0] = '\0'; // Don't print empty lines
                                }
                            }
                            
                            if (log_line[0] != '\0') {
                                // SD card write
                                if (file_opened) {
                                    f_write(&fil_local, log_line, strlen(log_line), &bw);
                                    if ((xTaskGetTickCount() - last_sync) > pdMS_TO_TICKS(5000)) {
                                        f_sync(&fil_local);
                                        last_sync = xTaskGetTickCount();
                                    }
                                }
                                // Debug print
                                usart_debug(log_line);
                            }
                            
                            tcp_line_idx = 0; // Reset for next line
                        }
                    }
                }
                break;

            case 0x1C: // SOCK_CLOSE_WAIT
                usart_debug("\r\n*** CLIENT DISCONNECTED ***\r\n");
                W5500_CloseSocket(0);
                connected = 0;
                break;

            case 0x00:  // SOCK_CLOSED
                if (connected) {
                    usart_debug("\r\n*** CONNECTION LOST ***\r\n");
                    connected = 0;
                }

                // server Again start
                W5500_TCP_Server_Init(0, 5000);
                break;

            default:
                // no connection
                if (connected) {
                    connected = 0;
                }
                break;
        }

            vTaskDelay(pdMS_TO_TICKS(10));
    }
}

// GPS Task
void vGPSTask(void *pvParam)
{
    
    (void)pvParam;

    uint16_t  ch;
    usart_debug("[GPSTask] Background parser started\r\n");

    for (;;)
    {
        // Block indefinitely waiting for a byte from the USART6 ISR.
        if (xQueueReceive(gpsQueue, &ch, portMAX_DELAY) == pdTRUE)
        {
            gps_feed((char)ch);
        }
    }
}
void vDebugMonitorTask(void *pvParam)
{
    (void)pvParam;

    while(1)
    {
        if(debug_monitor)
        {
            usart_debug("\r\n===== SYSTEM HEALTH =====\r\n");

            // GPS
            if(gps_data.valid)
                usart_debug("GPS          : OK\r\n");
            else
                usart_debug("GPS          : FAIL\r\n");

            // Satellites
            usart_debug("SATELLITES   : %d\r\n",
                         gps_data.satellites);

            // Ethernet
            uint8_t status = W5500_GetSocketStatus(0);

            if(status == 0x17)
                usart_debug("ETHERNET     : CONNECTED\r\n");
            else
                usart_debug("ETHERNET     : DISCONNECTED\r\n");

            // SD CARD
            if(f_mount(&fs, "", 0) == FR_OK)
                usart_debug("SD CARD      : OK\r\n");
            else
                usart_debug("SD CARD      : FAIL\r\n");

            // Heap
            usart_debug("FREE HEAP    : %d\r\n",
                        xPortGetFreeHeapSize());

            // Uptime
            usart_debug("UPTIME(ms)   : %lu\r\n",
                        xTaskGetTickCount());

            usart_debug("=========================\r\n");
        }

        vTaskDelay(pdMS_TO_TICKS(2000));
    }
}
static void vUartTask(void *pvParam)
{
    (void)pvParam;

    uint8_t ch;
    char buffer[64];
    int idx = 0;

    usart_debug("[UART Task] started\r\n");

    while (1)
    {
        if (xQueueReceive(uartQueue, &ch, portMAX_DELAY))
        {
            //  DEBUG (IMPORTANT)
            usart_debug("RX: %c\r\n", ch);

            // store character
            if (idx < sizeof(buffer) - 1)
            {
                buffer[idx++] = ch;
            }

            // command detection
            if (idx >= 5)
            {
                buffer[idx] = '\0';

                usart_debug("\r\n[CMD RECEIVED]: ");
                usart_debug(buffer);
                usart_debug("\r\n");

                if (strncmp(buffer, "HELLO", 5) == 0)
                {
                    usart_debug("HELLO RECEIVED OK\r\n");
                }
                else if (strncmp(buffer, "RESET", 5) == 0)
                {
                    usart_debug("SYSTEM RESET...\r\n");
                    vTaskDelay(pdMS_TO_TICKS(100));
                    NVIC_SystemReset();
                }

                else if (strncmp(buffer, "HEALTH", 6) == 0)
                {
                    usart_debug("HEALTH...\r\n");
                    vTaskDelay(pdMS_TO_TICKS(100));
                    gps_health_check();
                }
             else if (strncmp(buffer, "DEBUG", 5) == 0)
                {
                    debug_monitor = !debug_monitor;

                    if(debug_monitor)
                        usart_debug("DEBUG MONITOR ON\r\n");
                    else
                        usart_debug("DEBUG MONITOR OFF\r\n");
                }

                idx = 0; // reset buffer
            }
        }
    }
}
void vGPSHealthTask(void *pvParam)
{
    (void)pvParam;

    for (;;)
    {
        usart_debug("\r\n[GPS HEALTH]\r\n");
        gps_health_check();   // print health

        vTaskDelay(pdMS_TO_TICKS(31000)); // 30 sec delay
    }
}

void USART2_IRQHandler(void)
{
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;

    if (USART2->SR & USART_SR_RXNE)
    {
        uint8_t ch = USART2->DR;

        xQueueSendFromISR(uartQueue, &ch, &xHigherPriorityTaskWoken);
    }

    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

void USART6_IRQHandler(void)
{
    BaseType_t xHigherPriorityTaskWoken = pdFALSE;

    if (USART6->SR & USART_SR_RXNE)
    {
        uint8_t ch = USART6->DR;

        xQueueSendFromISR(gpsQueue, &ch, &xHigherPriorityTaskWoken);
    }

    portYIELD_FROM_ISR(xHigherPriorityTaskWoken);
}

int main(void)
{
    // PLL -> 96 MHz. Must be first -- all peripheral baud/timing depends on it
    SystemClock_Config();

    // Initialize hardware
    USART2_Init();

//==================================================================================
SDIO_Init();

// Full init sequence (VERY IMPORTANT)
SDIO_FullInit_Debug();   

uint16_t rca = SD_GetRCA();
usart_debug("RCA: %d\r\n", rca);
if (rca == 0) {
    usart_debug("RCA FAILED\r\n");
    while(1);
}

if (!SD_SelectCard(rca)) {
    usart_debug("SELECT FAILED\r\n");
    while(1);
}

g_sd_rca = rca;

    if (f_mount(&fs, "", 1) != FR_OK) {
        usart_debug("FATFS MOUNT FAIL\r\n");
    } else {
        usart_debug("FATFS MOUNT OK\r\n");
    }
//==============================================================================
    /* Queue create */
    uartQueue = xQueueCreate(32, sizeof(uint8_t));
    /* GPS queue + USART6 RX interrupt */
    gpsQueue = xQueueCreate(512, sizeof(uint8_t));

    /* UART RX interrupt enable */
    USART2->CR1 |= USART_CR1_RE;
    USART2->CR1 |= USART_CR1_RXNEIE;
    NVIC_SetPriority(USART2_IRQn, 6);
    NVIC_EnableIRQ(USART2_IRQn);

    gps_usart6_init();

    USART6->CR1 |= USART_CR1_RXNEIE;
    NVIC_SetPriority(USART6_IRQn, 6);   // must be >= configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY (5)
    NVIC_EnableIRQ(USART6_IRQn);

    gps_rtc_init();
    gps_health_check();
    print_boot_info("JUNCTION BOX - SIMPLE TEST");

    // SPI2 initialize (for W5500)
    SPI2_Init();

    // 1 ms SysTick
    SysTick_Config(SystemCoreClock / 1000);

    usart_debug("\r\n========================================\r\n");
    usart_debug("JUNCTION BOX SIMPLE TEST MODE\r\n");
    usart_debug("FreeRTOS Simple Tasks\r\n");
    usart_debug("========================================\r\n");
    usart_debug("Hardware initialized\r\n");

    for (int i = 0; i < 10; i++) {
        delay();
    }

   // TASKS CREATION

   // Task 2: TCPSimpleTask
    if (xTaskCreate(vTCPEthernetTask, "TCP", 2048, NULL, 2, NULL) != pdPASS) {
        usart_debug("Failed to create TCPSimpleTask\r\n");
    } else {
        usart_debug("TCPSimpleTask created\r\n");
    }

    xTaskCreate(vGPSTask, "GPS", 512, NULL, 3, NULL);

    xTaskCreate(vUartTask, "UART", 512, NULL, 3, NULL);
    xTaskCreate(vGPSHealthTask, "GPS_HEALTH", 512, NULL, 2, NULL);
    xTaskCreate(vDebugMonitorTask,"DEBUG", 1024, NULL, 1, NULL);
    
    usart_debug("\r\nAll tasks created. Starting scheduler...\r\n");
    usart_debug("========================================\r\n\r\n");


    // Start scheduler
    xSchedulerStarted = 1;
    vTaskStartScheduler();

    // Should never reach here
    usart_debug("FATAL: Scheduler returned\r\n");
    for (;;);
}
