# Cube petit 開発用イメージ
# 実機なしで開発・シミュレーションできるROS2 Jazzyワークスペース入りイメージ。
# setup_ros.bash と同じ手順(jazzy-develをclone → ripvcsで.reposを展開 → rosdep → colcon build)を
# コンテナ内で再現している。詳細は docker/README.md を参照。

FROM ros:jazzy

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV DEBIAN_FRONTEND=noninteractive

# 基本ツール(setup_ros.bash / sbgisen CI と同等)
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash-completion \
        ccache \
        curl \
        git \
        python3-pip \
        python3-vcstool \
        wget \
    && rm -rf /var/lib/apt/lists/*

# ripvcs(sbgisen CIと同じツール・バージョン)
ARG RIPVCS_VERSION=1.0.2
RUN wget -q "https://github.com/ErickKramer/ripvcs/releases/download/v${RIPVCS_VERSION}/ripvcs_${RIPVCS_VERSION}_linux_amd64" \
        -O /usr/local/bin/rv \
    && chmod +x /usr/local/bin/rv

# ワークスペースのclone(setup_ros.bashと同じ構成 + interaction/scenario)
# WORKSPACE_SNAPSHOT はレイヤーキャッシュを無効化して最新ソースを取り直すためのARG
# (CIが日付を渡す。手元でビルドするときは --build-arg WORKSPACE_SNAPSHOT=$(date +%Y%m%d))
ARG WORKSPACE_SNAPSHOT=manual
WORKDIR /ws/src
RUN echo "workspace snapshot: ${WORKSPACE_SNAPSHOT}" \
    && git clone https://github.com/sbgisen/cube_petit_ros.git -b jazzy-devel \
    && git clone https://github.com/sbgisen/cube_petit_interaction.git -b jazzy-devel \
    && git clone https://github.com/sbgisen/cube_petit_scenario.git -b jazzy-devel \
    && files=$(find . -type f -regextype posix-egrep -regex "\./.+\.(rosinstall|repos)" | sort) \
    && for f in ${files}; do rv import -r -s -i "${f}"; done

# コンテナ内でビルドできない・不適なパッケージを除外する。
# - uvで独自venvを作る重量級パッケージ(TensorFlow等で数GB増える)
# - depthai_hand_tracker: setup.pyがビルド時に sudo udevadm を実行するためコンテナ内で失敗する
# 除外理由と一覧は docker/README.md を参照。AMENT_IGNOREはrosdepにも無視させるため。
RUN for p in \
        depthai_hand_tracker \
        cube_petit_ros/cube_petit_speech_to_text \
        cube_petit_ros/cube_petit_text_to_speech \
        cube_petit_interaction/cube_petit_chat \
        cube_petit_interaction/cube_petit_perception \
        cube_petit_scenario/cube_petit_state_machine \
        cube_petit_scenario/cube_petit_rsj_2025 \
        cube_petit_scenario/memory_talk_demo \
    ; do \
        touch "${p}/COLCON_IGNORE" "${p}/AMENT_IGNORE"; \
    done

# 依存パッケージのインストール(-r: 未解決キーはスキップ。setup_ros.bash / CIと同じ)
# rviz2・teleop・cycloneddsは開発用に明示追加(実機はrmw_cyclonedds_cppで運用)
# hadolint ignore=DL3008
RUN echo -e "[install]\nbreak-system-packages = true" > /etc/pip.conf \
    && apt-get update \
    && rosdep update --rosdistro jazzy \
    && rosdep install -iry --from-paths /ws/src --rosdistro jazzy \
    && apt-get install -y --no-install-recommends \
        ros-jazzy-rmw-cyclonedds-cpp \
        ros-jazzy-rviz2 \
        ros-jazzy-teleop-twist-keyboard \
    && rm -rf /var/lib/apt/lists/*

# ワークスペースのビルド(build/logは削除してイメージを軽くする)
# 注: pose_to_servo が servo_action への依存を package.xml に宣言していないため(上流の修正待ち)、
# 先に servo_action をビルドして環境に載せてから全体をビルドする
WORKDIR /ws
# hadolint ignore=SC1091
RUN source /opt/ros/jazzy/setup.bash \
    && colcon build --packages-select servo_action --cmake-args -DCMAKE_BUILD_TYPE=Release \
    && source /ws/install/setup.bash \
    && colcon build --cmake-args -DCMAKE_BUILD_TYPE=Release \
    && rm -rf /ws/build /ws/log

# 実機と同じ設定(ROS_DOMAIN_ID=94 / CycloneDDS)
ENV ROS_DOMAIN_ID=94
ENV RMW_IMPLEMENTATION=rmw_cyclonedds_cpp

# 対話シェル・entrypoint両方でワークスペースをsourceする
RUN echo "source /opt/ros/jazzy/setup.bash" >> /root/.bashrc \
    && echo "source /ws/install/setup.bash" >> /root/.bashrc
COPY entrypoint.sh /ros_entrypoint.sh
RUN chmod +x /ros_entrypoint.sh

ENTRYPOINT ["/ros_entrypoint.sh"]
CMD ["bash"]
