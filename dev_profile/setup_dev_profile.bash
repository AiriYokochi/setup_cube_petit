#!/bin/bash
# Set up the "sbgisen-ROS2" VS Code profile on this machine:
#   - clone sbgisen/.github (shared lint/format config referenced by the
#     profile: pyproject.toml for isort/yapf/ruff, ros2/.cmake-format, ...)
#   - install the extensions listed in extensions.txt into the profile
#   - write the profile's settings.json (backing up any existing one)
#   - make new VS Code windows open with this profile by default
#
# Idempotent: safe to run again. No sudo needed except (optionally) for the
# /opt/work/.github convenience symlink; if sudo is unavailable the script
# prints the one command to run manually instead of failing.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_NAME="sbgisen-ROS2"
GITHUB_DIR="$HOME/work/.github"
CODE_USER_DIR="$HOME/.config/Code/User"

if ! command -v code >/dev/null 2>&1; then
  echo "ERROR: VS Code (code) is not installed."
  echo "Run setup_dev_tools.sh first (or the web app's dev-tools step) and retry."
  exit 1
fi

echo "== 1/5 shared config repo (sbgisen/.github) =="
if [ -d "$GITHUB_DIR/.git" ]; then
  git -C "$GITHUB_DIR" pull --ff-only || echo "WARN: could not update $GITHUB_DIR (offline?); continuing with the existing checkout"
else
  mkdir -p "$HOME/work"
  git clone https://github.com/sbgisen/.github.git "$GITHUB_DIR"
fi
# License header text used by the psi-header extension; not part of the
# upstream repo, so ship our own copy next to it.
if [ ! -f "$GITHUB_DIR/.apache-2" ]; then
  cp "$HERE/.apache-2" "$GITHUB_DIR/.apache-2"
fi

echo "== 2/5 /opt/work/.github symlink =="
# The profile references /opt/work/.github/... (same path convention as the
# sbgisen dev machines). Point it at the clone above.
if [ -e /opt/work/.github ]; then
  echo "already exists: $(readlink -f /opt/work/.github)"
elif sudo -n true 2>/dev/null; then
  sudo mkdir -p /opt/work
  sudo ln -s "$GITHUB_DIR" /opt/work/.github
  echo "created: /opt/work/.github -> $GITHUB_DIR"
else
  echo "WARN: sudo not available. Create the symlink manually:"
  echo "  sudo mkdir -p /opt/work && sudo ln -s $GITHUB_DIR /opt/work/.github"
fi

echo "== 3/5 extensions =="
grep -v '^\s*#' "$HERE/extensions.txt" | grep -v '^\s*$' | while read -r ext; do
  code --profile "$PROFILE_NAME" --install-extension "$ext" --force
done

echo "== 4/5 profile settings =="
# Resolve the profile's storage directory from VS Code's profile registry.
PROFILE_DIR="$(python3 - "$CODE_USER_DIR" "$PROFILE_NAME" <<'PY'
import json
import pathlib
import sys

user_dir, name = pathlib.Path(sys.argv[1]), sys.argv[2]
storage = user_dir / "globalStorage" / "storage.json"
try:
    profiles = json.loads(storage.read_text()).get("userDataProfiles", [])
except (OSError, ValueError):
    profiles = []
for p in profiles:
    if p.get("name") == name:
        print(user_dir / "profiles" / p["location"])
        break
PY
)"
if [ -z "$PROFILE_DIR" ]; then
  echo "ERROR: VS Code has not registered the '$PROFILE_NAME' profile yet."
  echo "Open VS Code once (it finalizes the profile), then re-run this script."
  exit 1
fi
mkdir -p "$PROFILE_DIR"
if [ -f "$PROFILE_DIR/settings.json" ] && ! cmp -s "$HERE/settings.json" "$PROFILE_DIR/settings.json"; then
  cp "$PROFILE_DIR/settings.json" "$PROFILE_DIR/settings.json.bak.$(date +%Y%m%d%H%M%S)"
  echo "backed up existing profile settings"
fi
cp "$HERE/settings.json" "$PROFILE_DIR/settings.json"
echo "wrote $PROFILE_DIR/settings.json"

echo "== 5/5 use the profile for new windows =="
# Merge into the *default* user settings (do not clobber personal settings).
python3 - "$CODE_USER_DIR/settings.json" "$PROFILE_NAME" <<'PY'
import json
import pathlib
import shutil
import sys
import time

path, name = pathlib.Path(sys.argv[1]), sys.argv[2]
settings = {}
if path.exists():
    try:
        settings = json.loads(path.read_text())
    except ValueError:
        # settings.json may contain comments/trailing commas (JSONC); do not
        # risk mangling it -- back it up and start from the one key we need.
        backup = path.with_suffix(f".json.bak.{time.strftime('%Y%m%d%H%M%S')}")
        shutil.copy(path, backup)
        print(f"WARN: could not parse {path} as strict JSON; backed up to {backup}")
if settings.get("window.newWindowProfile") != name:
    settings["window.newWindowProfile"] = name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(settings, ensure_ascii=False, indent=4) + "\n")
    print(f"set window.newWindowProfile = {name}")
else:
    print("window.newWindowProfile already set")
PY

echo ""
echo "Done. Open a new VS Code window -- it starts with the '$PROFILE_NAME' profile."
