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
    # Install the udev rule that creates /dev/ttyCANable and starts/stops
    # can@ttyCANable on USB plug/unplug (previously never installed by any
    # setup script; see issue #13).
    sudo cp udevs/99-usbCan.rules /etc/udev/rules.d/
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
  } || echo -e "\e[1;31m [FAILED] Setup CAN Auto Start \e[m"
else
  echo "Skip CAN Auto Start"
fi


# Setup Realsense
if confirm "Setup RealSense (build librealsense + udev rules)?"; then
  {
    echo -e '\e[1;32m == Setup RealSense == \e[m'

    # Create work directory
    mkdir -p ~/work
    cd ~/work || exit 1

    # Clone librealsense
    if [ ! -d "librealsense" ]; then
      git clone https://github.com/IntelRealSense/librealsense.git
    fi

    cd librealsense || exit 1
    git fetch --tags
    git checkout v2.56.3
    rm -rf build
    mkdir build && cd build || exit 1
    cmake .. \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX=/usr/local \
      -DBUILD_EXAMPLES=ON \
      -DBUILD_GRAPHICAL_EXAMPLES=ON \
      -DFORCE_LIBUVC=ON
    make -j$(nproc)
    sudo make install
    sudo ldconfig
    sudo cp ~/work/librealsense/config/99-realsense-libusb.rules /etc/udev/rules.d/
    sudo udevadm control --reload-rules
    sudo udevadm trigger
    echo -e '\e[1;32m == RealSense setup completed == \e[m'
  } || echo -e "\e[1;31m [FAILED] Setup RealSense \e[m"
else
  echo "Skip RealSense"
fi


echo -e '\e[1;32m == Setup Devices Finished == \e[m'
