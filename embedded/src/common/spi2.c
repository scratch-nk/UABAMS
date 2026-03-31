/* spi2.c -- SPI channel for Ethernet. Same for both boards
 *
 */
#include "spi_eth.h"

void SPI2_Init(void)
{
    /* Enable clocks */
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOBEN;
    RCC->APB1ENR |= RCC_APB1ENR_SPI2EN;

    /* PB13=SCK, PB14=MISO, PB15=MOSI (AF5) */
    GPIOB->MODER &= ~(
        (3 << (13*2)) |
        (3 << (14*2)) |
        (3 << (15*2))
    );

    GPIOB->MODER |= (
        (2 << (13*2)) |
        (2 << (14*2)) |
        (2 << (15*2))
    );

    GPIOB->AFR[1] &= ~(
        (0xF << 20) |
        (0xF << 24) |
        (0xF << 28)
    );

    GPIOB->AFR[1] |= (
        (5 << 20) |   // PB13
        (5 << 24) |   // PB14
        (5 << 28)     // PB15
    );

    /* CS = PB12 (GPIO Output) */
    GPIOB->MODER &= ~(3 << (12*2));
    GPIOB->MODER |=  (1 << (12*2));
    GPIOB->ODR   |=  (1 << 12);     // CS HIGH

    /* RST = PB3 (GPIO Output) */
    GPIOB->MODER &= ~(3 << (3*2));
    GPIOB->MODER |=  (1 << (3*2));
    GPIOB->ODR   |=  (1 << 3);      // RST HIGH

    /* SPI2 CONFIG – MODE 3 (MANDATORY for W5500) */
    SPI2->CR1 = 0;
    SPI2->CR1 =
        SPI_CR1_MSTR |        // Master
        SPI_CR1_SSM  |        // Software NSS
        SPI_CR1_SSI  |
        SPI_CR1_BR_2 |        // Slow speed (/32) – SAFE
        SPI_CR1_CPOL |        // MODE 3
        SPI_CR1_CPHA |
        SPI_CR1_SPE;          // Enable SPI
}

uint8_t SPI2_Transfer(uint8_t data)
{
    while (!(SPI2->SR & SPI_SR_TXE));
    *(__IO uint8_t *)&SPI2->DR = data;

    while (!(SPI2->SR & SPI_SR_RXNE));
    return *(__IO uint8_t *)&SPI2->DR;
}
