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
cd ~/git/setup_cube_petit
cat ~/git/setup_cube_petit/add_bashrc.txt >> ~/.bashrc
mkdir ~/shell_scripts
cp ./shell_utils/* ~/shell_scripts/

# add udev
sudo cp ./udevs/* /etc/udev/rules.d/
## sudo cat usb_add_vendor.txt >> /etc/udev/99-usb-serial.rules
##permittion denied
sudo /etc/init.d/udev reload

source ~/.bashrc


# apt get synaptic
sudo apt install synaptic -y
sudo apt install htop -y

# apt get ros-melodic-package

sudo apt install ros-melodic-amcl -y
sudo apt install ros-melodic-move-base -y
sudo apt install ros-melodic-gmapping -y
sudo apt install ros-melodic-hector-map-server -y
sudo apt install ros-melodic-hector-compressed-map-transport -y
sudo apt install libglfw3-dev libgl1-mesa-dev libglu1-mesa-dev -y
sudo apt install libssl-dev libusb-1.0-0-dev pkg-config libgtk-3-dev -y

sudo apt install ros-melodic-ackermann-steering-controller -y
sudo apt install ros-melodic-combined-robot-hw -y
sudo apt install ros-melodic-map-server -y

# ddynamic

sudo apt install ros-melodic-ddynamic-reconfigure:=0.2.0*
echo "[todo synapticでros-melodic-ddynamic-reconfigureバージョンロック]"


# ros-controllers

mkdir -p ~/ros/src/sbgisen
cd ~/ros/src/sbgisen
git clone https://github.com/sbgisen/ros_controllers.git
cd ros_controllers
git checkout feature/odom_initialization
touch ~/ros/src/sbgisen/ros_controllers/four_wheel_steering_contoller/CATKIN_IGNORE
touch ~/ros/src/sbgisen/ros_controllers/ackermann_steering_controller/CATKIN_IGNORE 
cd ../


# dynamixel
sudp apt install ros-melodic-ros-controll
sudo apt install ros-melodic-dynamixel-sdk
git clone https://github.com/AiriYokochi/libdynamixel.git
cd ~/ros/src/
cd libdynamixel
sudo ./waf configure
sudo ./waf
sudo ./waf install
mkdir include
sudo cp -r /usr/local/install/dynamixel ./include/
cd ../
git clone --recursive https://github.com/AiriYokochi/dynamixel_control_hw.git
cd dynamixel_control_hw
cp CMakeLists.txt CMakeLists.txt.old
sed -e "s/set(LIBDYNAMIXEL \"\")/set(LIBDYNAMIXEL \"\/home\/gisen\/ros\/src\/libdynamixel\")/g" CMakeLists.txt > tmp
mv tmp CMakeLists.txt
cd ../


# lh_laser_driver
git clone https://github.com/AiriYokochi/lh_laser_driver.git
# hector_slam
git clone https://github.com/sbgisen/hector_slam.git
# teleop
git clone https://github.com/ros-teleop/teleop_twist_joy.git

# intel-realsense
sudo apt-key adv --keyserver keys.gnupg.net --recv-key F6E65AC044F831AC80A06380C8B3A55A6F3EFCDE || sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-key F6E65AC044F831AC80A06380C8B3A55A6F3EFCDE
sudo add-apt-repository "deb http://realsense-hw-public.s3.amazonaws.com/Debian/apt-repo bionic main" -u

## [DO WITH SYNAPTIC]
echo "DO WITH SYNAPTIC
sudo apt install ros-melodic-realsense2-camera:=2.2.12*
sudo apt install librealsense2:=2.30.0*
sudo apt install ros-melodic-udev-rules:=2.30.0.*
sudo apt install ros-melodic-librealsense2-dkms
sudo apt install ros-melodic-librealsense2
"

echo "export ROS_MASTER_URI=http://${PC_IP}:11311" >> ~/.bashrc
echo "export ROS_IP=${PC_IP}" >> ~/.bashrc

echo "reboot and catkin build"
