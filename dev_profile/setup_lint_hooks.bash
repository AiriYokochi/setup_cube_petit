#!/bin/bash
# Install commit-time lint hooks into the cube_petit development repos.
#
# The upstream repos (cube_petit_ros / cube_petit_interaction /
# cube_petit_scenario) each ship a .pre-commit-config.yaml with the same
# checks as CI (isort / yapf / ruff / yamllint / detect-secrets ...), so
# `pre-commit install` is the canonical way to run them automatically on
# every `git commit`.
#
# Idempotent: safe to run again. Repos that are not cloned (or have no
# .pre-commit-config.yaml) are skipped. No sudo needed: the pre-commit tool
# itself is installed user-locally with `uv tool install`.
#
# For testing, the target repo list can be overridden with a colon-separated
# CUBE_PETIT_LINT_REPOS.
set -u

DEFAULT_REPOS="$HOME/ros/src/cube_petit_ros:$HOME/ros/src/cube_petit_interaction:$HOME/ros/src/cube_petit_scenario"
IFS=':' read -r -a REPOS <<< "${CUBE_PETIT_LINT_REPOS:-$DEFAULT_REPOS}"

# 1) make sure the pre-commit tool is available (user-local, via uv)
PRE_COMMIT="$(command -v pre-commit || true)"
if [ -z "$PRE_COMMIT" ] && [ -x "$HOME/.local/bin/pre-commit" ]; then
  PRE_COMMIT="$HOME/.local/bin/pre-commit"
fi
if [ -z "$PRE_COMMIT" ]; then
  UV="$(command -v uv || true)"
  [ -z "$UV" ] && [ -x "$HOME/.local/bin/uv" ] && UV="$HOME/.local/bin/uv"
  if [ -z "$UV" ]; then
    echo "WARN: uv not found (run setup_ros.bash first); lint hooks skipped"
    exit 0
  fi
  echo "installing pre-commit (uv tool install pre-commit)..."
  if ! "$UV" tool install --quiet pre-commit; then
    echo "WARN: could not install pre-commit; lint hooks skipped"
    exit 0
  fi
  PRE_COMMIT="$HOME/.local/bin/pre-commit"
fi

# 2) install the git hook into each cloned repo
for repo in "${REPOS[@]}"; do
  if [ ! -d "$repo/.git" ]; then
    echo "skip (not cloned): $repo"
    continue
  fi
  if [ ! -f "$repo/.pre-commit-config.yaml" ]; then
    echo "skip (no .pre-commit-config.yaml): $repo"
    continue
  fi
  if (cd "$repo" && "$PRE_COMMIT" install >/dev/null); then
    echo "installed pre-commit hook: $repo"
  else
    echo "WARN: pre-commit install failed: $repo"
  fi
done

echo "Note: each repo downloads its hook environments on the first commit"
echo "(network required; the sbgisen/pre-commit-hooks entry also needs GitHub"
echo "SSH access). Skip once with: git commit --no-verify"
