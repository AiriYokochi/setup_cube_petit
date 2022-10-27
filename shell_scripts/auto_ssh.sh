#!/bin/sh

PW="<INPUT PC PASSWORD>"
IP=$1

expect -c "
set timeout 5
spawn env LANG=C /usr/bin/ssh gisen@192.168.12.${IP}
expect \"gisen@192.168.12.${IP}'s password:\"
send \"${PW}\n\"
expect \"$\"
exit 0
"