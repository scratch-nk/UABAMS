
#include "stm32f4xx.h"
#include "w5500.h"
#include "spi_eth.h"
#include "delay.h"

/* Socket states */
#define SOCK_ESTABLISHED  0x17

/* Local source port used for TCP client connections */
#define W5500_LOCAL_PORT  5001

/* -------------------------------------------------
   Low-level SPI helpers
------------------------------------------------- */
static void W5500_Write(uint16_t addr, uint8_t block, uint8_t data)
{
    W5500_CS_LOW();
    SPI2_Transfer(addr >> 8);
    SPI2_Transfer(addr & 0xFF);
    SPI2_Transfer(block | 0x04);   // write
    SPI2_Transfer(data);
    W5500_CS_HIGH();
}

static uint8_t W5500_Read(uint16_t addr, uint8_t block)
{
    uint8_t val;
    W5500_CS_LOW();
    SPI2_Transfer(addr >> 8);
    SPI2_Transfer(addr & 0xFF);
    SPI2_Transfer(block);          // read
    val = SPI2_Transfer(0xFF);
    W5500_CS_HIGH();
    return val;
}

/* -------------------------------------------------
   Command wait — polls Sn_CR until cleared.
   Returns 0 on success, -1 on 1 s timeout.
   Sn_CR clears in microseconds under normal
   operation; timeout guards against a dead chip.
------------------------------------------------- */
static int W5500_WaitCommand(uint8_t sock)
{
    uint8_t block = 0x08 | (sock << 5);
    uint32_t start = get_tick_ms();
    while (W5500_Read(0x0001, block) != 0) {
        if ((get_tick_ms() - start) >= 1000)
            return -1;
    }
    return 0;
}

/* -------------------------------------------------
   Basic
------------------------------------------------- */
uint8_t W5500_ReadVersion(void)
{
    return W5500_Read(0x0039, 0x00);   // VERSIONR, common reg
}

uint8_t W5500_GetPHYStatus(void)
{
    return W5500_Read(0x002E, 0x00) & 0x01;  // PHYCFGR bit 0 = LNK
}

/* -------------------------------------------------
   Network config
------------------------------------------------- */
void W5500_SetNetwork(uint8_t *mac, uint8_t *ip,
                      uint8_t *sn, uint8_t *gw)
{
    for (int i = 0; i < 6; i++) W5500_Write(0x0009 + i, 0x00, mac[i]); // SHAR
    for (int i = 0; i < 4; i++) W5500_Write(0x000F + i, 0x00, ip[i]);  // SIPR
    for (int i = 0; i < 4; i++) W5500_Write(0x0005 + i, 0x00, sn[i]);  // SUBR
    for (int i = 0; i < 4; i++) W5500_Write(0x0001 + i, 0x00, gw[i]);  // GAR
}

/* -------------------------------------------------
   TCP SERVER INIT
------------------------------------------------- */
void W5500_TCP_Server_Init(uint8_t sock, uint16_t port)
{
    uint8_t block = 0x08 | (sock << 5);

    W5500_Write(0x0000, block, 0x01);          // Sn_MR = TCP
    W5500_Write(0x0004, block, port >> 8);     // Sn_PORT
    W5500_Write(0x0005, block, port & 0xFF);

    W5500_Write(0x0001, block, 0x01);          // OPEN
    W5500_WaitCommand(sock);

    W5500_Write(0x0001, block, 0x02);          // LISTEN
    W5500_WaitCommand(sock);
}

/* -------------------------------------------------
   TCP CLIENT CONNECT
   Returns 0 if OPEN+CONNECT commands were accepted
   by the chip, -1 on timeout (chip not responding).
   The 3-way handshake proceeds asynchronously after
   this returns — caller must poll
   W5500_GetSocketStatus() until SOCK_ESTABLISHED
   (0x17) before sending data.
------------------------------------------------- */
int W5500_TCP_Client_Connect(uint8_t sock,
                              uint8_t *server_ip, uint16_t port)
{
    uint8_t block = 0x08 | (sock << 5);

    W5500_Write(0x0000, block, 0x01);                    // Sn_MR = TCP

    /* Local source port — must be non-zero before OPEN.
     * Port 0 is reserved; the chip silently rejects it. */
    W5500_Write(0x0004, block, W5500_LOCAL_PORT >> 8);   // Sn_PORT MSB
    W5500_Write(0x0005, block, W5500_LOCAL_PORT & 0xFF); // Sn_PORT LSB

    for (int i = 0; i < 4; i++)
        W5500_Write(0x000C + i, block, server_ip[i]);    // Sn_DIPR

    W5500_Write(0x0010, block, port >> 8);               // Sn_DPORT
    W5500_Write(0x0011, block, port & 0xFF);

    W5500_Write(0x0001, block, 0x01);                    // Sn_CR = OPEN
    if (W5500_WaitCommand(sock) != 0) return -1;

    W5500_Write(0x0001, block, 0x04);                    // Sn_CR = CONNECT
    if (W5500_WaitCommand(sock) != 0) return -1;

    return 0;
}

