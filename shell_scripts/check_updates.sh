#!/usr/bin/env bash
# Check the registered git repositories for upstream updates and cache the
# result, so the owner never has to remember which version they are on --
# git's local HEAD *is* the installed version, and a fetch tells what is
# upstream.
#
# Modes:
#   check_updates.sh             fetch every repo, rewrite the cache, print
#   check_updates.sh --cached    print from the cache only (no network)
#   check_updates.sh --bashrc    for interactive shells: print the cached
#                                notice instantly (never blocks the shell),
#                                and refresh the cache in the background at
#                                most once every 6 hours
#
# Checked repositories (override with CUBE_PETIT_UPDATE_REPOS, a
# colon-separated list of paths, mainly for tests):
#   - the repo this script lives in (cube_petit_setup)
#   - the robot source (<ros ws>/src/cube_petit_ros, honoring the
#     "separate workspace" choice recorded in state.json)
#
# Cache: $CUBE_PETIT_SETUP_HOME (default ~/.cube_petit_setup)/updates.json
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$HERE")"
STATE_DIR="${CUBE_PETIT_SETUP_HOME:-$HOME/.cube_petit_setup}"
CACHE="$STATE_DIR/updates.json"
FETCH_TIMEOUT=10
REFRESH_AFTER_SECONDS=$((6 * 60 * 60))

repo_list() {
  if [ -n "${CUBE_PETIT_UPDATE_REPOS:-}" ]; then
    echo "${CUBE_PETIT_UPDATE_REPOS}" | tr ':' '\n'
    return
  fi
  echo "$REPO_ROOT"
  # Robot source: ~/ros unless state.json recorded the "separate ws" choice.
  local ws="$HOME/ros"
  if [ -f "$STATE_DIR/state.json" ] \
      && grep -q '"ros_ws"[[:space:]]*:[[:space:]]*"separate"' "$STATE_DIR/state.json"; then
    ws="$HOME/cube_petit_ros2_ws"
  fi
  echo "$ws/src/cube_petit_ros"
}

# Fetch every repo and rewrite the cache. Runs the network calls, so this is
# the slow path -- --bashrc only ever runs it in the background.
refresh_cache() {
  mkdir -p "$STATE_DIR"
  local entries=()
  while IFS= read -r repo; do
    [ -d "$repo/.git" ] || continue
    timeout "$FETCH_TIMEOUT" git -C "$repo" fetch --quiet 2>/dev/null || true
    # @{u} = the upstream of the current branch; repos without one are skipped.
    local behind
    behind="$(git -C "$repo" rev-list --count 'HEAD..@{u}' 2>/dev/null)" || continue
    local commits
    # One record per line downstream: fold the multi-line log into a single
    # field with vertical-tab separators (split back on \x0b in python).
    commits="$(git -C "$repo" log --oneline 'HEAD..@{u}' -10 2>/dev/null | tr '\n' '\v')"
    entries+=("$repo"$'\t'"$behind"$'\t'"$commits")
  done < <(repo_list)

  # Assemble JSON with python3 (always present on Ubuntu 24.04). The records
  # travel in an env var: stdin already carries the heredoc program itself,
  # so piping the data would be silently swallowed.
  RECORDS="$(printf '%s\n' "${entries[@]:-}")" python3 - "$CACHE" <<'PY'
import json
import os
import sys
import time

cache_path = sys.argv[1]
repos = []
for line in os.environ.get("RECORDS", "").split("\n"):
    if not line.strip():
        continue
    path, behind, *rest = line.split("\t")
    commits = (rest[0] if rest else "").split("\x0b")
    repos.append({
        "name": os.path.basename(path.rstrip("/")),
        "path": path,
        "behind": int(behind or 0),
        "commits": [c for c in commits if c],
    })
tmp = cache_path + ".tmp"
with open(tmp, "w", encoding="utf-8") as f:
    json.dump({"checked_at": int(time.time()), "repos": repos}, f, ensure_ascii=False, indent=2)
os.replace(tmp, cache_path)
PY
}

# Print the cached notice (one line per repo with updates). Silent when the
# cache is missing or everything is up to date.
print_cached() {
  [ -f "$CACHE" ] || return 0
  python3 - "$CACHE" "$REPO_ROOT" <<'PY'
import json
import sys

cache_path, setup_repo = sys.argv[1], sys.argv[2]
try:
    with open(cache_path, encoding="utf-8") as f:
        data = json.load(f)
except (OSError, ValueError):
    sys.exit(0)
for repo in data.get("repos", []):
    if repo.get("behind", 0) > 0:
        print(
            f"\U0001f4e6 {repo['name']} に更新が{repo['behind']}件あります。"
            f"{setup_repo}/webapp/run.sh を起動して、画面の「アップデート」を押してください"
        )
PY
}

cache_age() {
  [ -f "$CACHE" ] || { echo 999999999; return; }
  local now checked
  now="$(date +%s)"
  checked="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('checked_at',0))" "$CACHE" 2>/dev/null || echo 0)"
  echo $((now - checked))
}

case "${1:-}" in
  --cached)
    print_cached
    ;;
  --bashrc)
    # Shell-startup path: never block, never fail the shell.
    print_cached || true
    if [ "$(cache_age)" -gt "$REFRESH_AFTER_SECONDS" ]; then
      nohup bash "$HERE/check_updates.sh" >/dev/null 2>&1 &
      disown 2>/dev/null || true
    fi
    ;;
  *)
    refresh_cache
    print_cached
    ;;
esac
