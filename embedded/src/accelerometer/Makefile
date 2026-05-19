PROJECT_ROOT  := ../..
FREERTOS_ROOT := $(PROJECT_ROOT)/src/freertos

# Clock
CPU_CLOCK_MHZ ?= 96
CC = arm-none-eabi-gcc

LDFLAGS = -T $(PROJECT_ROOT)/lib/linker.ld $(LDFLAGS_COMMON)

INCLUDES = \
    -I$(PROJECT_ROOT)/include/cmsis/Include \
    -I$(PROJECT_ROOT)/include \
    -I$(PROJECT_ROOT)/include/freertos \
    -I$(PROJECT_ROOT)/src/freertos/portable/GCC/ARM_CM4F \
    -I$(PROJECT_ROOT)/src/common \
    -I$(PROJECT_ROOT)/src/fatfs

CFLAGS_LOCAL = $(CFLAGS) -DCPU_CLOCK_MHZ=$(CPU_CLOCK_MHZ)

# ── Project sources ─────────────────────────
SRC = \
    main.c \
    health.c \
    accelerometer_health.c \
    i2c.c \
    spi.c \
    gps.c \
    gpsAcc.c \
    adxl345.c

# ── Local common sources ────────────────────
LOCAL_CSRC = \
    $(PROJECT_ROOT)/src/common/clock_config.c \
    $(PROJECT_ROOT)/src/common/led_debug.c \
    $(PROJECT_ROOT)/src/common/gps_health.c

OBJDIR          = obj
FREERTOS_OBJDIR = freertos_obj

COMMON_OBJ = $(wildcard ../common/obj/*.o)
FATFS_OBJ = $(wildcard ../../src/fatfs/obj/*.o)

OBJ       = $(addprefix $(OBJDIR)/,$(SRC:.c=.o))
LOCAL_OBJ = $(patsubst %.c,$(OBJDIR)/%.o,$(notdir $(LOCAL_CSRC)))

DELAY_OBJ = $(OBJDIR)/delay.o

# ── FreeRTOS ───────────────────────────────
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

# ── Build ──────────────────────────────────
all: $(FREERTOS_OBJDIR) $(OBJDIR) $(TARGET) $(BIN)

$(OBJDIR) $(FREERTOS_OBJDIR):
	mkdir -p $@

$(OBJDIR)/%.o: %.c | $(OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(OBJDIR)/clock_config.o: $(PROJECT_ROOT)/src/common/clock_config.c | $(OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(OBJDIR)/led_debug.o: $(PROJECT_ROOT)/src/common/led_debug.c | $(OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(OBJDIR)/gps_health.o: $(PROJECT_ROOT)/src/common/gps_health.c | $(OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -c $< -o $@

$(DELAY_OBJ): $(PROJECT_ROOT)/src/common/delay.c | $(OBJDIR)
	$(CC) $(CFLAGS_LOCAL) $(INCLUDES) -DUSE_FREERTOS_SYSTICK -c $< -o $@

# ── FreeRTOS compile ───────────────────────
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

# ── LINK (FIXED) ───────────────────────────
$(TARGET): $(OBJ) $(LOCAL_OBJ) $(DELAY_OBJ) $(FREERTOS_OBJ)
	$(CC) -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard \
	$^ $(COMMON_OBJ) $(FATFS_OBJ) $(LDFLAGS) -lm -lgcc -lnosys -o $@

$(BIN): $(TARGET)
	$(OBJCOPY) -O binary $< $@
	@echo ""
	@echo "=== Accelerometer (FreeRTOS) build OK: $(BIN) ==="

flash:
	openocd -f board/st_nucleo_f4.cfg \
	        -c "program $(TARGET) verify reset exit"

clean:
	rm -rf $(OBJDIR) $(FREERTOS_OBJDIR) *.elf *.bin

.PHONY: all flash clean