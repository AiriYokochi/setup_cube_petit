#!/bin/bash

cd

# set home dir in English
LANG=C xdg-user-dirs-gtk-update

# Install and setup git
echo -e '\e[1;31m == Install and setup git == \e[m'
git config --global user.name gisen-robo-git
git config --global user.email gisen.robo.git@gmail.com

# Install ROS Melodic
echo -e '\e[1;31m == Install ROS Melodic == \e[m'
sudo sh -c 'echo "deb http://packages.ros.org/ros/ubuntu $(lsb_release -sc) main" > /etc/apt/sources.list.d/ros-latest.list'
sudo apt-key adv --keyserver 'hkp://keyserver.ubuntu.com:80' --recv-key C1CF6E31E6BADE8868B172B4F42ED6FBAB17C654
curl -sSL 'http://keyserver.ubuntu.com/pks/lookup?op=get&search=0xC1CF6E31E6BADE8868B172B4F42ED6FBAB17C654' | sudo apt-key add -

sudo apt update
sudo apt install ros-melodic-desktop-full -y
sudo rosdep init
rosdep update

echo "source /opt/ros/melodic/setup.bash" >> ~/.bashrc
source ~/.bashrc

mkdir -p ~/ros/src
cd ~/ros/src

sudo apt -y install python-rosinstall python-rosinstall-generator python-wstool build-essential
sudo apt -y install python-wstool python-catkin-tools
wstool init

echo -e '\e[1;31m == Install sbgisen packages == \e[m'
wstool set -y --git ros_controllers git@github.com:sbgisen/ros_controllers.git
wstool update

echo -e '\e[1;31m == Set permssion to access == \e[m'
sudo usermod -a -G dialout $USER
sudo usermod -a -G video $USER

# Install Cube-petit
echo -e '\e[1;31m == Set up Cube-petit == \e[m'
cd ~/ros/src/
git clone https://github.com/AiriYokochi/raspberrypi_cube_moc.git
cd raspberrypi_cube_moc/cube_petit/
catkin bt

# add bashrc
echo ./add_bashrc.txt >> ~/.bashrc
mkdir ~/shell_scripts
cp ./shell_utils/* ~/shell_scripts/

# add udev
sudo cp ./udevs/* /etc/udev/rules.d/
sudo echo usb_add_vendor.txt >> /etc/udev/99-usb-serial.rules
sudo /etc/init.d/udev reaload

source ~/.bashrc


# apt get synaptic
sudo apt install synaptic -y

# apt get ros-melodic-package

sudo apt install ros-melodic-amcl
sudo apt install ros-melodic-move-base
sudo apt install ros-melodic-gmapping
sudo apt install ros-melodic-hector-map-server -y
sudo apt install ros-melodic-hector-compressed-map-transporte -y
sudo apt install ros-melodic-hector-compressed-map-transport -y
sudo apt install libglfw3-dev libgl1-mesa-dev libglu1-mesa-dev
sudo apt install libssl-dev libusb-1.0-0-dev pkg-config libgtk-3-dev

sudo apt install ros-melodic-ackermans-steering-controller
sudo apt install ros-melodic-action-base-local-planner
sudo apt install ros-melodic-bond
sudo apt install ros-melodic-clear-costmap-recovery

sudo apt install ros-melodic-catkin ros-melodic-rospy ros-melodic-roscpp ros-melodic-urdf ros-melodic-std-msgs ros-melodic-message-generation
sudo apt install ros-melodic-hardware-interface
sudo apt install ros-melodic-combined-robot-hw
sudo apt install ros-melodic-controller-manager
sudo apt install ros-melodic-joint-state-publisher

# ddynamic

sudo apt install ros-melodic-ddynamic-reconfigure:=0.2.0


# ros-controllers

mkdir -p ~/ros/src/sbgisen
cd ~/ros/src/sbgisen
git clone https://github.com/sbgisen/ros_controllers.git
cd ros_controllers
git checkout feature/odom_initialization
cd ../


# dynamixel
sudo apt install ros-melodic-dynamixel-sdk
git clone https://github.com/AiriYokochi/libdynamixel.git
cd libdynamixel
sudo ./waf configure
sudo ./waf
sudo ./waf install
sudo vi CMakeList.txt
cd ../
git clone --recursive https://github.com/AiriYokochi/dynamixel_control_hw.git

# lh_laser_driver
git clone https://github.com/AiriYokochi/lh_laser_driver.git
# hector_slam
git clone https://github.com/sbgisen/hector_slam.git
# teleop
git clone https://github.com/ros-teleop/teleop_twist_joy.git

# intel-realsense
sudo apt install ros-melodic-realsense2-camera:=2.2.12*
sudo apt install librealsense2:=2.30.0*
sudo apt install ros-melodic-udev-rules:=2.30.0.*
sudo apt install ros-melodic-librealsense2-dkms
sudo apt install ros-melodic-librealsense2

catlkin build

