#include "sd.h"
#include "spi_sd.h"
#include "usart_debug.h"
#include "stm32f4xx.h"

uint8_t sd_cmd0_test(void)
{
    uint8_t r;
    uint16_t timeout = 0xFFFF;

    SD_CS_HIGH();

    /* 80 dummy clocks */
    for (int i = 0; i < 10; i++)
        spi1_txrx(0xFF);

    SD_CS_LOW();

    /* CMD0 */
    spi1_txrx(0x40);  // CMD0
    spi1_txrx(0x00);
    spi1_txrx(0x00);
    spi1_txrx(0x00);
    spi1_txrx(0x00);
    spi1_txrx(0x95);  // CRC

    while (timeout--)
    {
        r = spi1_txrx(0xFF);
        if (r != 0xFF)
            break;
    }

    SD_CS_HIGH();
    spi1_txrx(0xFF);

    return r;
}
