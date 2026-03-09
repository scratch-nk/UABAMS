#ifndef DELAY_H
#define DELAY_H

#include <stdint.h>

void delay_init(void);
void delay_ms(uint32_t ms);
void delay_us(uint32_t us);
uint32_t get_tick_ms(void);

#endif