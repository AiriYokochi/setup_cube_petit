#!/bin/bash

confirm() {
  read -r -p "$1 [y/n]: " ans
  [[ -z "$ans" || "$ans" == "y" || "$ans" == "Y" ]]
}

echo -e '\e[1;32m == Install Dev Tools == \e[m'

cd ~/Downloads

# Download GitKraken
if confirm "Install GitKraken (Git GUI Tool)?"; then
  echo -e '\e[1;33m == Install GitKraken (Git GUI Tool) == \e[m'
  wget -O /tmp/gitkraken-amd64.deb https://release.gitkraken.com/linux/gitkraken-amd64.deb
  sudo dpkg --install /tmp/gitkraken-amd64.deb
else
  echo "Skip GitKraken"
fi

# Download VS Code
if confirm "Install VS Code (Text Editor)?"; then
  echo -e '\e[1;33m == Install VS Code (Text Editor) == \e[m'
  sudo apt install -y curl gpg apt-transport-https
  curl -sSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /tmp/microsoft.gpg
  sudo install -o root -g root -m 644 /tmp/microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
  echo "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main" \
    | sudo tee /etc/apt/sources.list.d/vscode.list > /dev/null
  sudo apt update
  sudo apt install -y code
  # Also install the shared cube_petit dev profile (extensions + settings +
  # shared lint config) so the editor is ready to use out of the box.
  # Non-fatal: if VS Code has not registered the profile yet, the script
  # explains how to finish it manually. See dev_profile/README.md.
  bash ~/work/cube_petit_setup/dev_profile/setup_dev_profile.bash \
    || echo -e "\e[1;31m [WARN] dev profile install incomplete -- open VS Code once, then run dev_profile/setup_dev_profile.bash again \e[m"
else
  echo "Skip VS Code"
fi

# AnyDesk (remote support). Opt-in: only for machines whose owner will
# receive remote support. Requires an Xorg session for incoming connections
# (setup_pc.bash sets WaylandEnable=false; effective after a reboot).
if confirm "Install AnyDesk (remote support)?"; then
  echo -e '\e[1;33m == Install AnyDesk (remote support) == \e[m'
  wget -qO- https://keys.anydesk.com/repos/DEB-GPG-KEY \
    | sudo gpg --yes --dearmor -o /usr/share/keyrings/anydesk.gpg
  echo "deb [signed-by=/usr/share/keyrings/anydesk.gpg] http://deb.anydesk.com/ all main" \
    | sudo tee /etc/apt/sources.list.d/anydesk.list
  sudo apt update
  sudo apt install -y anydesk
else
  echo "Skip AnyDesk"
fi

echo -e '\e[1;32m == Install Dev Tools is Finished == \e[m'
