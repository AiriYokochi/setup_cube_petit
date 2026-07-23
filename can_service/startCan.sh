#!/bin/bash

CAN_PORT="can0"
BIT_RATE_OPTION="-s8"  # -s8 = 1Mbps
HEALTH_CHECK_INTERVAL_SEC=5

# The CAN adapter model differs between robots: some units have an
# Openlight Labs CANable2, others a Protofusion Labs CANable. Pick
# whichever is present.
DEVICE_PATH=""
for candidate in \
  /dev/serial/by-id/usb-Openlight_Labs_CANable2_* \
  /dev/serial/by-id/usb-Protofusion_Labs_CANable_*; do
  if [ -e "$candidate" ]; then
    DEVICE_PATH=$(readlink -f "$candidate")
    break
  fi
done

echo "[INFO] Starting slcand for $DEVICE_PATH on $CAN_PORT"

if [ -z "$DEVICE_PATH" ] || [ ! -e "$DEVICE_PATH" ]; then
  echo "[ERROR] No supported CANable device found in /dev/serial/by-id"
  exit 1
fi

# Start slcand (device file is passed explicitly here)
sudo slcand -o -c ${BIT_RATE_OPTION} ${DEVICE_PATH} ${CAN_PORT}
sleep 1

echo "[INFO] Bringing up $CAN_PORT"
sudo ip link set up ${CAN_PORT}
sudo ip link set ${CAN_PORT} txqueuelen 1000

echo "[INFO] Setting CAN interface ready"
ip -details link show ${CAN_PORT}

# Command-line pattern that identifies the slcand instance started
# above, so the health check below cannot be confused by some other
# slcand process (e.g. for a different CAN adapter).
SLCAND_MATCH="slcand -o -c ${BIT_RATE_OPTION} ${DEVICE_PATH} ${CAN_PORT}"

# This loop is the service's main process (ExecStart). Previously this
# was just `while :; do sleep 864000; done`, so if slcand died the
# service stayed "active (running)" forever with no way to notice and
# no automatic recovery. Now we poll slcand's liveness and the can0
# interface, and exit 1 on failure so that systemd (Restart=on-failure
# in can@.service) restarts the service and this script re-runs from
# the top.
while :; do
  sleep "${HEALTH_CHECK_INTERVAL_SEC}"

  if ! pgrep -f "${SLCAND_MATCH}" > /dev/null; then
    echo "[ERROR] slcand process is no longer running"
    exit 1
  fi

  if [ ! -e "/sys/class/net/${CAN_PORT}" ]; then
    echo "[ERROR] ${CAN_PORT} interface is no longer present"
    exit 1
  fi
done
