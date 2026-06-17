#!/usr/bin/env python3

import paho.mqtt.client as mqtt
import time
import signal
import sys
import argparse


# ================= MQTT CONFIG =================
# MQTT_HOST = "192.168.0.156"
MQTT_HOST = "192.168.1.28"
#MQTT_HOST = "10.178.215.92"
MQTT_PORT = 1883

MQTT_TOPIC_LEFT                = "adj/datalogger/sensors/left"
MQTT_TOPIC_RIGHT               = "adj/datalogger/sensors/right"
MQTT_TOPIC_EVENT_GPS           = "adj/datalogger/sensors/gps"
MQTT_TOPIC_EVENT               = "adj/datalogger/sensors/event"

MQTT_TOPIC_HEALTH              = "adj/datalogger/health"
MQTT_TOPIC_HEALTH_JUNCTION_BOX = "adj/datalogger/health/junction_box"  # Health of junction box board
MQTT_TOPIC_HEALTH_DATA_LOGGER  = "adj/datalogger/health/data_logger"   # Health of data logger board

MQTT_TOPIC_CLIENT_REQUEST      = "adj/datalogger/client_request"       # Client request sent to Junction box viw MQTT

running = True

# ================= SIGNAL =================
def signal_handler(sig, frame):
    global running
    print("\nShutting down...")
    running = False
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# ================= MAIN =================
def main():
    global running

    parser = argparse.ArgumentParser()
    parser.add_argument("-f", "--file", required=True, help="Path to data file")
    args = parser.parse_args()

    # MQTT connect
    client = mqtt.Client()
    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.loop_start()
        print(f"MQTT Connected → {MQTT_HOST}")
    except Exception as e:
        print(f"MQTT error: {e}")
        return

    try:
        fh = open(args.file, "r", errors="ignore")
    except Exception as e:
        print(f"File error: {e}")
        client.loop_stop()
        client.disconnect()
        return

    print(f"\nReading from file: {args.file}\n")

    left_buffer = []
    right_buffer = []
    health_buffer = []
    event_buffer = []

    event_active = False
    current_sensor = None
    health_active = False

    while running:
        try:
            line = fh.readline()

            if line == "":  # EOF
                break

            line = line.strip()

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
    fh.close()
    client.loop_stop()
    client.disconnect()


# ================= ENTRY =================
if __name__ == "__main__":
    main()
