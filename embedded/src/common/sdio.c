#include "stm32f4xx.h"
#include "usart_debug.h"
#include <stdint.h>
#include <sdio.h>

#include <stdio.h>
#include <string.h>
#include "ff.h"

#define NO_RESP    0
#define SHORT_RESP 1

/* Global RCA — set after card init, used by diskio.c */
uint16_t g_sd_rca = 0;
uint8_t  g_is_sdhc = 0;

/* -----------------------------------------------------------------------
 * SDIO_Init
 * - PC8–PC11 : D0–D3  (AF12)
 * - PC12     : CLK    (AF12)
 * - PD2      : CMD    (AF12)
 * - Pull-ups on all data/cmd lines (required by SD spec)
 * - Init clock ≤ 400 kHz: 48MHz / (118+2) = 400 kHz exactly
 * ----------------------------------------------------------------------- */
void SDIO_Init(void)
{
    /* Enable peripheral clocks */
    RCC->APB2ENR |= RCC_APB2ENR_SDIOEN;
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOCEN | RCC_AHB1ENR_GPIODEN;

    /* PC8–PC12: Alternate function + pull-up */
    for (int i = 8; i <= 12; i++)
    {
        /* Alternate function mode (10) */
        GPIOC->MODER &= ~(3U << (i * 2));
        GPIOC->MODER |=  (2U << (i * 2));

        /* Pull-up */
        GPIOC->PUPDR &= ~(3U << (i * 2));
        GPIOC->PUPDR |=  (1U << (i * 2));

        /* High speed */
        GPIOC->OSPEEDR |= (3U << (i * 2));

        /* AF12 (SDIO) — pins 8–12 are in AFR[1], offset = (pin-8)*4 */
        GPIOC->AFR[1] &= ~(0xFU << ((i - 8) * 4));
        GPIOC->AFR[1] |=  (12U  << ((i - 8) * 4));
    }

    /* PD2: CMD — Alternate function + pull-up */
    GPIOD->MODER  &= ~(3U << (2 * 2));
    GPIOD->MODER  |=  (2U << (2 * 2));   /* AF mode */

    GPIOD->PUPDR  &= ~(3U << (2 * 2));
    GPIOD->PUPDR  |=  (1U << (2 * 2));   /* pull-up */

    GPIOD->OSPEEDR |= (3U << (2 * 2));   /* high speed */

    GPIOD->AFR[0] &= ~(0xFU << (2 * 4));
    GPIOD->AFR[0] |=  (12U  << (2 * 4)); /* AF12 */

    /* Power ON */
    SDIO->POWER = 3;
    /* Wait ≥74 clocks at 400kHz ≈ 185µs before first command */
    for (volatile int i = 0; i < 10000; i++);

    /* CLKDIV=238 → 96MHz/239≈400kHz, CLKEN=1, 1-bit bus */
    SDIO->CLKCR = (238U << 0) | (1U << 8);
    /* Short settling delay after enabling clock */
    for (volatile int i = 0; i < 10000; i++);

    usart_debug("SDIO INIT DONE\r\n");
}

/* -----------------------------------------------------------------------
 * SDIO_Clock_HighSpeed
 * Increases SDIO_CK from 400kHz to ~24MHz (48MHz / (0+2)).
 * ----------------------------------------------------------------------- */
void SDIO_Clock_HighSpeed(void)
{
    /* CLKDIV=2 -> 48MHz/(2+2)=12MHz, CLKEN=1 (Safer for 1-bit/wires) */
    SDIO->CLKCR = (2U << 0) | (1U << 8);
    for (volatile int i = 0; i < 1000; i++);
    usart_debug("SDIO CLOCK: HIGH SPEED (12MHz)\r\n");
}

/* -----------------------------------------------------------------------
 * SDIO_SendCMD_R3 — for R3 responses (ACMD41, CMD58)
 * R3 has no CRC, so CCRCFAIL is raised by the peripheral but is normal.
 * We treat CCRCFAIL as success; only CTIMEOUT is a real failure.
 * ----------------------------------------------------------------------- */
