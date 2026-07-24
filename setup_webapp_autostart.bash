#!/usr/bin/env bash
# Sets up a systemd *user* service that keeps the cube_petit_setup webapp
# running persistently, so /fleet and every individual's setup page are
# always reachable from another robot/tablet without remembering to run
# ./webapp/run.sh by hand first.
#
# Unlike ./webapp/run.sh, this does NOT do run.sh's interactive sudo
# authentication (there is no TTY for a systemd service to prompt on) or
# browser auto-open. Steps that need sudo (pc_setup, ros_setup, ...) will
# fail with no visible prompt if triggered through this persistent instance.
# For those, stop this service first, run ./webapp/run.sh by hand for that
# one step, then start this service again:
#   systemctl --user stop cube-petit-setup-webapp.service
#   ./webapp/run.sh
#   systemctl --user start cube-petit-setup-webapp.service
#
# Idempotent: re-running regenerates the service file and restarts it.
#
# Optional env: CUBE_PETIT_SETUP_PORT (default 8760)
set -e

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="cube-petit-setup-webapp.service"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_PATH="$SERVICE_DIR/$SERVICE_NAME"
VENV_DIR="$HERE/webapp/.venv"
PORT="${CUBE_PETIT_SETUP_PORT:-8760}"

echo -e '\e[1;31m == Set up persistent cube_petit_setup webapp service == \e[m'

mkdir -p "$SERVICE_DIR"

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating venv at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi
"$VENV_DIR/bin/pip" install -q --disable-pip-version-check -r "$HERE/webapp/requirements.txt"

cat >"$SERVICE_PATH" <<EOF
[Unit]
Description=Cube Petit setup webapp (persistent, for /fleet reachability)
After=network.target

[Service]
Type=simple
WorkingDirectory=$HERE/webapp
ExecStart=$VENV_DIR/bin/uvicorn app.main:app --host 0.0.0.0 --port $PORT
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
echo "Wrote $SERVICE_PATH"

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

echo ""
echo "cube_petit_setup webapp is now running persistently on port $PORT"
echo "(http://localhost:$PORT, or from another device on the LAN:"
echo " http://$(hostname).local:$PORT)."
echo ""
echo "Note: steps that need sudo (apt install etc.) need interactive"
echo "authentication, which this persistent service can't provide. For"
echo "those, run:"
echo "  systemctl --user stop $SERVICE_NAME"
echo "  ./webapp/run.sh   # do the one privileged step"
echo "  systemctl --user start $SERVICE_NAME"
