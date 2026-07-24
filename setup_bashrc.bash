#!/usr/bin/env bash
# Configure ~/.bashrc with the ROS 2 environment variables and convenience
# launch aliases every Cube Petit individual needs (Issue #5). Also
# distributes the recommended CycloneDDS config (config/cyclonedds.xml +
# config/60-cyclonedds.conf) to this machine.
#
# Idempotent: re-running replaces the previously written managed block
# (between the MARK_START/MARK_END markers) instead of duplicating it, and
# only overwrites ~/cyclonedds.xml if its content actually changed.
#
# Required env: ROBOT_NAMESPACE, ROS_DOMAIN_ID
# Optional env: OPENAI_API_KEY, FACE_COLOR (hex code, e.g. #ffa500 -- chosen
#   in the setup wizard's prereq step; baked into the 01_BRING alias below so
#   a manual launch also uses it instead of cube_petit_bringup's own
#   hostname-derived default. See cube_petit_bringup.launch.py's face_color
#   argument and cube_petit_facial_animation/animation.py.)
set -e

: "${ROBOT_NAMESPACE:?ROBOT_NAMESPACE is required (e.g. cube_petit_yellow)}"
: "${ROS_DOMAIN_ID:?ROS_DOMAIN_ID is required (e.g. 94)}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASHRC="$HOME/.bashrc"
MARK_START="# >>> cube_petit_setup >>>"
MARK_END="# <<< cube_petit_setup <<<"

echo -e '\e[1;31m == Set up ~/.bashrc environment (Issue #5) == \e[m'

# --- CycloneDDS: rmw implementation, config file, kernel receive buffer ---
echo -e '\e[1;31m == Install CycloneDDS rmw + distribute recommended config == \e[m'
sudo apt update && sudo apt install -y ros-jazzy-rmw-cyclonedds-cpp

if [ -f "$HOME/cyclonedds.xml" ] && diff -q "$REPO_ROOT/config/cyclonedds.xml" "$HOME/cyclonedds.xml" >/dev/null 2>&1; then
  echo "$HOME/cyclonedds.xml is already up to date, skipping copy."
else
  cp "$REPO_ROOT/config/cyclonedds.xml" "$HOME/cyclonedds.xml"
  echo "Installed $HOME/cyclonedds.xml"
fi

# cyclonedds.xml's <SocketReceiveBufferSize min="16MB"/> only takes effect if
# the kernel's UDP receive buffer ceiling allows it -- apply that via sysctl.
sudo cp "$REPO_ROOT/config/60-cyclonedds.conf" /etc/sysctl.d/60-cyclonedds.conf
sudo sysctl --system

# --- ~/.bashrc managed block -----------------------------------------------
if [ -n "${OPENAI_API_KEY:-}" ]; then
  OPENAI_LINE="export OPENAI_API_KEY=\"${OPENAI_API_KEY}\""
else
  OPENAI_LINE='# export OPENAI_API_KEY="sk-..."  # 会話機能を使うとき設定'
fi

# face_color:=<hex> only when the wizard has a chosen color to bake in --
# otherwise leave 01_BRING as-is and let cube_petit_bringup.launch.py fall
# back to its own default.
BRING_FACE_COLOR_ARG=""
if [ -n "${FACE_COLOR:-}" ]; then
  BRING_FACE_COLOR_ARG=" face_color:=${FACE_COLOR}"
fi

touch "$BASHRC"
if grep -qF "$MARK_START" "$BASHRC"; then
  sed -i "/^${MARK_START}\$/,/^${MARK_END}\$/d" "$BASHRC"
fi

cat >>"$BASHRC" <<EOF
$MARK_START
export ROBOT_NAMESPACE=${ROBOT_NAMESPACE}
export ROS_DOMAIN_ID=${ROS_DOMAIN_ID}
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
export CYCLONEDDS_URI=file://\$HOME/cyclonedds.xml
${OPENAI_LINE}

alias 01_BRING="ros2 launch cube_petit_bringup cube_petit_bringup.launch.py${BRING_FACE_COLOR_ARG}"
alias 02_DEMO="ros2 launch cube_petit_scenario cube_petit_talk_demo.launch.py"
alias 04_TALK_START="ros2 service call /${ROBOT_NAMESPACE}/enable_realtime_conversation std_srvs/srv/SetBool \"data: true\""
alias 04_TALK_FINISH="ros2 service call /${ROBOT_NAMESPACE}/enable_realtime_conversation std_srvs/srv/SetBool \"data: false\""
# sound:=true でSE再生、swing:=true で首振り動作を有効化できます(いずれもデフォルトfalse)
alias 05_ANIMA="ros2 launch cube_petit_anima anima.launch.py"
# 更新チェック: キャッシュを即表示するだけ(シェル起動は遅くしない)。再確認は裏で数時間おき
[[ \$- == *i* ]] && bash ${REPO_ROOT}/shell_scripts/check_updates.sh --bashrc
$MARK_END
EOF

echo "Updated $BASHRC (managed block between the cube_petit_setup markers)."
echo "Run 'source ~/.bashrc' or open a new terminal to apply."
