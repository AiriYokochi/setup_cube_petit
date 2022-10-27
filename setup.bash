#!/bin/bash

cd

# set home dir in English
LANG=C xdg-user-dirs-gtk-update

# Install ROS
echo -e '\e[1;31m == Install ROS Noetic == \e[m'
#[TODO]

echo -e '\e[1;31m == Set permssion to access == \e[m'
sudo usermod -a -G dialout $USER
sudo usermod -a -G video $USER

# Install Cube-petit
echo -e '\e[1;31m == Set up Cube-petit == \e[m'
sudo apt install -y python3-pip python3-colcon-common-extensions python3-setuptools python3-vcstool
pip3 install -U setuptools

cd ~/ros/src/
git clone git@github.com:sbgisen/cube_petit_ros.git
cd cube_petit_ros/cube_petit_ros
rosdep install -i --from-paths ./
cd ~/ros/src/
vcs import < cube_petit_ros/.rosinstall
catkin build
source ~/.bashrc

# add bashrc
cd ~/lib/setup_cube_petit
cat ~/lib/setup_cube_petit/add_bashrc.txt >> ~/.bashrc
mkdir ~/shell_scripts
cp ./shell_scripts/* ~/shell_scripts/

# add udev
sudo cp ./udevs/* /etc/udev/rules.d/
sudo /etc/init.d/udev reload

source ~/.bashrc


# apt get synaptic
sudo apt install synaptic -y
sudo apt install htop -y

# apt get ros-melodic-package
sudo apt install libglfw3-dev libgl1-mesa-dev libglu1-mesa-dev -y
sudo apt install libssl-dev libusb-1.0-0-dev pkg-config libgtk-3-dev -y

## [TODO] Real sense

echo "export ROS_MASTER_URI=http://${PC_IP}:11311" >> ~/.bashrc
echo "export ROS_IP=${PC_IP}" >> ~/.bashrc

## [TODO] SET WIFI

## CHANGE BACKGROUND IMG
source ~/.bashrc
cp ~/ros/src/cube/cube_expression/imgs/*.png ~/Pictures/
gsettings set org.gnome.shell.extensions.dash-to-dock autohide false && gsettings set org.gnome.shell.extensions.dash-to-dock dock-fixed false && gsettings set org.gnome.shell.extensions.dash-to-dock intellihide false
gsettings set org.gnome.desktop.background picture-uri file:/home/gisen/Pictures/happy.png
echo "reboot and catkin build"
