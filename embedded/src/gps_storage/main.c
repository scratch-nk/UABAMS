#include "stm32f4xx.h"
#include "spi_eth.h"
#include "w5500.h"
#include "ethernet_health.h"
#include "gps.h"
#include "gps_health.h"
#include "usart_debug.h"
#include "boot_info.h"
#include "delay.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
extern volatile uint32_t ms_ticks;

//  NETWORK CONFIG 
uint8_t mac[] = {0x00,0x08,0xDC,0x11,0x22,0x01};
uint8_t ip[]  = {192,168,1,100};
uint8_t sn[]  = {255,255,255,0};
uint8_t gw[]  = {192,168,1,1};


void delay(void)
{
    for (volatile int i = 0; i < 500000; i++);
}


int main(void)
{
    uint8_t rx_buf[1024];
    uint8_t connected = 0;

    static uint32_t last_periodic_gps = 0; 
    // uint32_t last_gps_print = 0;

    USART2_Init();
    print_boot_info("JUNCTION BOX");
    SPI2_Init();
spi2_w5500_check();
gps_usart6_init();
ethernet_hardware_check();

gps_health_check();
    

    gps_rtc_init();
    SysTick_Config(SystemCoreClock / 1000);   // 1 ms tick


    //   W5500 INIT 
    W5500_RST_LOW(); 
    delay();
    W5500_RST_HIGH(); 
    delay();

    W5500_SetNetwork(mac, ip, sn, gw);
    W5500_TCP_Server_Init(0, 5000);

    usart_debug("TCP SERVER LISTENING...\r\n");

    
 while (1)
{
    gps_poll();

    uint8_t status = W5500_GetSocketStatus(0);

    switch(status)
    {
        case 0x17:   // SOCK_ESTABLISHED
        {
            if(!connected)
            {
                usart_debug("\r\nCLIENT CONNECTED\r\n");
                connected = 1;
            }

            int len = W5500_Recv(0, rx_buf, sizeof(rx_buf)-1);

            if(len > 0)
            {
                rx_buf[len] = 0;

                usart_debug("\r\n[UBMS DATA]\r\n");
                usart_debug((char*)rx_buf);

                /* ===== PERIODIC GPS ===== */

                if (gps_data.valid && (ms_ticks - last_periodic_gps >= 1000))
                {
                    last_periodic_gps = ms_ticks;

                    double lat = gps_data.lat_i / 1000000.0;
                    double lon = gps_data.lon_i / 1000000.0;
                    double spd = gps_data.speed_cms * 0.036;

                    usart_debug(
                        "\r\n[GPS DATA]\r\n"
                        "DATE : %02d/%02d/%04d\r\n"
                        "TIME : %02d:%02d:%02d\r\n"
                        "LAT  : %.6f %c\r\n"
                        "LON  : %.6f %c\r\n"
                        "SPD  : %.2f km/h\r\n",
                        gps_data.day,
                        gps_data.month,
                        gps_data.year,
                        gps_data.hour,
                        gps_data.minute,
                        gps_data.second,
                        lat, gps_data.ns,
                        lon, gps_data.ew,
                        spd
                    );
                }

                /* ===== EVENT GPS ===== */

                if (strstr((char *)rx_buf, "*** EVENT:"))
                {
                    usart_debug("\r\n[EVENT GPS DATA]\r\n");

                    if (gps_data.valid)
                    {
                        double lat = gps_data.lat_i / 1000000.0;
                        double lon = gps_data.lon_i / 1000000.0;
                        double spd = gps_data.speed_cms * 0.036;

                        usart_debug(
                            "DATE : %02d/%02d/%04d\r\n"
                            "TIME : %02d:%02d:%02d\r\n"
                            "LAT  : %.6f %c\r\n"
                            "LON  : %.6f %c\r\n"
                            "SPD  : %.2f km/h\r\n",
                            gps_data.day,
                            gps_data.month,
                            gps_data.year,
                            gps_data.hour,
                            gps_data.minute,
                            gps_data.second,
                            lat, gps_data.ns,
                            lon, gps_data.ew,
                            spd
                        );
                    }
                    else
                    {
                        usart_debug("GPS : NO FIX\r\n");
                    }
                }
            }

            break;
        }

        case 0x1C:   // SOCK_CLOSE_WAIT
        {
            usart_debug("\r\nCLIENT DISCONNECTED\r\n");
            W5500_CloseSocket(0);
            connected = 0;
            break;
        }

        case 0x00:   // SOCK_CLOSED
        {
            usart_debug("\r\nREOPENING SOCKET...\r\n");
            W5500_TCP_Server_Init(0,5000);
            connected = 0;
            break;
        }

        default:
            break;
    }
}
}