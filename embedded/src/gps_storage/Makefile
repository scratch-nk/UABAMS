PROJECT_ROOT := ../..

LDFLAGS = -T $(PROJECT_ROOT)/lib/linker.ld $(LDFLAGS_COMMON)

INCLUDES = -I$(PROJECT_ROOT)/include/cmsis/Include -I$(PROJECT_ROOT)/include

SRC = \
 spi.c \
 gps.c \
 sd.c \
 main.c

OBJDIR = obj
COMMON_OBJ = $(wildcard ../common/obj/*.o)
OBJ = $(addprefix $(OBJDIR)/,$(SRC:.c=.o))

# delay.c compiled locally — removed from COMMON_SRC to avoid SysTick
# conflict when FreeRTOS is added to the accelerometer target in Phase B.
DELAY_OBJ = $(OBJDIR)/delay.o

TARGET = firmware.elf
BIN    = firmware.bin

all: $(TARGET) $(BIN)

$(OBJDIR):
	mkdir -p $(OBJDIR)

$(OBJDIR)/%.o: %.c | $(OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(DELAY_OBJ): $(PROJECT_ROOT)/src/common/delay.c | $(OBJDIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(TARGET): $(OBJ) $(DELAY_OBJ)
	$(CC) $(CFLAGS) $(OBJ) $(DELAY_OBJ) $(COMMON_OBJ) $(LDFLAGS) -o $@

$(BIN): $(TARGET)
	$(OBJCOPY) -O binary $< $@

flash:
	openocd -f board/st_nucleo_f4.cfg \
	        -c "program $(TARGET) verify reset exit"

clean:
	rm -rf $(OBJDIR)/* *.elf *.bin

.PHONY: all clean flash
	
