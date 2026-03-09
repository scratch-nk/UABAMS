# FreeRTOS Migration — Box 1 (Accelerometer Firmware)

## Context

Box 1's bare-metal main loop calls `delay_ms(5)` 100 times per window = **500ms of blocked CPU**.
During that time no networking, GPS requests, or error handling can run. FreeRTOS replaces the
blocking loop with three cooperative tasks; the scheduler runs other tasks during each 5ms
inter-sample gap.

---

## Migration Strategy: Two Phases

| Phase | Goal | Touches accelerometer code? |
|-------|------|-----------------------------|
| **A — Bringup** | Prove FreeRTOS boots on this hardware: LED blink + UART print from two tasks | No |
| **B — Full migration** | Replace bare-metal main loop with 3 tasks (Steps 0–7 below) | Yes |

Phase A lives in its own directory (`embedded/src/bringup/`) and does **not** modify
`accelerometer/main.c` or any driver file. Once Phase A is verified on hardware, Phase B
proceeds with confidence that the RTOS, SysTick, PLL, and heap are all working.

---

## Phase A — Minimal FreeRTOS Bringup (LED + UART)

### Files created — nothing else touched

```
embedded/src/bringup/
    main.c          <- new, ~80 lines
    Makefile        <- new
embedded/include/clock_config.h    <- new (shared with Phase B)
embedded/src/common/clock_config.c <- new (shared with Phase B)
embedded/include/FreeRTOSConfig.h  <- new (shared with Phase B)
embedded/src/freertos/             <- new (FreeRTOS kernel, shared with Phase B)
embedded/include/freertos/         <- new (FreeRTOS headers, shared with Phase B)
```

Common prerequisites that must be done before Phase A:
- Toolchain prefix in root Makefile (Step 0)
- FreeRTOS source downloaded (Step 1)
- `FreeRTOSConfig.h` created (Step 2)
- `clock_config.c/.h` created (Step 0b)
- Linker script heap bump (Step 4)

`delay.c` is **not compiled at all** for the bringup — `vTaskDelay` replaces every
`delay_ms()` call, so `ms_ticks` is not needed and the SysTick conflict does not arise.

### `embedded/src/bringup/main.c`

```c
/*
 * bringup/main.c — minimal FreeRTOS boot test for STM32F411RE Nucleo
 *
 * Two tasks run concurrently:
 *   BlinkTask — toggles LD2 (PA5) every 500 ms
 *   UARTTask  — prints a heartbeat over USART2 every 1000 ms
 *
 * Verifies: PLL (96 MHz), FreeRTOS scheduler, SysTick, heap allocation.
 * No SPI, no accelerometer, no W5500 — nothing that can distract from
 * confirming the RTOS itself works on this hardware.
 */

#include "FreeRTOS.h"
#include "task.h"
#include "stm32f4xx.h"
#include "usart_debug.h"
#include "clock_config.h"

/* ── LED (Nucleo LD2 = PA5) ─────────────────────────────────────────────── */
static void LED_Init(void)
{
    RCC->AHB1ENR  |= RCC_AHB1ENR_GPIOAEN;   /* enable GPIOA clock           */
    GPIOA->MODER  |= (1UL << 10);            /* PA5 bits[11:10] = 01 = output */
}

/* ── Tasks ──────────────────────────────────────────────────────────────── */
static void vBlinkTask(void *pvParam)
{
    (void)pvParam;
    for (;;) {
        GPIOA->ODR ^= (1UL << 5);            /* toggle LD2                   */
        vTaskDelay(pdMS_TO_TICKS(500));       /* yield for 500 ms             */
    }
}

static void vUARTTask(void *pvParam)
{
    (void)pvParam;
    TickType_t xLast = xTaskGetTickCount();
    for (;;) {
        usart_debug("[FreeRTOS bringup] tick\r\n");
        vTaskDelayUntil(&xLast, pdMS_TO_TICKS(1000));  /* 1 s heartbeat     */
    }
}

/* ── SysTick — combined handler (no delay.c compiled here) ─────────────── */
void SysTick_Handler(void)
{
    /* FreeRTOS tick — port.c increments xTickCount, runs scheduler if needed */
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
    SystemClock_Config();          /* PLL -> 96 MHz; updates SystemCoreClock  */
    USART2_Init();                 /* 115200 baud debug UART                  */
    LED_Init();

    usart_debug("\r\nUABAMS BOX 1 — FreeRTOS bringup v10.5.1\r\n");
    usart_debug("Scheduler starting...\r\n");

    /* Stack sizes in words (x4 = bytes). 128 words = 512 B each — plenty   *
     * for tasks that only call vTaskDelay and usart_debug.                  */
    xTaskCreate(vBlinkTask, "Blink", 128, NULL, 1, NULL);
    xTaskCreate(vUARTTask,  "UART",  128, NULL, 1, NULL);

    vTaskStartScheduler();   /* never returns if heap is sufficient          */

    /* Reached only if heap was too small for idle task — should not happen  */
    usart_debug("FATAL: scheduler returned (heap too small?)\r\n");
    for (;;);
}
```