int SDIO_SendCMD_R3(uint8_t cmd, uint32_t arg)
{
    SDIO->ICR = 0xFFFFFFFF;
    SDIO->ARG = arg;
    SDIO->CMD = (cmd & 0x3F) | (1U << 10) | (1U << 6);

    /* For R3 responses (ACMD41): CMDREND never fires because there is no CRC.
     * CCRCFAIL may or may not fire depending on silicon.
     * We wait for CTIMEOUT (real failure) or let the software timeout expire,
     * then read RESP1 regardless — the response data is valid even if the
     * peripheral flagged a timeout, as confirmed by SDIO_SendCMD_Debug testing. */
    uint32_t timeout = 2000000;
    while (!(SDIO->STA & (1U << 6)) &&   /* CMDREND */
           !(SDIO->STA & (1U << 1)) &&   /* CTIMEOUT */
           !(SDIO->STA & (1U << 2)))     /* CCRCFAIL */
    {
        if (--timeout == 0) break;        /* timed out — RESP1 still valid */
    }

    /* Only fail on hardware CTIMEOUT (card truly absent/not responding) */
    if (SDIO->STA & (1U << 1)) return 0;
    return 1;
}

/* -----------------------------------------------------------------------
 * SDIO_SendCMD
 * resp = NO_RESP    → wait for CMDSENT (bit 7)
 * resp = SHORT_RESP → wait for CMDREND (bit 6)
 * ----------------------------------------------------------------------- */
int SDIO_SendCMD(uint8_t cmd, uint32_t arg, uint8_t resp)
{
    SDIO->ICR = 0xFFFFFFFF;   /* clear all flags */

    SDIO->ARG = arg;

    if (resp == NO_RESP)
        SDIO->CMD = (cmd & 0x3F) | (1U << 10);          /* CPSMEN, no response */
    else
        SDIO->CMD = (cmd & 0x3F) | (1U << 10) | (1U << 6); /* CPSMEN + WAITRESP short */

    uint32_t timeout = 2000000;

    if (resp == NO_RESP)
    {
        /* Wait for CMDSENT (bit 7) */
        while (!(SDIO->STA & (1U << 7)))
        {
            if (--timeout == 0)
            {
                usart_debug("CMD TIMEOUT (NO_RESP)\r\n");
                return 0;
            }
        }
    }
    else
    {
        /* Wait for CMDREND (bit 6), CTIMEOUT (bit 1), or CCRCFAIL (bit 2) */
        while (!(SDIO->STA & (1U << 6)) &&
               !(SDIO->STA & (1U << 1)) &&
               !(SDIO->STA & (1U << 2)))
        {
            if (--timeout == 0)
            {
                usart_debug("CMD TIMEOUT (SHORT_RESP)\r\n");
                return 0;
            }
        }

        if (SDIO->STA & (1U << 1)) return 0;  /* CTIMEOUT */
        if (SDIO->STA & (1U << 2)) return 0;  /* CCRCFAIL */
    }

    return 1;
}

/* -----------------------------------------------------------------------
 * SDIO_SendCMD_Debug — same as above but prints STA and RESP1
 * ----------------------------------------------------------------------- */
int SDIO_SendCMD_Debug(uint8_t cmd, uint32_t arg, uint8_t resp)
{
    char buf[100];

    SDIO->ICR = 0xFFFFFFFF;

    SDIO->ARG = arg;

    if (resp == NO_RESP)
        SDIO->CMD = (cmd & 0x3F) | (1U << 10);
    else
        SDIO->CMD = (cmd & 0x3F) | (1U << 10) | (1U << 6);

    uint32_t timeout = 2000000;

    if (resp == NO_RESP)
    {
        while (!(SDIO->STA & (1U << 7)))
        {
            if (--timeout == 0)
            {
                sprintf(buf, "CMD%d TIMEOUT (no resp)\r\n", cmd);
                usart_debug(buf);
                return 0;
            }
        }
        sprintf(buf, "CMD%d SENT OK  STA=0x%08lX\r\n", cmd, SDIO->STA);
        usart_debug(buf);
        return 1;
    }

    /* Response expected */
    while (!(SDIO->STA & (1U << 6)) &&
           !(SDIO->STA & (1U << 1)) &&
           !(SDIO->STA & (1U << 2)))
    {
        if (--timeout == 0)
        {
            sprintf(buf, "CMD%d TIMEOUT\r\n", cmd);
            usart_debug(buf);
            return 0;
        }
    }

    sprintf(buf, "CMD%d STA=0x%08lX\r\n", cmd, SDIO->STA);
    usart_debug(buf);

    if (SDIO->STA & (1U << 1))
    {
        usart_debug("  -> CTIMEOUT\r\n");
        return 0;
    }

    if (SDIO->STA & (1U << 2))
    {
        usart_debug("  -> CCRCFAIL\r\n");
        return 0;
    }

    sprintf(buf, "  RESP1=0x%08lX\r\n", SDIO->RESP1);
    usart_debug(buf);

    usart_debug("  CMD OK\r\n");
    return 1;
}

