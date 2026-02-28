#include "stm32f4xx.h"
#include "spi_eth.h"
#include "w5500.h"
#include "gps.h"
#include "usart_debug.h"
#include "delay.h"
#include "tcp_client.h"
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
    int client_fd = -1;
    char str[1024];
    int str_cnt;

    static uint32_t last_periodic_gps = 0; 
    // uint32_t last_gps_print = 0;

    USART2_Init();
    SPI2_Init();
    gps_usart6_init();
    gps_rtc_init();
    SysTick_Config(SystemCoreClock / 1000);   // 1 ms tick

    usart_debug("\r\n========================================\r\n");
    usart_debug("JUNCTION BOX BOOT\r\n");
    usart_debug("========================================\r\n");

    //   W5500 INIT 
    W5500_RST_LOW(); 
    delay();
    W5500_RST_HIGH(); 
    delay();

    W5500_SetNetwork(mac, ip, sn, gw);
    W5500_TCP_Server_Init(0, 5000);
    client_fd = tcp_connect("192.169.0.125", 500);

    usart_debug("TCP SERVER LISTENING...\r\n");

    
   while (1)
{
    gps_poll();   // always update GPS buffer

    /* -------- TCP RECEIVE -------- */
    if (W5500_GetSocketStatus(0) == 0x17)
    {
        if (!connected)
        {
            usart_debug("\r\nCLIENT CONNECTED\r\n");
            connected = 1;
        }

        int len = W5500_Recv(0, rx_buf, sizeof(rx_buf) - 1);
        if (len > 0)
        {
            rx_buf[len] = 0;

            /* ===== UBMS DATA ===== */
            usart_debug("\r\n[UBMS DATA]\r\n");
            usart_debug((char *)rx_buf);

            /* ===== PERIODIC GPS (1 sec) ===== */
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

                str_cnt = snprintf (str, sizeof(str),
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

                tcp_send(client_fd, str, str_cnt);
            }

            /* ===== EVENT → GPS SNAPSHOT ===== */
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

                    str_cnt = snprintf(str, 1024,
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
                    tcp_send(client_fd, str, str_cnt);

                }
                else
                {
                    usart_debug("GPS : NO FIX\r\n");
                }
            }
        }
    }
    else
    {
        connected = 0;
    }
}
}
