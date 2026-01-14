#!/bin/bash

confirm() {
  read -r -p "$1 [Y/n]: " ans
  [[ -z "$ans" || "$ans" == "y" || "$ans" == "Y" ]]
}

run_step() {
  local title="$1"
  shift
  echo -e "\e[1;32m == $title == \e[m"
  "$@" || echo -e "\e[1;31m [FAILED] $title \e[m"
}

echo -e '\e[1;32m == Setup Devices == \e[m'


# Setup Default Wifi
if confirm "Setup Default Wifi?"; then
  {
    echo -e '\e[1;32m == Setup Default Wifi == \e[m'
    nmcli connection show
    sudo nmcli connection modify "cube-petit-router-5G-2" connection.autoconnect-priority 100
    # sudo nmcli connection modify "cube-petit-router-2G-2" connection.autoconnect-priority 10
  } || echo -e "\e[1;31m [FAILED] Setup Default Wifi \e[m"
else
  echo "Skip Default Wifi"
fi


# Setup Default Audio
if confirm "Setup Default Audio (SoundBlaster auto set)?"; then
  {
    echo -e '\e[1;32m == Setup Default Audio == \e[m'
    sudo apt install -y pulseaudio-utils
    mkdir -p ~/.config/systemd/user/
    cp services/set-soundblaster.service ~/.config/systemd/user/
    systemctl --user daemon-reload
    systemctl --user enable set-soundblaster.service
    systemctl --user start set-soundblaster.service
  } || echo -e "\e[1;31m [FAILED] Setup Default Audio \e[m"
else
  echo "Skip Default Audio"
fi


# Setup IMU
if confirm "Setup IMU (Witmotion udev + libqt5serialport)?"; then
  {
    echo -e '\e[1;32m == Setup IMU == \e[m'
    sudo apt install -y libqt5serialport5-dev
    sudo cp ~/work/setup_cube_petit/udevs/99-imu-witmotion.rules /etc/udev/rules.d/
    sudo udevadm control --reload
    sudo udevadm trigger
  } || echo -e "\e[1;31m [FAILED] Setup IMU \e[m"
else
  echo "Skip IMU"
fi


# Setup CAN Service
if confirm "Setup CAN Auto Start (can0 systemd service)?"; then
  {
    echo -e '\e[1;32m == Setup CAN Auto Start == \e[m'
    sudo apt install -y can-utils
    sudo cp can_service/startCan.sh /usr/local/bin/
    sudo cp can_service/stopCan.sh /usr/local/bin/
    sudo chmod +x /usr/local/bin/startCan.sh
    sudo chmod +x /usr/local/bin/stopCan.sh
    sudo cp can_service/can@.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo udevadm control --reload
    sudo systemctl enable can@can0.service
    sudo systemctl start can@can0.service
  } || echo -e "\e[1;31m [FAILED] Setup CAN Auto Start \e[m"
else
  echo "Skip CAN Auto Start"
fi


# Setup Realsense
if confirm "Setup RealSense? (TODO)"; then
  {
    echo -e '\e[1;32m == Setup RealSense == \e[m'
    echo "TODO: RealSense setup not implemented yet"
  } || echo -e "\e[1;31m [FAILED] Setup RealSense \e[m"
else
  echo "Skip RealSense"
fi


echo -e '\e[1;32m == Setup Devices Finished == \e[m'