/* -----------------------------------------------------------------------
 * SDIO_CardInit — CMD0 → CMD8 → ACMD41 loop
 * ----------------------------------------------------------------------- */
int SDIO_CardInit(void)
{
    usart_debug("\r\n--- SD INIT START ---\r\n");

    /* CMD0: reset to idle, no response */
    if (!SDIO_SendCMD(0, 0, NO_RESP))
    {
        usart_debug("CMD0 FAIL\r\n");
        return 0;
    }
    usart_debug("CMD0 OK\r\n");

    /* CMD8: voltage check (expect echo 0x1AA), short response */
    if (!SDIO_SendCMD(8, 0x1AA, SHORT_RESP))
    {
        usart_debug("CMD8 FAIL (card may be SD v1 — continuing)\r\n");
        /* Not fatal for very old cards, but most modern cards need this */
    }
    else
    {
        usart_debug("CMD8 OK\r\n");
    }

    /* ACMD41 loop: CMD55 + ACMD41 until card signals ready */
    uint32_t retry = 0;

    while (1)
    {
        if (!SDIO_SendCMD(55, 0, SHORT_RESP))
        {
            usart_debug("CMD55 FAIL\r\n");
            return 0;
        }

        /* ACMD41: R3 response — no CRC, use SDIO_SendCMD_R3.
         * Arg: HCS=1 (bit30) + 3.3V range (bits 15:23) */
        if (!SDIO_SendCMD_R3(41, 0x51FF8000))
        {
            usart_debug("ACMD41 FAIL\r\n");
            return 0;
        }

        uint32_t ocr = SDIO->RESP1;

        if (ocr & (1U << 31))   /* Card power-up status bit */
        {
            usart_debug("CARD READY\r\n");
            /* Bit 30: Card Capacity Status (CCS). 1 = SDHC/SDXC, 0 = SDSC */
            if (ocr & (1U << 30)) {
                g_is_sdhc = 1;
                usart_debug("TYPE: SDHC/SDXC (Block Addressing)\r\n");
            } else {
                g_is_sdhc = 0;
                usart_debug("TYPE: SDSC (Byte Addressing)\r\n");
            }
            break;
        }

        retry++;
        if (retry > 2000)
        {
            usart_debug("ACMD41 TIMEOUT\r\n");
            return 0;
        }
    }

    SDIO_Clock_HighSpeed();

    usart_debug("--- SD INIT DONE ---\r\n");
    return 1;
}

/* -----------------------------------------------------------------------
 * SDIO_FullInit_Debug — verbose version of CardInit
 * ----------------------------------------------------------------------- */
