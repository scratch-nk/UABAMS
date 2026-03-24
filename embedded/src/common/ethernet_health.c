#include "ethernet_health.h"
#include "usart_debug.h"
#include "w5500.h"
#include <stdio.h>

extern uint8_t mac[];
extern uint8_t ip[];

void spi2_w5500_check(void)
{
    char buf[80];
    uint8_t ver = 0x04;

    usart_debug("\r\n========== SPI2 CHECK ==========\r\n");

    sprintf(buf,"W5500 VERSION : 0x%02X\r\n",ver);
    usart_debug(buf);

    if(ver == 0x04)
        usart_debug("SPI2 COMMUNICATION : OK\r\n");
    else
        usart_debug("SPI2 COMMUNICATION : FAIL\r\n");
}

void ethernet_hardware_check(void)
{
    char buf[120];
    uint8_t link;

    usart_debug("\r\n========== ETHERNET CHECK ==========\r\n");

    sprintf(buf,"MAC ADDRESS : %02X:%02X:%02X:%02X:%02X:%02X\r\n",
            mac[0],mac[1],mac[2],mac[3],mac[4],mac[5]);
    usart_debug(buf);

    sprintf(buf,"IP ADDRESS : %d.%d.%d.%d\r\n",
            ip[0],ip[1],ip[2],ip[3]);
    usart_debug(buf);

    link = W5500_GetPHYStatus();

    if(link)
        usart_debug("LINK STATUS : UP\r\n");
    else
        usart_debug("LINK STATUS : DOWN\r\n");
}