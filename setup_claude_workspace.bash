#!/bin/bash
# Set up an optional Claude Code workspace for this robot:
#   1. install the Claude Code CLI (official native installer, user-local,
#      no sudo; auto-updates itself afterwards)
#   2. create ~/work/<ROBOT_NAMESPACE>_claude from claude_workspace_template/
#      (CLAUDE.md conventions + issue/PR/planning skills)
#   3. make sure an SSH key exists for connecting the workspace to the
#      owner's personal *private* GitHub repository
# Finishes by printing the public key and the remaining manual steps
# (create the private repo, register the key, `claude` first login).
#
# Env: ROBOT_NAMESPACE (set by the setup webapp; defaults to cube_petit).
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

cat <<GUIDE

==========================================================================
 Claude Code コード支援の準備ができました。あと3つだけ手作業があります:

 1. GitHubで「個人のprivateリポジトリ」を作成してください
      リポジトリ名の例: ${ROBOT_NAMESPACE}_claude
      (作業ログや記憶に内部情報が入るので、必ず private にしてください)

 2. この公開鍵を GitHub の Settings → SSH and GPG keys に登録してください:

$(cat "${KEY_FILE}.pub")

 3. 登録できたら、ターミナルで以下を実行してつなぎます:

      cd ${WS_DIR}
      git remote add origin git@github.com:<あなたのアカウント>/${ROBOT_NAMESPACE}_claude.git
      git add -A && git commit -m "initial workspace"
      git push -u origin main

 使い始めるには、ターミナルで:

      cd ${WS_DIR}
      claude

 初回はブラウザが開いてClaude(Anthropic)へのログインを求められます。
 Claude Pro/Max などのプラン、またはAPIの課金設定が必要です。
==========================================================================
GUIDE

echo "Setup Claude workspace finished."
