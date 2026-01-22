#!/usr/bin/env bash
set -euo pipefail

WS_DIR="${1:-$HOME/ros}"
SRC_DIR="$WS_DIR/src"

if [ ! -d "$SRC_DIR" ]; then
  echo "[ERROR] src directory not found: $SRC_DIR"
  exit 1
fi

echo "[INFO] Searching repositories under: $SRC_DIR"
echo

mapfile -t GITMODULES_LIST < <(find "$SRC_DIR" -name ".gitmodules" -type f 2>/dev/null)

if [ ${#GITMODULES_LIST[@]} -eq 0 ]; then
  echo "[INFO] No submodules found (.gitmodules not found)."
  exit 0
fi

echo "[INFO] Found ${#GITMODULES_LIST[@]} repositories with submodules."
echo

for gm in "${GITMODULES_LIST[@]}"; do
  repo_dir="$(dirname "$gm")"

  echo "----------------------------------------"
  echo "[INFO] Repo: $repo_dir"
  echo "[INFO] Running: git submodule update --init --recursive"
  echo

  (
    cd "$repo_dir"
    git submodule update --init --recursive
  )

  echo
done

echo "----------------------------------------"
echo "[INFO] Done."