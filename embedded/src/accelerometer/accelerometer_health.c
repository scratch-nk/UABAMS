#include "accelerometer_health.h"
#include "adxl345.h"
#include "usart_debug.h"
#include <stdio.h>
#include <math.h>

void sensor_spi_health_check(void)
{
    uint8_t id1, id2;
    char buf[100];

    usart_debug("\r\n========== SENSOR SPI CHECK ==========\r\n");

    id1 = adxl345_read_device_id(1);
    id2 = adxl345_read_device_id(2);

    sprintf(buf,"S1 DEVICE ID : 0x%02X\r\n",id1);
    usart_debug(buf);

    sprintf(buf,"S2 DEVICE ID : 0x%02X\r\n",id2);
    usart_debug(buf);

    if(id1 == 0xE5)
        usart_debug("SENSOR S1 COMMUNICATION : OK\r\n");
    else
        usart_debug("SENSOR S1 COMMUNICATION : FAIL\r\n");

    if(id2 == 0xE5)
        usart_debug("SENSOR S2 COMMUNICATION : OK\r\n");
    else
        usart_debug("SENSOR S2 COMMUNICATION : FAIL\r\n");

    usart_debug("======================================\r\n");
}

void sensor_max_range_check(uint8_t sensor)
{
    uint8_t id;
    char buf[100];

    id = adxl345_read_device_id(sensor);

    if(id == 0xE5)
    {
        sprintf(buf,"S%d SENSOR : ADXL345\r\n",sensor);
        usart_debug(buf);

        sprintf(buf,"S%d MAX RANGE : ±16G\r\n",sensor);
        usart_debug(buf);
    }
    else if(id == 0xAD)   // example ID for ADXL372
    {
        sprintf(buf,"S%d SENSOR : ADXL372\r\n",sensor);
        usart_debug(buf);

        sprintf(buf,"S%d MAX RANGE : ±200G\r\n",sensor);
        usart_debug(buf);
    }
    else if(id == 0x1D)   // hypothetical example for ADXL355
    {
        sprintf(buf,"S%d SENSOR : ADXL355\r\n",sensor);
        usart_debug(buf);

        sprintf(buf,"S%d MAX RANGE : ±8G\r\n",sensor);
        usart_debug(buf);
    }
    else if(id == 0xF2)   // example for ADXL1002
    {
        sprintf(buf,"S%d SENSOR : ADXL1002\r\n",sensor);
        usart_debug(buf);

        sprintf(buf,"S%d MAX RANGE : ±50G\r\n",sensor);
        usart_debug(buf);
    }
    else
    {
        sprintf(buf,"S%d SENSOR : UNKNOWN\r\n",sensor);
        usart_debug(buf);
    }
}

void sensor_static_check(void)
{
    float x1,y1,z1;
    float x2,y2,z2;
    char buf[120];

    adxl345_read_xyz_spi(1,&x1,&y1,&z1);
    adxl345_read_xyz_spi(2,&x2,&y2,&z2);

    sprintf(buf,"S1 ACCEL : X=%.2fg Y=%.2fg Z=%.2fg\r\n",x1,y1,z1);
    usart_debug(buf);

    sprintf(buf,"S2 ACCEL : X=%.2fg Y=%.2fg Z=%.2fg\r\n",x2,y2,z2);
    usart_debug(buf);

    if(fabs(x1)<0.3 && fabs(y1)<0.3 && z1>0.7 && z1<1.3)
        usart_debug("S1 STATUS : OK\r\n");
    else
        usart_debug("S1 STATUS : FAULT\r\n");

    if(fabs(x2)<0.3 && fabs(y2)<0.3 && z2>0.7 && z2<1.3)
        usart_debug("S2 STATUS : OK\r\n");
    else
        usart_debug("S2 STATUS : FAULT\r\n");
}
