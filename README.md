# setup_cube_petit

This is setup script for Cube petit(Real robot)
キューブプチ(ロボット実機)のPCをセットアップするスクリプトです

## What is Cube petit?
- personal robot kit with **open-source software & hardware**
- Easy Development Environment( Real robot or Simulator(Gazebo9) )
- **SLAM & Navigation** as Basic Function
- **Easy Talk, Auto Charging**, etc as Advanced Function
- [Youtube]()
- [Twitter (~2023/03/31)]()

**If you develop in a simulator environment(your PC), please see here**
自分のPC上で動かす場合は本スクリプトは必要ありません
以下のリポジトリをクローンしてください
[Github: cube_petit_ros]()

## Requirements
- PC (Ubuntu20.04)
- Internet

## How to Install
1. Open terminal and install git and etc

    ```
    sudo apt install -y libappindicator1 git net-tools openssh-server
    ```

2. Set SSH key to Github

3. Git clone this repo
    ```
    mkdir -p ~/lib && cd ~/lib/
    git clone git@github.com:AiriYokochi/setup_cube_petit.git
    cd setup_cube_petit
    source setup.bash
    ```

4. Set IP Address
Check SETUP_WIFI.md

## Test
1. Put PC inside the robot
1. Connect **power**, **ethernet**, **2 USB** and **HDMI** connector
1. **Power ON** PC and Cube petit's Face is displayed
1. **Network** Setting
1. **Speaker and Mic** Setting
1. Check **USB recognized**
    `ls /dev` -> result
    ```
    a
    b
    c
    ``` 
1. Check **Controller** is available
1. Set **Auto Bring Up**

## Description for setup.bash

- [x] Install ROS Noetic (Ubuntu20.04)
- [x] Add udev files to `/etc/udev/rules.d/`
- [x] Add Shell scripts to `~/shell_scripts/`
- [x] Add alias to `~/.bashrc`
- [x] Change Background Image