#!/bin/bash


# set home dir in English
LANG=C xdg-user-dirs-gtk-update

# Apt upgrade
echo -e '\e[1;31m == apt update / upgrade == \e[m'
sudo apt update
sudo apt upgrade -y

echo -e '\e[1;31m == apt install == \e[m'
# Japanese Input
sudo apt install -y ibus-mozc wget gpg net-tools
# Chrome for face
wget -qO- https://dl.google.com/linux/linux_signing_key.pub \
  | gpg --dearmor \
  | sudo tee /usr/share/keyrings/google-chrome.gpg > /dev/null
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
  | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install -y google-chrome-stable
# remove keyring for open Chrome
rm ~/.local/share/keyrings/login.keyring

echo -e '\e[1;31m == Setup Udev rules == \e[m'
# Udevs
cd ~/work/cube_petit_setup
echo -e '\e[1;31m == Setup Udev rules == \e[m'
sudo cp udevs/* /etc/udev/rules.d/
cp -r shell_scripts ~/
grep -qxF '[[ $- == *i* ]] && echo "Running udev_check.sh..." && ~/shell_scripts/udev_check.sh' ~/.bashrc || echo '[[ $- == *i* ]] && echo "Running udev_check.sh..." && ~/shell_scripts/udev_check.sh' >> ~/.bashrc

grep -qxF "alias psgrepkill=\"bash ~/shell_scripts/ps_grep_kill.sh \$@\"" ~/.bashrc || echo "alias psgrepkill=\"bash ~/shell_scripts/ps_grep_kill.sh \$@\"" >> ~/.bashrc
cd
grep -qxF "export PS1=\"\n\"\$PS1" ~/.bashrc || echo "export PS1=\"\n\"\$PS1" >> ~/.bashrc
grep -qxF "export DISPLAY=:0.0" ~/.bashrc || echo "export DISPLAY=:0.0" >> ~/.bashrc
grep -qxF "export LIBGL_ALWAYS_SOFTWARE=1" ~/.bashrc || echo "export LIBGL_ALWAYS_SOFTWARE=1" >> ~/.bashrc


# blanc screen off
gsettings set org.gnome.desktop.session idle-delay  0

# hide side-bar
gsettings set org.gnome.shell.extensions.dash-to-dock autohide false && gsettings set org.gnome.shell.extensions.dash-to-dock dock-fixed false && gsettings set org.gnome.shell.extensions.dash-to-dock intellihide false

# Set Favorite app
gsettings set org.gnome.shell favorite-apps "['google-chrome.desktop', 'org.gnome.Nautilus.desktop', 'org.gnome.Terminal.desktop', 'code.desktop']"

# Hide Home fron desktop
gsettings set org.gnome.shell.extensions.ding show-home false

# Wall paper
mkdir -p ~/Pictures/Wallpapers
cp ~/work/cube_petit_setup/pictures/*.png ~/Pictures/Wallpapers
gsettings set org.gnome.desktop.background picture-uri "file://$HOME/Pictures/Wallpapers/happy.png"

# Auto login
sudo sed -i '/^\[daemon\]/a AutomaticLoginEnable=true\nAutomaticLogin='$(whoami) /etc/gdm3/custom.conf

echo -e '\e[1;31m == Setup PC Finished == \e[m'

sudo systemctl restart gdm
