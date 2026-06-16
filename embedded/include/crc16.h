#ifndef CRC16_H
#define CRC16_H

#include <stdint.h>

/**
 * @brief Calculate CRC16-CCITT (Polynomial: 0x1021, Init: 0xFFFF)
 * 
 * @param data Pointer to data buffer
 * @param length Length of data
 * @return uint16_t Calculated CRC
 */
uint16_t crc16_ccitt(const uint8_t *data, uint16_t length);

#endif /* CRC16_H */
