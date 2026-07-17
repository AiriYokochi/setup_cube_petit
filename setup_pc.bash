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
# With auto-login enabled the GNOME keyring is never unlocked by a login
# password, so Chrome prompts to unlock/create a keyring at first launch.
# Ship a passwordless plaintext default keyring instead: no prompt, and the
# robot stores no secrets in it anyway. (Just deleting login.keyring is not
# enough -- Chrome then prompts to create a new one.)
KEYRING_DIR="$HOME/.local/share/keyrings"
mkdir -p "$KEYRING_DIR"
chmod 700 "$KEYRING_DIR"
if [ ! -f "$KEYRING_DIR/Default_keyring.keyring" ]; then
  printf '[keyring]\ndisplay-name=Default keyring\nctime=0\nmtime=0\nlock-on-idle=false\nlock-after=false\n' \
    > "$KEYRING_DIR/Default_keyring.keyring"
fi
printf 'Default_keyring' > "$KEYRING_DIR/default"
rm -f "$KEYRING_DIR/login.keyring"

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

# Auto login. Applied on the next reboot; do NOT restart gdm here, it kills
# the running GUI session (terminal, browser, the setup webapp) mid-setup.
if ! sudo grep -q '^AutomaticLoginEnable=true' /etc/gdm3/custom.conf; then
  sudo sed -i '/^\[daemon\]/a AutomaticLoginEnable=true\nAutomaticLogin='$(whoami) /etc/gdm3/custom.conf
fi

# Force Xorg sessions (disable Wayland). Remote-desktop tools (AnyDesk) do
# not support incoming connections on Wayland, and with auto-login enabled
# there is no login screen to pick "Ubuntu on Xorg" from. Applied on reboot.
if ! sudo grep -q '^WaylandEnable=false' /etc/gdm3/custom.conf; then
  sudo sed -i '/^\[daemon\]/a WaylandEnable=false' /etc/gdm3/custom.conf
fi

echo -e '\e[1;31m == Setup PC Finished == \e[m'
echo 'Auto-login and other display settings take effect after the next reboot.'
