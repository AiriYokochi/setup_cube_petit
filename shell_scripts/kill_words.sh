#!/bin/bash

PROCESS_ID=""

while :
    do
      PROCESS_ID=`ps aux | grep ros | grep -v grep | awk '{print $2}'`
      if [ "${PROCESS_ID}" != "" ]; then
        echo ""kill ${PROCESS_ID}""
	kill -9 ${PROCESS_ID}
      else
        echo "nothing to kill"
	break
      fi
done
