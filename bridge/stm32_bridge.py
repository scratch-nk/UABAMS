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

# ── MQTT Configuration ────────────────────────────────────
MQTT_HOST = "localhost"
MQTT_PORT = 1883
# MQTT_USER = "mqtt_user"   # Set to None to disable authentication
# MQTT_PASS = "scratch2026"  # Set to None to disable authentication
MQTT_USER = None   # Set to None to disable authentication
MQTT_PASS = None  # Set to None to disable authentication

MQTT_TOPIC_ACCL = "adj/datalogger/sensors/accelerometer"
MQTT_TOPIC_GPS  = "adj/datalogger/sensors/gps"
MQTT_TOPIC_ALL  = "adj/datalogger/sensors"   # NOTE: Code below *only* sends all data,
                                              # both GPS and accelerometer data is sent by boards together is parsed
MQTT_TOPIC      = "sensor/railway/accelerometer/stm32"

# ── Serial Configuration ──────────────────────────────────
BAUD_RATE   = 115200
SERIAL_PORT = None  # Will auto-detect

# ── Global flag ───────────────────────────────────────────
running = True

def signal_handler(sig, frame):
    global running
    print("\nShutting down...")
    running = False
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# ── MQTT Callbacks ────────────────────────────────────────
def on_connect(client, userdata, connect_flags, reason_code, properties):
    if reason_code.is_failure:
        print(f"❌ MQTT connection failed: {reason_code}")
        if reason_code.value == 4:
            print("   → Check MQTT_USER and MQTT_PASS constants at top of file")
            print(f"   → Currently set: user='{MQTT_USER}' pass='{MQTT_PASS}'")
        elif reason_code.value == 5:
            print("   → Check if this user is allowed in /etc/mosquitto/passwd")
    else:
        print("✅ MQTT: Connected successfully")

def on_disconnect(client, userdata, disconnect_flags, reason_code, properties):
    if reason_code.value == 0:
        print("MQTT: Disconnected cleanly")
    else:
        print(f"⚠️  MQTT: Unexpected disconnect ({reason_code}), will reconnect...")

def on_publish(client, userdata, mid, reason_code, properties):
    pass  # Uncomment below to debug publishes
    # print(f"MQTT: Message {mid} published")

# ── Serial port detection ─────────────────────────────────
def find_stm32_port():
    """Auto-detect STM32 serial port"""
    ports = serial.tools.list_ports.comports()

    stm32_vendors = ['STMicro', 'STM32', 'USB Serial', 'CP210', 'CH340', 'FTDI']

    for port in ports:
        print(f"Checking {port.device}: {port.description}")
        for vendor in stm32_vendors:
            if vendor.lower() in port.description.lower():
                print(f"✅ Found STM32 on {port.device}")
                return port.device

    if ports:
        print("\nAvailable ports:")
        for i, port in enumerate(ports):
            print(f"  {i}: {port.device} - {port.description}")

        choice = input("\nSelect port number: ")
        try:
            return ports[int(choice)].device
        except (ValueError, IndexError):
            print("❌ Invalid selection")
            return None

    print("❌ No serial ports found")
    return None

# ── Data parsing ──────────────────────────────────────────
def parse_accelerometer_data(line, option):
    """
    Parse the USART output line: "X=1  Y=-13  Z=-262"
    Returns tuple (x_g, y_g, z_g, x_raw, y_raw, z_raw)
    """
    pattern = r'X=(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+Y=(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+Z=(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)'
    match = re.search(pattern, line)

    if match:
        SCALE_FACTOR = 256.0

        x_raw = float(match.group(1))
        y_raw = float(match.group(2))
        z_raw = float(match.group(3))

        x_g = x_raw / SCALE_FACTOR
        y_g = y_raw / SCALE_FACTOR
        z_g = z_raw / SCALE_FACTOR

        print(f"Parsed: raw=({x_raw}, {y_raw}, {z_raw}) -> g=({x_g:.3f}, {y_g:.3f}, {z_g:.3f})")
        return x_g, y_g, z_g, x_raw, y_raw, z_raw

    if option == 'd':
        print(f"Unparsed: {line}")
    return None

def calculate_peak_g(x_g, y_g, z_g):
    return (x_g*x_g + y_g*y_g + z_g*z_g)**0.5

def determine_severity(peak_g):
    if peak_g > 16:
        return "HIGH"
    elif peak_g > 8:
        return "MEDIUM"
    elif peak_g > 2:
        return "LOW"
    return "NORMAL"

