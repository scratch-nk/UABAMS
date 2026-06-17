/* led_debug.h -- LED debugging interface */

#ifndef LED_DEBUG_H
#define LED_DEBUG_H

#include <stdint.h>

/* PWM-based LED control */
void LED_PWM_Init(void);
void LED_SetBrightness(uint16_t brightness);

/* Basic LED control */
void LED_Init(void);
void LED_On(void);
void LED_Off(void);
void LED_Toggle(void);

#endif /* LED_DEBUG_H */