/* -------------------------------------------------
   Socket status
------------------------------------------------- */
uint8_t W5500_GetSocketStatus(uint8_t sock)
{
    uint8_t block = 0x08 | (sock << 5);
    return W5500_Read(0x0003, block);          // Sn_SR
}

/* -------------------------------------------------
   W5500_Recv
------------------------------------------------- */
int W5500_Recv(uint8_t sock, uint8_t *buf, uint16_t maxlen)
{
    uint16_t rx_size1, rx_size2;
    uint16_t rx_rd;
    uint16_t i;

    uint8_t sock_block = 0x08 | (sock << 5);   // socket register block
    uint8_t rx_block   = 0x18 | (sock << 5);   // RX buffer block

    /* 1. Stable read: repeat until two consecutive reads match */
    do {
        rx_size1  = W5500_Read(0x0026, sock_block) << 8; // Sn_RX_RSR
        rx_size1 |= W5500_Read(0x0027, sock_block);

        rx_size2  = W5500_Read(0x0026, sock_block) << 8;
        rx_size2 |= W5500_Read(0x0027, sock_block);
    } while (rx_size1 != rx_size2);

    if (rx_size1 == 0)
        return 0;

    if (rx_size1 > maxlen)
        rx_size1 = maxlen;

    /* 2. Read RX read pointer */
    rx_rd  = W5500_Read(0x0028, sock_block) << 8; // Sn_RX_RD
    rx_rd |= W5500_Read(0x0029, sock_block);

    /* 3. Read RX buffer.
     * In the W5500 block-select SPI frame, the 16-bit address is the
     * offset within the selected block (0x0000-0x07FF for 2 KB).
     * The chip's physical RX base (0x6000) is NOT part of this field. */
    for (i = 0; i < rx_size1; i++) {
        uint16_t offset = (rx_rd + i) & 0x07FF;
        buf[i] = W5500_Read(offset, rx_block);
    }

    /* 4. Update RX read pointer */
    rx_rd += rx_size1;
    W5500_Write(0x0028, sock_block, (rx_rd >> 8) & 0xFF);
    W5500_Write(0x0029, sock_block,  rx_rd & 0xFF);

    /* 5. RECV command */
    W5500_Write(0x0001, sock_block, 0x40); // Sn_CR = RECV
    W5500_WaitCommand(sock);

    return rx_size1;
}

/* -------------------------------------------------
   W5500_Send
------------------------------------------------- */
int W5500_Send(uint8_t sock, uint8_t *buf, uint16_t len)
{
    uint16_t tx_wr;
    uint16_t i;

    uint8_t sock_block = 0x08 | (sock << 5);   // socket register block
    uint8_t tx_block   = 0x10 | (sock << 5);   // TX buffer block

    /* 1. Read TX write pointer */
    tx_wr  = W5500_Read(0x0024, sock_block) << 8; // Sn_TX_WR
    tx_wr |= W5500_Read(0x0025, sock_block);

    /* 2. Write data to TX buffer.
     * In the W5500 block-select SPI frame, the 16-bit address is the
     * offset within the selected block (0x0000-0x07FF for 2 KB).
     * The chip's physical TX base (0x4000) is NOT part of this field. */
    for (i = 0; i < len; i++) {
        uint16_t offset = (tx_wr + i) & 0x07FF;
        W5500_Write(offset, tx_block, buf[i]);
    }

    // 3. Update TX write pointer 
    tx_wr += len;
    W5500_Write(0x0024, sock_block, (tx_wr >> 8) & 0xFF);
    W5500_Write(0x0025, sock_block,  tx_wr & 0xFF);

    /* 4. SEND command */
    W5500_Write(0x0001, sock_block, 0x20); // Sn_CR = SEND
    W5500_WaitCommand(sock);

    return len;
}
