For pin-out: search "stm32 f411re pinout"
https://www.oreilly.com/library/view/arm-based-microcontroller-projects/9780081029701/B978008102969509995X.xhtml

Accelerometer is connected via I2C

From accelerometer/spi.h
/*
 SPI1 PINS (STM32F411)
 --------------------
 
 PA4(A2)  -> CS (Manual GPIO)
 GND      -> GND
 VCC      -> 3V3
 PA5(D13) -> SCK (SCL)  Serial clock
 PA6(D12) -> MISO (SDO in chip)
 PA7(D11) -> MOSI (SDA in chip)
*/

For common/i2c.h
----------------
TODO

Note: If connecting Sensor # 2, the pinouts remain the same, just that the CS (Chip select changes)



