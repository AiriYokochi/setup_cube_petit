#!/usr/bin/env bash
# Reset the setup wizard so you can start over from step 1.
#
# Usage:
#   ./webapp/reset.sh        # asks for confirmation
#   ./webapp/reset.sh -f     # no confirmation
#
# This only clears the wizard's own bookkeeping (progress + logs in
# ~/.cube_petit_setup). It does NOT undo anything the setup steps already
# installed or configured — every step is safe to run again on top.
set -euo pipefail

STATE_DIR="${CUBE_PETIT_SETUP_HOME:-$HOME/.cube_petit_setup}"

if [ "${1:-}" != "-f" ]; then
  echo "セットアップの進行状態をリセットして、最初からやり直せるようにします。"
  echo "(インストール済みのものが消えるわけではありません。各ステップは再実行しても安全です)"
  read -r -p "リセットしますか? [y/N]: " ans
  case "$ans" in
    y|Y|yes) ;;
    *)
      echo "中止しました。"
      exit 0
      ;;
  esac
fi

# Clean up any setup script still running (e.g. one stuck waiting for input).
# pkill exits 1 when nothing matched; that's fine.
pkill -f 'cube_petit_setup/setup_.*\.bash' 2>/dev/null || true
pkill -f 'cube_petit_setup/setup_.*\.sh' 2>/dev/null || true
sudo -n pkill -f 'add-apt-repository' 2>/dev/null || true

rm -rf "$STATE_DIR"
echo "リセットしました: $STATE_DIR"
echo "run.sh を起動し直して、ブラウザをリロードしてください(Ctrl+Shift+R)。"
