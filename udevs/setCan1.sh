#!/bin/sh

CAN_PORT="can0"
BIT_RATE="1000000"

# ifconfig ${CAN_PORT} > /dev/null 2>&1
sudo slcand -o -c -s0 /dev/USB_CAN2 ${CAN_PORT}
if [ "$?" -ne 0 ]; then  
    echo "1"
    #exit 1
fi

cmd=`sudo ifconfig ${CAN_PORT} up`
if [ "$?" -ne 0 ]; then
    echo "3"
    #exit 1
fi

cmd=`ip link set ${CAN_PORT} up type can bitrate ${BIT_RATE} > /dev/null 2>&1`
if [ "${cmd}" != "0" ]; then
    : # nothing # echo "[WARN] Line2:"${CAN_PORT}"が忙しいか、存在しません"
fi


echo "0"
