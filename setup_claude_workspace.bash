#!/bin/bash
# Set up an optional Claude Code workspace for this robot:
#   1. install the Claude Code CLI (official native installer, user-local,
#      no sudo; auto-updates itself afterwards)
#   2. create ~/work/<ROBOT_NAMESPACE>_claude from claude_workspace_template/
#      (CLAUDE.md conventions + issue/PR/planning skills)
#   3. make sure an SSH key exists for connecting the workspace to the
#      owner's personal *private* GitHub repository
# Finishes by writing a small JSON summary for the setup webapp, which then
# renders the remaining manual steps (create the private repo, register the
# key, `claude` first login) as a panel with copy buttons. The public key is
# deliberately NOT printed to the log.
#
# Env: ROBOT_NAMESPACE (set by the setup webapp; defaults to cube_petit),
#      CUBE_PETIT_SETUP_HOME (where the JSON summary goes; defaults to
#      ~/.cube_petit_setup).
# Idempotent: safe to run again, never overwrites an existing workspace.
set -euo pipefail

ROBOT_NAMESPACE="${ROBOT_NAMESPACE:-cube_petit}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$HERE/claude_workspace_template"
WS_DIR="$HOME/work/${ROBOT_NAMESPACE}_claude"
KEY_FILE="$HOME/.ssh/id_ed25519"

echo -e '\e[1;32m == 1/3 Claude Code CLI == \e[m'
if command -v claude >/dev/null 2>&1 || [ -x "$HOME/.local/bin/claude" ]; then
  echo "Claude Code is already installed: $(command -v claude || echo "$HOME/.local/bin/claude")"
else
  # Official native installer (docs: code.claude.com/docs/en/setup).
  # Installs to ~/.local/bin/claude, no sudo needed.
  curl -fsSL https://claude.ai/install.sh | bash
fi

echo -e '\e[1;32m == 2/3 Claude workspace == \e[m'
if [ -d "$WS_DIR" ]; then
  echo "Workspace already exists, leaving it untouched: $WS_DIR"
else
  mkdir -p "$WS_DIR"
  cp -r "$TEMPLATE_DIR"/. "$WS_DIR"/
  mv "$WS_DIR/CLAUDE.md.template" "$WS_DIR/CLAUDE.md"
  # Fill in the robot name placeholders.
  grep -rl '{{ROBOT_NAME}}' "$WS_DIR" | while read -r f; do
    sed -i "s/{{ROBOT_NAME}}/${ROBOT_NAMESPACE}/g" "$f"
  done
  git -C "$WS_DIR" init -q -b main
  echo "Created workspace: $WS_DIR"
fi

echo -e '\e[1;32m == 3/3 SSH key == \e[m'
if [ -f "$KEY_FILE" ]; then
  echo "SSH key already exists: $KEY_FILE"
else
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"
  ssh-keygen -t ed25519 -N "" -C "$ROBOT_NAMESPACE" -f "$KEY_FILE"
fi

# Hand the follow-up info to the setup webapp as JSON. The webapp renders
# the remaining manual steps (repo creation, key registration, first login)
# as an on-screen panel with copy buttons; keeping the public key out of the
# log also keeps it out of the streamed/persisted step logs.
SETUP_HOME="${CUBE_PETIT_SETUP_HOME:-$HOME/.cube_petit_setup}"
mkdir -p "$SETUP_HOME"
WS_DIR="$WS_DIR" KEY_FILE="$KEY_FILE" ROBOT_NAMESPACE="$ROBOT_NAMESPACE" \
python3 - "$SETUP_HOME/claude_support.json" <<'PY'
import json
import os
import sys

ns = os.environ["ROBOT_NAMESPACE"]
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(
        {
            "workspace_dir": os.environ["WS_DIR"],
            "pubkey_path": os.environ["KEY_FILE"] + ".pub",
            "repo_suggestion": f"{ns}_claude",
            "robot_name": ns,
        },
        f,
        ensure_ascii=False,
        indent=2,
    )
PY

echo ""
echo "Claude Code コード支援の準備ができました。"
echo "残りの手順(GitHubリポジトリ作成・公開鍵の登録)は、この画面に表示されます。"
echo "Setup Claude workspace finished."
