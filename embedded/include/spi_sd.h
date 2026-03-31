#ifndef SPI_H
#define SPI_H

#include "stm32f4xx.h"

/* CS = PA4 */
#define SD_CS_LOW()   (GPIOA->BSRR = (1 << (4 + 16)))
#define SD_CS_HIGH()  (GPIOA->BSRR = (1 << 4))

void spi1_init(void);
uint8_t spi1_txrx(uint8_t data);

#endif