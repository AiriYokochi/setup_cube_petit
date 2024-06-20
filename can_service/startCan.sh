#!/bin/sh
CAN_PORT="can0"
BIT_RATE="1000000"

sleep 1
sudo slcand -o -c -s8 /dev/serial/by-id/usb-Openlight_Labs_CANable2_b158aa7_github.com_normaldotcom_canable2.git_209E387B4D4D-if00 can0
sleep 1
/sbin/ip link set up can0
/sbin/ip link set can0 txqueuelen 1000
while :; do sleep 864000; done
