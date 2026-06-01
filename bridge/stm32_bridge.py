#!/usr/bin/env python3

import serial
import serial.tools.list_ports
import paho.mqtt.client as mqtt
import time
import signal
import sys
import argparse
import json
import struct


# ================= MQTT CONFIG =================
#MQTT_HOST = "172.27.30.92"
MQTT_HOST = "192.168.0.156"
#MQTT_HOST = "10.45.192.92"
MQTT_PORT = 1883

MQTT_TOPIC_LEFT                = "adj/datalogger/sensors/left"
MQTT_TOPIC_RIGHT               = "adj/datalogger/sensors/right"
MQTT_TOPIC_EVENT_GPS           = "adj/datalogger/sensors/gps"
MQTT_TOPIC_EVENT               = "adj/datalogger/sensors/event"

MQTT_TOPIC_HEALTH              = "adj/datalogger/health"
MQTT_TOPIC_HEALTH_JUNCTION_BOX = "adj/datalogger/health/junction_box"  # Health of junction box board
MQTT_TOPIC_HEALTH_DATA_LOGGER  = "adj/datalogger/health/data_logger"   # Health of data logger board

MQTT_TOPIC_CLIENT_REQUEST      = "adj/datalogger/client_request"       # Client request sent to Junction box viw MQTT

BAUD_RATE = 460800

running = True
ser = None 
# ================= SIGNAL =================
def signal_handler(sig, frame):
    global running
    print("\nShutting down...")
    running = False
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# ================= CRC16 =================
def crc16_ccitt(data: bytes):
    crc = 0xFFFF
    for byte in data:
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
            crc &= 0xFFFF
    return crc

# ================= PORT DETECT =================
def pack_sensor_data(tag, parts):
    try:
        tag_val = 1 if tag == "S1" else 2
        # S1,Ax,Ay,Az,RMS-V,RMS-L,SD-V,SD-L,P2P-V,P2P-L,PEAK,Uptime,LAT:0,LON:0,SAT:0,TIME:00:00:00,DATE:00/00/0000,SPEED:0.0
        # floats from index 1 to 10
        vals = [float(p) for p in parts[1:11]]
        uptime = int(parts[11])
        
        # GPS parts
        lat = float(parts[12].split(':')[1])
        lon = float(parts[13].split(':')[1])
        sat = int(parts[14].split(':')[1])
        
        time_str = parts[15].split(':', 1)[1]
        h, m, s = [int(x) for x in time_str.split(":")]
        
        date_str = parts[16].split(':', 1)[1]
        day, mon, yr = [int(x) for x in date_str.split("/")]
        
        speed = float(parts[17].split(':')[1])
        
        # Binary format: <B10fIffHfBBBBBH (66 bytes)
        payload = struct.pack("<B10fIffHfBBBBBH", tag_val, *vals, uptime, lat, lon, sat, speed, h, m, s, day, mon, yr)
        
        # Add 2 bytes CRC (Total 68 bytes)
        crc = crc16_ccitt(payload)
        return payload + struct.pack("<H", crc)
    except Exception as e:
        # print(f"Error packing sensor data: {e}")
        return None

def pack_event_data(parts):
    try:
        # EVENT,20500,S1=1.03(NORMAL),S2=1.37(NORMAL)
        tag_val = 3
        uptime = int(parts[1])
        
        # Extract peaks
        s1_peak = float(parts[2].split('=')[1].split('(')[0])
        s2_peak = float(parts[3].split('=')[1].split('(')[0])
        
        # Binary format: <BIff (13 bytes)
        payload = struct.pack("<BIff", tag_val, uptime, s1_peak, s2_peak)
        
        # Add 2 bytes CRC (Total 15 bytes)
        crc = crc16_ccitt(payload)
        return payload + struct.pack("<H", crc)
    except Exception as e:
        # print(f"Error packing event data: {e}")
        return None

def pack_cfg_data(parts):
    try:
        # CFG,200,100
        tag_val = 4
        val1 = int(parts[1])
        val2 = int(parts[2])
        # Binary format: <BII (9 bytes)
        payload = struct.pack("<BII", tag_val, val1, val2)
        
        # Add 2 bytes CRC (Total 11 bytes)
        crc = crc16_ccitt(payload)
        return payload + struct.pack("<H", crc)
    except Exception as e:
        # print(f"Error packing cfg data: {e}")
        return None

def find_stm32_port():
    ports = serial.tools.list_ports.comports()
    for port in ports:
        if "STM" in port.description or "STLink" in port.description:
            print(f"Found STM32 on {port.device}")
            return port.device
    return None

