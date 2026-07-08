#!/bin/bash
# ros:jazzy 標準のentrypointに、ビルド済みワークスペースのsourceを追加したもの
set -e
source "/opt/ros/${ROS_DISTRO}/setup.bash" --
if [ -f /ws/install/setup.bash ]; then
    source /ws/install/setup.bash --
fi
exec "$@"