### `embedded/src/bringup/Makefile`

```makefile
# ── Bringup Makefile — FreeRTOS LED+UART smoke test ─────────────────────────
# Usage:
#   make -C embedded/src/bringup
#   make -C embedded/src/bringup CPU_CLOCK_MHZ=16   (HSI direct, no PLL)

PROJECT_ROOT  := $(realpath ../..)
FREERTOS_ROOT := $(PROJECT_ROOT)/src/freertos

CPU_CLOCK_MHZ ?= 96

TARGET  = bringup.elf
BINFILE = bringup.bin
OBJDIR  = obj
FRTOBJD = freertos_obj

# ── Sources ──────────────────────────────────────────────────────────────────
# Only what this test needs — no SPI, no accelerometer, no W5500
SRCS = \
    main.c \
    $(PROJECT_ROOT)/src/common/usart_debug.c \
    $(PROJECT_ROOT)/src/common/clock_config.c \
    $(PROJECT_ROOT)/src/common/system_stm32f4xx.c \
    $(PROJECT_ROOT)/src/common/syscalls.c

ASM_SRCS = $(PROJECT_ROOT)/src/common/startup.s

# ── FreeRTOS objects ─────────────────────────────────────────────────────────
FREERTOS_OBJ = \
    $(FRTOBJD)/tasks.o \
    $(FRTOBJD)/queue.o \
    $(FRTOBJD)/list.o \
    $(FRTOBJD)/timers.o \
    $(FRTOBJD)/port.o \
    $(FRTOBJD)/heap_4.o

# ── Flags ────────────────────────────────────────────────────────────────────
MCU     = -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard
CFLAGS  = $(MCU) -O2 -Wall -DSTM32F411xE -DCPU_CLOCK_MHZ=$(CPU_CLOCK_MHZ)
LDFLAGS = $(MCU) -T$(PROJECT_ROOT)/lib/linker.ld -nostartfiles \
          -Wl,--gc-sections -lm

INCLUDES = \
    -I. \
    -I$(PROJECT_ROOT)/include \
    -I$(PROJECT_ROOT)/include/cmsis/Include \
    -I$(PROJECT_ROOT)/include/freertos \
    -I$(PROJECT_ROOT)/src/freertos/portable/GCC/ARM_CM4F

# ── Build rules ──────────────────────────────────────────────────────────────
OBJ = $(patsubst %.c,$(OBJDIR)/%.o,$(notdir $(SRCS))) \
      $(patsubst %.s,$(OBJDIR)/%.o,$(notdir $(ASM_SRCS)))

all: $(FRTOBJD) $(OBJDIR) $(BINFILE)

$(BINFILE): $(TARGET)
	$(OBJCOPY) -O binary $< $@
	@echo "=== Bringup build OK: $@ ==="

$(TARGET): $(OBJ) $(FREERTOS_OBJ)
	$(CC) $(CFLAGS) $^ $(LDFLAGS) -o $@

# C objects (vpath resolves source directories)
vpath %.c $(sort $(dir $(SRCS)))
$(OBJDIR)/%.o: %.c | $(OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

# Assembly
vpath %.s $(PROJECT_ROOT)/src/common
$(OBJDIR)/startup.o: startup.s | $(OBJDIR)
	$(CC) $(MCU) -c $< -o $@

# FreeRTOS objects
$(FRTOBJD)/tasks.o:  $(FREERTOS_ROOT)/tasks.c  | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@
$(FRTOBJD)/queue.o:  $(FREERTOS_ROOT)/queue.c  | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@
$(FRTOBJD)/list.o:   $(FREERTOS_ROOT)/list.c   | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@
$(FRTOBJD)/timers.o: $(FREERTOS_ROOT)/timers.c | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@
$(FRTOBJD)/port.o:   $(FREERTOS_ROOT)/portable/GCC/ARM_CM4F/port.c | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@
$(FRTOBJD)/heap_4.o: $(FREERTOS_ROOT)/portable/MemMang/heap_4.c    | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(OBJDIR) $(FRTOBJD):
	mkdir -p $@

clean:
	rm -rf $(OBJDIR) $(FRTOBJD) $(TARGET) $(BINFILE)

.PHONY: all clean
```

### Phase A — pass criteria (before proceeding to Phase A2)

