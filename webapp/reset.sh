#!/usr/bin/env bash
# Reset the setup wizard's progress, either completely or from a chosen
# step onward, so you can redo part (or all) of it.
#
# Usage:
#   ./webapp/reset.sh                    # interactive: pick a step, "a" for
#                                         # all, "q" to abort
#   ./webapp/reset.sh --from <step_id>   # non-interactive: reset that step
#                                         # and every step after it (e.g.
#                                         # --from devices)
#   ./webapp/reset.sh --all              # non-interactive: reset everything
#   ./webapp/reset.sh -f                 # same as --all (kept for backward
#                                         # compatibility)
#
# "Reset from step X" clears the run status (status/exit_code) and log file
# of step X and every step after it in wizard order. It does NOT touch:
#   - steps before X (still recorded as done/skipped, not re-run)
#   - saved inputs (so re-running a step still prefills what was typed
#     before -- see webapp/app/state.py "inputs")
#   - anything a setup step already installed/configured on the system
#     (every step is safe to run again on top, same as before)
#
# This only touches the wizard's own bookkeeping in
# ~/.cube_petit_setup (or $CUBE_PETIT_SETUP_HOME).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STEPS_YAML="$HERE/app/steps.yaml"
STATE_DIR="${CUBE_PETIT_SETUP_HOME:-$HOME/.cube_petit_setup}"
STATE_FILE="$STATE_DIR/state.json"
LOG_DIR="$STATE_DIR/logs"

MODE=""       # "", "all", "from"
FROM_STEP=""

while [ $# -gt 0 ]; do
  case "$1" in
    -f|--all)
      MODE="all"
      shift
      ;;
    --from)
      MODE="from"
      FROM_STEP="${2:-}"
      if [ -z "$FROM_STEP" ]; then
        echo "エラー: --from にはステップIDを指定してください (例: --from devices)" >&2
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "不明な引数です: $1" >&2
      echo "Usage: $0 [--all | --from <step_id> | -f]" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Step list: reads "<id>\t<title_ja>" pairs, one per line, in wizard order.
# Parsed with a plain awk pass over steps.yaml instead of a YAML library:
# reset.sh must work even before webapp/run.sh has ever created its venv
# (pyyaml may not be installed on the system python3), and the format of
# each step block (a "  - id: <id>" line followed by a "    title_ja: ..."
# line) is simple and stable enough that this is safe.
# ---------------------------------------------------------------------------
step_list() {
  awk '
    /^  - id: /   { id = $3 }
    /^    title_ja: / {
      title = $0
      sub(/^    title_ja: *"/, "", title)
      sub(/"$/, "", title)
      print id "\t" title
    }
  ' "$STEPS_YAML"
}

STEP_IDS=()
STEP_TITLES=()
while IFS=$'\t' read -r sid stitle; do
  STEP_IDS+=("$sid")
  STEP_TITLES+=("$stitle")
done < <(step_list)

if [ "${#STEP_IDS[@]}" -eq 0 ]; then
  echo "エラー: $STEPS_YAML からステップ一覧を読み取れませんでした。" >&2
  exit 1
fi

kill_stuck_processes() {
  # Clean up any setup script still running (e.g. one stuck waiting for input).
  # pkill exits 1 when nothing matched; that's fine.
  pkill -f 'cube_petit_setup/setup_.*\.bash' 2>/dev/null || true
  pkill -f 'cube_petit_setup/setup_.*\.sh' 2>/dev/null || true
  sudo -n pkill -f 'add-apt-repository' 2>/dev/null || true
}

do_all_reset() {
  kill_stuck_processes
  rm -rf "$STATE_DIR"
  echo "リセットしました: $STATE_DIR"
  echo "run.sh を起動し直して、ブラウザをリロードしてください(Ctrl+Shift+R)。"
}

# Index (0-based) of $1 within STEP_IDS, or -1 if not found.
step_index() {
  local target="$1"
  for i in "${!STEP_IDS[@]}"; do
    if [ "${STEP_IDS[$i]}" = "$target" ]; then
      echo "$i"
      return 0
    fi
  done
  echo "-1"
}

do_from_reset() {
  local from_id="$1"
  local idx
  idx="$(step_index "$from_id")"
  if [ "$idx" -lt 0 ]; then
    echo "エラー: 不明なステップID: $from_id" >&2
    echo "有効なID: ${STEP_IDS[*]}" >&2
    exit 1
  fi

  kill_stuck_processes

  if [ -f "$STATE_FILE" ]; then
    python3 - "$STATE_FILE" "$idx" "${STEP_IDS[@]}" <<'PY'
import json
import sys

state_file, idx_str, *step_ids = sys.argv[1:]
to_clear = set(step_ids[int(idx_str):])

with open(state_file, encoding="utf-8") as f:
    state = json.load(f)

steps = state.get("steps", {})
for step_id in list(steps.keys()):
    if step_id in to_clear:
        # Dropping the key entirely puts it back to the implicit
        # "pending" default (see state.get_step_status()).
        del steps[step_id]

with open(state_file, "w", encoding="utf-8") as f:
    json.dump(state, f, ensure_ascii=False, indent=2)
PY
  else
    echo "state.json が見つかりません($STATE_FILE)。進行状態は元々ありません。"
  fi

  # Remove logs for the steps being reset so old output isn't shown for a
  # step that hasn't run yet.
  for ((i = idx; i < ${#STEP_IDS[@]}; i++)); do
    rm -f "$LOG_DIR/${STEP_IDS[$i]}.log" 2>/dev/null || true
  done

  echo "「${STEP_TITLES[$idx]}」以降をリセットしました。"
  echo "run.sh を起動し直して、ブラウザをリロードしてください(Ctrl+Shift+R)。"
}

# --- dispatch ---------------------------------------------------------------

case "$MODE" in
  all)
    do_all_reset
    exit 0
    ;;
  from)
    do_from_reset "$FROM_STEP"
    exit 0
    ;;
esac

# Interactive mode (no flags given).
echo "セットアップの進行状態をリセットして、途中から(または最初から)やり直せるようにします。"
echo "(インストール済みのものが消えるわけではありません。各ステップは再実行しても安全です)"
echo ""
echo "どのステップからやり直しますか?"
for i in "${!STEP_IDS[@]}"; do
  printf '  %d) %s\n' "$((i + 1))" "${STEP_TITLES[$i]}"
done
echo "  a) 全部リセットする(最初からやり直す)"
echo "  q) 中止する"
read -r -p "番号 / a / q: " ans

case "$ans" in
  q|Q|"")
    echo "中止しました。"
    exit 0
    ;;
  a|A)
    do_all_reset
    exit 0
    ;;
  *[!0-9]*)
    echo "エラー: 数字、a、q のいずれかを入力してください。" >&2
    exit 1
    ;;
  *)
    if [ "$ans" -lt 1 ] || [ "$ans" -gt "${#STEP_IDS[@]}" ]; then
      echo "エラー: 範囲外の番号です(1〜${#STEP_IDS[@]})。" >&2
      exit 1
    fi
    do_from_reset "${STEP_IDS[$((ans - 1))]}"
    exit 0
    ;;
esac
