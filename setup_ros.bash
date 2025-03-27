#!/bin/bash

cd

# Install ROS Humble
echo -e '\e[1;31m == Install ROS2 Jazzy == \e[m'
locale  # check for UTF-8

sudo apt update && sudo apt install locales
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8

locale  # verify settings
sudo apt install -y software-properties-common
sudo add-apt-repository universe
sudo apt update && sudo apt install curl -y
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
sudo apt update && sudo apt install -y ros-dev-tools

sudo apt update
sudo apt upgrade
sudo apt install -y ros-jazzy-desktop python3-rosdep
echo "source /opt/ros/jazzy/setup.bash" >> ~/.bashrc

echo -e '\e[1;31m == Set permssion to access == \e[m'
sudo usermod -a -G dialout $USER
sudo usermod -a -G video $USER

# Install Cube-petit
echo -e '\e[1;31m == Set up Cube-petit == \e[m'
mkdir -p ~/ros/src && cd ~/ros/src/
sudo rosdep init 
rosdep update

RIPVCS_VERSION=$(curl -s "https://api.github.com/repos/ErickKramer/ripvcs/releases/latest" | \grep -Po '"tag_name": *"v\K[^"]*')
ARCHITECTURE="linux_amd64"
curl -Lo ~/.local/bin/rv "https://github.com/ErickKramer/ripvcs/releases/download/v${RIPVCS_VERSION}/ripvcs_${RIPVCS_VERSION}_${ARCHITECTURE}"
chmod +x ~/.local/bin/rv

git clone git@github.com:sbgisen/cube_petit_ros.git -b feature/ros2_jazzy
rv import -r -i cube_petit_ros/cube_petit_ros.repos

rosdep install --from-paths . --ignore-src -r -y

cd ~/ros
colcon build --symlink-install --cmake-args -DCMAKE_EXPORT_COMPILE_COMMANDS=ON -DCMAKE_BUILD_TYPE=Release
