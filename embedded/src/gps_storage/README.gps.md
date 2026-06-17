GPS Neo-M8N-0-10

 Bare Metal vs FreeRTOS: GPS Hardware Access

  What's the same

  The low-level GPS code (gps.c) is identical in both — direct register access to USART6, polling USART6->SR & USART_SR_RXNE, reading USART6->DR one byte at a time, and assembling NMEA lines into
  the global gps_data struct. No DMA, no interrupt.

  The fundamental difference

  ┌──────────────────────┬────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────┐
  │        Aspect        │                       Bare Metal                       │                       FreeRTOS                        │
  ├──────────────────────┼────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ When gps_poll() runs │ Tight while(1) loop — catches every byte as it arrives │ Called every 100ms via vTaskDelay(pdMS_TO_TICKS(100)) │
  ├──────────────────────┼────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ CPU availability     │ 100% dedicated to polling                              │ Task sleeps, scheduler runs other tasks               │
  ├──────────────────────┼────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ UART buffering       │ Not needed — you never miss a byte                     │ Critical — bytes arrive while task sleeps             │
  ├──────────────────────┼────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ Timing guarantee     │ Deterministic                                          │ None — depends on scheduler                           │
  └──────────────────────┴────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────┘

  ---
  Why it likely fails on FreeRTOS

  The core problem: USART has no hardware FIFO

  At 9600 baud, one byte arrives every ~1.04ms.
  USART6 on STM32F411 has only a 1-byte data register — no buffer, no FIFO.

  With vTaskDelay(100ms), your task sleeps for 100ms between polls.
  In that 100ms window, ~96 bytes arrive. Only the last 2 survive in the shift register. Everything else is silently overrun and lost (the ORE flag in USART6->SR will be set).

  NMEA sentence at 9600 baud:
    "$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A\r\n"
    = ~72 bytes × 1.04ms = ~75ms to receive

  vTaskDelay(100ms) means you miss most of every sentence.

  Secondary issues to check

  1. gps_poll() reads only 1 byte per call (src/gps_storage/gps.c). Even if you shorten the delay, it reads one byte then returns — in bare metal this works because you loop back immediately.
  2. Priority starvation: GPS task is priority 1 (lowest). TCP task (priority 2) and UART task (priority 3) can starve it if they run long without yielding.
  3. No overrun error clearing: If ORE bit is set in USART6->SR, new received data may be blocked. The polling code doesn't clear error flags.
  4. SystemCoreClock dependency: Baud rate is computed as (SystemCoreClock + 4800) / 9600. If clock_config() is not called before gps_init(), SystemCoreClock may still be 16 MHz (HSI default),
  giving wrong baud rate.

  ---
  The fix (when you're ready to implement)

  The correct FreeRTOS pattern — which you already have working for USART2 (src/gps_storage/main.c:280) — is interrupt-driven with a queue:

  USART6 RX interrupt  →  xQueueSendFromISR(gpsQueue, &ch, ...)
  vGPSTask             →  xQueueReceive(gpsQueue, &ch, portMAX_DELAY)  →  assemble NMEA

  This is exactly how USART2 (debug/command UART) works in your code. GPS needs the same treatment. The gps_poll() polling approach is fundamentally incompatible with an RTOS that puts tasks to
  sleep.


-- Questions on working code.

Works. Some cleanup, code level questions. 1. Should Queue create happen after setting the interrupts or before?  2. Just to make code readable, should all the IRQs, TastCreate, priority be in    
one place? 3. Why is gps_poll calling gps_feed? Would it be cleaner to call gps_feed() in back and return True/False from GPS poll? SysTick_Config() should be called first, before we do anything    
else? 4. Do we need the for ... delay() in line 363 in main.c?  5. Does xQueueReceive block for 5 seconds? Why is there no else with this if? 6. Where is byte_rx reset to 0 or is not not required?  
7. gps_data is global, is that OK, or is it better to expose it some other way? 8. Diagnostics is only printed if gps_valid happens. What if connection never received, what diagnostic is displayed  
then? 