void SDIO_FullInit_Debug(void)
{
    usart_debug("\r\n==== SD INIT START (debug) ====\r\n");

    /* The card may be in Transfer state from a previous run (CMD0 has no
     * response so we can't confirm it worked). Strategy:
     * 1. CMD7(RCA=0) — deselects any selected card (R1b, may timeout if none selected — ignore)
     * 2. CMD0 x5 with delays — drives card to idle
     * 3. CMD8 — voltage check */
    usart_debug("Sending CMD7(RCA=0) to deselect...\r\n");
    SDIO_SendCMD_Debug(7, 0, SHORT_RESP);  /* ignore result */

    usart_debug("Sending CMD0 x5 (force idle)...\r\n");
    for (int i = 0; i < 5; i++)
    {
        SDIO_SendCMD_Debug(0, 0, NO_RESP);
        for (volatile int d = 0; d < 200000; d++);
    }

    usart_debug("Sending CMD8...\r\n");
    SDIO_SendCMD_Debug(8, 0x1AA, SHORT_RESP);

    for (volatile int d = 0; d < 100000; d++);

    /* Check card state with CMD13 before starting ACMD41 loop */
    usart_debug("Sending CMD13 (check state)...\r\n");
    SDIO_SendCMD_Debug(13, 0, SHORT_RESP);  /* RCA=0 during init */

    uint32_t retry = 0;

    while (1)
    {
        usart_debug("Sending CMD55...\r\n");
        if (!SDIO_SendCMD_Debug(55, 0, SHORT_RESP)) return;

        usart_debug("Sending ACMD41...\r\n");
        for (volatile int d = 0; d < 500000; d++);
        if (!SDIO_SendCMD_R3(41, 0x51FF8000)) return;

        uint32_t ocr = SDIO->RESP1;
        char buf[60];
        sprintf(buf, "  OCR=0x%08lX (busy=%d)\r\n", ocr, !(ocr >> 31));
        usart_debug(buf);

        if (ocr & (1U << 31))
        {
            usart_debug("CARD READY\r\n");
            if (ocr & (1U << 30)) {
                g_is_sdhc = 1;
                usart_debug("TYPE: SDHC/SDXC\r\n");
            } else {
                g_is_sdhc = 0;
                usart_debug("TYPE: SDSC\r\n");
            }
            break;
        }

        retry++;
        if (retry > 2000)
        {
            usart_debug("ACMD41 TIMEOUT\r\n");
            return;
        }
    }

    SDIO_Clock_HighSpeed();

    usart_debug("==== SD INIT DONE ====\r\n");
}

/* -----------------------------------------------------------------------
 * SD_CardDetect_Test
 * Reads pin levels on CMD (PD2) and D0 (PC8) to check wiring.
 * Note: pins are put back to input here — call SDIO_Init() again after.
 * ----------------------------------------------------------------------- */
void SD_CardDetect_Test(void)
{
    usart_debug("\r\n=== SD CARD DETECT TEST ===\r\n");

    /* Set CMD (PD2) and D0 (PC8) as inputs temporarily */
    GPIOD->MODER &= ~(3U << (2 * 2));
    GPIOC->MODER &= ~(3U << (8 * 2));

    int cmd = (GPIOD->IDR & (1U << 2)) ? 1 : 0;
    int d0  = (GPIOC->IDR & (1U << 8)) ? 1 : 0;

    char buf[60];
    sprintf(buf, "RAW PIN STATE -> CMD=%d, D0=%d\r\n", cmd, d0);
    usart_debug(buf);

    if (cmd == 0 || d0 == 0)
        usart_debug("WARNING: LINE LOW - check wiring / pull-ups\r\n");
    else
        usart_debug("LINES HIGH (OK)\r\n");
}

/* -----------------------------------------------------------------------
 * SDIO_PinTest — toggle CLK (PC12) to verify wiring with a scope/meter
 * ----------------------------------------------------------------------- */
void SDIO_PinTest(void)
{
    usart_debug("\r\n=== PIN TEST START ===\r\n");

    /* PC12 → GPIO output */
    GPIOC->MODER &= ~(3U << (12 * 2));
    GPIOC->MODER |=  (1U << (12 * 2));

    for (int i = 0; i < 10; i++)
    {
        GPIOC->ODR ^= (1U << 12);
        for (volatile int d = 0; d < 500000; d++);
    }

    usart_debug("CLK TOGGLE DONE\r\n");

    /* PD2 → input, read CMD line state */
    GPIOD->MODER &= ~(3U << (2 * 2));

    if (GPIOD->IDR & (1U << 2))
        usart_debug("CMD LINE HIGH (OK)\r\n");
    else
        usart_debug("CMD LINE LOW (PROBLEM)\r\n");
}

/* -----------------------------------------------------------------------
 * SD_GetRCA — CMD2 (ALL_SEND_CID) + CMD3 (SEND_RELATIVE_ADDR)
 * Returns the 16-bit RCA assigned by the card, or 0 on failure.
 * ----------------------------------------------------------------------- */
