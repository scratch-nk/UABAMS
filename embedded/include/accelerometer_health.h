#ifndef ACCELEROMETER_HEALTH_H
#define ACCELEROMETER_HEALTH_H

#include <stdint.h>

void sensor_spi_health_check(void);
void sensor_max_range_check(uint8_t sensor);
void sensor_static_check(void);

#endif