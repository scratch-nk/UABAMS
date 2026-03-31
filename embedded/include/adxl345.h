#ifndef _ADXL345_H_
#define _ADXL345_H_

#include <stdint.h>

/* Register Map */
#define ADXL_DEVID        0x00
#define ADXL_POWER_CTL    0x2D
#define ADXL_DATA_FORMAT  0x31
#define ADXL_BW_RATE      0x2C
#define ADXL_INT_ENABLE   0x2E
#define ADXL_INT_SOURCE   0x30
#define ADXL_THRESH_ACT   0x24
#define ADXL_DATAX0       0x32

/* Range */
#define ADXL_RANGE_2G     0x00
#define ADXL_RANGE_4G     0x01
#define ADXL_RANGE_8G     0x02
#define ADXL_RANGE_16G    0x03

uint8_t adxl345_read_id(uint8_t sensor);
void adxl345_init(uint8_t sensor);
void adxl345_set_range(uint8_t sensor, uint8_t range);
void adxl345_set_odr(uint8_t sensor, uint8_t odr);
void adxl345_read_xyz_spi(uint8_t sensor,
                          float *x,
                          float *y,
                          float *z);



#endif
