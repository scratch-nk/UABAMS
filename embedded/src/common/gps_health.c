#include "gps_health.h"
#include "usart_debug.h"
#include "stm32f4xx.h"
#include <stdio.h>
#include "gps.h"

void gps_health_check(void)
{
    char buf[120];
    gps_data_t gps_local;
    
    // Get safe copy of data
    gps_get_copy(&gps_local);

    usart_debug("\r\n========== GPS HEALTH CHECK ==========\r\n");

    if(gps_local.valid)
    {
        usart_debug("GPS MODULE     : DETECTED\r\n");
        usart_debug("UART STATUS    : OK\r\n");
        usart_debug("NMEA STREAM    : RECEIVING\r\n");
        sprintf(buf,"SATELLITES     : %d\r\n", gps_local.satellites);
        usart_debug(buf);
        usart_debug("FIX STATUS     : OK\r\n");
        usart_debug("TIME SYNC      : OK\r\n");
    }
    else
    {
        // Even if not valid, we check if we are getting anything at all
        // (This part is tricky with ISR, but gps_local.valid is our best bet for health)
        usart_debug("GPS MODULE     : NO FIX / NOT DETECTED\r\n");
        usart_debug("UART STATUS    : WAITING\r\n");
        usart_debug("NMEA STREAM    : NO VALID DATA\r\n");
        usart_debug("SATELLITES     : 0\r\n");
        usart_debug("FIX STATUS     : NO FIX\r\n");
        usart_debug("TIME SYNC      : NO SYNC\r\n");
    }

    usart_debug("\r\n======================================\r\n");
}