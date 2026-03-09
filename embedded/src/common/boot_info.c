#include "boot_info.h"
#include "usart_debug.h"
#include <stdio.h>

#define FW_VERSION "1.0"
#define MCU_NAME   "STM32F411"
#define CLOCK_FREQ "100 MHz"

void print_boot_info(const char *device)
{
    char buf[128];

    usart_debug("\r\n====================================\r\n");
    usart_debug("UABAMS SYSTEM BOOT\r\n");

    sprintf(buf,"DEVICE           : %s\r\n", device);
    usart_debug(buf);

    sprintf(buf,"Firmware Version : %s\r\n", FW_VERSION);
    usart_debug(buf);

    sprintf(buf,"MCU              : %s\r\n", MCU_NAME);
    usart_debug(buf);

    sprintf(buf,"Clock            : %s\r\n", CLOCK_FREQ);
    usart_debug(buf);

    sprintf(buf,"Build Date       : %s %s\r\n", __DATE__, __TIME__);
    usart_debug(buf);

    usart_debug("====================================\r\n");
}