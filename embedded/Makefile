# Root Makefile for UABAMS
export TOOLCHAIN_PREFIX ?= /usr/local/bin/gcc-arm-none-eabi-10.3-2021.10/bin/
export CC      = $(TOOLCHAIN_PREFIX)arm-none-eabi-gcc
export OBJCOPY = $(TOOLCHAIN_PREFIX)arm-none-eabi-objcopy
export MCU     = -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard
export DEFS    = -DSTM32F411xE
export CFLAGS  = $(MCU) -O0 -g -Wall -ffreestanding $(DEFS) -u _printf_float
export LDFLAGS_COMMON = -nostdlib -lc -lm -lgcc -lnosys

INCLUDES = -Iinclude/cmsis/Include -Iinclude

# Common source files
COMMON_DIR = src/common
COMMON_OBJDIR = $(COMMON_DIR)/obj

COMMON_SRC = \
 usart_debug.c \
 spi2.c \
 w5500.c \
 boot_info.c \
 ethernet_health.c \
 system_stm32f4xx.c \
 startup.s \
 syscalls.c

COMMON_OBJ = $(addprefix $(COMMON_OBJDIR)/,$(COMMON_SRC:.c=.o))
COMMON_OBJ := $(COMMON_OBJ:.s=.o)

# Default: build all projects
all: accelerometer gps_storage

bringup:
	$(MAKE) -C src/bringup

# Build common objects
common: $(COMMON_OBJ)

$(COMMON_OBJDIR):
	mkdir -p $(COMMON_OBJDIR)

$(COMMON_OBJDIR)/%.o: $(COMMON_DIR)/%.c | $(COMMON_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(COMMON_OBJDIR)/%.o: $(COMMON_DIR)/%.s | $(COMMON_OBJDIR)
	$(CC) $(CFLAGS) -c $< -o $@

# Project targets
accelerometer: common
	$(MAKE) -C src/accelerometer

gps_storage: common
	$(MAKE) -C src/gps_storage

# Clean targets
clean: clean-common clean-accelerometer clean-gps_storage

clean-common:
	rm -rf $(COMMON_OBJDIR)

clean-accelerometer:
	$(MAKE) -C src/accelerometer clean

clean-gps_storage:
	$(MAKE) -C src/gps_storage clean

# Serial targets
seriallist:
	ls /dev/ttyACM*

serialmonitor:
	minicom -b 115200 -D /dev/ttyACM0

serialmonitor0:
	minicom -b 115200 -D /dev/ttyACM0

serialmonitor1:
	minicom -b 115200 -D /dev/ttyACM1

flash_accelometer:
	$(MAKE) -C src/accelerometer  flash

flash_gpsstorage:
	$(MAKE) -C src/gps_storage flash

.PHONY: all common accelerometer gps_storage clean clean-common clean-accelerometer clean-gps_storage seriallist serialmonitor serialmonitor0 serialmonitor1

