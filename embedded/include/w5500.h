#ifndef W5500_H
#define W5500_H

#include <stdint.h>
/* ---------- BASIC ---------- */
uint8_t W5500_ReadVersion(void);
uint8_t W5500_GetPHYStatus(void);
/* ---------- NETWORK ---------- */
void W5500_SetNetwork(uint8_t *mac,
                      uint8_t *ip,
                      uint8_t *sn,
                      uint8_t *gw);
/* ---------- TCP ---------- */
void W5500_TCP_Server_Init(uint8_t sock, uint16_t port);
int  W5500_TCP_Client_Connect(uint8_t sock,
                              uint8_t *server_ip,
                              uint16_t port);

uint8_t W5500_GetSocketStatus(uint8_t sock);
/* ---------- DATA ---------- */
int W5500_Send(uint8_t sock, uint8_t *buf, uint16_t len);
int W5500_Recv(uint8_t sock, uint8_t *buf, uint16_t maxlen);

/* ------- CHIP CONTROL ---------- */
void W5500_CloseSocket(uint8_t sock);
/* ---------- CHIP CONTROL ---------- */
/* These macros must already exist somewhere */
#define W5500_CS_LOW()   (GPIOB->BSRR = (1 << (12 + 16)))
#define W5500_CS_HIGH()  (GPIOB->BSRR = (1 << 12))
#define W5500_RST_LOW()  (GPIOB->BSRR = (1 << (3 + 16)))
#define W5500_RST_HIGH() (GPIOB->BSRR = (1 << 3))
#endif
