PROJECT_ROOT  := ../..
FREERTOS_ROOT := $(PROJECT_ROOT)/src/freertos

# Clock
# 96: PLL on HSI — full performance, correct USB clock (48 MHz)
# 16: HSI direct — no PLL. Override: make -C src/accelerometer CPU_CLOCK_MHZ=16
CPU_CLOCK_MHZ ?= 96

LDFLAGS = -T $(PROJECT_ROOT)/lib/linker.ld $(LDFLAGS_COMMON)

INCLUDES = \
    -I$(PROJECT_ROOT)/include/cmsis/Include \
    -I$(PROJECT_ROOT)/include \
    -I$(PROJECT_ROOT)/include/freertos \
    -I$(PROJECT_ROOT)/src/freertos/portable/GCC/ARM_CM4F \
    -I$(PROJECT_ROOT)/src/common

# Inherit CFLAGS from root Makefile (includes FPU flags); add clock define.
CFLAGS_LOCAL = $(CFLAGS) -DCPU_CLOCK_MHZ=$(CPU_CLOCK_MHZ)

# ── Project sources ────────────────────────────────────────────────────────────
SRC = \
    main.c \
    health.c \
	accelerometer_health.c \
    i2c.c \
    spi.c \
    gps.c \
    adxl345.c
	
# ── Local common sources (not in COMMON_OBJ) ──────────────────────────────────
# clock_config.c  — PLL setup (needed for 96 MHz, compiled for both speeds)
# led_debug.c     — PWM LED, used for status indication
LOCAL_CSRC = \
    $(PROJECT_ROOT)/src/common/clock_config.c \
    $(PROJECT_ROOT)/src/common/led_debug.c

OBJDIR          = obj
FREERTOS_OBJDIR = freertos_obj
COMMON_OBJ      = $(wildcard ../common/obj/*.o)
OBJ             = $(addprefix $(OBJDIR)/,$(SRC:.c=.o))
LOCAL_OBJ       = $(patsubst %.c,$(OBJDIR)/%.o,$(notdir $(LOCAL_CSRC)))

# delay.c compiled with FreeRTOS SysTick guard:
#   suppresses delay.c's SysTick_Handler so the combined handler in main.c
#   can own it (calls ms_ticks++ then xPortSysTickHandler()).
DELAY_OBJ = $(OBJDIR)/delay.o

# ── FreeRTOS kernel objects ────────────────────────────────────────────────────
# Placed in a separate dir to avoid basename collisions with project objects.
FREERTOS_OBJ = \
    $(FREERTOS_OBJDIR)/tasks.o \
    $(FREERTOS_OBJDIR)/queue.o \
    $(FREERTOS_OBJDIR)/list.o \
    $(FREERTOS_OBJDIR)/timers.o \
    $(FREERTOS_OBJDIR)/stream_buffer.o \
    $(FREERTOS_OBJDIR)/port.o \
    $(FREERTOS_OBJDIR)/heap_4.o

TARGET = firmware.elf
BIN    = firmware.bin

# ── Build rules ────────────────────────────────────────────────────────────────
all: $(FREERTOS_OBJDIR) $(OBJDIR) $(TARGET) $(BIN)

$(OBJDIR) $(FREERTOS_OBJDIR):
	mkdir -p $@

# Project C objects
$(OBJDIR)/%.o: %.c | $(OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

# Local common objects (clock_config, led_debug) — explicit rules needed
# because they live outside the current directory
$(OBJDIR)/clock_config.o: $(PROJECT_ROOT)/src/common/clock_config.c | $(OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(OBJDIR)/led_debug.o: $(PROJECT_ROOT)/src/common/led_debug.c | $(OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

# delay.c — compiled with USE_FREERTOS_SYSTICK to suppress its SysTick_Handler
$(DELAY_OBJ): $(PROJECT_ROOT)/src/common/delay.c | $(OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -DUSE_FREERTOS_SYSTICK -c $< -o $@

# ── FreeRTOS kernel — explicit rules (basenames not unique across directories) ─
$(FREERTOS_OBJDIR)/tasks.o: $(FREERTOS_ROOT)/tasks.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/queue.o: $(FREERTOS_ROOT)/queue.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/list.o: $(FREERTOS_ROOT)/list.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/timers.o: $(FREERTOS_ROOT)/timers.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/stream_buffer.o: $(FREERTOS_ROOT)/stream_buffer.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/port.o: $(FREERTOS_ROOT)/portable/GCC/ARM_CM4F/port.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/heap_4.o: $(FREERTOS_ROOT)/portable/MemMang/heap_4.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

# ── Link ───────────────────────────────────────────────────────────────────────
$(TARGET): $(OBJ) $(LOCAL_OBJ) $(DELAY_OBJ) $(FREERTOS_OBJ)
	$(CC) $(CFLAGS_LOCAL) $^ $(COMMON_OBJ) $(LDFLAGS) -lm -lgcc -lnosys -o $@

$(BIN): $(TARGET)
	$(OBJCOPY) -O binary $< $@
	@echo ""
	@echo "=== Accelerometer (FreeRTOS) build OK: $(BIN) ==="
	@echo "    Flash with: make -C embedded/src/accelerometer flash"

flash:
	openocd -f board/st_nucleo_f4.cfg \
	        -c "program $(TARGET) verify reset exit"

clean:
	rm -rf $(OBJDIR) $(FREERTOS_OBJDIR) *.elf *.bin

.PHONY: all flash clean
