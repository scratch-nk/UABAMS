#ifndef CLOCK_CONFIG_H
#define CLOCK_CONFIG_H

/*
 * clock_config.h — CPU clock initialisation for STM32F411RE
 *
 * Call SystemClock_Config() once at the top of main(), before any peripheral
 * init or vTaskStartScheduler(). At CPU_CLOCK_MHZ=16 this is a no-op (HSI
 * is already active after reset).
 */

void SystemClock_Config(void);

#endif /* CLOCK_CONFIG_H */
