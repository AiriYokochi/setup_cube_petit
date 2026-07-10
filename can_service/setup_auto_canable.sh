#!/bin/bash
# Run from this directory (can_service/).

sudo apt install -y can-utils
sudo cp startCan.sh /usr/local/bin/
sudo cp stopCan.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/startCan.sh
sudo chmod +x /usr/local/bin/stopCan.sh
sudo cp can@.service /etc/systemd/system/
# Install the udev rule that creates /dev/ttyCANable and starts/stops
# can@ttyCANable on USB plug/unplug (previously never installed by any
# setup script; see issue #13).
sudo cp ../udevs/99-usbCan.rules /etc/udev/rules.d/
sudo systemctl daemon-reload
sudo udevadm control --reload
sudo udevadm trigger
# Migration for machines set up by the old version of this script: it
# enabled can@can0.service while the udev rule starts can@ttyCANable,
# so both units managed the same slcand/can0 and attached two slcand
# daemons to the same tty at boot (see issue #13). Remove the old unit.
if systemctl is-enabled --quiet can@can0.service 2>/dev/null; then
  sudo systemctl disable --now can@can0.service
fi
sudo systemctl enable can@ttyCANable.service
sudo systemctl start can@ttyCANable.service
