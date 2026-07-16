#!/bin/bash


# Add udev
sudo cp ~/work/cube_petit_setup/udevs/99-imu-witmotion.rules /etc/udev/rules.d/
sudo udevadm control --reload
sudo udevadm trigger

# ROS build
cd ~/ros/src/
git clone -b ros2 --recursive https://github.com/ElettraSciComp/witmotion_IMU_ros.git witmotion_ros
sudo apt install -y libqt5serialport5-dev
cd ~/ros
colcon build --symlink-install --packages-select witmotion_ros
source install/setup.bash
