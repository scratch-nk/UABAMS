#ifndef FREERTOS_CONFIG_H
#define FREERTOS_CONFIG_H

/*
 * FreeRTOSConfig.h — kernel configuration for STM32F411RE (Cortex-M4F)
 *
 * CPU_CLOCK_MHZ is passed in from the Makefile via -DCPU_CLOCK_MHZ=<n>.
 * configCPU_CLOCK_HZ is derived from it so the two always stay in sync.
 * Override at build time: make CPU_CLOCK_MHZ=16 bringup
 */

/* ── Clock ─────────────────────────────────────────────────────────────── */
#ifndef CPU_CLOCK_MHZ
#  define CPU_CLOCK_MHZ 96
#endif
#define configCPU_CLOCK_HZ      ((uint32_t)(CPU_CLOCK_MHZ * 1000000UL))
#define configTICK_RATE_HZ      1000        /* 1 ms tick                    */

/* ── Scheduler ─────────────────────────────────────────────────────────── */
#define configUSE_PREEMPTION                    1
#define configUSE_PORT_OPTIMISED_TASK_SELECTION 1
#define configUSE_IDLE_HOOK                     0
#define configUSE_TICK_HOOK                     0
#define configMAX_PRIORITIES                    5
#define configMINIMAL_STACK_SIZE                128  /* words — Idle task   */
#define configUSE_16_BIT_TICKS                  0

/* ── Heap (heap_4.c) ────────────────────────────────────────────────────── *
 * 20 KB covers all tasks + TCBs + queue + mutexes with ~11 KB to spare.    *
 * See README.FreeRTOS.md §Step 2 for the full memory estimate.             */
#define configTOTAL_HEAP_SIZE                   (20 * 1024)
#define configSUPPORT_DYNAMIC_ALLOCATION        1

/* ── Synchronisation primitives ─────────────────────────────────────────── */
#define configUSE_MUTEXES                       1
#define configUSE_RECURSIVE_MUTEXES             0
#define configUSE_COUNTING_SEMAPHORES           0

/* ── Software timers ────────────────────────────────────────────────────── *
 * Disabled — periodic work is done via vTaskDelayUntil in each task loop.  *
 * Health checks (W5500 reconnect, ADXL345 verify) are inline in tasks.     */
#define configUSE_TIMERS                        0

/* ── Safety hooks ───────────────────────────────────────────────────────── */
#define configUSE_MALLOC_FAILED_HOOK            1  /* heap exhausted        */
#define configCHECK_FOR_STACK_OVERFLOW          2  /* method 2: watermark   */

/* ── Cortex-M interrupt priorities ─────────────────────────────────────── *
 * STM32F411 uses 4 priority bits (16 levels, 0 = highest).                *
 * FreeRTOS syscall ISRs must have priority >= MAX_SYSCALL (i.e. numerically*
 * equal or higher number). Kernel itself runs at LOWEST (15 << 4 = 0xF0). */
#define configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY    5
#define configLIBRARY_LOWEST_INTERRUPT_PRIORITY         15
#define configKERNEL_INTERRUPT_PRIORITY         (configLIBRARY_LOWEST_INTERRUPT_PRIORITY << 4)
#define configMAX_SYSCALL_INTERRUPT_PRIORITY    (configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY << 4)

/* ── ISR name aliases ────────────────────────────────────────────────────── *
 * FreeRTOS ARM_CM4F port uses names vPortSVCHandler / xPortPendSVHandler.   *
 * startup.s has SVC_Handler and PendSV_Handler as weak → Default_Handler.   *
 * These macros rename the port symbols so the linker overrides the weaks.   *
 * SysTick_Handler is NOT aliased here — it is a combined handler in main.c  *
 * that calls xPortSysTickHandler() directly.                                 */
#define vPortSVCHandler     SVC_Handler
#define xPortPendSVHandler  PendSV_Handler

/* ── Optional API ───────────────────────────────────────────────────────── */
#define INCLUDE_vTaskDelay                      1
#define INCLUDE_vTaskDelayUntil                 1
#define INCLUDE_vTaskDelete                     1
#define INCLUDE_uxTaskGetStackHighWaterMark     1
#define INCLUDE_xTaskGetTickCount               1

#endif /* FREERTOS_CONFIG_H */