| Check | How |
|-------|-----|
| Builds with zero errors | `make -C embedded/src/bringup` |
| LD2 blinks at 1 Hz | Visual — on/off every 500 ms |
| USART prints every second | `screen /dev/ttyACM0 115200` — see `[FreeRTOS bringup] tick` |
| No FATAL messages | Confirms heap OK and no stack overflow |
| SYSCLK = 96 MHz | Add `usart_debug("SYSCLK: 96 MHz\r\n")` in main if needed |

---

## Phase A2 — Ethernet Bringup

Phase A2 adds a third task to `bringup/main.c` that exercises SPI2 and the W5500 under
FreeRTOS. It is kept separate from Phase A so that if something fails you know immediately
whether the problem is the RTOS itself (Phase A) or the SPI2/W5500 path (Phase A2).

**No new files** — extend `embedded/src/bringup/main.c` and its Makefile only.

### Additional sources in `bringup/Makefile`

```makefile
SRCS += \
    $(PROJECT_ROOT)/src/common/spi2.c \
    $(PROJECT_ROOT)/src/common/w5500.c
```

### `vNetworkTask` — add to `bringup/main.c`

```c
static SemaphoreHandle_t xSPI2Mutex;   /* add to globals */

static void vNetworkTask(void *pvParam)
{
    (void)pvParam;

    /* Initialise W5500 once, outside the loop */
    xSemaphoreTake(xSPI2Mutex, portMAX_DELAY);
    SPI2_Init();
    W5500_Reset();
    W5500_Init();
    if (W5500_TCP_Connect("192.168.1.100", 5000) == 0) {
        usart_debug("[NET] TCP connected\r\n");
    } else {
        usart_debug("[NET] TCP connect FAILED\r\n");
    }
    xSemaphoreGive(xSPI2Mutex);

    for (;;) {
        xSemaphoreTake(xSPI2Mutex, portMAX_DELAY);
        W5500_Send((uint8_t *)"hello from FreeRTOS\r\n", 21);
        xSemaphoreGive(xSPI2Mutex);
        vTaskDelay(pdMS_TO_TICKS(2000));   /* send every 2 s */
    }
}
```

### Updated `main()` — create mutex and third task

```c
xSPI2Mutex = xSemaphoreCreateMutex();   /* before xTaskCreate calls */
xTaskCreate(vBlinkTask,   "Blink", 128, NULL, 1, NULL);
xTaskCreate(vUARTTask,    "UART",  128, NULL, 1, NULL);
xTaskCreate(vNetworkTask, "Net",   512, NULL, 2, NULL);  /* higher priority */
```

### Phase A2 — pass criteria (before proceeding to Phase B)

| Check | How |
|-------|-----|
| `[NET] TCP connected` on USART | Confirms SPI2 + W5500 init under RTOS |
| Server receives `hello from FreeRTOS` every 2 s | Confirms mutex + send path |
| LD2 still blinks, UART tick still prints | Confirms no task starvation |

---

## Phase B — Full Migration (Steps 0–7)

Steps below modify the existing accelerometer firmware. Do these only after Phase A2 passes.

---

## Step 0 — Toolchain Path Fix

**File**: `embedded/Makefile`

The compiler is at `/usr/local/bin/gcc-arm-none-eabi-10.3-2021.10/bin/` but is not in PATH.
Add a `TOOLCHAIN_PREFIX` near the top:

```makefile
TOOLCHAIN_PREFIX ?= /usr/local/bin/gcc-arm-none-eabi-10.3-2021.10/bin/
export CC      = $(TOOLCHAIN_PREFIX)arm-none-eabi-gcc
export OBJCOPY = $(TOOLCHAIN_PREFIX)arm-none-eabi-objcopy
```

The `?=` allows overriding from the environment (e.g. if the user adds it to PATH later).

---

## Step 0b — Configurable PLL Clock

**Problem discovered**: `system_stm32f4xx.c` never configures the PLL. After reset the CPU
runs on HSI at **16 MHz**. Setting `configCPU_CLOCK_HZ 96000000UL` with a 16 MHz CPU would
make FreeRTOS configure SysTick 6x too fast — all task delays would be wrong.

**Solution**: add a `SystemClock_Config()` function compiled and called only when
`CPU_CLOCK_MHZ=96` (the default). At `CPU_CLOCK_MHZ=16` the function is a no-op (HSI is
already active after reset).

### Why 96 MHz and not the 100 MHz maximum?

The STM32F411RE has a USB FS peripheral that must be clocked at exactly 48 MHz, derived from
the same PLL. At 96 MHz: `PLL_Q=4` gives `192 / 4 = 48 MHz` exactly. At 100 MHz the USB
math doesn't divide cleanly. 96 MHz is ST's standard recommendation for USB-capable targets.

### Clock sources from the datasheet

| Source | Speed | Used for |
|--------|-------|----------|
| HSI (internal RC) | 16 MHz | Default boot clock, PLL input |
| HSE (crystal) | 4–26 MHz | More accurate PLL input (not used here) |
| LSE (external) | 32.768 kHz | RTC only — irrelevant to CPU clock |
| LSI (internal) | ~32 kHz | RTC / IWDG only — irrelevant to CPU clock |

