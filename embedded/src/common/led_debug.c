/* led_debug.c -- using LED to debug, using brighness, delay  */
#include "stm32f4xx.h"
#include "led_debug.h"

/* Not sure what this is doing */
void LED_PWM_Init(void) {
    // Enable clocks
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;
    
    // PA5 as AF1 (TIM2_CH1)
    GPIOA->MODER &= ~(3U << (5 * 2));
    GPIOA->MODER |= (2U << (5 * 2));  // Alternate function
    GPIOA->AFR[0] &= ~(0xF << (5 * 4));
    GPIOA->AFR[0] |= (1U << (5 * 4));  // AF1
    
    // Configure TIM2
    TIM2->PSC = 83;  // 84MHz / 84 = 1MHz
    TIM2->ARR = 999; // 1MHz / 1000 = 1kHz PWM
    TIM2->CCR1 = 0;  // Start at 0% duty cycle
    TIM2->CCMR1 = TIM_CCMR1_OC1M_2 | TIM_CCMR1_OC1M_1;  // PWM mode 1
    TIM2->CCER = TIM_CCER_CC1E;  // Enable output
    TIM2->CR1 = TIM_CR1_CEN;  // Start timer
}

void LED_SetBrightness(uint16_t brightness) {
    // brightness: 0 (off) to 1000 (full bright)
    TIM2->CCR1 = brightness;
}


void LED_Init(void) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    GPIOA->MODER &= ~(3U << (5 * 2));
    GPIOA->MODER |= (1U << (5 * 2));  // Output mode
}

void LED_On(void) {
    GPIOA->BSRR = GPIO_BSRR_BS5;
}

void LED_Off(void) {
    GPIOA->BSRR = GPIO_BSRR_BR5;
}

void LED_Toggle(void) {
    GPIOA->ODR ^= GPIO_ODR_OD5;
}

