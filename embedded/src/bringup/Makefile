# Bringup Makefile — FreeRTOS Phase A smoke test
#
# Builds a minimal image: LED blink + UART heartbeat, no SPI/accelerometer.
#
# Usage:
#   make -C embedded/src/bringup                  (96 MHz PLL, default)
#   make -C embedded/src/bringup CPU_CLOCK_MHZ=16 (HSI direct, no PLL)
#
# Or from the embedded/ root:
#   make bringup

PROJECT_ROOT  := $(realpath ../..)
FREERTOS_ROOT := $(PROJECT_ROOT)/src/freertos

# ── Clock (see README.FreeRTOS.md §Step 0b) ──────────────────────────────
# 96: PLL on HSI — full performance, correct USB clock (48 MHz)
# 16: HSI direct — no PLL code runs, useful for debug/low-power testing
CPU_CLOCK_MHZ ?= 96

TARGET  = bringup.elf
BINFILE = bringup.bin
OBJDIR  = obj
FRTOBJD = freertos_obj

# ── Sources ───────────────────────────────────────────────────────────────
# Deliberately minimal — only what Phase A needs
SRCS = \
    main.c \
    $(PROJECT_ROOT)/src/common/usart_debug.c \
    $(PROJECT_ROOT)/src/common/clock_config.c \
    $(PROJECT_ROOT)/src/common/led_debug.c \
    $(PROJECT_ROOT)/src/common/system_stm32f4xx.c \
    $(PROJECT_ROOT)/src/common/syscalls.c

ASM_SRCS = $(PROJECT_ROOT)/src/common/startup.s

# ── FreeRTOS kernel objects ───────────────────────────────────────────────
FREERTOS_OBJ = \
    $(FRTOBJD)/tasks.o \
    $(FRTOBJD)/queue.o \
    $(FRTOBJD)/list.o \
    $(FRTOBJD)/timers.o \
    $(FRTOBJD)/stream_buffer.o \
    $(FRTOBJD)/port.o \
    $(FRTOBJD)/heap_4.o

# ── Compiler/linker flags ─────────────────────────────────────────────────
MCU     = -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard
CFLAGS  = $(MCU) -O0 -g -Wall -DSTM32F411xE -DCPU_CLOCK_MHZ=$(CPU_CLOCK_MHZ)
LDFLAGS = $(MCU) -T$(PROJECT_ROOT)/lib/linker.ld -nostartfiles \
          -Wl,--gc-sections -lc -lm -lgcc -lnosys

INCLUDES = \
    -I. \
    -I$(PROJECT_ROOT)/include \
    -I$(PROJECT_ROOT)/include/cmsis/Include \
    -I$(PROJECT_ROOT)/include/freertos \
    -I$(PROJECT_ROOT)/src/freertos/portable/GCC/ARM_CM4F \
    -I$(PROJECT_ROOT)/src/common

# ── Build rules ───────────────────────────────────────────────────────────
OBJ = $(patsubst %.c,$(OBJDIR)/%.o,$(notdir $(SRCS))) \
      $(patsubst %.s,$(OBJDIR)/%.o,$(notdir $(ASM_SRCS)))

all: $(FRTOBJD) $(OBJDIR) $(BINFILE)

$(BINFILE): $(TARGET)
	$(OBJCOPY) -O binary $< $@
	@echo ""
	@echo "=== Phase A bringup build OK: $(BINFILE) ==="
	@echo "    Flash with: make -C embedded/src/bringup flash"
	@echo "    Monitor:    minicom -b 115200 -D /dev/ttyACM0"

$(TARGET): $(OBJ) $(FREERTOS_OBJ)
	$(CC) $(CFLAGS) $^ $(LDFLAGS) -o $@

# C objects — vpath lets make find sources in subdirectories
vpath %.c $(sort $(dir $(SRCS)))
$(OBJDIR)/%.o: %.c | $(OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

# Assembly
vpath %.s $(PROJECT_ROOT)/src/common
$(OBJDIR)/startup.o: startup.s | $(OBJDIR)
	$(CC) $(MCU) -c $< -o $@

# FreeRTOS kernel — explicit rules needed (non-unique basenames across dirs)
$(FRTOBJD)/tasks.o:        $(FREERTOS_ROOT)/tasks.c        | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FRTOBJD)/queue.o:        $(FREERTOS_ROOT)/queue.c        | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FRTOBJD)/list.o:         $(FREERTOS_ROOT)/list.c         | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FRTOBJD)/timers.o:       $(FREERTOS_ROOT)/timers.c       | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FRTOBJD)/stream_buffer.o: $(FREERTOS_ROOT)/stream_buffer.c | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FRTOBJD)/port.o: $(FREERTOS_ROOT)/portable/GCC/ARM_CM4F/port.c | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FRTOBJD)/heap_4.o: $(FREERTOS_ROOT)/portable/MemMang/heap_4.c  | $(FRTOBJD)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(OBJDIR) $(FRTOBJD):
	mkdir -p $@

flash:
	openocd -f board/st_nucleo_f4.cfg \
	        -c "program $(TARGET) verify reset exit"

clean:
	rm -rf $(OBJDIR) $(FRTOBJD) $(TARGET) $(BINFILE)

.PHONY: all flash clean
