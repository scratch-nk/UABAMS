#include "spi.h"
#include "stm32f4xx.h"

void spi1_init(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB2ENR |= RCC_APB2ENR_SPI1EN;

    /* PA5, PA6, PA7 → AF5 */
    GPIOA->MODER &= ~((3<<(5*2))|(3<<(6*2))|(3<<(7*2)));
    GPIOA->MODER |=  ((2<<(5*2))|(2<<(6*2))|(2<<(7*2)));

    GPIOA->AFR[0] &= ~((0xF<<(5*4))|(0xF<<(6*4))|(0xF<<(7*4)));
    GPIOA->AFR[0] |=  ((5<<(5*4))|(5<<(6*4))|(5<<(7*4)));

    GPIOA->PUPDR &= ~(3<<(6*2));
    GPIOA->PUPDR |=  (1<<(6*2));   // PA6 pull-up

    /* CS PA4 */
    GPIOA->MODER &= ~(3<<(4*2));
    GPIOA->MODER |=  (1<<(4*2));
    GPIOA->BSRR = (1<<4);

    SPI1->CR1 = 0;
    SPI1->CR1 =
        SPI_CR1_MSTR |
        SPI_CR1_SSM  |
        SPI_CR1_SSI  |
        SPI_CR1_BR_2 | SPI_CR1_BR_1 | SPI_CR1_BR_0;

    SPI1->CR1 |= SPI_CR1_SPE;
}

uint8_t spi1_txrx(uint8_t d)
{
    while (!(SPI1->SR & SPI_SR_TXE));
    SPI1->DR = d;
    while (!(SPI1->SR & SPI_SR_RXNE));
    return SPI1->DR;
}

