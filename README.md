# cube_petit_setup

This is setup script for Cube petit(Real robot) <br>
キューブプチ(ロボット実機)のPCをセットアップするスクリプトです

## What is Cube petit?
- personal robot kit with **open-source software & hardware**
- Easy Development Environment( Real robot or Simulator(Gazebo11) )
- **SLAM & Navigation** as Basic Function
- **Easy Talk, Auto Charging**, etc as Advanced Function (ROS1 available)

**If you develop in a simulator environment(your PC), please see here**
自分のPC上で動かす場合は本スクリプトは必要ありません<br>
以下のリポジトリをクローンしてください
[Github: cube_petit_ros](https://github.com/sbgisen/cube_petit_ros)

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
    git clone https://github.com/sbgisen/cube_petit_setup.git -b feature/ros2_jazzy
    cd cube_petit_setup
    ```

4. Run setup Script

    1. `source setup_pc.bash` : Set Wallpaper, Install Chrome, Hide side bar, Set Power
    1. `source setup_dev_tools.sh` : (Option) Install gitKraken, VSCode
    1. `source setup_ros.bash` : Install ROS2 Jazzy and cube_petit_ros repository
    1. `source setup_devices.bash` : Setup Wifi, Audio, IMU, CAN, Realsense


## Setup Script
1. `setup_pc.bash`
    - 実行するとパスワードを聞かれます。実行完了すると、一度画面が暗くなって顔の壁紙が表示されます。
1. `setup_dev_tools.sh`
    - 実行すると各ツールをインストールするか聞かれます。インストールする際はエンターキーを押してください。パスワードを聞かれます。
1. `setup_ros.bash`
    - 実行するとパスワードを聞かれます。またエンターキーを求められるタイミングがあります。
1. `setup_devices.bash`
    - 実行すると各デバイスをインストールするか聞かれます。Wifiはルータがセットアップしているとき、AudioはSoundBlasterがつながっているときに実行してください。


## Test
1. Put PC inside the robot
1. Connect **power**, **2 USB** and **HDMI** connector
1. **Power ON** PC and Cube petit's Face is displayed
1. **Network** Setting
1. **Speaker and Mic** Setting
1. Check **USB recognized**
    `ls /dev` -> result should include (device names created by `udevs/*.rules`)
    ```
    ttyWitMotion
    ttyCANable
    ttyLD06-19
    ``` 
1. Check **Controller** is available
1. Set **Auto Bring Up**
