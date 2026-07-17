#!/usr/bin/env bash

GREEN="\e[32m"
RED="\e[31m"
NC="\e[0m"   # No Color

DEVICES=(
  "ttyWitMotion"   # IMU
  "ttyCANable"     # CAN
  "ttyLD06-19"     # LiDAR
)
# Set LiDAR dev path
LIDAR_DEV="/dev/ttyLD06-19"
# 0.1s was too short: the read frequently caught 0 bytes even when the
# LiDAR was sending data, causing a false NG. 2s reliably captures at
# least one frame on real hardware.
LIDAR_TIMEOUT=2
# Set IMU dev path
IMU_DEV="/dev/ttyWitMotion"
IMU_TIMEOUT=2

echo "=== /dev device check ==="

for dev in "${DEVICES[@]}"; do
  if ls /dev | grep -q "^${dev}$"; then
    echo -e "${GREEN}[OK]${NC} /dev/${dev} is found"
  else
    echo -e "${RED}[NG]${NC} /dev/${dev} is not found"
  fi
done

echo ""
echo "=== CAN (can0) check ==="

if ifconfig can0 &>/dev/null; then
  RX_PACKETS=$(ifconfig can0 | grep "RX packets" | awk '{print $3}')

  if [[ -n "$RX_PACKETS" && "$RX_PACKETS" -gt 0 ]]; then
    echo -e "${GREEN}[OK]${NC} can0 found, 、RX packets = ${RX_PACKETS}"
  else
    echo -e "${RED}[NG]${NC} can0 found, but RX packets is 0"
  fi
else
  echo -e "${RED}[NG]${NC} No can0"
fi

