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
  sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main" > /etc/apt/sources.list.d/vscode.list'
  sudo apt update
  sudo apt install -y code
else
  echo "Skip VS Code"
fi

echo -e '\e[1;32m == Install Dev Tools is Finished == \e[m'
