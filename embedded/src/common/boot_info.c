#include "boot_info.h"
#include "usart_debug.h"

void print_boot_info(const char *system)
{
    usart_debug("\r\n=================================\r\n");
    usart_debug("   UBMS 1.1\r\n");
    usart_debug(system);
    usart_debug("\r\n=================================\r\n");
}