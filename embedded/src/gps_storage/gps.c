#include "stm32f4xx.h"
#include "gps.h"
#include "usart_debug.h"
#include <string.h>
#include <stdlib.h>
#include <stdint.h>


/* ===== GLOBAL GPS DATA DEFINITION ===== */
gps_data_t gps_data = {0};

/* =========================================================
   NMEA FIELD EXTRACTION
   ========================================================= */

static void get_nmea_field(const char *line, int field, char *out, int maxlen)
{
    int current = 0;
    int i = 0;

    if (*line == '$')
        line++;

    while (*line && current < field)
    {
        if (*line == ',')
            current++;
        line++;
    }

    while (*line && *line != ',' && i < maxlen - 1)
    {
        out[i++] = *line++;
    }

    out[i] = '\0';
}

/* =========================================================
   NMEA COORDINATE CONVERSION
   ========================================================= */

static double nmea_lat_to_decimal(const char *lat)
{
    int deg = (lat[0] - '0') * 10 + (lat[1] - '0');
    double min = atof(&lat[2]);
    return deg + (min / 60.0);
}

static double nmea_lon_to_decimal(const char *lon)
{
    int deg = (lon[0] - '0') * 100 +
              (lon[1] - '0') * 10 +
              (lon[2] - '0');
    double min = atof(&lon[3]);
    return deg + (min / 60.0);
}

/* =========================================================
   RTC INITIALIZATION (LSI)
   ========================================================= */

void gps_rtc_init(void)
{
    RCC->APB1ENR |= RCC_APB1ENR_PWREN;
    PWR->CR |= PWR_CR_DBP;

    RCC->CSR |= RCC_CSR_LSION;
    while (!(RCC->CSR & RCC_CSR_LSIRDY));

    RCC->BDCR |= RCC_BDCR_RTCSEL_1;   // LSI
    RCC->BDCR |= RCC_BDCR_RTCEN;
}

/* =========================================================
   GPS UART INIT (USART3 – PB10 / PB11)
   ========================================================= */

void gps_usart6_init(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOCEN;
    RCC->APB2ENR |= RCC_APB2ENR_USART6EN;

    /* PC6 = TX, PC7 = RX */
    GPIOC->MODER &= ~((3<<(6*2)) | (3<<(7*2)));
    GPIOC->MODER |=  (2<<(6*2)) | (2<<(7*2));
    GPIOC->AFR[0] &= ~((0xF<<(6*4)) | (0xF<<(7*4)));
    GPIOC->AFR[0] |=  (8<<(6*4)) | (8<<(7*4));   // AF8 = USART6

    uint32_t pclk2 = SystemCoreClock;   // (default no prescaler)
    USART6->BRR = (pclk2 + 4800) / 9600;

    USART6->CR1 = USART_CR1_RE | USART_CR1_UE;
}


/* =========================================================
   GPS POLLING & PARSING
   ========================================================= */

void gps_poll(void)
{
    static char line[128];
    static uint8_t idx = 0;

    if (USART6->SR & USART_SR_RXNE)
    {
        char c = USART6->DR;

        if (c == '\n')
        {
            line[idx] = '\0';
            idx = 0;

            if (strstr(line, "RMC,"))
            {
                char status[2] = {0};
                char lat[16] = {0}, lon[16] = {0};
                char ns[2] = {0}, ew[2] = {0};
                char speed_knots[16] = {0};
                char utc_time[16] = {0};
                char date[8] = {0};

                get_nmea_field(line, 2, status, sizeof(status));
                get_nmea_field(line, 3, lat, sizeof(lat));
                get_nmea_field(line, 4, ns, sizeof(ns));
                get_nmea_field(line, 5, lon, sizeof(lon));
                get_nmea_field(line, 6, ew, sizeof(ew));
                get_nmea_field(line, 7, speed_knots, sizeof(speed_knots));
                get_nmea_field(line, 1, utc_time, sizeof(utc_time));
                get_nmea_field(line, 9, date, sizeof(date));   // DDMMYY

                if (status[0] == 'A' && lat[0] && lon[0])
                {
                    gps_data.valid = 1;

                    double dlat = nmea_lat_to_decimal(lat);
                    double dlon = nmea_lon_to_decimal(lon);

                    gps_data.lat_i = (int32_t)(dlat * 1000000);
                    gps_data.lon_i = (int32_t)(dlon * 1000000);
                    gps_data.ns = ns[0];
                    gps_data.ew = ew[0];

                    gps_data.speed_cms = (uint32_t)(atof(speed_knots) * 51.444); // knots→cm/s

                    if (strlen(utc_time) >= 6)
                    {
                        gps_data.hour   = (utc_time[0]-'0')*10 + (utc_time[1]-'0');
                        gps_data.minute = (utc_time[2]-'0')*10 + (utc_time[3]-'0');
                        gps_data.second = (utc_time[4]-'0')*10 + (utc_time[5]-'0');

                        // UTC → IST
                        gps_data.minute += 30;
                        if (gps_data.minute >= 60)
                        {
                            gps_data.minute -= 60;
                            gps_data.hour++;
                        }
                        gps_data.hour += 5;
                        if (gps_data.hour >= 24) gps_data.hour -= 24;
                    }

                    if (strlen(date) == 6)
                    {
                        gps_data.day   = (date[0]-'0')*10 + (date[1]-'0');
                        gps_data.month = (date[2]-'0')*10 + (date[3]-'0');
                        gps_data.year  = 2000 + (date[4]-'0')*10 + (date[5]-'0');
                    }
                }
                else
                {
                    gps_data.valid = 0;
                }
            }
        }
        else if (idx < sizeof(line)-1)
        {
            line[idx++] = c;
        }
    }
}