The 16 MHz HSI feeds the PLL. The PLL multiplies it to 96 MHz. The 32 kHz sources are a
completely separate low-speed domain; they never touch the CPU clock.

**PLL formula:**
```
VCO input  = HSI / PLL_M  = 16 / 16  =   1 MHz  (allowed range: 1-2 MHz)
VCO output = VCO in × PLL_N = 1 × 192 = 192 MHz  (range: 100-432 MHz)
SYSCLK     = VCO out / PLL_P = 192 / 2  =  96 MHz
USB clock  = VCO out / PLL_Q = 192 / 4  =  48 MHz  (must be exactly 48)
```

### Makefile variable (`embedded/src/accelerometer/Makefile`)

```makefile
# ── Clock frequency ───────────────────────────────────────────────────────────
# CPU_CLOCK_MHZ: target CPU speed in MHz.
#   96 (default) — PLL on HSI; full performance + correct USB clock (48 MHz).
#                  Override: make CPU_CLOCK_MHZ=16 accelerometer
#   16            — HSI direct; no PLL, 6x slower. Useful for debug/low-power.
CPU_CLOCK_MHZ ?= 96
CFLAGS += -DCPU_CLOCK_MHZ=$(CPU_CLOCK_MHZ)
```

### `embedded/include/clock_config.h` — new file

```c
#ifndef CLOCK_CONFIG_H
#define CLOCK_CONFIG_H
/*
 * clock_config.h — CPU clock initialisation for STM32F411RE
 * Call SystemClock_Config() once at the top of main(), before any peripheral
 * init or vTaskStartScheduler(). At CPU_CLOCK_MHZ=16 this is a no-op.
 */
void SystemClock_Config(void);
#endif
```

### `embedded/src/common/clock_config.c` — new file

```c
/*
 * clock_config.c — STM32F411RE PLL setup (96 MHz target)
 *
 * Only compiled into the accelerometer target; gps_storage stays at 16 MHz HSI.
 * Compiled for any CPU_CLOCK_MHZ value but only does work when == 96.
 *
 * Clock tree (CPU_CLOCK_MHZ == 96):
 *
 *   HSI (16 MHz internal RC, factory-trimmed ±1%)
 *     └─ ÷ PLL_M(16)  ─→  1 MHz  VCO input  [allowed range: 1-2 MHz]
 *          └─ × PLL_N(192) ─→ 192 MHz  VCO output [range: 100-432 MHz]
 *               ├─ ÷ PLL_P(2) ─→  96 MHz  SYSCLK  (CPU clock)        ✓
 *               └─ ÷ PLL_Q(4) ─→  48 MHz  USB FS clock (must = 48)   ✓
 *
 *   AHB  prescaler ÷1  → HCLK  =  96 MHz  (max 100 MHz)  ✓
 *   APB1 prescaler ÷2  → PCLK1 =  48 MHz  (max  50 MHz)  ✓
 *   APB2 prescaler ÷1  → PCLK2 =  96 MHz  (max 100 MHz)  ✓
 *
 *   Flash latency = 3 wait states
 *     (RM0383 §3.4 Table 7: required for 90-100 MHz at 2.7-3.6 V)
 */

#include "stm32f4xx.h"
#include "clock_config.h"

void SystemClock_Config(void)
{
#if CPU_CLOCK_MHZ == 96

    /* ── 1. Ensure HSI is on and stable ───────────────────────────────────── */
    RCC->CR |= RCC_CR_HSION;
    while (!(RCC->CR & RCC_CR_HSIRDY))
        ;   /* ~2 µs typical */

    /* ── 2. Raise flash latency BEFORE increasing SYSCLK ─────────────────── *
     * Failing to do this first causes hard-faults during the PLL switch.     */
    FLASH->ACR = FLASH_ACR_PRFTEN       /* prefetch buffer — improves IPC    */
               | FLASH_ACR_ICEN         /* instruction cache (1 KB, 8-way)   */
               | FLASH_ACR_DCEN         /* data cache      (1 KB, 4-way)     */
               | FLASH_ACR_LATENCY_3WS; /* 3 wait-states @ 96 MHz / 3.3 V   */

    /* ── 3. Configure PLL (safe: PLL is off after reset) ─────────────────── *
     * Bit fields per RM0383 §6.3.2 RCC_PLLCFGR:                             *
     *   [5:0]   PLLM  = 16  → VCO input  = 16 MHz / 16 =   1 MHz           *
     *   [14:6]  PLLN  = 192 → VCO output = 1 MHz × 192 = 192 MHz           *
     *   [17:16] PLLP  = 00  → ÷2          SYSCLK  = 192 / 2  =  96 MHz     *
     *   [22]    PLLSRC = 0  → HSI selected as PLL input (not HSE)           *
     *   [27:24] PLLQ  = 4   → USB clock  = 192 / 4  =  48 MHz              */
    RCC->PLLCFGR =
          ( 16UL <<  0)   /* PLLM  */
        | (192UL <<  6)   /* PLLN  */
        | (  0UL << 16)   /* PLLP = 0b00 → ÷2 */
        | (  0UL << 22)   /* PLLSRC = HSI */
        | (  4UL << 24);  /* PLLQ  */

    /* ── 4. Enable PLL and wait for lock (~200 µs) ───────────────────────── */
    RCC->CR |= RCC_CR_PLLON;
    while (!(RCC->CR & RCC_CR_PLLRDY))
        ;

    /* ── 5. Set bus prescalers BEFORE switching SYSCLK source ────────────── */
    RCC->CFGR =
          RCC_CFGR_HPRE_DIV1    /* AHB  ÷1 → HCLK  = 96 MHz */
        | RCC_CFGR_PPRE1_DIV2   /* APB1 ÷2 → PCLK1 = 48 MHz */
        | RCC_CFGR_PPRE2_DIV1;  /* APB2 ÷1 → PCLK2 = 96 MHz */

    /* ── 6. Switch SYSCLK to PLL output ──────────────────────────────────── */
    RCC->CFGR |= RCC_CFGR_SW_PLL;
    while ((RCC->CFGR & RCC_CFGR_SWS) != RCC_CFGR_SWS_PLL)
        ;   /* confirm switch complete */

    /* ── 7. Update CMSIS SystemCoreClock global ───────────────────────────── *
     * FreeRTOS port.c, delay.c, and all HAL-style drivers read this value.   *
     * Must match configCPU_CLOCK_HZ in FreeRTOSConfig.h.                    */
    SystemCoreClock = 96000000UL;

#endif /* CPU_CLOCK_MHZ == 96 */
    /*
     * CPU_CLOCK_MHZ == 16 (or any other value):
     * HSI at 16 MHz is already active after reset — nothing to do.
     * SystemCoreClock default in system_stm32f4xx.c is already 16000000UL.
     */
}
```

