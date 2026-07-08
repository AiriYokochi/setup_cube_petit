#!/bin/bash
set -e

cd

# Install ROS Jazzy
echo -e '\e[1;31m == Install ROS2 Jazzy == \e[m'
locale  # check for UTF-8

sudo apt update && sudo apt install -y locales
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
sudo apt upgrade -y
sudo apt install -y ros-jazzy-desktop python3-rosdep
grep -qxF "source /opt/ros/jazzy/setup.bash" ~/.bashrc || echo "source /opt/ros/jazzy/setup.bash" >> ~/.bashrc
grep -qxF "source ~/ros/install/setup.bash" ~/.bashrc || echo "source ~/ros/install/setup.bash" >> ~/.bashrc

echo -e '\e[1;31m == Set permission to access == \e[m'
sudo usermod -a -G dialout $USER
sudo usermod -a -G video $USER

# Install Cube-petit
echo -e '\e[1;31m == Set up Cube-petit == \e[m'
mkdir -p ~/ros/src && cd ~/ros/src/
sudo rosdep init 2>/dev/null || true
rosdep update

# Install ripvcs
echo -e '\e[1;31m == Install ripvcs == \e[m'
cd ~/work
sudo apt install -y golang-go python3-vcstool
git clone https://github.com/ErickKramer/ripvcs
cd ripvcs
go build -o rv main.go
mkdir -p ~/.local/bin
mv rv ~/.local/bin/rv
chmod +x ~/.local/bin/rv
grep -qxF 'export PATH="$HOME/.local/bin:$PATH"' ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

# Install uv
echo -e '\e[1;31m == Install uv == \e[m'
curl -Ls https://astral.sh/uv/install.sh | bash
# uv installs to ~/.local/bin, which is already added to PATH above
grep -qxF "export ROS_DOMAIN_ID=94" ~/.bashrc || echo "export ROS_DOMAIN_ID=94" >> ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"
source /opt/ros/jazzy/setup.bash

# Install cube_petit_ros
echo -e '\e[1;31m == Install cube_petit_ros == \e[m'
cd ~/ros/src/
git clone https://github.com/sbgisen/cube_petit_ros.git -b jazzy-devel
vcs import . < ./cube_petit_ros/cube_petit_ros.repos
source /opt/ros/jazzy/setup.bash
rosdep install --from-path . --ignore-src -r -y
source ~/work/setup_cube_petit/submodule_recursive.bash
cd ~/ros
colcon build --symlink-install --parallel-workers 2
echo "Please reboot to apply group changes (dialout/video)."