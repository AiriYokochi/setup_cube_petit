#!/bin/bash

# Udevs
cd ~/work/setup_cube_petit
echo -e '\e[1;31m == Install and setup Udev rules == \e[m'
sudo cp udevs/* /etc/udev/rules.d/
sudo cp -r shell_scripts ~/
echo "alias psgrepkill=\"bash ~/shell_scripts/ps_grep_kill.sh \$@\""  >> ~/.bashrc
cd

# set home dir in English
LANG=C xdg-user-dirs-gtk-update

# blanc screen iff
gsettings set org.gnome.desktop.session idle-delay  0

# hide side-bar
gsettings set org.gnome.shell.extensions.dash-to-dock autohide false && gsettings set org.gnome.shell.extensions.dash-to-dock dock-fixed false && gsettings set org.gnome.shell.extensions.dash-to-dock intellihide false

# Download Chrome
cd ~/Downloads
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && sudo dpkg -i google-chrome-stable_current_amd64.deb

# Set Favorite app
gsettings set org.gnome.shell favorite-apps "['google-chrome.desktop', 'org.gnome.Nautilus.desktop', 'org.gnome.Terminal.desktop', 'code.desktop']"

# Hide Home fron desktop
gsettings set org.gnome.shell.extensions.ding show-home false

# Japanese Input
sudo apt install -y ibus-mozc

# Wall paper
mkdir -p ~/Pictures/Wallpapers
cp ~/work/setup_cube_petit/pictures/*.png ~/Pictures/Wallpapers
