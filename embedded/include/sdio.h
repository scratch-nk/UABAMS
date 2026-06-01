#ifndef SDIO_H
#define SDIO_H

#include <stdint.h>

extern uint16_t g_sd_rca;
extern uint8_t  g_is_sdhc;

/* Init */
void SystemClock_Config(void);
void SDIO_Init(void);
void SDIO_Clock_HighSpeed(void);

/* Debug */
void SDIO_DebugFull(void);
void SD_CardDetect_Test(void);
void SDIO_PinTest(void);
void SDIO_FullInit_Debug(void);

/* Card */
int SDIO_CardInit(void);
uint16_t SD_GetRCA(void);
int SD_SelectCard(uint16_t rca);

/* Read Write */
int SD_ReadBlock(uint32_t addr, uint8_t *buf);
int SD_WriteBlock(uint32_t addr, const uint8_t *buf, uint16_t rca);

/* Test */
void SD_ReadWriteTest(uint16_t rca);
void SD_ImageTest(uint16_t rca);
void SD_WriteTextFiles(uint16_t rca);

/* FATFS */
void SD_FatFsTest(void);

#endif