### `main()` init sequence — `SystemClock_Config()` must be first

```c
int main(void)
{
    SystemClock_Config();   /* PLL to 96 MHz (or no-op at 16 MHz) — FIRST   */
    USART2_Init();          /* baud rate divisor depends on correct PCLK1   */
    spi1_init();
    SPI2_Init();
    SysTick_Config(SystemCoreClock / 1000);  /* uses updated SystemCoreClock */
    /* ... rest of init ... */
}
```

---

## Step 1 — Download FreeRTOS Source

Use **FreeRTOS v10.5.1** (LTS, stable, well-tested on Cortex-M4F).

Download minimal kernel files and place as:
```
embedded/src/freertos/
    tasks.c
    queue.c
    list.c
    timers.c
    portable/
        GCC/ARM_CM4F/
            port.c
            portmacro.h
        MemMang/
            heap_4.c

embedded/include/freertos/
    FreeRTOS.h
    task.h
    queue.h
    semphr.h
    timers.h
    list.h
    projdefs.h
    portable.h
    deprecated_definitions.h
    stack_macros.h
    mpu_wrappers.h
    croutine.h
    event_groups.h
    message_buffer.h
    stream_buffer.h
```

Source: https://github.com/FreeRTOS/FreeRTOS-Kernel — download the repo and copy only the
above files.


## Step 2 — FreeRTOSConfig.h

**New file**: `embedded/include/FreeRTOSConfig.h`

```c
/* CPU clock passed in from Makefile via -DCPU_CLOCK_MHZ=<n>.
 * Defaults to 96 if built without the Makefile variable (shouldn't happen).
 * Must match what SystemClock_Config() actually configures. */
#ifndef CPU_CLOCK_MHZ
#  define CPU_CLOCK_MHZ 96
#endif
#define configCPU_CLOCK_HZ   ((uint32_t)(CPU_CLOCK_MHZ * 1000000UL))

#define configTICK_RATE_HZ              1000         /* 1ms tick */
#define configMAX_PRIORITIES            5
#define configMINIMAL_STACK_SIZE        128          /* words for Idle task */
#define configTOTAL_HEAP_SIZE           (20 * 1024)  /* 20KB — see memory estimate below */
#define configUSE_PREEMPTION            1
#define configUSE_PORT_OPTIMISED_TASK_SELECTION 1
#define configUSE_MUTEXES               1
#define configUSE_RECURSIVE_MUTEXES     0
#define configUSE_COUNTING_SEMAPHORES   0
#define configUSE_TIMERS                0            /* not needed — periodic work done in tasks */
#define configUSE_IDLE_HOOK             0
#define configUSE_TICK_HOOK             0
#define configUSE_MALLOC_FAILED_HOOK    1
#define configCHECK_FOR_STACK_OVERFLOW  2            /* catches stack overflows */
#define configUSE_16_BIT_TICKS          0
#define configSUPPORT_DYNAMIC_ALLOCATION 1

/* Cortex-M interrupt priority — must be >= configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY */
#define configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY 5
#define configLIBRARY_LOWEST_INTERRUPT_PRIORITY       15
#define configKERNEL_INTERRUPT_PRIORITY     (configLIBRARY_LOWEST_INTERRUPT_PRIORITY << 4)
#define configMAX_SYSCALL_INTERRUPT_PRIORITY (configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY << 4)

/* Required API includes */
#define INCLUDE_vTaskDelay                  1
#define INCLUDE_vTaskDelayUntil             1
#define INCLUDE_uxTaskGetStackHighWaterMark 1
#define INCLUDE_xTaskGetTickCount           1
```

