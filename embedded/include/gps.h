#ifndef GPS_H
#define GPS_H

#include <stdint.h>



/* ================= GPS DATA STRUCT ================= */
typedef struct
{
    uint8_t valid;

    int32_t lat_i;
    int32_t lon_i;
    char ns;
    char ew;

    uint32_t speed_cms;

    uint8_t hour;
    uint8_t minute;
    uint8_t second;

    uint8_t day;
    uint8_t month;
    uint16_t year;

} gps_data_t;

extern gps_data_t gps_data;


/* -------- FUNCTIONS -------- */
void gps_usart6_init(void);
void gps_poll(void); 
void gps_rtc_init(void);

#endif