uint16_t SD_GetRCA(void)
{
    char buf[80];

    /* CMD2: ALL_SEND_CID — R2 long response (136-bit), no CRC check */
    SDIO->ICR = 0xFFFFFFFF;
    SDIO->ARG = 0;
    /* WAITRESP=11 (long), CPSMEN */
    SDIO->CMD = (2U & 0x3F) | (1U << 10) | (3U << 6);

    uint32_t timeout = 2000000;
    while (!(SDIO->STA & (1U << 6)) &&
           !(SDIO->STA & (1U << 1)) &&
           !(SDIO->STA & (1U << 2)))
    {
        if (--timeout == 0) { usart_debug("CMD2 TIMEOUT\r\n"); return 0; }
    }
    if (SDIO->STA & (1U << 1)) { usart_debug("CMD2 CTIMEOUT\r\n"); return 0; }
    sprintf(buf, "CMD2 OK  CID[0]=0x%08lX\r\n", SDIO->RESP1);
    usart_debug(buf);

    /* CMD3: SEND_RELATIVE_ADDR — card assigns its RCA, returns R6 */
    SDIO->ICR = 0xFFFFFFFF;
    SDIO->ARG = 0;
    SDIO->CMD = (3U & 0x3F) | (1U << 10) | (1U << 6);  /* short response */

    timeout = 2000000;
    while (!(SDIO->STA & (1U << 6)) &&
           !(SDIO->STA & (1U << 1)) &&
           !(SDIO->STA & (1U << 2)))
    {
        if (--timeout == 0) { usart_debug("CMD3 TIMEOUT\r\n"); return 0; }
    }
    if (SDIO->STA & (1U << 1)) { usart_debug("CMD3 CTIMEOUT\r\n"); return 0; }

    uint16_t rca = (uint16_t)(SDIO->RESP1 >> 16);
    sprintf(buf, "CMD3 OK  RCA=0x%04X\r\n", rca);
    usart_debug(buf);
    return rca;
}

/* -----------------------------------------------------------------------
 * SD_SelectCard — CMD7 (SELECT_CARD) with RCA to move card to Transfer state
 * ----------------------------------------------------------------------- */
int SD_SelectCard(uint16_t rca)
{
    SDIO->ICR = 0xFFFFFFFF;
    SDIO->ARG = (uint32_t)rca << 16;
    SDIO->CMD = (7U & 0x3F) | (1U << 10) | (1U << 6);  /* R1b short */

    uint32_t timeout = 2000000;
    while (!(SDIO->STA & (1U << 6)) &&
           !(SDIO->STA & (1U << 1)) &&
           !(SDIO->STA & (1U << 2)))
    {
        if (--timeout == 0) { usart_debug("CMD7 TIMEOUT\r\n"); return 0; }
    }
    if (SDIO->STA & (1U << 1)) { usart_debug("CMD7 CTIMEOUT\r\n"); return 0; }

    char buf[48];
    sprintf(buf, "CMD7 OK  RESP1=0x%08lX (card selected)\r\n", SDIO->RESP1);
    usart_debug(buf);
    return 1;
}

/* -----------------------------------------------------------------------
 * SD_WriteBlock — CMD24: write 512-byte block at given sector
 * ----------------------------------------------------------------------- */
