#!/bin/bash

sudo apt install -y can-utils
sudo cp startCan.sh /usr/local/bin/
sudo cp stopCan.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/startCan.sh
sudo chmod +x /usr/local/bin/stopCan.sh
sudo cp can@.service /etc/systemd/system/
systemctl daemon-reload
sudo udevadm control --reload
sudo systemctl enable can@can0.service
sudo systemctl start can@can0.service