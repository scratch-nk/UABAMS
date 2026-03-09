
#include "stm32f4xx.h"
#include "w5500.h"
#include "spi_eth.h"

/* Socket states */
#define SOCK_ESTABLISHED  0x17

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
   Command wait (VERY IMPORTANT)
------------------------------------------------- */
static void W5500_WaitCommand(uint8_t sock)
{
    uint8_t block = 0x08 | (sock << 5);   // socket block
    while (W5500_Read(0x0001, block) != 0);
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
    return W5500_Read(0x002E, 0x00) & 0x01;  // PHYCFGR, common reg
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
------------------------------------------------- */
void W5500_TCP_Client_Connect(uint8_t sock,
                              uint8_t *server_ip, uint16_t port)
{
    uint8_t block = 0x08 | (sock << 5);

    W5500_Write(0x0000, block, 0x01);          // Sn_MR = TCP

    for (int i = 0; i < 4; i++)
        W5500_Write(0x000C + i, block, server_ip[i]); // Sn_DIPR

    W5500_Write(0x0010, block, port >> 8);     // Sn_DPORT
    W5500_Write(0x0011, block, port & 0xFF);

    W5500_Write(0x0001, block, 0x01);          // OPEN
    W5500_WaitCommand(sock);

    W5500_Write(0x0001, block, 0x04);          // CONNECT
    W5500_WaitCommand(sock);
}

/* -------------------------------------------------
   Socket status
------------------------------------------------- */
uint8_t W5500_GetSocketStatus(uint8_t sock)
{
    uint8_t block = 0x08 | (sock << 5);
    return W5500_Read(0x0003, block);          // Sn_SR
}

int W5500_Recv(uint8_t sock, uint8_t *buf, uint16_t maxlen)
{
    uint16_t rx_size1, rx_size2;
    uint16_t rx_rd;
    uint16_t offset;
    uint16_t i;

    uint8_t sock_block = 0x08 | (sock << 5);   // Socket register block
    uint8_t rx_block   = 0x18 | (sock << 5);   // RX buffer block

    /* -------------------------------------------------
       1. Read RX received size (STABLE READ)
       Datasheet rule: read until same twice
    ------------------------------------------------- */
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

    /* -------------------------------------------------
       2. Read RX read pointer
    ------------------------------------------------- */
    rx_rd  = W5500_Read(0x0028, sock_block) << 8; // Sn_RX_RD
    rx_rd |= W5500_Read(0x0029, sock_block);

    /* -------------------------------------------------
       3. Read RX buffer (CIRCULAR)
       RX buffer base = 0x6000 + sock*0x0800
       Mask = 0x07FF (2KB buffer)
    ------------------------------------------------- */
    uint16_t rx_base = 0x6000 + (sock * 0x0800);

    for (i = 0; i < rx_size1; i++)
    {
        offset = (rx_rd + i) & 0x07FF;
        buf[i] = W5500_Read(rx_base + offset, rx_block);
    }

    /* -------------------------------------------------
       4. Update RX read pointer
    ------------------------------------------------- */
    rx_rd += rx_size1;
    W5500_Write(0x0028, sock_block, (rx_rd >> 8) & 0xFF);
    W5500_Write(0x0029, sock_block,  rx_rd & 0xFF);

    /* -------------------------------------------------
       5. Notify W5500 (RECV command)
    ------------------------------------------------- */
    W5500_Write(0x0001, sock_block, 0x40); // Sn_CR = RECV
    W5500_WaitCommand(sock);

    return rx_size1;
}

int W5500_Send(uint8_t sock, uint8_t *buf, uint16_t len)
{
    uint16_t tx_wr;
    uint16_t offset;
    uint16_t i;

    uint8_t sock_block = 0x08 | (sock << 5);   // socket register block
    uint8_t tx_block   = 0x10 | (sock << 5);   // TX buffer block

    /* 1. Read TX write pointer */
    tx_wr  = W5500_Read(0x0024, sock_block) << 8; // Sn_TX_WR
    tx_wr |= W5500_Read(0x0025, sock_block);

    /* 2. TX buffer base */
    uint16_t tx_base = 0x4000 + (sock * 0x0800);

    /* 3. Write data to TX buffer (circular) */
    for (i = 0; i < len; i++)
    {
        offset = (tx_wr + i) & 0x07FF;
        W5500_Write(tx_base + offset, tx_block, buf[i]);
    }

    /* 4. Update TX write pointer */
    tx_wr += len;
    W5500_Write(0x0024, sock_block, (tx_wr >> 8) & 0xFF);
    W5500_Write(0x0025, sock_block,  tx_wr & 0xFF);

    /* 5. SEND command */
    W5500_Write(0x0001, sock_block, 0x20); // Sn_CR = SEND
    W5500_WaitCommand(sock);

    return len;
}

void W5500_CloseSocket(uint8_t sock)
{
    // Socket close command
    W5500_Write(sock, 0x0001, 0x08);
}
