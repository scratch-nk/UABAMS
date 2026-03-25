#ifndef SPI2_H
#define SPI2_H

#include "stm32f411xe.h"
#include <stdint.h>

void SPI2_Init(void);
uint8_t SPI2_Transfer(uint8_t data);

#endif