### Note on `configUSE_TIMERS 0`

This disables **FreeRTOS software timers** (the `xTimerCreate` API and its daemon task).
It has no effect on hardware SPI peripherals or the SysTick timer. Periodic work (200Hz
sampling, 1s GPS poll) is handled by `vTaskDelayUntil`/`vTaskDelay` in each task's loop —
no software timer callbacks needed. Health checks (W5500 reconnect, ADXL345 DEVID verify)
are done inline in each task after a failed operation.

### Memory Estimate (20KB heap)

| Item | Size |
|------|------|
| AccelTask stack (1024 words) | 4096 B |
| NetworkTask stack (512 words) | 2048 B |
| GpsRequestTask stack (256 words) | 1024 B |
| Idle task stack (128 words) | 512 B |
| 4x TCBs (~100B each) | 400 B |
| Queue (4 x ~190B WindowStats_t) | 800 B |
| 2x Mutex structs | 80 B |
| **Total** | **~9 KB** |

20KB leaves ~11KB free — safe margin.

---

## Step 3 — Resolve SysTick Conflict

**Problem**: `delay.c` defines `SysTick_Handler` as a strong symbol. FreeRTOS `port.c` provides
`xPortSysTickHandler` (the FreeRTOS tick logic) and expects to own `SysTick_Handler`.

**Solution**: Remove `delay.c` from `COMMON_SRC` in the root Makefile. Each sub-project compiles
it independently:
- **accelerometer target**: compiles `delay.c` with `-DUSE_FREERTOS_SYSTICK` (suppresses `SysTick_Handler` in delay.c); a combined handler in `main.c` calls both `ms_ticks++` AND `xPortSysTickHandler()`.
- **gps_storage target**: compiles `delay.c` locally without the flag — behaviour unchanged.

### 3a. `embedded/src/common/delay.c` change
Wrap the handler in a guard:
```c
#ifndef USE_FREERTOS_SYSTICK
void SysTick_Handler(void)
{
    ms_ticks++;
}
#endif
```

### 3b. `embedded/include/delay.h` — add missing declaration
```c
uint32_t get_tick_ms(void);   /* was missing from header */
```

### 3c. Combined handler in `main.c` (accelerometer only)
```c
extern void xPortSysTickHandler(void);
extern volatile uint32_t ms_ticks;

void SysTick_Handler(void)
{
    ms_ticks++;
    xPortSysTickHandler();
}
```

---

## Step 4 — Linker Script Update

**File**: `embedded/lib/linker.ld`

Increase newlib sbrk heap (used by `syscalls.c`):
```
_Min_Heap_Size  = 0x800;   /* 2 KB (was 1 KB) */
_Min_Stack_Size = 0x800;   /* unchanged (MSP, pre-scheduler only) */
```

FreeRTOS heap (20KB `ucHeap` array in heap_4.c) lives in `.bss` — no linker script change
needed for it. Total RAM budget: code ~20KB + bss ~25KB (includes ucHeap) + stack 2KB = ~47KB
of 128KB. Plenty of room.

---

## Step 5 — Makefile Changes

### 5a. `embedded/Makefile`
- Add `TOOLCHAIN_PREFIX` (Step 0)
- Remove `delay.c` from `COMMON_SRC`:
```makefile
COMMON_SRC = \
 usart_debug.c \
 spi2.c \
 w5500.c \
 system_stm32f4xx.c \
 startup.s \
 syscalls.c
```

