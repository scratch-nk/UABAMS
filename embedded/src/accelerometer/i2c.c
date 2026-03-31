#include "stm32f4xx.h"
#include "i2c.h"

void i2c1_init(void)
{
    /* Enable clocks */
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOBEN;
    RCC->APB1ENR |= RCC_APB1ENR_I2C1EN;

    /* PB8 (SCL), PB9 (SDA) -> AF4 */

    GPIOB->MODER &= ~((3 << (8*2)) | (3 << (9*2)));
    GPIOB->MODER |=  ((2 << (8*2)) | (2 << (9*2)));   // AF mode

    GPIOB->OTYPER |= (1 << 8) | (1 << 9);             // Open-drain

    GPIOB->OSPEEDR |= (3 << (8*2)) | (3 << (9*2));    // High speed

    GPIOB->PUPDR &= ~((3 << (8*2)) | (3 << (9*2)));
    GPIOB->PUPDR |=  (1 << (8*2)) | (1 << (9*2));     // Pull-up

    GPIOB->AFR[1] &= ~((0xF << 0) | (0xF << 4));
    GPIOB->AFR[1] |=  (4 << 0) | (4 << 4);            // AF4

    /* Reset I2C */
    I2C1->CR1 |= I2C_CR1_SWRST;
    I2C1->CR1 &= ~I2C_CR1_SWRST;

    /* I2C config (PCLK1 = 16MHz) */
    I2C1->CR2   = 16;
    I2C1->CCR   = 80;     // 100kHz
    I2C1->TRISE = 17;

    I2C1->CR1 |= I2C_CR1_PE;
}


void i2c_write_reg(uint8_t dev, uint8_t reg, uint8_t data)
{
    // START
    I2C1->CR1 |= I2C_CR1_START;
    while (!(I2C1->SR1 & I2C_SR1_SB));

    // Slave address + Write
    I2C1->DR = dev << 1;
    while (!(I2C1->SR1 & I2C_SR1_ADDR));
    (void)I2C1->SR2; // Clear ADDR


    // Send data
    I2C1->DR = reg;
    while (!(I2C1->SR1 & I2C_SR1_TXE));
    I2C1->DR = data;
    while (!(I2C1->SR1 & I2C_SR1_BTF));

    // STOP
    I2C1->CR1 |= I2C_CR1_STOP;
}

uint8_t i2c_read_reg(uint8_t dev, uint8_t reg)
{
    uint8_t val;

    I2C1->CR1 |= I2C_CR1_START;
    while (!(I2C1->SR1 & I2C_SR1_SB));
    I2C1->DR = dev << 1;
    while (!(I2C1->SR1 & I2C_SR1_ADDR));
    (void)I2C1->SR2;

    I2C1->DR = reg;
    while (!(I2C1->SR1 & I2C_SR1_TXE));

    I2C1->CR1 |= I2C_CR1_START;
    while (!(I2C1->SR1 & I2C_SR1_SB));
    I2C1->DR = (dev << 1) | 1;
    while (!(I2C1->SR1 & I2C_SR1_ADDR));
    (void)I2C1->SR2;

    I2C1->CR1 &= ~I2C_CR1_ACK;
    while (!(I2C1->SR1 & I2C_SR1_RXNE));
    val = I2C1->DR;

    I2C1->CR1 |= I2C_CR1_STOP;
    I2C1->CR1 |= I2C_CR1_ACK;

    return val;
}

void i2c_read_multi(uint8_t dev_addr, uint8_t reg, uint8_t *buf, uint8_t len)
{
    // START
    I2C1->CR1 |= I2C_CR1_START;
    while (!(I2C1->SR1 & I2C_SR1_SB));

    // Send device address (write)
    I2C1->DR = (dev_addr << 1);
    while (!(I2C1->SR1 & I2C_SR1_ADDR));
    (void)I2C1->SR2;

    // Send register address
    while (!(I2C1->SR1 & I2C_SR1_TXE));
    I2C1->DR = reg;

    // Repeated START
    I2C1->CR1 |= I2C_CR1_START;
    while (!(I2C1->SR1 & I2C_SR1_SB));

    // Send device address (read)
    I2C1->DR = (dev_addr << 1) | 1;
    while (!(I2C1->SR1 & I2C_SR1_ADDR));
    (void)I2C1->SR2;

    while (len--)
    {
        while (!(I2C1->SR1 & I2C_SR1_RXNE));
        *buf++ = I2C1->DR;
    }
    I2C1->CR1 |= I2C_CR1_STOP;

}
