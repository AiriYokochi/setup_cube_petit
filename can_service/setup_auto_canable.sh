#!/bin/bash

sudo cp startCan.sh /usr/local/bin/
sudo cp stopCan.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/startCan.sh
sudo chmod +x /usr/local/bin/stopCan.sh
sudo cp can@.service /etc/systemd/system/
systemctl daemon-reload
sudo udevadm control --reload