int SD_WriteBlock(uint32_t sector, const uint8_t *buf512, uint16_t rca)
{
    char msg[64];
    uint32_t addr = g_is_sdhc ? sector : (sector * 512U);

    /* Set block length to 512 (CMD16) — technically optional for SDHC but safe */
    SDIO->ICR = 0xFFFFFFFF;
    SDIO->ARG = 512;
    SDIO->CMD = (16U & 0x3F) | (1U << 10) | (1U << 6);
    uint32_t timeout = 2000000;
    while (!(SDIO->STA & (1U<<6)) && !(SDIO->STA & (1U<<1)) && !(SDIO->STA & (1U<<2)))
        if (--timeout == 0) { usart_debug("CMD16 TIMEOUT\r\n"); return 0; }
    if (SDIO->STA & (1U<<1)) { usart_debug("CMD16 CTIMEOUT\r\n"); return 0; }

    /* CMD24: WRITE_BLOCK — send command first, get R1 response */
    SDIO->ICR = 0xFFFFFFFF;
    SDIO->ARG = addr;
    SDIO->CMD = (24U & 0x3F) | (1U << 10) | (1U << 6);
    timeout = 2000000;
    while (!(SDIO->STA & (1U<<6)) && !(SDIO->STA & (1U<<1)) && !(SDIO->STA & (1U<<2)))
        if (--timeout == 0) { usart_debug("CMD24 TIMEOUT\r\n"); return 0; }
    if (SDIO->STA & (1U<<1)) { usart_debug("CMD24 CTIMEOUT\r\n"); return 0; }

    SDIO->DTIMER = 0xFFFFFFFF;
    SDIO->DLEN   = 512;
    SDIO->ICR    = 0xFFFFFFFF;
    SDIO->DCTRL  = (9U << 4) | (0U << 1) | (1U << 0);
    for (volatile int i = 0; i < 100; i++);

    const uint32_t *src = (const uint32_t *)buf512;
    int words_written = 0;

    while (words_written < 128)
    {
        timeout = 2000000;
        while (!(SDIO->STA & (1U << 14)))
        {
            if (SDIO->STA & ((1U<<3)|(1U<<4)|(1U<<5))) {
                sprintf(msg, "WRITE ERR w=%d STA=0x%08lX\r\n", words_written, SDIO->STA);
                usart_debug(msg);
                return 0;
            }
            if (--timeout == 0) {
                sprintf(msg, "TXFIFOHE STUCK w=%d STA=0x%08lX\r\n", words_written, SDIO->STA);
                usart_debug(msg);
                return 0;
            }
        }
        int burst = (128 - words_written < 8) ? (128 - words_written) : 8;
        for (int j = 0; j < burst; j++)
            SDIO->FIFO = src[words_written++];
    }
    timeout = 5000000;
    while (!(SDIO->STA & (1U << 8)))
    {
        if (SDIO->STA & ((1U<<3)|(1U<<4)|(1U<<5))) {
            sprintf(msg, "WRITE ERR STA=0x%08lX\r\n", SDIO->STA);
            usart_debug(msg);
            return 0;
        }
        if (--timeout == 0) {
            usart_debug("WRITE TIMEOUT\r\n");
            return 0;
        }
    }

    SDIO->DCTRL = 0;      /* Release SDIO data path */
    SDIO->ICR   = 0xFFFFFFFF;

    /* Poll CMD13 until card exits programming state (bit 8 = READY_FOR_DATA,
     * bits [12:9] = TRAN state = 0b0100 = 4) */
    timeout = 5000000;
    while (1)
    {
        SDIO->ICR = 0xFFFFFFFF;
        SDIO->ARG = (uint32_t)rca << 16;
        SDIO->CMD = (13U & 0x3F) | (1U << 10) | (1U << 6);
        uint32_t t2 = 200000;
        while (!(SDIO->STA & (1U<<6)) && !(SDIO->STA & (1U<<1)) && !(SDIO->STA & (1U<<2)))
            if (--t2 == 0) break;
        uint32_t r1 = SDIO->RESP1;
        /* READY_FOR_DATA = bit 8, current state = bits [12:9] */
        if ((r1 & (1U << 8)) && (((r1 >> 9) & 0xF) == 4))
            break;
        if (--timeout == 0) { usart_debug("CARD BUSY TIMEOUT\r\n"); return 0; }
    }

    return 1;
}

/* -----------------------------------------------------------------------
 * SD_ReadBlock — CMD17: read 512-byte block at given sector
 * ----------------------------------------------------------------------- */
