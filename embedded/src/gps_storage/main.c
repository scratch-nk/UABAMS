#include "stm32f4xx.h"
#include "spi_eth.h"
#include "w5500.h"
#include "gps.h"
#include "usart_debug.h"
#include "delay.h"
#include "boot_info.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

/* FreeRTOS headers */
#include "FreeRTOS.h"
#include "task.h"
#include "queue.h"
#include "semphr.h"

extern volatile uint32_t ms_ticks;

// FreeRTOS scheduler start flag for SysTick handler 
static volatile uint8_t xSchedulerStarted = 0;

// Network config  
uint8_t mac[] = {0x00, 0x08, 0xDC, 0x11, 0x22, 0x01};
uint8_t ip[]  = {192, 168, 1, 100};
uint8_t sn[]  = {255, 255, 255, 0};
uint8_t gw[]  = {192, 168, 1, 1};

// Mutex for GPS USART6
static SemaphoreHandle_t xUSART6Mutex;

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

/* ============================================================================
 * Task 1: TCPSimpleTask - W5500 TCP Server
 * ========================================================================== */
void vTCPSimpleTask(void *pvParam)
{
    (void)pvParam;
    uint8_t rx_buf[256];
    uint8_t connected = 0;
    
    usart_debug("[TCPSimpleTask] started\r\n");
    
    // W5500 Reset
    W5500_RST_LOW();
    vTaskDelay(pdMS_TO_TICKS(100));
    W5500_RST_HIGH();
    vTaskDelay(pdMS_TO_TICKS(300));
    
    // W5500 version check
    uint8_t ver = W5500_ReadVersion();
    usart_debug("W5500 Version: 0x%02x ", ver);
    
    if (ver == 0x04) {
        usart_debug("- OK\r\n");
    } else {
        usart_debug("- ERROR: Wrong version!\r\n");
    }
    
    // Network config
    W5500_SetNetwork(mac, ip, sn, gw);
    
    // TCP server start
    W5500_TCP_Server_Init(0, 5000);
    usart_debug("TCP SERVER LISTENING on port 5000...\r\n");
    usart_debug("IP: %d.%d.%d.%d\r\n", ip[0], ip[1], ip[2], ip[3]);

    for (;;) {
        uint8_t status = W5500_GetSocketStatus(0);
        
        switch (status) {
            case 0x17:  /* SOCK_ESTABLISHED */
                if (!connected) {
                    usart_debug("\r\n*** CLIENT CONNECTED! ***\r\n");
                    connected = 1;
                }
                
                int len = W5500_Recv(0, rx_buf, sizeof(rx_buf) - 1);
                
                if (len > 0) {
                    rx_buf[len] = '\0';
                    usart_debug("\r\n[RECEIVED %d bytes]\r\n", len);
                    usart_debug("Data: %s\r\n", rx_buf);
                    
                    char *reply = "ACK from Junction Box\r\n";
                    W5500_Send(0, (uint8_t*)reply, strlen(reply));
                }
                break;
                
            case 0x1C:  /* SOCK_CLOSE_WAIT */
                usart_debug("\r\n*** CLIENT DISCONNECTED ***\r\n");
                W5500_CloseSocket(0);
                connected = 0;
                break;
                
            case 0x00:  /* SOCK_CLOSED */
                if (connected) {
                    usart_debug("\r\n*** CONNECTION LOST ***\r\n");
                    connected = 0;
                }
                // Server restart
                W5500_TCP_Server_Init(0, 5000);
                break;
                
            default:
                if (connected) {
                    connected = 0;
                }
                break;
        }
        
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

/* ============================================================================
 * Task 2: GPSPollTask - Poll GPS data
 * ========================================================================== */
void vGPSPollTask(void *pvParam)
{
    (void)pvParam;
    usart_debug("[GPSPollTask] started\r\n");
    
    uint32_t last_gps_print = 0;
    uint8_t gps_fix = 0;

    for (;;) {
        xSemaphoreTake(xUSART6Mutex, portMAX_DELAY);
        gps_poll();
        xSemaphoreGive(xUSART6Mutex);
        
        // Print GPS status every 10 seconds
        if (ms_ticks - last_gps_print >= 10000) {
            last_gps_print = ms_ticks;
            
            xSemaphoreTake(xUSART6Mutex, portMAX_DELAY);
            if (gps_data.valid) {
                if (!gps_fix) {
                    usart_debug("\r\n*** GPS FIX ACQUIRED ***\r\n");
                    gps_fix = 1;
                }
                
                double lat = gps_data.lat_i / 1000000.0;
                double lon = gps_data.lon_i / 1000000.0;
                double spd = gps_data.speed_cms * 0.036;
                
                usart_debug("[GPS] %02d:%02d:%02d | LAT: %.6f %c | LON: %.6f %c | SPD: %.2f km/h\r\n",
                    gps_data.hour, gps_data.minute, gps_data.second,
                    lat, gps_data.ns, lon, gps_data.ew, spd);
            } else {
                if (gps_fix) {
                    usart_debug("\r\n*** GPS FIX LOST ***\r\n");
                    gps_fix = 0;
                } else {
                    usart_debug("[GPS] Waiting for fix...\r\n");
                }
            }
            xSemaphoreGive(xUSART6Mutex);
        }
        
        vTaskDelay(pdMS_TO_TICKS(100));  // Poll GPS at 10Hz
    }
}

/* ============================================================================
 * Main function
 * ========================================================================== */
int main(void)
{
    /* Initialize hardware */
    USART2_Init();
    print_boot_info("JUNCTION BOX - WITH GPS");
    
    /* SPI2 initialize (for W5500) */
    SPI2_Init();
    
    /* GPS initialize */
    gps_usart6_init();
    vTaskDelay(pdMS_TO_TICKS(500));  // Give GPS time to initialize
    gps_rtc_init();
    
    /* 1 ms SysTick */
    SysTick_Config(SystemCoreClock / 1000);
    
    usart_debug("\r\n========================================\r\n");
    usart_debug("JUNCTION BOX WITH GPS\r\n");
    usart_debug("FreeRTOS Tasks: TCP Server + GPS\r\n");
    usart_debug("========================================\r\n");
    
    usart_debug("Hardware initialized\r\n");
    
    /* Create mutex for GPS */
    xUSART6Mutex = xSemaphoreCreateMutex();
    if (xUSART6Mutex == NULL) {
        usart_debug("FATAL: Failed to create GPS mutex\r\n");
        for (;;);
    }
    
    /* Small delay for stability */
    for (int i = 0; i < 10; i++) {
        delay();
    }
    
    /* ===== TASKS CREATION ===== */
    
    /* Task 1: TCPSimpleTask - Priority 2 */
    if (xTaskCreate(vTCPSimpleTask, "TCP", 512, NULL, 2, NULL) != pdPASS) {
        usart_debug("Failed to create TCPSimpleTask\r\n");
    } else {
        usart_debug("TCPSimpleTask created\r\n");
    }
    
    /* Task 2: GPSPollTask - Priority 1 (lower than TCP) */
    if (xTaskCreate(vGPSPollTask, "GPS", 256, NULL, 1, NULL) != pdPASS) {
        usart_debug("Failed to create GPSPollTask\r\n");
    } else {
        usart_debug("GPSPollTask created\r\n");
    }
    
    usart_debug("\r\nAll tasks created. Starting scheduler...\r\n");
    usart_debug("========================================\r\n\r\n");
    
    /* Start scheduler */
    xSchedulerStarted = 1;
    vTaskStartScheduler();
    
    /* Should never reach here */
    usart_debug("FATAL: Scheduler returned\r\n");
    for (;;);
}