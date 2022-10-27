#!/bin/sh
CAN_PORT="can0"
BIT_RATE="1000000"

# ifconfig ${CAN_PORT} > /dev/null 2>&1
sleep 1
/usr/bin/slcand -o -c -s8 /dev/serial/by-id/usb-Protofusion_Labs_CANable_1205aa6_https\:__github.com_normaldotcom_cantact-fw_0030000D524E430420373533-if00 ${CAN_PORT}

# echo "slcand: $?" >> /var/log/messages
# if [ "$?" -ne 0 ]; then  
#   echo "slcand failed" >> /var/log/messages
# fi

# echo "slcand -> ifconfig" >> /var/log/messages
sleep 2
/sbin/ifconfig ${CAN_PORT} up
# echo "ifconfig: $?" >> /var/log/messages
# if [ "$?" -ne 0 ]; then
#   echo "ifconfig failed" >> /var/log/messages
# fi

# echo "CAN started" >> /var/log/messages
# exit 0

while :
  do sleep 864000
done
