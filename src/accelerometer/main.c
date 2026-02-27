#include "stm32f4xx.h"
#include "spi.h"
#include "spi_eth.h"
#include "adxl345.h"
#include "w5500.h"
#include "usart_debug.h"
#include "delay.h"
#include <stdio.h>
#include <math.h>
#include <string.h>

// CONFIG 
#define FS_HZ        200
#define WINDOW_MS    500
#define SAMPLE_COUNT (FS_HZ * WINDOW_MS / 1000)
#define EVENT_TH     2.0f

// TCP IP
uint8_t mac[]       = {0x00,0x08,0xDC,0x11,0x22,0x10};
uint8_t ip[]        = {192,168,1,10};
uint8_t sn[]        = {255,255,255,0};
uint8_t gw[]        = {0,0,0,0};
uint8_t server_ip[] = {192,168,1,100};


  
    /* -- nk
    volatile uint32_t ms_ticks = 0;

    void SysTick_Handler(void)
    {
        ms_ticks++;
    }
    */



const char* vib_level(float peak)
{
    if (peak >= 16.0f) return "16G";
    if (peak >= 8.0f)  return "8G";
    if (peak >= 4.0f)  return "4G";
    if (peak >= 2.0f)  return "2G";
    return "NORMAL";
}

void UBMS_Send_TCP(char *data)
{
    W5500_Send(0, (uint8_t *)data, strlen(data));
}


