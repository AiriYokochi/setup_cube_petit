#!/usr/bin/env bash
# cube_petit_setup webapp launcher.
#
# Usage:
#   ./webapp/run.sh            # real run (will ask for sudo password once)
#   ./webapp/run.sh --mock     # development mode: no real commands are run,
#                               # no sudo is needed, everything is simulated.
#
# Re-running this script after a reboot (as instructed by the "reboot" step
# in the wizard) picks up right where you left off: progress is saved in
# ~/.cube_petit_setup/state.json.
set -euo pipefail

MOCK=0
for arg in "$@"; do
  case "$arg" in
    --mock) MOCK=1 ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--mock]" >&2
      exit 1
      ;;
  esac
done

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$HERE/.venv"
PORT="${CUBE_PETIT_SETUP_PORT:-8760}"
HOST="${CUBE_PETIT_SETUP_HOST:-0.0.0.0}"

KEEPALIVE_PID=""
cleanup() {
  if [ -n "$KEEPALIVE_PID" ]; then
    kill "$KEEPALIVE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# Long steps (apt upgrade, colcon build) can outlast the default 5-minute
# screen blank, which looks like a freeze to a non-engineer. Disable idle
# blanking up front; setup_pc.bash makes the same setting permanent anyway.
if command -v gsettings >/dev/null 2>&1; then
  gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || true
fi

if [ "$MOCK" -eq 1 ]; then
  echo "[run.sh] --mock mode: no real setup commands will run, sudo is not needed."
  export CUBE_PETIT_SETUP_MOCK=1
else
  echo "[run.sh] Authenticating sudo once for the whole session..."
  sudo -v
  # Keep the sudo timestamp alive in the background so individual setup
  # steps never prompt for a password mid-stream. Killed on exit (see trap).
  ( while true; do sudo -n true; sleep 50; done ) &
  KEEPALIVE_PID=$!
  unset CUBE_PETIT_SETUP_MOCK
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "[run.sh] creating venv at $VENV_DIR"
  if ! python3 -m venv "$VENV_DIR" 2>/tmp/cube_petit_setup_venv_err.log; then
    echo "[run.sh] python3-venv seems missing, installing it (needs sudo)..."
    sudo apt update
    sudo apt install -y python3-venv
    python3 -m venv "$VENV_DIR"
  fi
fi

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
pip install -q --disable-pip-version-check -r "$HERE/requirements.txt"

echo "[run.sh] starting server on http://${HOST}:${PORT}"
echo "[run.sh] open in a browser: http://localhost:${PORT}"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
if [ -n "$LAN_IP" ]; then
  echo "[run.sh] from a tablet on the same network: http://${LAN_IP}:${PORT}"
fi

cd "$HERE"
exec uvicorn app.main:app --host "$HOST" --port "$PORT"
