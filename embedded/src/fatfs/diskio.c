/*
 * diskio.c — FatFs disk I/O layer for STM32F411 bare-metal SDIO driver
 *
 * Bridges FatFs disk_read/disk_write to SD_ReadBlock/SD_WriteBlock
 * defined in main.c.
 *
 * FatFs uses sector numbers (not byte addresses).
 */

#include "diskio.h"
#include "ffconf.h"

/* Declared in sdio.c */
extern int      SD_WriteBlock(unsigned int sector, const unsigned char *buf512, unsigned short rca);
extern int      SD_ReadBlock (unsigned int sector, unsigned char *buf512);
extern unsigned short g_sd_rca;   /* global RCA set after card init */

/* -----------------------------------------------------------------------
 * disk_initialize
 * Card is already initialised before FatFs is mounted, so just return OK.
 * ----------------------------------------------------------------------- */
DSTATUS disk_initialize(BYTE pdrv)
{
    if (pdrv != 0) return STA_NOINIT;
    return 0; /* RES_OK — no STA_NOINIT bit */
}

/* -----------------------------------------------------------------------
 * disk_status
 * ----------------------------------------------------------------------- */
DSTATUS disk_status(BYTE pdrv)
{
    if (pdrv != 0) return STA_NOINIT;
    return 0;
}

/* -----------------------------------------------------------------------
 * disk_read
 * ----------------------------------------------------------------------- */
DRESULT disk_read(BYTE pdrv, BYTE *buff, DWORD sector, UINT count)
{
    if (pdrv != 0) return RES_PARERR;
    for (UINT i = 0; i < count; i++)
    {
        if (!SD_ReadBlock(sector + i, buff + i * 512))
            return RES_ERROR;
    }
    return RES_OK;
}

/* -----------------------------------------------------------------------
 * disk_write
 * ----------------------------------------------------------------------- */
DRESULT disk_write(BYTE pdrv, const BYTE *buff, DWORD sector, UINT count)
{
    if (pdrv != 0) return RES_PARERR;
    for (UINT i = 0; i < count; i++)
    {
        if (!SD_WriteBlock(sector + i, buff + i * 512, g_sd_rca))
            return RES_ERROR;
    }
    return RES_OK;
}

/* -----------------------------------------------------------------------
 * disk_ioctl
 * ----------------------------------------------------------------------- */
DRESULT disk_ioctl(BYTE pdrv, BYTE cmd, void *buff)
{
    if (pdrv != 0) return RES_PARERR;

    switch (cmd)
    {
        case CTRL_SYNC:
            return RES_OK;

        case GET_SECTOR_SIZE:
            *(WORD *)buff = 512;
            return RES_OK;

        case GET_SECTOR_COUNT:
            /* 65536 sectors = 32MB — small enough that f_mkfs finishes
             * in ~2 seconds using polled SDIO writes. */
            *(DWORD *)buff = 65536UL;
            return RES_OK;

        case GET_BLOCK_SIZE:
            /* Erase block size in sectors — 1 is always safe */
            *(DWORD *)buff = 1;
            return RES_OK;

        default:
            return RES_PARERR;
    }
}
