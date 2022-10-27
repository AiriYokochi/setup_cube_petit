#!/bin/bash
echo "--------------------------------"
echo "[INFO] UDEV CHECK START"
CMD1=`udevadm info -a -n /dev/ttyUSB0 | grep idVendor |sed 's/^.*"\(.*\)".*$/\1/' | awk  'NR==1'`

if [ "${CMD1}" == "0403"  ]; then
	echo "[INFO] ttyUSB0 is DYNAMIXEL MOTOR:[OK]"
else
	echo "[WARN] ***ttyUSB0 IS NOT DYNAMICEL MOTOR PLEASE CHECK***"
fi


CMD1=`udevadm info -a -n /dev/ttyUSB1 | grep idVendor |sed 's/^.*"\(.*\)".*$/\1/' | awk  'NR==1'`

if [ "${CMD1}" == "1a86" ]; then
        echo "[INFO] ttyUSB1 is PACECAT LiDAR:[OK]"
else
        echo "[WARN] ***ttyUSB1 IS NOT PACECAR LiDAR PLEASE CHECK***"
fi


#ttyDYNAMIXEL_2.4.2
#ttyPACECAT_2.4.3
CMD1=`ls /dev/ttyDYNAMIXEL*`
if [ "${CMD1}" != "" ];then
        echo "[INFO] ${CMD1} :[OK]"
else
        echo "[WARN] ***ttyDYNAMIXEL  IS NOT FOUND***"
fi

CMD1=`ls /dev/ttyPACECAT*`
if [ "${CMD1}" != "" ];then
        echo "[INFO] ${CMD1} :[OK]"
else
        echo "[WARN] ***ttyPACECAT_2.4.3  IS NOT FOUND***"
fi


echo "[INFO] UDEV CHECK FINISH"
echo "---------------------------------"

