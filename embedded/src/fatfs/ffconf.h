/*
 * ffconf.h — FatFs configuration for STM32F411 bare-metal SDIO project
 */

#define _FFCONF 68300

#define _FS_READONLY    0   /* Read/Write */
#define _FS_MINIMIZE    0   /* All basic functions enabled */
#define _USE_STRFUNC    1   /* Enable f_puts / f_printf */
#define _USE_FIND       0
#define _USE_MKFS       1   /* Enable f_mkfs so we can format the card */
#define _USE_FASTSEEK   0
#define _USE_EXPAND     0
#define _USE_CHMOD      0
#define _USE_LABEL      0
#define _USE_FORWARD    0

#define _CODE_PAGE      437  /* US ASCII */
#define _USE_LFN        0    /* No long filenames — saves RAM */
#define _MAX_LFN        12
#define _LFN_UNICODE    0
#define _STRF_ENCODE    3
#define _FS_RPATH       0

#define _VOLUMES        1    /* One drive (the SD card) */
#define _STR_VOLUME_ID  0
#define _VOLUME_STRS    "SD"
#define _MULTI_PARTITION 0

#define _MIN_SS         512
#define _MAX_SS         512

#define _USE_TRIM       0
#define _FS_NOFSINFO    0
#define _FS_TINY        0   /* Use full 512-byte sector buffer inside FatFs */
#define _FS_EXFAT       0
#define _FS_NORTC       1   /* No RTC — use fixed timestamp */
#define _NORTC_MON      1
#define _NORTC_MDAY     1
#define _NORTC_YEAR     2024
#define _FS_LOCK        0   /* No re-entrancy needed (no RTOS) */
#define _FS_REENTRANT   0
#define _FS_TIMEOUT     1000
#define _SYNC_t         int
