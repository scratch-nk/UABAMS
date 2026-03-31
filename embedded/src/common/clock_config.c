/*
 * clock_config.c — STM32F411RE PLL setup
 *
 * Only does work when compiled with -DCPU_CLOCK_MHZ=96 (the default for the
 * accelerometer and bringup targets). At CPU_CLOCK_MHZ=16 the function is a
 * no-op — HSI at 16 MHz is already active after reset.
 *
 * Clock tree (CPU_CLOCK_MHZ == 96):
 *
 *   HSI (16 MHz internal RC, factory-trimmed ±1%)
 *     └─ ÷ PLL_M(16)   →   1 MHz  VCO input  [allowed range: 1–2 MHz]
 *          └─ × PLL_N(192) → 192 MHz  VCO output [range: 100–432 MHz]
 *               ├─ ÷ PLL_P(2)  →  96 MHz  SYSCLK  (CPU clock)        ✓
 *               └─ ÷ PLL_Q(4)  →  48 MHz  USB FS clock (must = 48)   ✓
 *
 *   AHB  prescaler ÷1  → HCLK  =  96 MHz  (max 100 MHz)  ✓
 *   APB1 prescaler ÷2  → PCLK1 =  48 MHz  (max  50 MHz)  ✓
 *   APB2 prescaler ÷1  → PCLK2 =  96 MHz  (max 100 MHz)  ✓
 *
 *   Flash latency = 3 wait states
 *     (RM0383 §3.4 Table 7: required for 90–100 MHz at 2.7–3.6 V)
 *
 * Why 96 MHz and not 100 MHz (the max)?
 *   USB FS requires exactly 48 MHz from the PLL. PLL_Q=4 gives 192/4=48 ✓.
 *   At 100 MHz the USB math doesn't divide cleanly from the same VCO.
 *   96 MHz is ST's standard recommendation for USB-capable configurations.
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
    FLASH->ACR = FLASH_ACR_PRFTEN        /* prefetch buffer — improves IPC   */
               | FLASH_ACR_ICEN          /* instruction cache (1 KB, 8-way)  */
               | FLASH_ACR_DCEN          /* data cache      (1 KB, 4-way)    */
               | FLASH_ACR_LATENCY_3WS;  /* 3 wait-states @ 96 MHz / 3.3 V  */

    /* ── 3. Configure PLL (safe: PLL is off after reset) ─────────────────── *
     * Bit fields per RM0383 §6.3.2 RCC_PLLCFGR:                             *
     *   [5:0]   PLLM  = 16  → VCO input  = 16 MHz / 16 =   1 MHz           *
     *   [14:6]  PLLN  = 192 → VCO output =  1 MHz × 192 = 192 MHz          *
     *   [17:16] PLLP  = 00  → ÷2           SYSCLK  = 192 / 2  =  96 MHz    *
     *   [22]    PLLSRC = 0  → HSI as PLL input (not HSE)                    *
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
     * FreeRTOS port.c reads this to configure SysTick. Must match            *
     * configCPU_CLOCK_HZ in FreeRTOSConfig.h.                               */
    SystemCoreClock = 96000000UL;

#endif /* CPU_CLOCK_MHZ == 96 */
    /*
     * CPU_CLOCK_MHZ == 16: HSI at 16 MHz is already active after reset.
     * SystemCoreClock default in system_stm32f4xx.c is already 16000000UL.
     */
}