### 5b. `embedded/src/accelerometer/Makefile` — full rewrite
Key additions:
```makefile
FREERTOS_ROOT := $(PROJECT_ROOT)/src/freertos
INCLUDES += -I$(PROJECT_ROOT)/include/freertos

# ── Clock frequency ───────────────────────────────────────────────────────────
# CPU_CLOCK_MHZ: target CPU speed in MHz.
#   96 (default) — PLL on HSI; full performance + correct USB clock (48 MHz).
#   16            — HSI direct; no PLL, 6x slower. Useful for debug/low-power.
# Override: make CPU_CLOCK_MHZ=16 accelerometer
CPU_CLOCK_MHZ ?= 96
CFLAGS += -DCPU_CLOCK_MHZ=$(CPU_CLOCK_MHZ)

# delay.c compiled with FreeRTOS flag (suppresses its SysTick_Handler)
DELAY_OBJ = $(OBJDIR)/delay.o
$(DELAY_OBJ): $(PROJECT_ROOT)/src/common/delay.c | $(OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -DUSE_FREERTOS_SYSTICK -c $< -o $@

# FreeRTOS objects in separate dir to avoid name collisions
FREERTOS_OBJDIR = freertos_obj
FREERTOS_OBJ = \
    $(FREERTOS_OBJDIR)/tasks.o     $(FREERTOS_OBJDIR)/queue.o \
    $(FREERTOS_OBJDIR)/list.o      $(FREERTOS_OBJDIR)/timers.o \
    $(FREERTOS_OBJDIR)/port.o      $(FREERTOS_OBJDIR)/heap_4.o

# Individual rules for each FreeRTOS .c (explicit paths needed due to non-unique basenames)
$(FREERTOS_OBJDIR)/port.o:   $(FREERTOS_ROOT)/portable/GCC/ARM_CM4F/port.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@
$(FREERTOS_OBJDIR)/heap_4.o: $(FREERTOS_ROOT)/portable/MemMang/heap_4.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@
# ... (tasks, queue, list, timers follow same pattern)

$(TARGET): $(OBJ) $(DELAY_OBJ) $(FREERTOS_OBJ)
	$(CC) $(CFLAGS) $^ $(COMMON_OBJ) $(LDFLAGS) -o $@

clean:
	rm -rf $(OBJDIR)/* $(FREERTOS_OBJDIR)/* *.elf *.bin
```

### 5c. `embedded/src/gps_storage/Makefile`
Add local delay.c compilation (replaces the now-removed common delay.o):
```makefile
DELAY_OBJ = $(OBJDIR)/delay.o
$(DELAY_OBJ): $(PROJECT_ROOT)/src/common/delay.c | $(OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(TARGET): $(OBJ) $(DELAY_OBJ)
	$(CC) $(CFLAGS) $(OBJ) $(DELAY_OBJ) $(COMMON_OBJ) $(LDFLAGS) -o $@
```

---

## Step 6 — main.c Restructure

**File**: `embedded/src/accelerometer/main.c` — full rewrite.

### Types and globals
```c
typedef struct {
    float s1_rms_v, s1_rms_l, s1_sd_v, s1_sd_l, s1_p2p_v, s1_p2p_l, s1_peak; char s1_vib[8];
    float s2_rms_v, s2_rms_l, s2_sd_v, s2_sd_l, s2_p2p_v, s2_p2p_l, s2_peak; char s2_vib[8];
    float s1_last_x, s1_last_y, s1_last_z;
    float s2_last_x, s2_last_y, s2_last_z;
} WindowStats_t;

static QueueHandle_t     xAccelQueue;   /* AccelTask -> NetworkTask */
static SemaphoreHandle_t xGpsMutex;     /* protects g_gps_snapshot */
static SemaphoreHandle_t xSPI2Mutex;    /* protects SPI2/W5500 bus */
```

### Task Priorities
| Task | Priority | Stack words |
|------|----------|-------------|
| AccelTask | 4 (HIGH) | 1024 |
| NetworkTask | 3 (MEDIUM) | 512 |
| GpsRequestTask | 2 (LOW) | 256 |

### AccelTask logic
- `vTaskDelayUntil(&xLastSampleTime, pdMS_TO_TICKS(5))` per sample (accurate 200Hz)
- Arrays `s1_x[100]`, `s1_z[100]`, `s2_x[100]`, `s2_z[100]` are **stack-local** (1600B) — accounted for in 4KB stack
- Computes RMS, SD, P2P, peak, calls `vib_level()` — all identical logic to original
- Pushes `WindowStats_t` to `xAccelQueue` with timeout=0 (drop if full — NetworkTask drains faster)

### NetworkTask logic
- `xQueueReceive(xAccelQueue, &stats, portMAX_DELAY)` — blocks until data ready
- Takes `xSPI2Mutex` before W5500 sends
- Formats identical TCP text output as original (no protocol change)
- Sends event alert if peak >= EVENT_TH
- On send failure: reconnect inline (no timer needed)

### GpsRequestTask logic
- `vTaskDelay(pdMS_TO_TICKS(1000))` — 1s period
- Takes `xSPI2Mutex`, polls `W5500_Recv()` for GPS data from Box 2
- Updates `g_gps_snapshot` under `xGpsMutex`

