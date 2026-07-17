# cube_petit_setup

日本語版 → [README.md](README.md)

Setup scripts for the Cube petit (real robot) PC.

> If you only want to run Cube petit in a simulator on your own PC, you don't need this script. Clone [cube_petit_ros](https://github.com/sbgisen/cube_petit_ros) directly, or use the [Docker development environment](docker/README.md) (just `docker pull` a prebuilt-workspace image).

## Setup in 3 steps

Just copy-paste the blocks below, in order, to finish the setup.

### ① Get the repository

```bash
sudo apt install -y git ssh

mkdir -p ~/work && cd ~/work/
git clone https://github.com/sbgisen/cube_petit_setup.git -b jazzy-devel
cd cube_petit_setup
```

- If you haven't registered an SSH key with GitHub yet, run `ssh-keygen` and add the printed public key at [https://github.com/settings/keys](https://github.com/settings/keys) (skip this if you already have one registered).

### ② Set up the PC and ROS

```bash
source setup_pc.bash
source setup_dev_tools.sh
source setup_ros.bash
```

- `setup_pc.bash`: asks for your sudo password. Near the end the screen briefly goes dark and Cube petit's face wallpaper appears — that's expected.
- `setup_dev_tools.sh`: interactively asks (Y/n, press Enter to install) whether to install GitKraken and VS Code. Also asks for your sudo password.
- `setup_ros.bash`: asks for your sudo password, and there are a few points where it waits for Enter.
- **Reboot once this finishes** (to apply the dialout/video group permissions — required before the next step).

After rebooting, set `ROS_DOMAIN_ID` / `RMW_IMPLEMENTATION` / CycloneDDS config and the launch
aliases (01_BRING, etc.) in `~/.bashrc` (`setup_ros.bash` no longer does this — see Issue #5):

```bash
ROBOT_NAMESPACE=cube_petit_yellow ROS_DOMAIN_ID=94 ./setup_bashrc.bash
source ~/.bashrc
```

- `ROBOT_NAMESPACE` is the individual name you chose in step ①; change `ROS_DOMAIN_ID` per
  individual if you run several Cube petits in the same place (both are required — it exits
  with an error if either is missing).
- To use the conversation feature, also pass `OPENAI_API_KEY=sk-...`, or edit `~/.bashrc`
  directly afterwards.

### ③ Set up devices (after rebooting)

```bash
cd ~/work/cube_petit_setup
source setup_devices.bash
```

- For each of Wifi, Audio, IMU, CAN, and Realsense, it interactively asks (Y/n, press Enter to install) whether to set that device up.
- Only run Wifi if a router is already set up, and Audio if a SoundBlaster is connected. It's fine to skip any device that isn't connected to your robot.

## Verify it works

1. Put the PC inside the robot
2. Connect **power**, **2 USB**, and **HDMI**
3. **Power on** and confirm Cube petit's face is displayed
4. Check the **network** setting
5. Check the **speaker and mic** setting
6. Check **USB is recognized** (device names created by `udevs/*.rules`)
    ```bash
    ls /dev
    ```
    should include:
    ```
    ttyWitMotion
    ttyCANable
    ttyLD06-19
    ```
7. Check the **controller** is available
8. Set up **auto bring-up**

## Docker development environment (develop without the robot)

You can develop and run simulations without the physical robot using a Docker image that contains a prebuilt workspace.

```bash
docker pull ghcr.io/sbgisen/cube_petit_dev:jazzy
```

The image is built automatically by GitHub Actions on every push to `jazzy-devel` and on a weekly schedule.
See [docker/README.md](docker/README.md) (Japanese) for usage: Gazebo simulation, mounting your own source, and the VSCode devcontainer.

## Details

### What is Cube petit?

- A personal robot kit built with **open-source software & hardware**
- An easy development environment for both the real robot and the simulator (Gazebo11)
- **SLAM & Navigation** as a basic function
- **Easy talk, auto charging**, etc. as advanced functions (also available on ROS1)

### Requirements

- Ubuntu 24.04
- Internet connection

### About each setup script

| Script | What it does |
| --- | --- |
| `setup_pc.bash` | Wallpaper, Chrome install, hide side bar, power settings, etc. |
| `setup_dev_tools.sh` | (Optional) Install GitKraken and VS Code |
| `setup_ros.bash` | Install ROS2 Jazzy and the `cube_petit_ros` repository (`--build-only` to just rebuild; `CUBE_PETIT_ROS_WS` to install into a different workspace) |
| `setup_bashrc.bash` | Set `ROS_DOMAIN_ID`, CycloneDDS config, and launch aliases in `~/.bashrc` |
| `setup_devices.bash` | Set up Wifi, Audio, IMU, CAN, Realsense |
