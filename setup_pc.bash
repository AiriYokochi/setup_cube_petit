#!/bin/bash

# Udevs
cd ~/work/setup_cube_petit
echo -e '\e[1;31m == Install and setup Udev rules == \e[m'
sudo cp udevs/* /etc/udev/rules.d/
sudo cp -r shell_scripts ~/
echo "alias psgrepkill=\"bash /home/gisen/shell_scripts/ps_grep_kill.sh \$@\""  >> ~/.bashrc
cd

# set home dir in English
LANG=C xdg-user-dirs-gtk-update

# blanc screen iff
gsettings set org.gnome.desktop.session idle-delay  0

# Download Chrome
cd ~/Downloads
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && sudo dpkg -i google-chrome-stable_current_amd64.deb

# Download GitKraken
cd ~/Downloads
wget https://release.gitkraken.com/linux/gitkraken-amd64.deb && sudo dpkg --install gitkraken-amd64.deb

# Download VS Code
sudo apt install curl
curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
sudo install -o root -g root -m 644 microsoft.gpg /etc/apt/trusted.gpg.d/
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main" > /etc/apt/sources.list.d/vscode.list'
sudo apt install apt-transport-https
sudo apt update
sudo apt install code

# Install and setup git
echo -e '\e[1;31m == Install and setup git == \e[m'
sudo apt install -y git ssh net-tools vim
cd ~/.ssh
ssh-keygen
