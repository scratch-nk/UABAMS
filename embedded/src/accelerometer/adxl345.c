#include "stm32f4xx.h"
#include "adxl345.h"
#include "spi.h"
#include "delay.h"
#include <math.h>

/* Full resolution scale (3.9 mg/LSB) */
#define ADXL_SCALE 0.0039f

/* =====================================================
   CHIP SELECT CONTROL
   ===================================================== */

static inline void adxl_cs_select(uint8_t sensor)
{
    if (sensor == 1)
        ADXL1_CS_LOW();
    else
        ADXL2_CS_LOW();
}

static inline void adxl_cs_deselect(uint8_t sensor)
{
    if (sensor == 1)
        ADXL1_CS_HIGH();
    else
        ADXL2_CS_HIGH();
}

/* =====================================================
   LOW LEVEL SPI ACCESS
   ===================================================== */

static uint8_t adxl_spi_read(uint8_t sensor, uint8_t reg)
{
    uint8_t val;

    adxl_cs_select(sensor);
    spi1_txrx(0x80 | reg);      // READ
    val = spi1_txrx(0x00);
    adxl_cs_deselect(sensor);

    return val;
}

static void adxl_spi_write(uint8_t sensor, uint8_t reg, uint8_t data)
{
    adxl_cs_select(sensor);
    spi1_txrx(reg);
    spi1_txrx(data);
    adxl_cs_deselect(sensor);
}

/* =====================================================
   PUBLIC API
   ===================================================== */

uint8_t adxl345_read_id(uint8_t sensor)
{
    return adxl_spi_read(sensor, ADXL_DEVID);
}

void adxl345_set_range(uint8_t sensor, uint8_t range)
{
    adxl_spi_write(sensor,
                   ADXL_DATA_FORMAT,
                   (0x08 | range));   // FULL_RES = 1
}

void adxl345_set_odr(uint8_t sensor, uint8_t odr)
{
    adxl_spi_write(sensor, ADXL_BW_RATE, odr);
}

void adxl345_init(uint8_t sensor)
{
    /* Standby */
    adxl_spi_write(sensor, ADXL_POWER_CTL, 0x00);
    delay_ms(10);

    /* Measurement mode */
    adxl_spi_write(sensor, ADXL_POWER_CTL, 0x08);

    /* UBMS recommended settings */
    adxl345_set_range(sensor, ADXL_RANGE_16G);
    adxl345_set_odr(sensor, 0x0B);   // 200 Hz
}

/* =====================================================
   XYZ READ (SPI)
   ===================================================== */

void adxl345_read_xyz_spi(uint8_t sensor,
                          float *x,
                          float *y,
                          float *z)
{
    uint8_t raw[6];
    int16_t rx, ry, rz;

    adxl_cs_select(sensor);
    spi1_txrx(0xC0 | ADXL_DATAX0);   // READ + MULTI

    for (int i = 0; i < 6; i++)
        raw[i] = spi1_txrx(0x00);

    adxl_cs_deselect(sensor);

    rx = (int16_t)((raw[1] << 8) | raw[0]);
    ry = (int16_t)((raw[3] << 8) | raw[2]);
    rz = (int16_t)((raw[5] << 8) | raw[4]);

    *x = rx * ADXL_SCALE;
    *y = ry * ADXL_SCALE;
    *z = rz * ADXL_SCALE;
}
