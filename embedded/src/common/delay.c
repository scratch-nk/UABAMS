#include "delay.h"
#include "stm32f4xx.h"
#include <stdint.h>

 volatile uint32_t ms_ticks = 0;

#ifndef USE_FREERTOS_SYSTICK
void SysTick_Handler(void)
{
    ms_ticks++;
}
#endif

void delay_init(void)
{
    // SysTick already configured in main
}

void delay_ms(uint32_t ms)
{
    uint32_t start = ms_ticks;
    while ((ms_ticks - start) < ms);
}

void delay_us(uint32_t us)
{
    // Simple busy-loop delay (not accurate for large values)
    for (uint32_t i = 0; i < us * 16; i++) {
        __NOP();
    }
}

uint32_t get_tick_ms(void)
{
    return ms_ticks;
}