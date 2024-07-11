#!/bin/bash

cd

# Install ROS Humble
echo -e '\e[1;31m == Install ROS Humble == \e[m'
sudo apt install -y software-properties-common
sudo add-apt-repository universe

sudo apt update && sudo apt install curl -y
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null

sudo apt update && sudo apt upgrade
sudo apt install -y ros-humble-desktop

echo "source /opt/ros/humble/setup.bash" >> ~/.bashrc
echo "export ROS_DOMAIN_ID=1" >> ~/.bashrc
echo "export ROS_LOCALHOST_ONLY=1" >> ~/.bashrc
echo "source ~/ros/install/setup.bash" >> ~/.bashrc

touch ~/.bash_profile
echo "source ~/.bashrc" >> ~/.bash_profile
echo "source /opt/ros/humble/setup.bash" >> ~/.bash_profile
echo "source ~/ros/install/setup.bash" >> ~/.bash_profile

sudo apt install -y python3-rosdep
sudo apt install -y ~nros-humble-rqt*
sudo apt install -y python3-pip
pip3 install -U colcon-common-extensions

echo 'export PATH=$PATH:~/.local/bin' >> ~/.bashrc

mkdir -p ~/ros/src
cd ~/ros/src
cd ~/ros
sudo rosdep init
rosdep update
source ~/.bashrc

sudo apt -y install python3-rosinstall python3-rosinstall-generator build-essential
sudo apt -y install python3-wstool
sudo apt -y install python3-vcstool
cd ~/ros/src
wstool init

echo -e '\e[1;31m == Set permssion to access == \e[m'
sudo usermod -a -G dialout $USER
sudo usermod -a -G video $USER

# Install Cube-petit
echo -e '\e[1;31m == Set up Cube-petit == \e[m'
cd ~/ros/src/
git clone -b feature/humble_setup git@github.com:sbgisen/cube_petit_ros.git
wstool merge cube_petit_ros/.rosinstall
wstool up
rosdep install -r -y -i --from-paths src
# colcon build
# source install/setup.bash


# # intel-realsense
# sudo apt-key adv --keyserver keys.gnupg.net --recv-key F6E65AC044F831AC80A06380C8B3A55A6F3EFCDE || sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-key F6E65AC044F831AC80A06380C8B3A55A6F3EFCDE
# sudo add-apt-repository "deb http://realsense-hw-public.s3.amazonaws.com/Debian/apt-repo bionic main" -u

mkdir -p ~/Pictures/Wallpapers
cp ~/work/setup_cube_petit/pictures/*.png ~/Pictures/Wallpapers
gsettings set org.gnome.desktop.background picture-uri "file://${HOME}/Pictures/Wallpapers/happy.png"


# AutoStart
# mkdir -p ~/.config/autostart
# cp gnome-terminal.desktop ~/.config/autostart
