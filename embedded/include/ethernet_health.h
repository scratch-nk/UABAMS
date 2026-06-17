#ifndef ETHERNET_HEALTH_H
#define ETHERNET_HEALTH_H

#include <stdint.h>

extern uint8_t mac[];
extern uint8_t ip[];

void spi2_w5500_check(void);
void ethernet_hardware_check(void);

#endif