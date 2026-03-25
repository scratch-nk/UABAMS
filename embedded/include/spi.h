#ifndef _SPI_H_
#define _SPI_H_

#include <stdint.h>

/* SPI Init */
void spi1_init(void);

/* SPI Transfer */
uint8_t spi1_txrx(uint8_t data);

/* Chip Select Control */
void spi1_cs_low(void);
void spi1_cs_high(void);

#define ADXL1_CS_LOW()   (GPIOA->BSRR = (1 << (4 + 16))) // PA4
#define ADXL1_CS_HIGH()  (GPIOA->BSRR = (1 << 4))

#define ADXL2_CS_LOW()   (GPIOA->BSRR = (1 << (1 + 16))) // PA1
#define ADXL2_CS_HIGH()  (GPIOA->BSRR = (1 << 1))


#endif
