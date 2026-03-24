PROJECT_ROOT := ../..
FREERTOS_ROOT := $(PROJECT_ROOT)/src/freertos
FREERTOS_OBJDIR := freertos_obj

# Clock 
CPU_CLOCK_MHZ ?= 96

#  Compiler Flags
CC = arm-none-eabi-gcc
OBJCOPY = arm-none-eabi-objcopy
CFLAGS = -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard -O0 -g -Wall
CFLAGS += -ffreestanding -DSTM32F411xE -u _printf_float
CFLAGS += -DCPU_CLOCK_MHZ=$(CPU_CLOCK_MHZ)

# Common LDFLAGS
LDFLAGS_COMMON = -nostdlib -lc -lm -lgcc -lnosys
LDFLAGS = -T $(PROJECT_ROOT)/lib/linker.ld $(LDFLAGS_COMMON)

# Include paths
INCLUDES = -I$(PROJECT_ROOT)/include/cmsis/Include
INCLUDES += -I$(PROJECT_ROOT)/include
INCLUDES += -I$(PROJECT_ROOT)/include/freertos
INCLUDES += -I$(FREERTOS_ROOT)/portable/GCC/ARM_CM4F
INCLUDES += -I$(PROJECT_ROOT)/src/common

# Source files (local)
SRC = \
 spi.c \
 gps.c \
 sd.c \
 gps_health.c \
 main.c

# Object directories
OBJDIR = obj
COMMON_OBJ_DIR = $(PROJECT_ROOT)/src/common/obj

# Common objects (all .o files from common directory)
COMMON_OBJ = $(wildcard $(COMMON_OBJ_DIR)/*.o)

# Local objects
OBJ = $(addprefix $(OBJDIR)/,$(SRC:.c=.o))

# delay.c compiled locally
DELAY_OBJ = $(OBJDIR)/delay.o

# FreeRTOS objects
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

# Default target
all: $(TARGET) $(BIN)

# Create directories
$(OBJDIR) $(FREERTOS_OBJDIR):
	mkdir -p $@

# Compile local source files
$(OBJDIR)/%.o: %.c | $(OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

# Compile delay.c from common directory
$(DELAY_OBJ): $(PROJECT_ROOT)/src/common/delay.c | $(OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -DUSE_FREERTOS_SYSTICK -c $< -o $@

# Compile w5500.c from common directory (if needed locally)
$(OBJDIR)/w5500.o: $(PROJECT_ROOT)/src/common/w5500.c | $(OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

# ── FreeRTOS kernel rules
$(FREERTOS_OBJDIR)/tasks.o: $(FREERTOS_ROOT)/tasks.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/queue.o: $(FREERTOS_ROOT)/queue.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/list.o: $(FREERTOS_ROOT)/list.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/timers.o: $(FREERTOS_ROOT)/timers.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/stream_buffer.o: $(FREERTOS_ROOT)/stream_buffer.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/port.o: $(FREERTOS_ROOT)/portable/GCC/ARM_CM4F/port.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FREERTOS_OBJDIR)/heap_4.o: $(FREERTOS_ROOT)/portable/MemMang/heap_4.c | $(FREERTOS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

# Link target - include all objects
$(TARGET): $(OBJ) $(DELAY_OBJ) $(FREERTOS_OBJ) $(COMMON_OBJ)
	$(CC) $(CFLAGS) $^ $(LDFLAGS) -o $@

# Generate binary
$(BIN): $(TARGET)
	$(OBJCOPY) -O binary $< $@

# Flash target
flash:
	openocd -f board/st_nucleo_f4.cfg \
	        -c "program $(TARGET) verify reset exit"

# Clean
clean:
	rm -rf $(OBJDIR) $(FREERTOS_OBJDIR) *.elf *.bin

.PHONY: all clean flash
