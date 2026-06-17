#include "stm32f4xx.h"
#include "spi_eth.h"
#include "w5500.h"
#include "usart_debug.h"
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
#include "semphr.h"

#include "gps_health.h"

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

//  Task 2: TCPSimpleTask
void vTCPSimpleTask(void *pvParam)
{
    (void)pvParam;
    uint8_t rx_buf[512];
    uint8_t connected = 0;

    usart_debug("[TCPSimpleTask] started\r\n");

    // W5500
    W5500_RST_LOW();
    vTaskDelay(pdMS_TO_TICKS(100));
    W5500_RST_HIGH();
    vTaskDelay(pdMS_TO_TICKS(300));

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
    for (;;) {
        uint8_t status = W5500_GetSocketStatus(0);

        switch (status) {
            case 0x17:  // SOCK_ESTABLISHED
                if (!connected) {
                    usart_debug("\r\n*** CLIENT CONNECTED! ***\r\n");
                    connected = 1;
                }
                int len;
                while(
                 len = W5500_Recv(0, rx_buf, sizeof(rx_buf) > 0))
                 {
                    rx_buf[len] = '\0';
                    usart_debug((char*)rx_buf);
                 }
                if (len > 0) {
                    rx_buf[len] = '\0';
                    usart_debug("\r\n[RECEIVED %d bytes]\r\n", len);
                    usart_debug("Data: %s\r\n", rx_buf);
                    // char *reply = "ACK from Junction Box\r\n";
                    // W5500_Send(0, (uint8_t*)reply, strlen(reply));
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

    uint8_t  ch;
    uint8_t  prev_valid      = 0;
    uint32_t bytes_rx        = 0;
    uint32_t last_print_tick = 0;

    usart_debug("[GPSTask] started\r\n");

    for (;;)
    {
        // Block up to 5 s waiting for a byte from the USART6 ISR.
        // If the timeout fires with bytes_rx still 0, the module is absent/unwired.
        if (xQueueReceive(gpsQueue, &ch, pdMS_TO_TICKS(5000)) == pdTRUE)
        {
            gps_feed((char)ch);
            bytes_rx++;
        }

        uint32_t now = ms_ticks;

        if (gps_data.valid)
        {
            if (!prev_valid)
            {
                usart_debug("\r\n[GPS] FIX ACQUIRED\r\n");
                prev_valid      = 1;
                last_print_tick = now;
            }

            // Print position once per second
            if ((now - last_print_tick) >= 1000)
            {
                last_print_tick = now;
                usart_debug("LAT:%ld%c LON:%ld%c  %02d:%02d:%02d %02d-%02d-%04d  SPD:%lu cm/s\r\n",
                    gps_data.lat_i, gps_data.ns,
                    gps_data.lon_i, gps_data.ew,
                    gps_data.hour, gps_data.minute, gps_data.second,
                    gps_data.day,  gps_data.month,  gps_data.year,
                    gps_data.speed_cms);
            }
        }
        else
        {
            if (prev_valid)
            {
                usart_debug("[GPS] FIX LOST\r\n");
                prev_valid      = 0;
                last_print_tick = now;
            }

            // Print diagnostic once every 5 s — two cases:
            //   bytes_rx == 0 → no serial data at all (wiring/power problem)
            //   bytes_rx  > 0 → data arriving but no satellite fix yet
            if ((now - last_print_tick) >= 5000)
            {
                last_print_tick = now;
                if (bytes_rx == 0)
                    usart_debug("[GPS] NO SIGNAL -- check PC7 wiring (SR:0x%04x)\r\n",
                        (unsigned)USART6->SR);
                else
                    usart_debug("[GPS] WAITING FOR FIX  (bytes:%lu  SR:0x%04x)\r\n",
                        bytes_rx, (unsigned)USART6->SR);
            }
        }
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
            // 🔥 DEBUG (IMPORTANT)
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

                idx = 0; // reset buffer
            }
        }
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

    // Initialize hardware
    USART2_Init();

    /* Queue create */
    uartQueue = xQueueCreate(32, sizeof(uint8_t));
    /* GPS queue + USART6 RX interrupt */
    gpsQueue = xQueueCreate(128, sizeof(uint8_t));

    /* UART RX interrupt enable */
    USART2->CR1 |= USART_CR1_RE;
    USART2->CR1 |= USART_CR1_RXNEIE;
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
    if (xTaskCreate(vTCPSimpleTask, "TCP", 512, NULL, 2, NULL) != pdPASS) {
        usart_debug("Failed to create TCPSimpleTask\r\n");
    } else {
        usart_debug("TCPSimpleTask created\r\n");
    }

    xTaskCreate(vGPSTask, "GPS", 512, NULL, 1, NULL);

    xTaskCreate(vUartTask, "UART", 512, NULL, 3, NULL);
    usart_debug("\r\nAll tasks created. Starting scheduler...\r\n");
    usart_debug("========================================\r\n\r\n");


    // Start scheduler
    xSchedulerStarted = 1;
    vTaskStartScheduler();

    // Should never reach here
    usart_debug("FATAL: Scheduler returned\r\n");
    for (;;);
}
