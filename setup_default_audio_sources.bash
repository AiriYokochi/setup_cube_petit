#!/bin/bash
sudo apt install -y pulseaudio-utils

mkdir -p ~/.config/systemd/user/
cp set-soundblaster.service ~/.config/systemd/user/

systemctl --user daemon-reload
systemctl --user enable set-soundblaster.service
systemctl --user start set-soundblaster.service