# ================= MQTT RECEIVE =================
def on_message(client, userdata, msg):
    global ser

    try:
        payload = msg.payload.decode().strip()
        print(f"\n Received from MQTT: {payload}")

        if ser is None:
            print("Serial not ready")
            return

        #  Try JSON command
        try:
            data = json.loads(payload)
            command = data.get("cmd", "")
        except:
            command = payload   # fallback plain text

        if command:
            print(f" Forwarding to STM32: {command}")
            ser.write((command + "\n").encode())

    except Exception as e:
        print(f"MQTT receive error: {e}")

# ================= MAIN =================
def main():
    global running , ser

    parser = argparse.ArgumentParser()
    parser.add_argument("-t", "--tty", help="Serial port")
    args = parser.parse_args()

    # Serial connect
    port = args.tty if args.tty else find_stm32_port()
    if not port:
        port = input("Enter serial port: ")

    try:
        ser = serial.Serial(port, BAUD_RATE, timeout=1)
        print(f"Connected to STM32 on {port}")
    except Exception as e:
        print(f"Serial error: {e}")
        return

    # MQTT connect
    client = mqtt.Client()
    client.on_message = on_message
    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.subscribe(MQTT_TOPIC_CLIENT_REQUEST)
        client.loop_start()
        print(f"MQTT Connected → {MQTT_HOST}")
        print(f"Subscribed to → {MQTT_TOPIC_CLIENT_REQUEST}")
    except Exception as e:
        print(f"MQTT error: {e}")
        return

    print("\nReading data...\n")

    while running:
        try:
            line = ser.readline().decode('utf-8', errors='ignore').strip()

            if not line:
                continue

            # ================= CRC VERIFICATION =================
            if ",CRC:0x" in line:
                data_part, received_crc_str = line.split(",CRC:0x")
                try:
                    received_crc = int(received_crc_str, 16)
                    calculated_crc = crc16_ccitt(data_part.encode())
                    
                    if received_crc != calculated_crc:
                        print(f" CRC FAIL: Calculated 0x{calculated_crc:04X}, Received 0x{received_crc:04X}")
                        print(f"Dropped line: {line}")
                        continue
                    else:
                        # Ye line add ki hai aapke practical test ke liye
                        print(f" CRC OK (0x{received_crc:04X})")
                    
                    # line is valid, use data_part for further parsing
                    line = data_part
                except Exception as e:
                    print(f"Error parsing CRC: {e}")
                    continue

            # ================= NEW CSV FORMAT PARSING =================
            parts = line.split(',')
            tag = parts[0]

            if tag == "S1":
                # S1,Ax,Ay,Az,RMS-V,RMS-L,SD-V,SD-L,P2P-V,P2P-L,PEAK,Uptime,LAT,LON,SAT,TIME,DATE,SPEED
                bin_payload = pack_sensor_data(tag, parts)
                if bin_payload:
                    client.publish(MQTT_TOPIC_LEFT, bin_payload)
                    print(f"S1 Binary: {bin_payload.hex()} ({len(bin_payload)} bytes)")
                else:
                    client.publish(MQTT_TOPIC_LEFT, line)
                    print(f"S1 Data Published: {line}")

            elif tag == "S2":
                bin_payload = pack_sensor_data(tag, parts)
                if bin_payload:
                    client.publish(MQTT_TOPIC_RIGHT, bin_payload)
                    print(f"S2 Binary: {bin_payload.hex()} ({len(bin_payload)} bytes)")
                else:
                    client.publish(MQTT_TOPIC_RIGHT, line)
                    print(f"S2 Data Published: {line}")

            elif tag == "EVENT":
                bin_payload = pack_event_data(parts)
                if bin_payload:
                    client.publish(MQTT_TOPIC_EVENT, bin_payload)
                    print(f"EVENT Binary: {bin_payload.hex()} ({len(bin_payload)} bytes)")
                else:
                    client.publish(MQTT_TOPIC_EVENT, line)
                    print(f"EVENT Published: {line}")

            elif tag == "CFG":
                # Config info
                print(f"STM32 Config: {line}")

            # ================= LEGACY / HEALTH HANDLING =================
            elif "[HEALTH]" in line:
                # Basic health print for now
                print(f"Health Info: {line}")
                client.publish(MQTT_TOPIC_HEALTH, line)

            elif "GPS:" in line or "[GPS]" in line:
                client.publish(MQTT_TOPIC_EVENT_GPS, line)
                print(f"GPS Status: {line}")

            else:
                # Print unknown lines for debugging
                if len(line) > 0:
                    print(f"STM32: {line}")

            time.sleep(0.0001) # Faster polling

        except Exception as e:
            print(f"Error in main loop: {e}")

        except Exception as e:
            print(f"Error: {e}")

    # Cleanup
    if ser:
        ser.close()
    
    client.loop_stop()
    client.disconnect()


# ================= ENTRY =================
if __name__ == "__main__":
    main()

    