#!/usr/bin/env python3
"""
STM32 ADXL345 Bridge to Railway Monitoring System
Reads accelerometer data from STM32 via serial and publishes to MQTT
"""

import serial
import serial.tools.list_ports
import paho.mqtt.client as mqtt
import json
import time
import re
import signal
import sys
import argparse
from datetime import datetime, timedelta

# Configuration
# MQTT_HOST = "192.168.0.125"
MQTT_HOST = "localhost"
MQTT_PORT = 1883
MQTT_TOPIC = "sensor/railway/accelerometer/stm32"
BAUD_RATE = 115200
SERIAL_PORT = None  # Will auto-detect

# Global flag
running = True

def signal_handler(sig, frame):
    global running
    print("\nShutting down...")
    running = False
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

def find_stm32_port():
    """Auto-detect STM32 serial port"""
    ports = serial.tools.list_ports.comports()
    
    # Common STM32 USB-Serial identifiers
    stm32_vendors = ['STMicro', 'STM32', 'USB Serial', 'CP210', 'CH340', 'FTDI']
    
    for port in ports:
        print(f"Checking {port.device}: {port.description}")
        for vendor in stm32_vendors:
            if vendor.lower() in port.description.lower():
                print(f" Found STM32 on {port.device}")
                return port.device
    
    # If no match, ask user
    if ports:
        print("\nAvailable ports:")
        for i, port in enumerate(ports):
            print(f"{i}: {port.device} - {port.description}")
        
        choice = input("\nSelect port number: ")
        try:
            return ports[int(choice)].device
        except:
            return None
        return None

def parse_accelerometer_data(line, option):
    """
    Parse the USART output line: "X=1  Y=-13  Z=-262"
    Returns tuple (x_g, y_g, z_g, x_raw, y_raw, z_raw)
    """

    # Pattern to match X=1 Y=-13 Z=-262 (handles negative numbers)
    # pattern = r'X=(-?\d+)\s+Y=(-?\d+)\s+Z=(-?\d+)'
    # Pattern to match float values (with decimal place)
    pattern = r'X=(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+Y=(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+Z=(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)'
    match = re.search(pattern, line)
    
    if match:
        # print (f"unparsed line: {line}")
        # ADXL345 with ±2g range: 1g = 256 LSB
        # At rest, Z should read about +256 (1g) or -256 depending on orientation
        SCALE_FACTOR = 256.0
        
        x_raw = float (match.group(1))
        y_raw = float (match.group(2))
        z_raw = float (match.group(3))
        
        # Convert to g
        x_g = x_raw / SCALE_FACTOR
        y_g = y_raw / SCALE_FACTOR
        z_g = z_raw / SCALE_FACTOR
        
        print(f"Parsed: raw=({x_raw}, {y_raw}, {z_raw}) -> g=({x_g:.3f}, {y_g:.3f}, {z_g:.3f})")
        
        return x_g, y_g, z_g, x_raw, y_raw, z_raw
    
    if option == 'd':
        print(f"{line}")
    return None

def calculate_peak_g(x_g, y_g, z_g):
    """Calculate resultant g-force"""
    return (x_g*x_g + y_g*y_g + z_g*z_g)**0.5

def determine_severity(peak_g):
    """Determine severity based on g-force"""
    if peak_g > 16:
        return "HIGH"
    elif peak_g > 8:
        return "MEDIUM"
    elif peak_g > 2:
        return "LOW"
    return "NORMAL"

def main():
    global running

    parser = argparse.ArgumentParser(description="STM32 ADXL345 Bridge")
    parser.add_argument("-t", "--tty", help="Serial port (e.g., /dev/ttyUSB0)")
    parser.add_argument("-d", "--debug", action="store_true", help="Debug: print unparsed lines")
    args = parser.parse_args()
    option = 'd' if args.debug else None

    print("STM32 ADXL345 Bridge Starting...")
    print("====================================")

    if args.tty:
        port = args.tty
        print(f"\nUsing specified port: {port}")
    else:
        # Find STM32 serial port
        print("\n🔍 Detecting STM32 serial port...")
        port = find_stm32_port()

        if not port:
            print(" Could not find STM32 port. Please specify manually:")
            port = input("Enter serial port (e.g., /dev/ttyUSB0): ").strip()
    
    # Connect to serial
    try:
        # TODO: Create server on port 1234 and read data instead of serial port
        #
        ser = serial.Serial(
            port=port,
            baudrate=BAUD_RATE,
            timeout=1,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS
        )
        print(f" Connected to STM32 on {port} at {BAUD_RATE} baud")
    except Exception as e:
        print(f" Failed to open serial port: {e}")
        return
    
    # Connect to MQTT
    client = mqtt.Client()
    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.loop_start()
        print(f" Connected to MQTT broker at {MQTT_HOST}:{MQTT_PORT}")
    except Exception as e:
        print(f" Failed to connect to MQTT: {e}")
        ser.close()
        return
    
    print("\n Reading accelerometer data...")
    print("Press Ctrl+C to stop\n")
    
    sample_count = 0
    
    while running:
        try:
            # Read line from STM32
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            
            if line:
                # Parse accelerometer values
                result = parse_accelerometer_data(line, option)
                
                if result:
                    x_g, y_g, z_g, x_raw, y_raw, z_raw = result
                    peak_g = calculate_peak_g(x_g, y_g, z_g)
                    severity = determine_severity(peak_g)
                    
                    # Create MQTT payload
                    payload = {
                        "timestamp": (datetime.utcnow() + timedelta(hours=5, minutes=30)).isoformat() ,
                        "x": round(x_g, 3),
                        "y": round(y_g, 3),
                        "z": round(z_g, 3),
                        "x_raw": x_raw,
                        "y_raw": y_raw,
                        "z_raw": z_raw,
                        "peak_g": round(peak_g, 3),
                        "severity": severity,
                        "device_id": "stm32_adxl345",
                        "sample_rate": 10  # Your STM32 delay is ~2M cycles
                    }
                    
                    # Publish to MQTT
                    client.publish(MQTT_TOPIC, json.dumps(payload))
                    
                    # Print to console with color
                    sample_count += 1
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    
                    if severity != "NORMAL":
                        # Highlight impacts in red
                        print(f"[{timestamp}] X:{x_g:6.3f}g ({x_raw:5d}) Y:{y_g:6.3f}g ({y_raw:5d}) Z:{z_g:6.3f}g ({z_raw:5d}) | Peak:{peak_g:6.3f}g | {severity}")
                    else:
                        print(f"[{timestamp}] X:{x_g:6.3f} Y:{y_g:6.3f} Z:{z_g:6.3f} | Peak:{peak_g:6.3f}g")
                    
            # Small sleep to prevent CPU hogging
            time.sleep(0.001)
            
        except serial.SerialException as e:
            print(f" Serial error: {e}")
            break
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f" Error: {e}")
            continue
    
    # Cleanup
    print("\n Cleaning up...")
    client.loop_stop()
    client.disconnect()
    ser.close()
    print("Done")

if __name__ == "__main__":
    main()
