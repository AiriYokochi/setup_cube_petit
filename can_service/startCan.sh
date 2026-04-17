#!/bin/bash

CAN_PORT="can0"
BIT_RATE_OPTION="-s8"  # -s8 = 1Mbps

DEVICE_PATH=$(readlink -f /dev/serial/by-id/usb-Openlight_Labs_CANable2_*)
echo "[INFO] Starting slcand for $DEVICE_PATH on $CAN_PORT"

if [ ! -e "$DEVICE_PATH" ]; then
  echo "[ERROR] Device path not found: $DEVICE_PATH"
  exit 1
fi

# slcand起動（ここでデバイスファイルを明示的に指定）
sudo slcand -o -c ${BIT_RATE_OPTION} ${DEVICE_PATH} ${CAN_PORT}
sleep 1

echo "[INFO] Bringing up $CAN_PORT"
sudo ip link set up ${CAN_PORT}
sudo ip link set ${CAN_PORT} txqueuelen 1000

echo "[INFO] Setting CAN interface ready"
ip -details link show ${CAN_PORT}

# 永続ループ
while :; do sleep 864000; done