int SD_ReadBlock(uint32_t sector, uint8_t *buf512)
{
    char msg[64];
    uint32_t addr = g_is_sdhc ? sector : (sector * 512U);

    /* CMD16: SET_BLOCKLEN = 512 */
    SDIO->ICR = 0xFFFFFFFF;
    SDIO->ARG = 512;
    SDIO->CMD = (16U & 0x3F) | (1U << 10) | (1U << 6);
    uint32_t timeout = 2000000;
    while (!(SDIO->STA & (1U<<6)) && !(SDIO->STA & (1U<<1)) && !(SDIO->STA & (1U<<2)))
        if (--timeout == 0) { usart_debug("CMD16 TIMEOUT\r\n"); return 0; }
    if (SDIO->STA & (1U<<1)) { usart_debug("CMD16 CTIMEOUT\r\n"); return 0; }

    /* For reads: configure data path BEFORE CMD17 so peripheral is ready
     * to receive data as soon as the card starts sending */
    SDIO->DTIMER = 0xFFFFFFFF;
    SDIO->DLEN   = 512;
    SDIO->ICR    = 0xFFFFFFFF;
    /* DBLOCKSIZE=9, DTDIR=1 (card→host), DTEN=1 */
    SDIO->DCTRL  = (9U << 4) | (1U << 1) | (1U << 0);

    /* CMD17: READ_SINGLE_BLOCK */
    SDIO->ARG = addr;
    SDIO->CMD = (17U & 0x3F) | (1U << 10) | (1U << 6);
    timeout = 2000000;
    while (!(SDIO->STA & (1U<<6)) && !(SDIO->STA & (1U<<1)) && !(SDIO->STA & (1U<<2)))
        if (--timeout == 0) { usart_debug("CMD17 TIMEOUT\r\n"); return 0; }
    if (SDIO->STA & (1U<<1)) { usart_debug("CMD17 CTIMEOUT\r\n"); return 0; }

    /* Read 512 bytes from FIFO */
    uint32_t *dst = (uint32_t *)buf512;
    for (int i = 0; i < 128; i++)
    {
        /* Wait for RXDAVL (data available in FIFO, bit 21) */
        timeout = 2000000;
        while (!(SDIO->STA & (1U << 21)))
        {
            if (SDIO->STA & ((1U<<3)|(1U<<5))) { /* DTIMEOUT=3, RXOVERR=5 */
                sprintf(msg, "READ ERR i=%d STA=0x%08lX\r\n", i, SDIO->STA);
                usart_debug(msg);
                return 0;
            }
            if (--timeout == 0) {
                sprintf(msg, "READ FIFO TIMEOUT i=%d STA=0x%08lX\r\n", i, SDIO->STA);
                usart_debug(msg);
                return 0;
            }
        }
        dst[i] = SDIO->FIFO;
    }

    /* Wait for DATAEND */
    timeout = 2000000;
    while (!(SDIO->STA & (1U << 8)))
    {
        if (SDIO->STA & ((1U<<3)|(1U<<5))) {
            sprintf(msg, "READ DATAEND ERR STA=0x%08lX\r\n", SDIO->STA);
            usart_debug(msg);
            return 0;
        }
        if (--timeout == 0) { usart_debug("READ DATAEND TIMEOUT\r\n"); return 0; }
    }

    SDIO->DCTRL = 0;      /* Release SDIO data path */
    SDIO->ICR   = 0xFFFFFFFF;
    return 1;
}

/* -----------------------------------------------------------------------
 * SD_ReadWriteTest — write a pattern to block 8, read it back, verify
 * Block 8 is used (not block 0) to avoid overwriting the MBR/partition table
 * ----------------------------------------------------------------------- */
void SD_ReadWriteTest(uint16_t rca)
{
    usart_debug("\r\n===== SD READ/WRITE TEST =====\r\n");

    static uint8_t wbuf[512];
    static uint8_t rbuf[512];

    /* Fill write buffer with a known pattern */
    for (int i = 0; i < 512; i++)
        wbuf[i] = (uint8_t)(i & 0xFF);

    usart_debug("Writing block 100...\r\n");
    if (!SD_WriteBlock(100U, wbuf, rca)) { usart_debug("WRITE FAILED\r\n"); return; }

    /* Brief delay before read */
    for (volatile int d = 0; d < 100000; d++);

    usart_debug("Reading block 100...\r\n");
    if (!SD_ReadBlock(100U, rbuf)) { usart_debug("READ FAILED\r\n"); return; }

    /* Verify */
    int errors = 0;
    for (int i = 0; i < 512; i++)
    {
        if (rbuf[i] != wbuf[i]) errors++;
    }

    char buf[64];
    if (errors == 0)
    {
        usart_debug("VERIFY OK — all 512 bytes match!\r\n");
        /* Print first 16 bytes as hex */
        sprintf(buf, "Data[0..7]: %02X %02X %02X %02X %02X %02X %02X %02X\r\n",
                rbuf[0],rbuf[1],rbuf[2],rbuf[3],rbuf[4],rbuf[5],rbuf[6],rbuf[7]);
        usart_debug(buf);
    }
    else
    {
        sprintf(buf, "VERIFY FAILED: %d bytes mismatch\r\n", errors);
        usart_debug(buf);
    }

    usart_debug("===== TEST DONE =====\r\n");
}

/* -----------------------------------------------------------------------
 * SD_ReadBMP_Verify
 * Reads back the BMP written by SD_WriteBMP_RGB565 and checks:
 *   1. Magic bytes 'B','M' at offset 0
 *   2. The RGB565 red-channel mask at offset 54 equals 0x0000F800
 *   3. First 8 pixel bytes match what was written
 * ----------------------------------------------------------------------- */
