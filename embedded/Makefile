# Root Makefile for UABAMS

export TOOLCHAIN_PREFIX ?=
export CC      = $(TOOLCHAIN_PREFIX)arm-none-eabi-gcc
export OBJCOPY = $(TOOLCHAIN_PREFIX)arm-none-eabi-objcopy
export MCU     = -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard
export DEFS    = -DSTM32F411xE
export CFLAGS  = $(MCU) -O0 -g -Wall -ffreestanding $(DEFS) -u _printf_float
export LDFLAGS_COMMON = -nostdlib -lc -lm -lgcc -lnosys

# =======================
# INCLUDE PATHS
# =======================
INCLUDES = \
-Iinclude \
-Iinclude/cmsis/Include \
-Iinclude/cmsis/Device/ST/STM32F4xx/Include \
-Isrc/common \
-Isrc/fatfs \
-Iinclude/freertos \
-Isrc/freertos/portable/GCC/ARM_CM4F

# =======================
# COMMON SOURCE FILES
# =======================
COMMON_DIR = src/common
COMMON_OBJDIR = $(COMMON_DIR)/obj

COMMON_SRC = \
 usart_debug.c \
 sdio.c \
 spi2.c \
 w5500.c \
 boot_info.c \
 ethernet_health.c \
 system_stm32f4xx.c \
 startup.s \
 syscalls.c \
 crc16.c

COMMON_OBJ = $(addprefix $(COMMON_OBJDIR)/,$(COMMON_SRC:.c=.o))
COMMON_OBJ := $(COMMON_OBJ:.s=.o)

# =======================
# FATFS FILES
# =======================
# FATFS
FATFS_DIR = src/fatfs
FATFS_OBJDIR = $(FATFS_DIR)/obj

FATFS_SRC = \
 ff.c \
 diskio.c

FATFS_OBJ = $(addprefix $(FATFS_OBJDIR)/,$(FATFS_SRC:.c=.o))

# =======================
# DEFAULT TARGET
# =======================
all: accelerometer gps_storage

bringup:
	$(MAKE) -C src/bringup

# =======================
# BUILD COMMON + FATFS
# =======================
common: $(COMMON_OBJ) $(FATFS_OBJ)

$(COMMON_OBJDIR):
	mkdir -p $(COMMON_OBJDIR)

$(FATFS_OBJDIR):
	mkdir -p $(FATFS_OBJDIR)

# Compile common C
$(COMMON_OBJDIR)/%.o: $(COMMON_DIR)/%.c | $(COMMON_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

# Compile assembly
$(COMMON_OBJDIR)/%.o: $(COMMON_DIR)/%.s | $(COMMON_OBJDIR)
	$(CC) $(CFLAGS) -c $< -o $@

# Compile FATFS
$(FATFS_OBJDIR)/%.o: $(FATFS_DIR)/%.c | $(FATFS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(FATFS_OBJDIR):
	mkdir -p $(FATFS_OBJDIR)

$(FATFS_OBJDIR)/%.o: $(FATFS_DIR)/%.c | $(FATFS_OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

# =======================
# PROJECT TARGETS
# =======================
accelerometer: common
	$(MAKE) -C src/accelerometer

gps_storage: common
	$(MAKE) -C src/gps_storage

# =======================
# CLEAN
# =======================
clean: clean-common clean-accelerometer clean-gps_storage

clean-common:
	rm -rf $(COMMON_OBJDIR)
	rm -rf $(FATFS_OBJDIR)

clean-accelerometer:
	$(MAKE) -C src/accelerometer clean

clean-gps_storage:
	$(MAKE) -C src/gps_storage clean

# =======================
# SERIAL
# =======================
seriallist:
	ls /dev/ttyACM*

serialmonitor:
	minicom -b 460800 -D /dev/ttyACM0

serialmonitor0:
	minicom -b 460800 -D /dev/ttyACM0

serialmonitor1:
	minicom -b 460800 -D /dev/ttyACM1

# =======================
# FLASH
# =======================
flash_accelometer:
	$(MAKE) -C src/accelerometer flash

flash_gpsstorage:
	$(MAKE) -C src/gps_storage flash

.PHONY: all common accelerometer gps_storage clean clean-common clean-accelerometer clean-gps_storage seriallist serialmonitor serialmonitor0 serialmonitor1