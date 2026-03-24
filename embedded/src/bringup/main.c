/*
 * bringup/main.c — minimal FreeRTOS boot test for STM32F411RE Nucleo
 *
 * Phase A: two tasks run concurrently to verify the RTOS itself:
 *   BlinkTask — toggles LD2 (PA5) every 500 ms
 *   UARTTask  — prints a heartbeat over USART2 every 1000 ms
 *
 * Verifies: PLL (96 MHz), FreeRTOS scheduler, SysTick, heap allocation.
 * No SPI, no accelerometer, no W5500 — isolates the RTOS from peripherals.
 *
 * Once Phase A passes on hardware, add vNetworkTask below for Phase A2
 * (Ethernet bringup). See README.FreeRTOS.md §Phase A2.
 */

#include "FreeRTOS.h"
#include "task.h"
#include "stm32f4xx.h"
#include "usart_debug.h"
#include "clock_config.h"
#include "led_debug.h"   /* LED_Init(), LED_Toggle() from src/common/led_debug.c */

/* ── Tasks ──────────────────────────────────────────────────────────────── */
static void vBlinkTask(void *pvParam)
{
    (void)pvParam;
    for (;;) {
        LED_Toggle();                        /* uses BSRR — clean toggle      */
        vTaskDelay(pdMS_TO_TICKS(500));      /* yield — LED on/off at 1 Hz   */
    }
}

static void vUARTTask(void *pvParam)
{
    (void)pvParam;
    TickType_t xLast = xTaskGetTickCount();
    for (;;) {
        usart_debug("[FreeRTOS bringup] tick\r\n");
        vTaskDelayUntil(&xLast, pdMS_TO_TICKS(1000));  /* accurate 1 s period */
    }
}

/* ── SysTick ────────────────────────────────────────────────────────────── *
 * delay.c is NOT compiled for the bringup target, so no SysTick conflict.  *
 * This handler only drives the FreeRTOS tick.                              */
void SysTick_Handler(void)
{
    extern void xPortSysTickHandler(void);
    xPortSysTickHandler();
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
    /* PLL → 96 MHz. Must be first — USART baud divisor depends on PCLK1.   */
    SystemClock_Config();
    USART2_Init();
    // LED_Init();    /* from led_debug.c — clears mode bits before setting output */
    LED_PWM_Init();    /* from led_debug.c — clears mode bits before setting output */

    usart_debug("\r\nUABAMS BOX 1 — FreeRTOS v10.6.2 bringup\r\n");
    usart_debug("Phase A: LED blink + UART heartbeat\r\n");
    usart_debug("Scheduler starting...\r\n");

    LED_SetBrightness (50); // 50% brighness
    LED_On();

    /* 128 words = 512 B per task — sufficient for vTaskDelay + usart_debug  */
    xTaskCreate(vBlinkTask, "Blink", 128, NULL, 1, NULL);
    xTaskCreate(vUARTTask,  "UART",  128, NULL, 1, NULL);

    vTaskStartScheduler();  /* never returns if heap is sufficient           */

    /* Reached only if heap too small for idle task — increase configTOTAL_HEAP_SIZE */
    usart_debug("FATAL: scheduler returned\r\n");
    for (;;);
}
