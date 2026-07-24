#!/usr/bin/env bash
# Grants the current user passwordless sudo for the specific system commands
# the setup_*.bash/*.sh scripts in this repo run under `sudo` (apt install,
# writing to /etc/udev/rules.d, systemctl, usermod, ...).
#
# Why: the setup webapp now runs as a persistent, non-interactive systemd
# service (see setup_webapp_autostart.bash), so there is no TTY for sudo to
# prompt on -- any needs_sudo step (pc_setup, dev_tools, ros_setup,
# env_setup, devices) fails outright with "a terminal is required to read
# the password" when triggered from a browser/iPad.
#
# Scope: this allows the listed binaries only, with any arguments -- not an
# arbitrary root shell. It does NOT reduce the blast radius much below full
# root, though: cp/tee/sed/install can still write or replace any file, and
# apt/dpkg can install anything. That is an accepted tradeoff for a
# single-purpose, physically-controlled robot PC whose setup webapp already
# has no authentication of its own -- anyone who can reach this robot's
# setup webapp on the LAN can now trigger this range of root operations
# through it. Do not run this on a robot that is exposed beyond a trusted
# network.
#
# Idempotent: safe to re-run; only rewrites the sudoers file if the content
# actually changed. Always validates with `visudo -c` before installing, so
# a bug here cannot lock out sudo on the machine.
#
# This script itself needs an interactive sudo prompt the first time (you
# cannot grant yourself passwordless sudo without already having sudo) --
# run it once by hand from a terminal per robot.
set -e

SUDOERS_PATH="/etc/sudoers.d/99-cube-petit-setup"
TARGET_USER="$(whoami)"

echo -e '\e[1;31m == Grant passwordless sudo for cube_petit_setup scripts == \e[m'

# Resolve absolute paths so the sudoers entries can't be bypassed by a PATH
# trick, and so this doesn't silently no-op if a binary lives somewhere
# unexpected on a given machine.
BINS="apt apt-get dpkg add-apt-repository tee cp install chmod sed gpg curl grep usermod systemctl udevadm locale-gen update-locale rosdep make ldconfig nmcli sysctl"
CMD_LIST=""
for b in $BINS; do
  p="$(command -v "$b" || true)"
  if [ -z "$p" ]; then
    echo "  (skip: $b not found on this machine)"
    continue
  fi
  CMD_LIST="${CMD_LIST}${CMD_LIST:+, }$p"
done

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT
cat >"$TMP_FILE" <<EOF
# Cube Petit setup wizard: passwordless sudo for the fixed set of system
# commands setup_*.bash/*.sh run, so the persistent (non-interactive)
# webapp service can complete needs_sudo steps. See setup_sudoers.bash in
# sbgisen/cube_petit_setup -- generated, do not hand-edit; edit that script
# and re-run it instead.
Cmnd_Alias CUBE_PETIT_SETUP = $CMD_LIST
$TARGET_USER ALL=(root) NOPASSWD: CUBE_PETIT_SETUP
EOF

if ! visudo -c -f "$TMP_FILE" >/dev/null; then
  echo "Generated sudoers file failed validation -- not installing. See above." >&2
  exit 1
fi

if [ -f "$SUDOERS_PATH" ] && cmp -s "$TMP_FILE" "$SUDOERS_PATH"; then
  echo "$SUDOERS_PATH already up to date."
else
  sudo install -o root -g root -m 440 "$TMP_FILE" "$SUDOERS_PATH"
  echo "Wrote $SUDOERS_PATH"
fi

echo ""
echo "Passwordless sudo is now set up for: $TARGET_USER"
echo "needs_sudo steps triggered from the persistent webapp (e.g. from an"
echo "iPad) should now complete without a sudo prompt."