int main(void)
{
    float s1_x[SAMPLE_COUNT], s1_z[SAMPLE_COUNT];
    float s2_x[SAMPLE_COUNT], s2_z[SAMPLE_COUNT];
    float x1,y1,z1, x2,y2,z2;

    float s1_rms_v, s1_rms_l, s2_rms_v, s2_rms_l;
    float s1_sd_v,  s1_sd_l,  s2_sd_v,  s2_sd_l;
    float s1_peak,  s2_peak;

    char tcp_buf[512];

    USART2_Init();
    spi1_init();          // ADXL SPI
    SPI2_Init();          // W5500 SPI
SysTick_Config(SystemCoreClock / 1000);
    usart_debug("\r\nDATA LOGGER BOOT\r\n");

  //  W5500 INIT 
    W5500_RST_LOW();  delay_ms(50);
    W5500_RST_HIGH(); delay_ms(300);

    W5500_SetNetwork(mac, ip, sn, gw);
    delay_ms(1000);

    usart_debug("CONNECT REQUEST SENT\r\n");
    W5500_TCP_Client_Connect(0, server_ip, 5000);

    while (W5500_GetSocketStatus(0) != 0x17);

    usart_debug("TCP CONNECTED\r\n");

    usart_debug("\r\n========================================\r\n");
        usart_debug("UBMS AXLE BOX MONITORING SYSTEM\r\n");
        usart_debug("LEFT (S1) & RIGHT (S2) \r\n");
        usart_debug("========================================\r\n");


   //  ADXL INIT 
    adxl345_init(1);
    adxl345_init(2);

    while (1)
    {
            float sum_z1 = 0, sum_x1 = 0;
            float sum_z2 = 0, sum_x2 = 0;
            float sumsq_z1 = 0, sumsq_x1 = 0;
            float sumsq_z2 = 0, sumsq_x2 = 0;

            float mean_z1, mean_x1, mean_z2, mean_x2;
            float sd_sum_z1 = 0, sd_sum_x1 = 0;
            float sd_sum_z2 = 0, sd_sum_x2 = 0;

            s1_peak = s2_peak = 0.0f;

            float s1_p2p_v = 2.0f * s1_sd_v;
    float s1_p2p_l = 2.0f * s1_sd_l;

    float s2_p2p_v = 2.0f * s2_sd_v;
    float s2_p2p_l = 2.0f * s2_sd_l;

        //  SAMPLING 
        for (int i=0;i<SAMPLE_COUNT;i++)
        {
            adxl345_read_xyz_spi(1,&x1,&y1,&z1);
            adxl345_read_xyz_spi(2,&x2,&y2,&z2);

            s1_x[i]=x1; s1_z[i]=z1;
            s2_x[i]=x2; s2_z[i]=z2;

            float mag1 = sqrtf(x1*x1 + y1*y1 + z1*z1);
            float mag2 = sqrtf(x2*x2 + y2*y2 + z2*z2);

            if (mag1 > s1_peak) s1_peak = mag1;
            if (mag2 > s2_peak) s2_peak = mag2;

            sum_z1+=z1; sum_x1+=x1;
            sum_z2+=z2; sum_x2+=x2;

            sumsq_z1+=z1*z1; sumsq_x1+=x1*x1;
            sumsq_z2+=z2*z2; sumsq_x2+=x2*x2;

            delay_ms(1000/FS_HZ);
        }

        mean_z1 = sum_z1/SAMPLE_COUNT;
        mean_x1 = sum_x1/SAMPLE_COUNT;
        mean_z2 = sum_z2/SAMPLE_COUNT;
        mean_x2 = sum_x2/SAMPLE_COUNT;

        s1_rms_v = sqrtf(sumsq_z1/SAMPLE_COUNT);
        s1_rms_l = sqrtf(sumsq_x1/SAMPLE_COUNT);
        s2_rms_v = sqrtf(sumsq_z2/SAMPLE_COUNT);
        s2_rms_l = sqrtf(sumsq_x2/SAMPLE_COUNT);

        for (int i=0;i<SAMPLE_COUNT;i++)
        {
            sd_sum_z1+=(s1_z[i]-mean_z1)*(s1_z[i]-mean_z1);
            sd_sum_x1+=(s1_x[i]-mean_x1)*(s1_x[i]-mean_x1);
            sd_sum_z2+=(s2_z[i]-mean_z2)*(s2_z[i]-mean_z2);
            sd_sum_x2+=(s2_x[i]-mean_x2)*(s2_x[i]-mean_x2);
        }

        s1_sd_v=sqrtf(sd_sum_z1/SAMPLE_COUNT);
        s1_sd_l=sqrtf(sd_sum_x1/SAMPLE_COUNT);
        s2_sd_v=sqrtf(sd_sum_z2/SAMPLE_COUNT);
        s2_sd_l=sqrtf(sd_sum_x2/SAMPLE_COUNT);


//   CONTINUOUS REPORT 
usart_debug("\r\n----- UBMS CONTINUOUS DATA -----\r\n");
usart_debug("COACH_ID : C1\r\n");
usart_debug("BOGIE_ID : B1\r\n");


        //  PACKET 
snprintf(tcp_buf,sizeof(tcp_buf),
"\r\n[AXLE BOX LEFT - S1]\r\n"
"Ax : %.3f g  Ay : %.3f g  Az : %.3f g\r\n"
"RMS-V : %.3f g\r\n"
"RMS-L : %.3f g\r\n"
"SD-V  : %.3f g\r\n"
"SD-L  : %.3f g\r\n"
"P2P-V : %.3f g\r\n"
"P2P-L : %.3f g\r\n"
"PEAK  : %.3f g\r\n",
s1_x[SAMPLE_COUNT-1], y1, s1_z[SAMPLE_COUNT-1],
s1_rms_v, s1_rms_l,
s1_sd_v,  s1_sd_l,
2.0f*s1_sd_v, 2.0f*s1_sd_l,
s1_peak
);

usart_debug(tcp_buf);
 UBMS_Send_TCP(tcp_buf);


snprintf(tcp_buf,sizeof(tcp_buf),
"\r\n[AXLE BOX RIGHT - S2]\r\n"
"Ax : %.3f g  Ay : %.3f g  Az : %.3f g\r\n"
"RMS-V : %.3f g\r\n"
"RMS-L : %.3f g\r\n"
"SD-V  : %.3f g\r\n"
"SD-L  : %.3f g\r\n"
"P2P-V : %.3f g\r\n"
"P2P-L : %.3f g\r\n"
"PEAK  : %.3f g\r\n",
s2_x[SAMPLE_COUNT-1], y2, s2_z[SAMPLE_COUNT-1],
s2_rms_v, s2_rms_l,
s2_sd_v,  s2_sd_l,
2.0f*s2_sd_v, 2.0f*s2_sd_l,
s2_peak
);

usart_debug(tcp_buf);
 UBMS_Send_TCP(tcp_buf);

snprintf(tcp_buf,sizeof(tcp_buf),
"\r\nFS     : %d Hz\r\n"
"WINDOW : %d ms\r\n",
FS_HZ, WINDOW_MS);

usart_debug(tcp_buf);
 UBMS_Send_TCP(tcp_buf);



            // EVENT 
            if (s1_peak >= EVENT_TH || s2_peak >= EVENT_TH)
            {
                snprintf(tcp_buf,sizeof(tcp_buf),
                "\r\n*** EVENT: VIBRATION ALERT ***\r\n"
                "S1 PEAK : %.2f g (%s)\r\n"
                "S2 PEAK : %.2f g (%s)\r\n",
                s1_peak, vib_level(s1_peak),
                s2_peak, vib_level(s2_peak));

                usart_debug(tcp_buf);
                UBMS_Send_TCP(tcp_buf);
            }

            usart_debug("UBMS PACKET SENT\r\n");
        // usart_debug(tcp_buf);
        // UBMS_Send_TCP(tcp_buf);
    }
}