# ── MQTT client setup ─────────────────────────────────────
def create_mqtt_client():
    """Create and connect MQTT client with optional authentication."""
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="stm32-bridge")
    client.on_connect    = on_connect
    client.on_disconnect = on_disconnect
    client.on_publish    = on_publish

    # Only set credentials if both are provided
    if MQTT_USER is not None and MQTT_PASS is not None:
        print(f"🔐 MQTT auth enabled (user='{MQTT_USER}')")
        client.username_pw_set(MQTT_USER, MQTT_PASS)
    else:
        print("⚠️  MQTT auth disabled (anonymous mode)")

    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        client.loop_start()
        print(f"📡 Connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT}...")
        time.sleep(1)  # Give on_connect time to fire
    except ConnectionRefusedError:
        print(f"❌ MQTT connection refused — is Mosquitto running?")
        print(f"   → sudo systemctl status mosquitto")
        return None
    except OSError as e:
        print(f"❌ MQTT network error: {e}")
        print(f"   → Check MQTT_HOST='{MQTT_HOST}' and MQTT_PORT={MQTT_PORT}")
        return None
    except Exception as e:
        print(f"❌ MQTT unexpected error: {e}")
        return None

    return client

# ── Main ──────────────────────────────────────────────────
def main():
    global running

    parser = argparse.ArgumentParser(description="STM32 ADXL345 Bridge")
    parser.add_argument("-t", "--tty",   help="Serial port (e.g., /dev/ttyUSB0)")
    parser.add_argument("-d", "--debug", action="store_true", help="Debug: print unparsed lines")
    args = parser.parse_args()
    option = 'd' if args.debug else None

    print("STM32 ADXL345 Bridge Starting...")
    print("====================================")

    # ── Serial port ───────────────────────────────────────
    if args.tty:
        port = args.tty
        print(f"Using specified port: {port}")
    else:
        print("\n🔍 Detecting STM32 serial port...")
        port = find_stm32_port()
        if not port:
            print("❌ Could not find STM32 port. Use -t /dev/ttyUSB0 to specify manually.")
            return

    try:
        ser = serial.Serial(
            port=port,
            baudrate=BAUD_RATE,
            timeout=1,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            bytesize=serial.EIGHTBITS
        )
        print(f"✅ Connected to STM32 on {port} at {BAUD_RATE} baud")
    except serial.SerialException as e:
        print(f"❌ Failed to open serial port '{port}': {e}")
        print(f"   → Check device is connected: ls /dev/ttyUSB* /dev/ttyACM*")
        print(f"   → Check permissions: sudo usermod -aG dialout $USER")
        return
    except Exception as e:
        print(f"❌ Unexpected serial error: {e}")
        return

    # ── MQTT ──────────────────────────────────────────────
    client = create_mqtt_client()
    if client is None:
        ser.close()
        return

    print("\n📊 Reading accelerometer data...")
    print("Press Ctrl+C to stop\n")

    sample_count = 0

    while running:
        try:
            line = ser.readline().decode('utf-8', errors='ignore').strip()

            if line:
                result = parse_accelerometer_data(line, option)

                if result:
                    x_g, y_g, z_g, x_raw, y_raw, z_raw = result
                    peak_g   = calculate_peak_g(x_g, y_g, z_g)
                    severity = determine_severity(peak_g)

                    payload = {
                        "timestamp": (datetime.utcnow() + timedelta(hours=5, minutes=30)).isoformat(),
                        "x":         round(x_g, 3),
                        "y":         round(y_g, 3),
                        "z":         round(z_g, 3),
                        "x_raw":     x_raw,
                        "y_raw":     y_raw,
                        "z_raw":     z_raw,
                        "peak_g":    round(peak_g, 3),
                        "severity":  severity,
                        "device_id": "stm32_adxl345",
                        "sample_rate": 10
                    }

                    result_pub = client.publish(MQTT_TOPIC, json.dumps(payload), qos=1)
                    if result_pub.rc != mqtt.MQTT_ERR_SUCCESS:
                        print(f"⚠️  Publish failed (rc={result_pub.rc}) — broker may have disconnected")

                    sample_count += 1
                    timestamp = datetime.now().strftime("%H:%M:%S")

                    if severity != "NORMAL":
                        print(f"[{timestamp}] ⚠️  X:{x_g:6.3f}g Y:{y_g:6.3f}g Z:{z_g:6.3f}g | Peak:{peak_g:6.3f}g | {severity}")
                    else:
                        print(f"[{timestamp}] X:{x_g:6.3f} Y:{y_g:6.3f} Z:{z_g:6.3f} | Peak:{peak_g:6.3f}g")

            time.sleep(0.001)

        except serial.SerialException as e:
            print(f"❌ Serial error: {e}")
            break
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"⚠️  Error: {e}")
            continue

    # ── Cleanup ───────────────────────────────────────────
    print("\n🧹 Cleaning up...")
    client.loop_stop()
    client.disconnect()
    ser.close()
    print("Done")

if __name__ == "__main__":
    main()