### main() init sequence
1. `SystemClock_Config()` — PLL to 96 MHz — **must be first**
2. `USART2_Init()`, `spi1_init()`, `SPI2_Init()`
3. `SysTick_Config(SystemCoreClock / 1000)` — 1ms tick (FreeRTOS will reconfigure same rate)
4. W5500 reset + network setup + TCP connect
5. `adxl345_init(1)` + `adxl345_init(2)`
6. `xQueueCreate(4, sizeof(WindowStats_t))`
7. `xSemaphoreCreateMutex()` x 2
8. `xTaskCreate(...)` x 3
9. `vTaskStartScheduler()` — never returns

### Hook implementations
```c
void vApplicationMallocFailedHook(void) { usart_debug("FATAL: heap exhausted\r\n"); for(;;); }
void vApplicationStackOverflowHook(TaskHandle_t xTask, char *pcTaskName) {
    usart_debug("FATAL: stack overflow: "); usart_debug(pcTaskName); for(;;); }
```

---

## Step 7 — startup.s: No Changes Needed

`SVC_Handler` and `PendSV_Handler` are **weak aliases** in startup.s (lines 257-264).
FreeRTOS `port.c` defines them as strong symbols — they override automatically.

`SysTick_Handler` weak alias is overridden by the combined handler in `main.c`.

---

## Verification

### Phase A build
```bash
make -C embedded/src/bringup
```
Flash `bringup.bin`, observe LD2 blinking at 1 Hz and USART printing `[FreeRTOS bringup] tick`
every second. No FATAL messages = heap OK, no stack overflow.

### Phase B build check
```bash
cd embedded && make clean && make accelerometer 2>&1 | grep -E "error:|warning:|undefined"
```
Expected: zero errors. Check for:
- No "multiple definition of SysTick_Handler" — Step 3 worked
- No "undefined reference to xPortSysTickHandler" — port.c compiled
- `firmware.bin` size < 512KB

### gps_storage still builds
```bash
make gps_storage
```
Must compile without errors — delay.c local compilation verifies Step 5c.

### USART boot sequence (115200 baud, `/dev/ttyACM0`)
```
UABAMS BOX 1 BOOT — FreeRTOS v10.5.1
SYSCLK: 96 MHz
TCP connect...
TCP connected
ADXL345 x2 initialized
Starting FreeRTOS scheduler...
[AXLE BOX LEFT - S1]          <- appears within ~500ms
...
```

### Stack watermarks (add temporarily to NetworkTask)
```c
usart_debug("AccelHWM: "); /* uxTaskGetStackHighWaterMark(xAccelHandle) */
```
All watermarks must be > 64 words. If AccelTask watermark < 100 words, increase to 1280 words.

### TCP packet integrity
Verify backend receives packets every ~500ms with same format as before migration.

---

## File Change Summary

### Phase A (bringup) — new files only, nothing modified

| File | Action |
|------|--------|
| `embedded/src/bringup/main.c` | **New** — LED blink + UART heartbeat, two FreeRTOS tasks (Phase A); add `vNetworkTask` + `xSPI2Mutex` for Phase A2 |
| `embedded/src/bringup/Makefile` | **New** — Phase A2 adds `spi2.c` + `w5500.c` to sources |
| `embedded/include/clock_config.h` | **New** — `SystemClock_Config()` declaration |
| `embedded/src/common/clock_config.c` | **New** — PLL init (no-op at 16 MHz) |
| `embedded/include/FreeRTOSConfig.h` | **New** — shared by both phases; clock derived from `CPU_CLOCK_MHZ` |
| `embedded/src/freertos/` | **New directory** — FreeRTOS kernel source |
| `embedded/include/freertos/` | **New directory** — FreeRTOS headers |

### Phase B (full migration) — modifications to existing files

| File | Action |
|------|--------|
| `embedded/Makefile` | Add `TOOLCHAIN_PREFIX`; remove `delay.c` from `COMMON_SRC` |
| `embedded/src/accelerometer/Makefile` | Full rewrite: FreeRTOS objects + local delay.c + `CPU_CLOCK_MHZ` |
| `embedded/src/gps_storage/Makefile` | Add local delay.c compilation |
| `embedded/src/common/delay.c` | Add `#ifndef USE_FREERTOS_SYSTICK` guard |
| `embedded/include/delay.h` | Add `get_tick_ms()` declaration |
| `embedded/lib/linker.ld` | `_Min_Heap_Size` 0x400 -> 0x800 |
| `embedded/src/accelerometer/main.c` | Full rewrite (3 tasks + SysTick bridge + hooks) |

**Do NOT touch**: gps_storage source, all common drivers, adxl345.c, spi.c, startup.s body.
