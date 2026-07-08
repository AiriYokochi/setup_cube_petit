#!/bin/bash
# ワークスペースのビルド結果を検証する(docker/Dockerfile から colcon build 直後に呼ばれる)
#
# - required_packages.txt の必須パッケージがすべて install 済みかを確認し、
#   1つでも欠けていれば明確なエラーを出して exit 1(=イメージのビルド失敗)
# - それ以外(サードパーティドライバ等)のビルド失敗は致命傷にせず、
#   ${WS}/BUILD_REPORT.txt に記録してイメージに残す(利用者が確認できる)
set -o pipefail

WS="${WS:-/ws}"
REQUIRED_LIST="${REQUIRED_LIST:-${WS}/required_packages.txt}"
REPORT="${REPORT:-${WS}/BUILD_REPORT.txt}"

# ROSのsetup.bashは未定義変数を参照するため、set -u はsource後に有効化する
source "/opt/ros/${ROS_DISTRO:-jazzy}/setup.bash"
set -u
cd "${WS}" || exit 1

expected=$(colcon list --names-only 2>/dev/null | sort)
built=$(find "${WS}/install" -mindepth 1 -maxdepth 1 -type d -printf "%f\n" | sort)
required=$(grep -vE "^[[:space:]]*(#|$)" "${REQUIRED_LIST}" | sort)

not_built=$(comm -23 <(echo "${expected}") <(echo "${built}"))
missing_required=$(comm -23 <(echo "${required}") <(echo "${built}"))

{
    echo "# Cube petit dev image build report"
    echo "generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "packages in source: $(echo "${expected}" | grep -c .)"
    echo "packages built:     $(echo "${built}" | grep -c .)"
    echo ""
    echo "## Not built (optional packages; build failed or aborted)"
    if [ -n "${not_built}" ]; then echo "${not_built}"; else echo "(none)"; fi
    echo ""
    echo "## Excluded by COLCON_IGNORE (intentional, see docker/README.md)"
    find "${WS}/src" -name COLCON_IGNORE -printf "%h\n" | xargs -r -n1 basename | sort
} > "${REPORT}"

echo "==== ${REPORT} ===="
cat "${REPORT}"

if [ -n "${missing_required}" ]; then
    echo "" >&2
    echo "ERROR: required packages are missing from the install space:" >&2
    echo "${missing_required}" | sed "s/^/  - /" >&2
    echo "See build log above for the compile errors (docker/required_packages.txt defines the set)." >&2
    exit 1
fi
echo "OK: all $(echo "${required}" | grep -c .) required packages built."