void SD_ReadBMP_Verify(uint32_t block_start, const uint8_t *original_pixels)
{
    static uint8_t sector[512];
    char msg[80];

    usart_debug("\r\n===== BMP READ-BACK VERIFY =====\r\n");

    if (!SD_ReadBlock(block_start, sector))
    {
        usart_debug("READ FAILED\r\n");
        return;
    }

    /* Check magic */
    if (sector[0] == 'B' && sector[1] == 'M')
        usart_debug("Magic 'BM': OK\r\n");
    else
    {
        sprintf(msg, "Magic FAIL: got 0x%02X 0x%02X\r\n", sector[0], sector[1]);
        usart_debug(msg);
        return;
    }

    /* Check file size field */
    uint32_t fsize = (uint32_t)sector[2]
                   | ((uint32_t)sector[3] << 8)
                   | ((uint32_t)sector[4] << 16)
                   | ((uint32_t)sector[5] << 24);
    sprintf(msg, "File size: %lu bytes\r\n", fsize);
    usart_debug(msg);

    /* Check red mask at byte 54 */
    uint32_t rmask = (uint32_t)sector[54]
                   | ((uint32_t)sector[55] << 8)
                   | ((uint32_t)sector[56] << 16)
                   | ((uint32_t)sector[57] << 24);
    if (rmask == 0x0000F800)
        usart_debug("Red mask 0xF800: OK\r\n");
    else
    {
        sprintf(msg, "Red mask FAIL: got 0x%08lX\r\n", rmask);
        usart_debug(msg);
    }

    /* Check first 8 pixel bytes (at offset 66 in the sector) */
    int pixel_errors = 0;
    for (int i = 0; i < 8; i++)
        if (sector[66 + i] != original_pixels[i]) pixel_errors++;

    if (pixel_errors == 0)
        usart_debug("First 8 pixel bytes: OK\r\n");
    else
    {
        usart_debug("Pixel mismatch:\r\n");
        sprintf(msg, "  Written:  %02X %02X %02X %02X %02X %02X %02X %02X\r\n",
                original_pixels[0], original_pixels[1],
                original_pixels[2], original_pixels[3],
                original_pixels[4], original_pixels[5],
                original_pixels[6], original_pixels[7]);
        usart_debug(msg);
        sprintf(msg, "  ReadBack: %02X %02X %02X %02X %02X %02X %02X %02X\r\n",
                sector[66], sector[67], sector[68], sector[69],
                sector[70], sector[71], sector[72], sector[73]);
        usart_debug(msg);
    }

    usart_debug("===== VERIFY DONE =====\r\n");
}

/* -----------------------------------------------------------------------
 * SD_DumpBMP_UART
 * Reads the BMP back from SD card and prints every byte as hex over UART.
 * Format: "BMP_START\r\n" then lines of 16 hex bytes, then "BMP_END\r\n"
 * A PC script can capture this and reconstruct the .bmp file.
 *
 * total_bytes: file size (66 + width*height*2)
 * ----------------------------------------------------------------------- */
void SD_DumpBMP_UART(uint32_t block_start, uint32_t total_bytes)
{
    static uint8_t sector[512];
    char line[64];

    usart_debug("\r\nBMP_START\r\n");

    uint32_t bytes_sent = 0;
    uint32_t current_sector = block_start;

    while (bytes_sent < total_bytes)
    {
        if (!SD_ReadBlock(current_sector, sector))
        {
            usart_debug("READ_ERROR\r\n");
            return;
        }

        uint32_t chunk = total_bytes - bytes_sent;
        if (chunk > 512) chunk = 512;

        /* Print 16 bytes per line */
        for (uint32_t i = 0; i < chunk; i += 16)
        {
            uint32_t row = (chunk - i < 16) ? (chunk - i) : 16;
            int pos = 0;
            for (uint32_t j = 0; j < row; j++)
            {
                pos += sprintf(&line[pos], "%02X", sector[i + j]);
                if (j < row - 1) line[pos++] = ' ';
            }
            line[pos++] = '\r';
            line[pos++] = '\n';
            line[pos]   = '\0';
            usart_debug(line);
        }

        bytes_sent += chunk;
        current_sector++;
    }

    usart_debug("BMP_END\r\n");
}

