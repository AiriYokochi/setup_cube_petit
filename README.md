# setup_cube_petit

This is setup script for Cube petit(Real robot)
キューブプチ(ロボット実機)のPCをセットアップするスクリプトです

## What is Cube petit?
- personal robot kit with **open-source software & hardware**
- Easy Development Environment( Real robot or Simulator(Gazebo11) )
- **SLAM & Navigation** as Basic Function(ROS1 avaiable)
- **Easy Talk, Auto Charging**, etc as Advanced Function (ROS1 avaiable)
- [Youtube]()
- [Twitter (~2023/03/31)]()

**If you develop in a simulator environment(your PC), please see here**
自分のPC上で動かす場合は本スクリプトは必要ありません
以下のリポジトリをクローンしてください
[Github: cube_petit_ros]()

## Requirements
- Ubuntu24.04
- Internet

## How to Install
1. Open terminal and install git and etc

    ```
    sudo apt install -y git ssh
    ```

2. Set SSH key to Github (If you need)

    ```
    cd ~/.ssh
    ssh-keygen
    ```
    access to : https://github.com/settings/keys

3. Git clone this repo
    ```
    mkdir -p ~/work && cd ~/work/
    git clone git@github.com:AiriYokochi/setup_cube_petit.git -b feature/ros2_jazzy
    cd setup_cube_petit
    ```

    `source setup.pc` : Set Wallpaper, Install chrome, Hide side bar, Set Power
    `source setup_dev_tools.sh` : (Option) Install gitKraken, VSCode
    `source setup_ros2.sh` : Install ROS2 Jazzy and cube_petit_ros repository


## Test
1. Put PC inside the robot
1. Connect **power**, , **2 USB** and **HDMI** connector
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
