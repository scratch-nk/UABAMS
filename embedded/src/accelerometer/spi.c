#include "spi.h"
#include "stm32f4xx.h"

/*
 SPI1 PINS (STM32F411)
 --------------------
 PA4  -> CS (Manual GPIO)
 PA5  -> SCK
 PA6  -> MISO
 PA7  -> MOSI
*/

void spi1_init(void)
{
    /* Enable clocks */
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB2ENR |= RCC_APB2ENR_SPI1EN;

    /* PA5,6,7 -> AF mode */
    GPIOA->MODER &= ~(0xFC00);
    GPIOA->MODER |=  (0xA800);

    /* High speed */
    GPIOA->OSPEEDR |= (3 << 10) | (3 << 12) | (3 << 14);

    /* AF5 */
    GPIOA->AFR[0] &= ~((0xF << 20) | (0xF << 24) | (0xF << 28));
    GPIOA->AFR[0] |=  (5 << 20) | (5 << 24) | (5 << 28);

    /* PA4 as GPIO output (CS1 HIGH idle) */
    GPIOA->MODER &= ~(3 << 8);
    GPIOA->MODER |=  (1 << 8);
    GPIOA->ODR   |=  (1 << 4);

    // PA3 as GPIO output (CS2)
// -------- CS2 : PA1 --------
GPIOA->MODER &= ~(3 << (1 * 2));     // clear
GPIOA->MODER |=  (1 << (1 * 2));     // output mode

GPIOA->OSPEEDR |= (3 << (1 * 2));    // high speed
GPIOA->PUPDR   &= ~(3 << (1 * 2));   // no pull

GPIOA->ODR |= (1 << 1);              // CS HIGH (idle)



    /* SPI CONFIG */
    SPI1->CR1 = 0;

    SPI1->CR1 |=
        SPI_CR1_MSTR |      // Master
        SPI_CR1_SSM  |      // Software NSS
        SPI_CR1_SSI  |      // NSS high internally
        SPI_CR1_BR_1 | SPI_CR1_BR_0 |  // fPCLK/64 (safe start)
        SPI_CR1_CPOL |      // CPOL=1
        SPI_CR1_CPHA;       // CPHA=1  → MODE 3

    SPI1->CR1 |= SPI_CR1_SPE;   // Enable SPI
}

/* CS control */
void spi1_cs_low(void)
{
    GPIOA->ODR &= ~(1 << 4);
}

void spi1_cs_high(void)
{
    GPIOA->ODR |= (1 << 4);
}

/* SPI transfer */
uint8_t spi1_txrx(uint8_t data)
{
    while (!(SPI1->SR & SPI_SR_TXE));
    SPI1->DR = data;

    while (!(SPI1->SR & SPI_SR_RXNE));
    return SPI1->DR;
}


