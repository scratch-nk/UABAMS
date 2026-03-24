#!/usr/bin/env python3

import serial
import serial.tools.list_ports
import paho.mqtt.client as mqtt
import time
import signal
import sys
import argparse
import json


# ================= MQTT CONFIG =================
MQTT_HOST = "192.168.0.156"
#MQTT_HOST = "192.168.0.125"
#MQTT_HOST = "10.178.215.92"
MQTT_PORT = 1883

MQTT_TOPIC_LEFT = "adj/datalogger/sensors/left"
MQTT_TOPIC_RIGHT = "adj/datalogger/sensors/right"
MQTT_TOPIC_HEALTH = "adj/datalogger/health"
MQTT_TOPIC_EVENT = "adj/datalogger/event"
MQTT_TOPIC_CONTROL = "adj/datalogger/control"

BAUD_RATE = 115200

running = True
ser = None 
# ================= SIGNAL =================
def signal_handler(sig, frame):
    global running
    print("\nShutting down...")
    running = False
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# ================= PORT DETECT =================
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
            print(f"➡️ Forwarding to STM32: {command}")
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
        client.subscribe(MQTT_TOPIC_CONTROL)
        client.loop_start()
        print(f"MQTT Connected → {MQTT_HOST}")
        print(f"Subscribed to → {MQTT_TOPIC_CONTROL}")
    except Exception as e:
        print(f"MQTT error: {e}")
        return

    print("\nReading data...\n")

    left_buffer = []
    right_buffer = []
    health_buffer = []
    event_buffer = []
    
    event_active = False
    current_sensor = None
    health_active = False

    while running:
        try:
            line = ser.readline().decode('utf-8', errors='ignore').strip()

            if not line:
                continue

            # ================= HEALTH START =================
            if "[HEALTH]" in line:
                health_active = True
                health_buffer = [line]
                continue

            # ================= HEALTH COLLECT =================
            if health_active:
                health_buffer.append(line)

                if "====" in line:
                    health_data = "\n".join(health_buffer)

                    client.publish(MQTT_TOPIC_HEALTH, health_data)

                    print("\n🩺 HEALTH SENT DATA Logger =================")
                    print(health_data)
                    print("================================\n")

                    health_buffer = []
                    health_active = False

                continue

            # ================= EVENT START =================
            if "VIBRATION ALERT" in line:
                event_active = True
                event_buffer = [line]
                continue

            # ================= EVENT COLLECT =================
            if event_active:
                event_buffer.append(line)

                # END condition → next sensor block start
                if "[AXLE BOX" in line:
                    event_data = "\n".join(event_buffer[:-1])  # last line remove

                    client.publish(MQTT_TOPIC_EVENT, event_data)

                    print("\n🚨 EVENT SENT =================")
                    print(event_data)
                    print("================================\n")

                    event_buffer = []
                    event_active = False

                    # ⚠️ Important → current line sensor ka hai
                    # so process again
                    current_sensor = None

                continue
            # ================= LEFT =================
            if "[AXLE BOX LEFT" in line:
                current_sensor = "LEFT"
                left_buffer = [line]
                continue

            # ================= RIGHT =================
            if "[AXLE BOX RIGHT" in line:
                current_sensor = "RIGHT"
                right_buffer = [line]
                continue

            # ================= BUFFER FILL =================
            if current_sensor == "LEFT":
                left_buffer.append(line)

            elif current_sensor == "RIGHT":
                right_buffer.append(line)

            # ================= PACKET END =================
            if "WINDOW" in line:

                # -------- LEFT --------
                if left_buffer:
                    left_data = "\n".join(left_buffer)

                    client.publish(MQTT_TOPIC_LEFT, left_data)

                    print("\n📡 LEFT SENT ===")
                    print(left_data)

                    for l in left_buffer:
                        if "X=" in l:
                            print("LEFT XYZ:", l)

                    print("==============\n")
                    left_buffer = []

                # -------- RIGHT --------
                if right_buffer:
                    right_data = "\n".join(right_buffer)

                    client.publish(MQTT_TOPIC_RIGHT, right_data)

                    print("\n📡 RIGHT SENT ===")
                    print(right_data)

                    for l in right_buffer:
                        if "X=" in l:
                            print("RIGHT XYZ:", l)

                    print("==============\n")
                    right_buffer = []

                current_sensor = None

            time.sleep(0.001)

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
