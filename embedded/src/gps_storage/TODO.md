# TODO / Cleanup Checklist
# Date: Mon Mar 30 09:04:00 PM IST 2026

---

## main.c

- [ ] **USART2 missing interrupt priority** ← bug
  `USART2_IRQHandler` calls `xQueueSendFromISR` but USART2_IRQn has no `NVIC_SetPriority` call.
  Default priority after reset is 0 (highest), which is < `configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY` (5).
  Calling FreeRTOS FromISR APIs from a priority-0 ISR can corrupt the scheduler.
  Fix: add `NVIC_SetPriority(USART2_IRQn, 6);` before `NVIC_EnableIRQ(USART2_IRQn)`.

- [ ] **TCP receive loop — operator precedence bug**
  `W5500_Recv(0, rx_buf, sizeof(rx_buf) > 0)` passes `1` (not 512) — `>` binds tighter than `,`.
  The `if (len > 0)` block after the while loop is dead code (loop exits when len == 0).
  Fix: `while ((len = W5500_Recv(0, rx_buf, sizeof(rx_buf) - 1)) > 0)` and remove dead block.

- [ ] **`int len` declared inside a `case` — C jump-over UB**
  `int len` is declared inside `case 0x17:` without braces; other cases can jump over it.
  Fix: declare `int len = 0;` before the `switch` statement.

- [ ] **`xTaskCreate` return unchecked for GPS and UART tasks**
  GPS and UART task creates have no error check — silent failure if heap is exhausted.
  Fix: mirror the existing check used for TCPSimpleTask.

- [ ] **Task priority inversion**
  UartTask (debug HELLO/RESET commands) is priority 3, GPSTask is priority 1.
  GPS data arrives continuously at 9600 baud; if outranked, the 128-byte queue overflows silently.
  Fix: raise GPSTask to priority 3, lower UartTask.

- [ ] **SysTick_Config called too late**
  Currently called after SPI2_Init. Move to right after `USART2_Init()` so `ms_ticks` /
  `get_tick_ms()` are valid throughout the entire init phase.

- [ ] **gps_rtc_init() called too late**
  Only touches PWR/LSI/RCC — no dependency on USART6, SPI, or queues.
  Move to right after SysTick_Config.

- [ ] **Unused global `rx_byte`** — declared at file scope, never referenced. Remove.

- [ ] **`delay()` busy-wait function** — 500k-iteration spin kept "for compatibility".
  Remove the function and the `for (i < 10) { delay(); }` call in main().

- [ ] **Per-byte UART echo in vUartTask** — `// 🔥 DEBUG (IMPORTANT)` + `usart_debug("RX: %c\r\n", ch)`
  floods the console. Remove both lines.

- [ ] `// W5500 version cheek` → `// W5500 version check`
- [ ] `// server Again start` → `// restart server`

---

## gps.c

- [ ] **Move RXNEIE + NVIC setup into `gps_usart6_init()`**
  main.c sets RXNEIE, NVIC priority, and NVIC enable after calling `gps_usart6_init()`.
  These belong inside `gps_usart6_init()` — all USART6 setup in one place.
  The FreeRTOS syscall priority constraint comment (≥ 5) should move with it.

- [ ] **AFR shift UB — use unsigned literals**
  `0xF << 28` shifts a signed `int` into bit 31 (the sign bit) — undefined behaviour in C.
  Fix:
  ```c
  GPIOC->AFR[0] &= ~((0xFU << (6*4)) | (0xFU << (7*4)));
  GPIOC->AFR[0] |=  ( 8U   << (6*4)) | ( 8U   << (7*4));
  ```

- [ ] **Wrong comment on `gps_usart6_init()`** — says `USART3 – PB10 / PB11`; fix to `USART6 – PC6 / PC7`

---

## gps_health.c

- [ ] **Hardcoded satellite count**
  `sprintf(buf, "SATELLITES     : %d\r\n", 7)` — `7` is a placeholder, meaningless at boot.
  Replace with `usart_debug("SATELLITES     : N/A\r\n");` and remove `buf` + `sprintf`.