echo ""
echo "=== Wi-Fi interface ==="
WIFI_INFO=$(ip -4 addr show | awk '
  /^[0-9]+: / {
    iface=$2
    gsub(":", "", iface)
  }
  /inet / && iface ~ /^wl/ {
    split($2, a, "/")
    print iface, a[1]
    exit
  }
')

if [[ -n "$WIFI_INFO" ]]; then
  WIFI_IF=$(echo "$WIFI_INFO" | awk '{print $1}')
  WIFI_IP=$(echo "$WIFI_INFO" | awk '{print $2}')

  echo -e "${GREEN}[OK]${NC} Wi-Fi IF = ${WIFI_IF}, IP = ${WIFI_IP}"
else
  echo -e "${RED}[NG]${NC} No Wi-Fi IF"
fi

echo ""
echo "=== Audio Device Check (Sound_Blaster required) ==="

# ----------------------------
# Check microphone source
# ----------------------------
MIC_SOURCE=$(pactl list short sources \
  | grep -v monitor \
  | grep -i "Sound_Blaster" \
  | awk '{print $2}' \
  | head -n 1)

if [[ -n "$MIC_SOURCE" ]]; then
  echo -e "${GREEN}[OK]${NC} Sound_Blaster microphone found: ${MIC_SOURCE}"
else
  echo -e "${RED}[NG]${NC} Sound_Blaster microphone not found"
fi

# ----------------------------
# Check speaker sink
# ----------------------------
SPEAKER_SINK=$(pactl list short sinks \
  | grep -i "Sound_Blaster" \
  | awk '{print $2}' \
  | head -n 1)

if [[ -n "$SPEAKER_SINK" ]]; then
  echo -e "${GREEN}[OK]${NC} Sound_Blaster speaker found: ${SPEAKER_SINK}"
else
  echo -e "${RED}[NG]${NC} Sound_Blaster speaker not found"
fi

echo ""
echo "=== LiDAR Data Check ==="

if [[ -e "$LIDAR_DEV" ]]; then
  # Put the tty into raw mode before reading. Baud rate is intentionally
  # left untouched (existing setting is trusted).
  #
  # On real hardware, plain `stty -F "$LIDAR_DEV" ...` can block forever:
  # opening a serial device without `clocal` waits for carrier detect
  # (CLOCAL unset), and if nothing ever asserts carrier the open() call
  # inside stty never returns -- the surrounding `timeout` on the `cat`
  # below is useless here because it never even gets that far. Wrapping
  # the stty call itself in `timeout` and adding `clocal` fixes both: once
  # this succeeds, later opens of the same device no longer wait for
  # carrier either.
  timeout "${LIDAR_TIMEOUT}" stty -F "$LIDAR_DEV" raw -echo clocal 2>/dev/null || true
  BYTE_COUNT=$(timeout ${LIDAR_TIMEOUT} cat "$LIDAR_DEV" 2>/dev/null | head -c 256 | wc -c)

  if [[ "$BYTE_COUNT" -gt 0 ]]; then
    echo -e "${GREEN}[OK]${NC} LiDAR is sending data (${BYTE_COUNT} bytes received)"
  else
    echo -e "${RED}[NG]${NC} LiDAR device found but no data received"
  fi
else
  echo -e "${RED}[NG]${NC} LiDAR device not found: ${LIDAR_DEV}"
fi

echo ""
echo "=== IMU Data Check ==="


if [[ -e "$IMU_DEV" ]]; then
  # Put the tty into raw mode before reading. Baud rate is intentionally
  # left untouched (9600 already works on real hardware).
  # See the LiDAR check above for why this stty call itself needs `timeout`
  # and `clocal`: without them, opening the device can hang forever waiting
  # for carrier detect, and the whole check gets stuck at "running".
  timeout "${IMU_TIMEOUT}" stty -F "$IMU_DEV" raw -echo clocal 2>/dev/null || true
  BYTE_COUNT=$(timeout ${IMU_TIMEOUT} cat "$IMU_DEV" 2>/dev/null | head -c 256 | wc -c)

  if [[ "$BYTE_COUNT" -gt 0 ]]; then
    echo -e "${GREEN}[OK]${NC} IMU is sending data (${BYTE_COUNT} bytes received)"
  else
    echo -e "${RED}[NG]${NC} IMU device found but no data received"
  fi
else
  echo -e "${RED}[NG]${NC} IMU device not found: ${IMU_DEV}"
fi

echo ""
echo "=== RealSense Check ==="

# Check if any Intel RealSense device is connected via USB
if lsusb | grep -qi "Intel.*RealSense"; then
  REALSENSE_LINE=$(lsusb | grep -i "Intel.*RealSense" | head -n 1)
  echo -e "${GREEN}[OK]${NC} RealSense device detected: ${REALSENSE_LINE}"
else
  echo -e "${RED}[NG]${NC} No Intel RealSense device detected"
fi

echo ""
echo "=== Bluetooth Controller Check ==="

# Check if bluetoothctl command exists
if ! command -v bluetoothctl &>/dev/null; then
  echo -e "${RED}[NG]${NC} bluetoothctl not found"
else
  # `bluetoothctl info | grep "Connected: yes" -B 1` (the previous approach)
  # is broken: -B 1 grabs the line right above "Connected: yes", which is
  # always "Blocked: no" in bluetoothctl's output, never the device Name.
  # It also only ever looked at whatever single device `bluetoothctl info`
  # (no argument) defaults to.
  #
  # Instead, list every currently-connected device as "Device <MAC> <Name>"
  # lines and match the controller regex against the Name portion.
  CONNECTED_BT_DEVICES=$(bluetoothctl devices Connected 2>/dev/null)

  # Older BlueZ versions don't support the "Connected" filter argument to
  # `devices`, so fall back to checking each known device individually.
  if [[ -z "$CONNECTED_BT_DEVICES" ]]; then
    while read -r _ mac _; do
      [[ -z "$mac" ]] && continue
      INFO=$(bluetoothctl info "$mac" 2>/dev/null)
      if echo "$INFO" | grep -q "Connected: yes"; then
        NAME=$(echo "$INFO" | grep "Name:" | head -n 1 | sed 's/^[[:space:]]*Name:[[:space:]]*//')
        CONNECTED_BT_DEVICES+=$'\n'"Device ${mac} ${NAME}"
      fi
    done < <(bluetoothctl devices 2>/dev/null)
  fi

  if [[ -z "$CONNECTED_BT_DEVICES" ]]; then
    echo -e "${RED}[NG]${NC} No Bluetooth devices connected"
  else
    # Try to find a controller-like device name
    CONTROLLER_DEVICE=$(echo "$CONNECTED_BT_DEVICES" | grep -Ei \
      "controller|gamepad|joystick|joy|xbox|dualshock|dualsense|wireless controller" \
      | head -n 1)

    if [[ -n "$CONTROLLER_DEVICE" ]]; then
      echo -e "${GREEN}[OK]${NC} Bluetooth controller connected:"
      echo "     ${CONTROLLER_DEVICE}"
    else
      echo -e "${RED}[NG]${NC} Bluetooth device connected, but no controller detected"
    fi
  fi
fi
