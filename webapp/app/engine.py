"""Step execution engine.

Design goal: this module is a thin wrapper around existing shell scripts in
the repo root (setup_pc.bash, setup_dev_tools.sh, setup_ros.bash). It never
reimplements what those scripts do -- it only decides *how* to invoke them
(plain run / with stdin answers / after a precheck) and streams their output.

Mock mode (CUBE_PETIT_SETUP_MOCK=1, set by `run.sh --mock`) replaces every
command that would actually touch the system with an echo+sleep simulation,
so the whole app can be exercised on this dev machine (orange) without ever
running the real setup scripts here.
"""
from __future__ import annotations

import asyncio
import os
import re
import shlex
from pathlib import Path
from typing import Optional

from . import state as state_mod

# webapp/app/engine.py -> app/ -> webapp/ -> repo root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MOCK = os.environ.get("CUBE_PETIT_SETUP_MOCK") == "1"

# Precheck path detection is redirected into a sandbox under
# ~/.cube_petit_setup/mock_home/ while mocking, so testing never touches the
# real ~/ros or ~/work directories that already exist on a dev machine.
MOCK_HOME = state_mod.STATE_DIR / "mock_home"


class StepRun:
    """Tracks one in-flight (or just-finished) execution of a step."""

    def __init__(self, step_id: str):
        self.step_id = step_id
        self.proc: Optional[asyncio.subprocess.Process] = None
        self.queues: set[asyncio.Queue] = set()
        self.done = False
        self.exit_code: Optional[int] = None
        self.task: Optional[asyncio.Task] = None

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self.queues.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self.queues.discard(q)

    def broadcast(self, line: str) -> None:
        for q in list(self.queues):
            q.put_nowait(line)


_runs: dict[str, StepRun] = {}


def get_run(step_id: str) -> Optional[StepRun]:
    return _runs.get(step_id)


def is_running(step_id: str) -> bool:
    run = _runs.get(step_id)
    return bool(run and not run.done)


def script_path(name: str) -> Path:
    return REPO_ROOT / name


def _mock_command(description: str, seconds: int = 2) -> str:
    """A shell snippet that fakes running `description` without doing anything real."""
    n = max(1, seconds)
    lines = [f'echo "[mock] would run: {description}"']
    for i in range(1, n + 1):
        lines.append(f'echo "[mock] working... ({i}/{n})"')
        lines.append("sleep 1")
    lines.append('echo "[mock] done."')
    return "\n".join(lines)


def _cmd_or_mock(real_cmd: str, mock_desc: str, mock_seconds: int = 2) -> str:
    return _mock_command(mock_desc, mock_seconds) if MOCK else real_cmd


async def _pump_output(run: StepRun, step_id: str) -> None:
    log_path = state_mod.log_path_for(step_id)
    with open(log_path, "a", encoding="utf-8") as log_f:
        assert run.proc is not None and run.proc.stdout is not None
        while True:
            line = await run.proc.stdout.readline()
            if not line:
                break
            text = line.decode(errors="replace").rstrip("\n")
            log_f.write(text + "\n")
            log_f.flush()
            run.broadcast(text)
        code = await run.proc.wait()
        run.exit_code = code
        run.done = True
        run.broadcast(f"__END__{code}")


def _child_env() -> dict:
    """Environment for setup scripts: the server runs inside webapp/.venv,
    but the scripts must NOT — colcon/CMake would pick up the venv python,
    which lacks catkin_pkg etc., and the workspace build fails. Strip the
    venv activation before spawning children."""
    env = os.environ.copy()
    venv = env.pop("VIRTUAL_ENV", None)
    if venv:
        env["PATH"] = os.pathsep.join(
            p for p in env.get("PATH", "").split(os.pathsep)
            if p and not p.startswith(venv)
        )
    return env


async def start_command(
    step_id: str,
    cmd: str,
    *,
    cwd: Optional[Path] = None,
    stdin_text: Optional[str] = None,
    extra_env: Optional[dict] = None,
) -> StepRun:
    if is_running(step_id):
        raise RuntimeError(f"step {step_id} is already running")

    run = StepRun(step_id)
    _runs[step_id] = run

    log_path = state_mod.log_path_for(step_id)
    log_path.write_text("", encoding="utf-8")  # fresh log for this run

    env = _child_env()
    if extra_env:
        env.update(extra_env)

    # stdin is a PIPE when we have scripted answers, DEVNULL otherwise: never
    # let a child inherit the server's terminal, where an unexpected prompt
    # (e.g. add-apt-repository without -y) would block forever waiting for a
    # keypress nobody can see. With DEVNULL such a prompt hits EOF and the
    # step fails visibly instead of hanging.
    proc = await asyncio.create_subprocess_shell(
        cmd,
        stdin=asyncio.subprocess.PIPE if stdin_text is not None else asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        cwd=str(cwd) if cwd else None,
        env=env,
    )
    run.proc = proc

    if stdin_text is not None and proc.stdin is not None:
        proc.stdin.write(stdin_text.encode())
        await proc.stdin.drain()
        proc.stdin.close()

    run.task = asyncio.create_task(_pump_output(run, step_id))
    return run


def _build_prereq_cmd() -> str:
    real_cmd = r"""
set +e
echo "Checking Ubuntu version..."
. /etc/os-release
echo "  detected: $PRETTY_NAME"
if [ "$VERSION_ID" != "24.04" ]; then
  echo "  WARNING: expected Ubuntu 24.04, found $VERSION_ID"
else
  echo "  OK: Ubuntu 24.04"
fi
echo "Checking network connectivity..."
if curl -fsS -m 5 https://packages.ros.org >/dev/null 2>&1; then
  echo "  OK: network reachable"
else
  echo "  WARNING: could not reach packages.ros.org (check network)"
fi
echo "Checking free disk space in \$HOME..."
df -h "$HOME"
echo "Prereq check complete."
""".strip()
    return _cmd_or_mock(real_cmd, "prereq check (Ubuntu version / network / disk space)", 1)


def _build_script_cmd(script_name: str, *, args: str = "") -> str:
    suffix = f" {args}" if args else ""
    real_cmd = f"bash {shlex.quote(str(script_path(script_name)))}{suffix}"
    return _cmd_or_mock(real_cmd, f"bash {script_name}{suffix}", 3)


def _build_env_setup_cmd(script_name: str, extra_env: dict) -> str:
    """Like _build_script_cmd, but the mock description also shows the
    env vars the real script would receive (API key redacted), since this
    step's whole point is threading state (robot_namespace, saved inputs)
    into the child's environment -- worth surfacing when verifying mock runs."""
    real_cmd = f"bash {shlex.quote(str(script_path(script_name)))}"
    if not MOCK:
        return real_cmd
    redacted = dict(extra_env)
    if redacted.get("OPENAI_API_KEY"):
        redacted["OPENAI_API_KEY"] = "***"
    shown = ", ".join(f"{k}={v}" for k, v in redacted.items())
    return _mock_command(f"{script_name} (env: {shown})", 2)


def _build_claude_support_cmd(script_name: str, extra_env: dict) -> str:
    """Like _build_env_setup_cmd, but the mock variant also produces the side
    effects the post-run guide panel needs (claude_support.json + a fake
    public key file under MOCK_HOME), so the panel can be exercised end to
    end in --mock without reading the real ~/.ssh."""
    if not MOCK:
        return _build_env_setup_cmd(script_name, extra_env)
    # robot_namespace is validated as ^cube_petit_[a-z0-9_]+$ upstream, so it
    # is safe to embed in the generated snippet.
    ns = extra_env.get("ROBOT_NAMESPACE") or "cube_petit"
    seed = (
        "import json, pathlib\n"
        f"home = pathlib.Path({str(MOCK_HOME)!r})\n"
        "ssh = home / '.ssh'\n"
        "ssh.mkdir(parents=True, exist_ok=True)\n"
        "pub = ssh / 'id_ed25519.pub'\n"
        f"pub.write_text('ssh-ed25519 AAAAC3mockmockmockmockmock {ns}\\n')\n"
        f"ws = home / 'work' / '{ns}_claude'\n"
        "info = {'workspace_dir': str(ws), 'pubkey_path': str(pub),\n"
        f"        'repo_suggestion': '{ns}_claude', 'robot_name': '{ns}'}}\n"
        f"path = pathlib.Path({str(state_mod.STATE_DIR)!r}) / 'claude_support.json'\n"
        "path.write_text(json.dumps(info, ensure_ascii=False, indent=2))\n"
    )
    return (
        _build_env_setup_cmd(script_name, extra_env)
        + f"\npython3 -c {shlex.quote(seed)}"
        + "\necho '[mock] wrote claude_support.json'"
    )


async def connect_repo(ws_dir: str, repo_url: str) -> dict:
    """Wire the claude_support workspace to the owner's GitHub repository:
    remote add/set-url + (first-commit if needed) + push -u. Returns
    {ok, output}; URL validation happens in the API layer. In mock mode
    nothing real runs."""
    if MOCK:
        return {
            "ok": True,
            "output": (
                f"[mock] would run in {ws_dir}:\n"
                f"[mock]   git remote add origin {repo_url}\n"
                "[mock]   git add -A && git commit -m 'initial workspace'\n"
                "[mock]   git fetch origin && git merge origin/main -X ours (README/LICENSE取り込み)\n"
                "[mock]   git push -u origin main\n"
                "[mock] push succeeded."
            ),
        }

    env = _git_ssh_env()
    outputs: list[str] = []
    # Fallback identity: a freshly set up machine has no git user config yet,
    # and both the first commit and the merge below need a committer.
    git_id = ("-c", "user.name=Cube Petit Setup", "-c", "user.email=cube-petit-setup@localhost")

    async def run(*args: str, log: bool = True) -> tuple[int, str]:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=ws_dir,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=90)
        except asyncio.TimeoutError:
            proc.kill()
            if log:
                outputs.append(f"$ {' '.join(args)}\n(timed out)")
            return 124, ""
        text = out.decode(errors="replace").strip()
        if log:
            outputs.append(f"$ {' '.join(args)}" + (f"\n{text}" if text else ""))
        return proc.returncode or 0, text

    def fail() -> dict:
        return {"ok": False, "output": "\n".join(outputs)}

    # remote add, or update it when re-running with a corrected URL
    code, _ = await run("git", "remote", "get-url", "origin", log=False)
    if code == 0:
        code, _ = await run("git", "remote", "set-url", "origin", repo_url)
    else:
        code, _ = await run("git", "remote", "add", "origin", repo_url)
    if code != 0:
        return fail()

    # The workspace is git-init'ed but has no commit yet on the first run.
    code, _ = await run("git", "rev-parse", "--verify", "HEAD", log=False)
    if code != 0:
        if (await run("git", "add", "-A"))[0] != 0:
            return fail()
        if (await run("git", *git_id, "commit", "-m", "initial workspace"))[0] != 0:
            return fail()

    # A repository created with "Add a README file" / a license (the flow the
    # guide recommends) already has commits on GitHub's default branch, so a
    # plain push would be rejected as non-fast-forward. Fetch, detect the
    # remote default branch, and merge those initial files in first.
    if (await run("git", "fetch", "origin"))[0] != 0:
        return fail()
    code, sym = await run("git", "ls-remote", "--symref", "origin", "HEAD", log=False)
    default = None
    if code == 0:
        for line in sym.splitlines():
            if line.startswith("ref:") and "refs/heads/" in line:
                default = line.split()[1].split("refs/heads/", 1)[1]
                break
    _, branch = await run("git", "rev-parse", "--abbrev-ref", "HEAD", log=False)
    branch = branch or "main"
    target = default or branch

    code, _ = await run("git", "rev-parse", "--verify", f"origin/{target}", log=False)
    if code == 0:
        # -X ours: on add/add conflicts (README.md exists in both the
        # workspace template and the GitHub-generated repo) keep the local
        # template version; remote-only files (e.g. LICENSE) come in as-is.
        if (await run(
            "git", *git_id, "merge", f"origin/{target}",
            "--allow-unrelated-histories", "-X", "ours",
            "-m", "Merge initial repository files from GitHub",
        ))[0] != 0:
            return fail()

    # Align the local branch name with the remote default (master vs main).
    if branch != target:
        if (await run("git", "branch", "-m", target))[0] != 0:
            return fail()

    if (await run("git", "push", "-u", "origin", target))[0] != 0:
        return fail()
    return {"ok": True, "output": "\n".join(outputs)}


def _git_ssh_env() -> dict:
    """Child env for network git/ssh calls: never block on an interactive
    prompt (host key confirmation, password) -- fail visibly instead."""
    env = _child_env()
    env["GIT_SSH_COMMAND"] = "ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes"
    return env


_SSH_AUTH_OK_RE = re.compile(r"Hi ([A-Za-z0-9-]+)! You've successfully authenticated")

# Unified wording for any SSH-authentication failure (precheck item 2 and
# connect_repo/push): the frontend also shows recovery actions next to it.
SSH_ISSUE_MESSAGE = (
    "SSH鍵の問題です。手順2の「公開鍵の登録」がきちんとできているか、もう一度確認してください。"
)


async def _run_once(args: list[str], timeout: int) -> tuple[int, str]:
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        env=_git_ssh_env(),
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        return 124, "(timed out)"
    return proc.returncode or 0, out.decode(errors="replace").strip()


async def open_claude_terminal(ws_dir: str) -> dict:
    """Open a terminal ON THE ROBOT'S OWN SCREEN, running `claude` in the
    workspace (first-login is interactive, so it cannot run inside the web
    app). Falls back from gnome-terminal to x-terminal-emulator."""
    if MOCK:
        return {"ok": True, "message": "[mock] この機体の画面にターミナルを開きました(疑似)。"}

    import shutil

    env = _child_env()
    manual_hint = "手動でターミナルを開いて、コピーしたコマンドを実行してください。"
    if not env.get("DISPLAY") and not env.get("WAYLAND_DISPLAY"):
        return {"ok": False, "message": f"この機体の画面が見つかりません。{manual_hint}"}

    if shutil.which("gnome-terminal"):
        args = ["gnome-terminal", f"--working-directory={ws_dir}",
                "--", "bash", "-lc", "claude; exec bash"]
    elif shutil.which("x-terminal-emulator"):
        args = ["x-terminal-emulator", "-e",
                f"bash -lc 'cd {shlex.quote(ws_dir)} && claude; exec bash'"]
    else:
        return {"ok": False, "message": f"ターミナルアプリが見つかりません。{manual_hint}"}

    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=ws_dir,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
            env=env,
            start_new_session=True,  # survive a webapp server restart
        )
    except OSError as e:
        return {"ok": False, "message": f"ターミナルを起動できませんでした({e})。{manual_hint}"}
    # gnome-terminal re-spawns via its server process and exits quickly on
    # success; only an immediate non-zero exit is a real failure.
    await asyncio.sleep(0.5)
    if proc.returncode not in (None, 0):
        return {"ok": False, "message": f"ターミナルを起動できませんでした。{manual_hint}"}
    return {"ok": True, "message": "この機体の画面にターミナルを開きました。"}


def _github_account_exists(account: str) -> tuple[Optional[bool], str]:
    """(exists, message). exists=None means the check itself failed."""
    import urllib.error
    import urllib.request

    req = urllib.request.Request(
        f"https://api.github.com/users/{account}",
        headers={"User-Agent": "cube-petit-setup"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5):
            return True, f"アカウント {account} が見つかりました。"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False, f"アカウント {account} が見つかりません(入力ミスはありませんか?)。"
        return None, f"アカウントの確認ができませんでした(HTTP {e.code})。そのまま接続を試しても構いません。"
    except Exception:
        return None, "アカウントの確認ができませんでした(ネットワークエラー)。接続を確認してください。"


async def precheck_repo(account: str, repo: str) -> list[dict]:
    """Pre-connect connectivity check, one result item per stage:
    GitHub account exists / this machine's SSH key authenticates /
    the target repository exists. Items: {id, ok, warn, message, ssh_issue}.
    ok=None renders as a warning (check inconclusive)."""
    if MOCK:
        bad = "ng" in account
        return [
            {"id": "account", "ok": not bad, "warn": False, "ssh_issue": False,
             "message": (f"アカウント {account} が見つかりません(入力ミスはありませんか?)。" if bad
                         else f"アカウント {account} が見つかりました。")},
            {"id": "ssh", "ok": not bad, "warn": False, "ssh_issue": bad,
             "message": (SSH_ISSUE_MESSAGE if bad
                         else f"この機体の鍵は {account} として認証されています。")},
            {"id": "repo", "ok": not bad, "warn": False, "ssh_issue": False,
             "message": (f"リポジトリが見つかりません。手順1で作成しましたか?(名前: {repo})" if bad
                         else f"リポジトリ {account}/{repo} が見つかりました。")},
        ]

    items: list[dict] = []

    # 1. account exists (unauthenticated GitHub API)
    exists, message = await asyncio.to_thread(_github_account_exists, account)
    items.append({
        "id": "account",
        "ok": exists is not False,
        "warn": exists is None,
        "ssh_issue": False,
        "message": message,
    })

    # 2. SSH key authenticates against github.com. ssh -T exits 1 even on
    # success (GitHub offers no shell), so parse the greeting instead.
    code, text = await _run_once(
        ["ssh", "-T", "git@github.com",
         "-o", "StrictHostKeyChecking=accept-new",
         "-o", "BatchMode=yes",
         "-o", "ConnectTimeout=5"],
        timeout=15,
    )
    m = _SSH_AUTH_OK_RE.search(text)
    if m:
        auth_user = m.group(1)
        if auth_user.lower() != account.lower():
            items.append({
                "id": "ssh", "ok": True, "warn": True, "ssh_issue": False,
                "message": (
                    f"この機体の鍵は {auth_user} として認証されています。"
                    f"リポジトリは {auth_user} 側に作るか、アカウント名を合わせてください。"
                ),
            })
        else:
            items.append({
                "id": "ssh", "ok": True, "warn": False, "ssh_issue": False,
                "message": f"この機体の鍵は {auth_user} として認証されています。",
            })
    elif re.search(r"permission denied", text, re.I):
        items.append({"id": "ssh", "ok": False, "warn": False, "ssh_issue": True,
                      "message": SSH_ISSUE_MESSAGE})
    else:
        items.append({
            "id": "ssh", "ok": False, "warn": False, "ssh_issue": False,
            "message": f"GitHubへのSSH接続に失敗しました。ネットワーク接続を確認してください。({text[:120]})",
        })

    # 3. the target repository exists (over the same SSH transport)
    code, text = await _run_once(
        ["git", "ls-remote", f"git@github.com:{account}/{repo}.git", "HEAD"],
        timeout=20,
    )
    if code == 0:
        items.append({"id": "repo", "ok": True, "warn": False, "ssh_issue": False,
                      "message": f"リポジトリ {account}/{repo} が見つかりました。"})
    elif re.search(r"repository not found", text, re.I):
        items.append({"id": "repo", "ok": False, "warn": False, "ssh_issue": False,
                      "message": f"リポジトリが見つかりません。手順1で作成しましたか?(名前: {repo})"})
    elif re.search(r"permission denied", text, re.I):
        items.append({"id": "repo", "ok": False, "warn": False, "ssh_issue": True,
                      "message": SSH_ISSUE_MESSAGE})
    else:
        items.append({"id": "repo", "ok": False, "warn": False, "ssh_issue": False,
                      "message": f"リポジトリの確認に失敗しました。({text[:120]})"})

    return items


def _mock_check_cmd() -> str:
    """A fake udev_check.sh-like log: same "[OK]"/"[NG]" line shape as the
    real script (see shell_scripts/udev_check.sh), colored the same way,
    so main.py's log parser can be exercised without touching real devices.
    Real ESC bytes are embedded directly (via shlex.quote, which single-quotes
    and so passes them through untouched) instead of relying on `echo -e`,
    which is not portably available across /bin/sh implementations."""
    ESC = "\x1b"
    GREEN, RED, NC = f"{ESC}[32m", f"{ESC}[31m", f"{ESC}[0m"

    def ok(text: str) -> str:
        return f"echo {shlex.quote(f'{GREEN}[OK]{NC} {text}')}"

    def ng(text: str) -> str:
        return f"echo {shlex.quote(f'{RED}[NG]{NC} {text}')}"

    lines = [
        'echo "=== /dev device check ==="',
        ok("/dev/ttyWitMotion is found"),
        ok("/dev/ttyCANable is found"),
        ng("/dev/ttyLD06-19 is not found"),
        'echo ""',
        'echo "=== CAN (can0) check ==="',
        ng("can0 found, but RX packets is 0 (if the robot body itself is powered off, RX stays 0 even though CAN is wired correctly)"),
        'echo ""',
        'echo "=== Wi-Fi interface ==="',
        ok("Wi-Fi IF = wlan0, IP = 192.168.1.50"),
        'echo ""',
        'echo "=== Audio Device Check (Sound_Blaster required) ==="',
        ok("Sound_Blaster microphone found: alsa_input.mock"),
        ok("Sound_Blaster speaker found: alsa_output.mock"),
        'echo ""',
        'echo "=== LiDAR Data Check ==="',
        ng("LiDAR device not found: /dev/ttyLD06-19"),
        'echo ""',
        'echo "=== IMU Data Check ==="',
        ok("IMU is sending data (256 bytes received)"),
        'echo ""',
        'echo "=== RealSense Check ==="',
        ng("No Intel RealSense device detected"),
        'echo ""',
        'echo "=== Bluetooth Controller Check ==="',
        ok("Bluetooth controller connected:"),
        'sleep 1',
        'echo ""',
        'echo "[mock] done."',
    ]
    return "\n".join(lines)


def _build_check_cmd(script_name: str) -> str:
    if MOCK:
        return _mock_check_cmd()
    return f"bash {shlex.quote(str(script_path(script_name)))}"


def _build_toggle_cmd(
    script_name: str, input_defs: list[dict], inputs: dict
) -> tuple[str, Optional[str]]:
    # setup_dev_tools.sh asks sequential "[y/n]" confirm() prompts, in the
    # order the inputs are declared in steps.yaml (GitKraken, VS Code, ...).
    answers = ["y" if bool(inputs.get(d["id"], d.get("default", False))) else "n" for d in input_defs]
    if MOCK:
        chosen = ", ".join(
            f"{d['label_ja']}={bool(inputs.get(d['id'], d.get('default', False)))}" for d in input_defs
        )
        return _mock_command(f"{script_name} ({chosen})", 2), None
    real_cmd = f"bash {shlex.quote(str(script_path(script_name)))}"
    stdin_text = "\n".join(answers) + "\n"
    return real_cmd, stdin_text


def _precheck_base() -> Path:
    return MOCK_HOME if MOCK else Path.home()


def _ros_setup_ws_dir() -> Path:
    """The *default* ros_setup workspace ($HOME/ros, or the mock sandbox
    equivalent) -- used for precheck detection, before any "separate
    workspace" choice has been resolved. Not to be confused with
    resolved_ros_ws(), which is what actually gets passed to setup_ros.bash
    as CUBE_PETIT_ROS_WS once a choice has been made."""
    return _precheck_base() / "ros"


def resolved_ros_ws(state: dict) -> Path:
    """The workspace setup_ros.bash will actually build into, given the
    precheck resolution (if any) saved in state["ros_ws"]."""
    if state.get("ros_ws") == "separate":
        return _precheck_base() / "cube_petit_ros2_ws"
    return _ros_setup_ws_dir()


def ros_ws_env(state: dict) -> dict:
    """Env override for the ros_setup step's child process: only set
    CUBE_PETIT_ROS_WS when the user picked the "separate workspace" precheck
    choice -- setup_ros.bash's own default ($HOME/ros) is otherwise correct
    and there is no need to override it."""
    if state.get("ros_ws") == "separate":
        return {"CUBE_PETIT_ROS_WS": str(resolved_ros_ws(state))}
    return {}


def _extra_env_for(step_id: str, state: dict, inputs: dict) -> dict:
    """Per-step environment overrides for the child process, layered on top
    of _child_env(). Centralizes the two cases where a step needs values
    that live elsewhere in state (a previous step's saved input, or this
    step's own saved input) rather than the server's own environment."""
    if step_id == "ros_setup":
        return ros_ws_env(state)
    if step_id == "env_setup":
        env = {
            "ROBOT_NAMESPACE": state.get("robot_namespace") or "",
            "ROS_DOMAIN_ID": str(inputs.get("ros_domain_id") or "94"),
        }
        api_key = inputs.get("openai_api_key")
        if api_key:
            env["OPENAI_API_KEY"] = str(api_key)
        return env
    if step_id == "claude_support":
        return {"ROBOT_NAMESPACE": state.get("robot_namespace") or ""}
    return {}


def _ros_ws_built(ws_dir: Path) -> bool:
    install_dir = ws_dir / "install"
    if not install_dir.is_dir():
        return False
    return any(p.name.startswith("cube_petit_") for p in install_dir.iterdir())


async def run_step(step_def: dict, inputs: dict, state: dict) -> StepRun:
    step_id = step_def["id"]
    step_type = step_def["type"]
    extra_env = _extra_env_for(step_id, state, inputs)

    if step_type == "prereq_check":
        return await start_command(step_id, _build_prereq_cmd(), cwd=REPO_ROOT)
    if step_type in ("script", "script_with_precheck"):
        if step_id == "claude_support":
            # Threads state into the child's env AND (in mock) seeds the
            # artifacts the post-run guide panel reads.
            cmd = _build_claude_support_cmd(step_def["script"], extra_env)
        elif step_id == "env_setup":
            # Exists to thread state into the child's env; show it in the
            # mock description (see _build_env_setup_cmd).
            cmd = _build_env_setup_cmd(step_def["script"], extra_env)
        else:
            cmd = _build_script_cmd(step_def["script"])
        return await start_command(step_id, cmd, cwd=REPO_ROOT, extra_env=extra_env)
    if step_type == "toggle_script":
        cmd, stdin_text = _build_toggle_cmd(step_def["script"], step_def["inputs"], inputs)
        return await start_command(step_id, cmd, cwd=REPO_ROOT, stdin_text=stdin_text)
    if step_type == "check":
        return await start_command(step_id, _build_check_cmd(step_def["script"]), cwd=REPO_ROOT)
    raise ValueError(f"step type {step_type!r} is not directly runnable via run_step()")


async def run_build_only(step_def: dict, state: dict) -> StepRun:
    """Resolve the ros_setup precheck's "source is there, just rebuild"
    choice: run setup_ros.bash --build-only directly as the step's own run,
    so a successful build marks the ros_setup step itself done (unlike the
    'clean' choice below, which is just cleanup and leaves the step pending
    for a normal run afterwards)."""
    step_id = step_def["id"]
    extra_env = _extra_env_for(step_id, state, {})
    cmd = _build_script_cmd(step_def["script"], args="--build-only")
    return await start_command(step_id, cmd, cwd=REPO_ROOT, extra_env=extra_env)


def precheck_status(step_def: dict, state: dict) -> dict:
    """Report which of the step's 'existing work' paths are present, plus
    which resolution choices apply given the current filesystem state.

    skip / clean are always offered (from steps.yaml) once anything is
    detected. build_only / separate_ws are computed dynamically here:
      - separate_ws: offered whenever $HOME/ros exists at all (regardless of
        whether cube_petit_ros was ever cloned into it) -- picking it routes
        the whole install into a fresh, isolated workspace instead.
      - build_only: offered when cube_petit_ros source is cloned but has not
        been built yet (no install/cube_petit_* directories).
    """
    precheck = step_def.get("precheck")
    if not precheck:
        return {"needed": False}

    # Once "separate workspace" has been resolved, the whole point was to
    # route around whatever is under $HOME/ros -- nothing left to ask about.
    if state.get("ros_ws") == "separate":
        return {"needed": False, "existing": [], "message_ja": "", "choices": []}

    base = _precheck_base()
    existing = [p for p in precheck["paths"] if (base / p["path"]).exists()]

    ros_dir = _ros_setup_ws_dir()
    ros_dir_exists = ros_dir.exists()
    cube_petit_ros_cloned = (ros_dir / "src" / "cube_petit_ros").exists()
    build_only_available = cube_petit_ros_cloned and not _ros_ws_built(ros_dir)

    needed = bool(existing) or ros_dir_exists

    dynamic_choices = []
    if build_only_available:
        dynamic_choices.append({
            "id": "build_only",
            "label_ja": "ソース一式はあるので、ビルドだけやり直す",
        })
    if ros_dir_exists:
        dynamic_choices.append({
            "id": "separate_ws",
            "label_ja": "既存の ~/ros はそのまま残し、別ワークスペース cube_petit_ros2_ws を新しく作って導入する",
        })

    return {
        "needed": needed,
        "existing": existing,
        "message_ja": precheck.get("message_ja", ""),
        "choices": dynamic_choices + precheck.get("choices", []),
    }


async def resolve_precheck(step_def: dict, choice: str) -> StepRun:
    """choice == 'clean': remove the pre-existing directories (its own loggable run).

    Note: this always actually deletes `paths` -- it is NOT run through
    _cmd_or_mock(). That's safe because `_precheck_base()` already redirects
    to the MOCK_HOME sandbox when mocking, so in mock mode this only ever
    deletes fixture directories created by /api/debug/mock/seed/*, never
    anything under the real $HOME. Simulating this step instead of really
    performing it would leave mock testing stuck: the precheck would keep
    reporting the fixtures as present forever.
    """
    precheck = step_def["precheck"]
    base = _precheck_base()
    paths = [str(base / p["path"]) for p in precheck["paths"]]
    quoted = " ".join(shlex.quote(p) for p in paths)
    cmd = f'echo "Removing existing directories ({"mock sandbox" if MOCK else "real"})..."\nrm -rf -- {quoted}\necho "Removed existing directories."'
    return await start_command(f"{step_def['id']}__precheck", cmd)


# --- bluetooth controller pairing (step 7) ---------------------------------
#
# bluetoothctl one-shots (power/scan/devices/info/pair/trust/connect) are
# short, non-interactive commands, unlike the long-running setup scripts
# above -- they don't need the StepRun/log-streaming machinery, just a
# blocking-but-async subprocess call with a timeout.

_BT_DEVICE_RE = re.compile(r"^Device\s+([0-9A-Fa-f:]{17})\s+(.+)$")

# Mock mode only: simulates bluetoothctl's persistent device list across
# scan/connect calls within a single server run.
_mock_bt_devices: list[dict] = []


async def _run_cmd(args: list[str], timeout: float = 15.0) -> tuple[int, str]:
    """Run a short non-interactive command and return (returncode, combined
    stdout+stderr)."""
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        env=_child_env(),
    )
    try:
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return 124, "(timed out)"
    return proc.returncode or 0, stdout.decode(errors="replace")


async def _bluetooth_info(mac: str) -> dict:
    _, out = await _run_cmd(["bluetoothctl", "info", mac], timeout=10)
    return {
        "paired": bool(re.search(r"Paired:\s*yes", out)),
        "connected": bool(re.search(r"Connected:\s*yes", out)),
    }


async def bluetooth_devices() -> list[dict]:
    """Currently known devices, without triggering a new scan."""
    if MOCK:
        return list(_mock_bt_devices)
    _, out = await _run_cmd(["bluetoothctl", "devices"], timeout=10)
    devices = []
    for line in out.splitlines():
        m = _BT_DEVICE_RE.match(line.strip())
        if not m:
            continue
        mac, name = m.group(1), m.group(2).strip()
        devices.append({"mac": mac, "name": name or mac, **await _bluetooth_info(mac)})
    return devices


async def bluetooth_scan() -> list[dict]:
    """Power on the adapter, scan for ~12s, then return the device list."""
    if MOCK:
        await asyncio.sleep(2)
        if not _mock_bt_devices:
            _mock_bt_devices.extend(
                [
                    {"mac": "AA:11:22:33:44:01", "name": "Pro Controller", "paired": False, "connected": False},
                    {"mac": "AA:11:22:33:44:02", "name": "Wireless Controller", "paired": False, "connected": False},
                    {"mac": "AA:11:22:33:44:03", "name": "Airi's Earbuds", "paired": True, "connected": False},
                ]
            )
        return list(_mock_bt_devices)
    await _run_cmd(["bluetoothctl", "power", "on"], timeout=10)
    await _run_cmd(["bluetoothctl", "--timeout", "12", "scan", "on"], timeout=20)
    return await bluetooth_devices()


async def bluetooth_connect(mac: str) -> dict:
    """pair -> trust -> connect, in that order. A pair failure is tolerated
    (the device may already be paired from a previous run); what matters is
    whether connect ultimately succeeds."""
    if MOCK:
        for dev in _mock_bt_devices:
            if dev["mac"] == mac:
                dev["paired"] = True
                dev["connected"] = True
                return {"ok": True, "detail": f"(mock) connected to {dev['name']}"}
        return {"ok": False, "detail": "(mock) unknown device"}

    detail_lines = []
    _, out = await _run_cmd(["bluetoothctl", "pair", mac], timeout=30)
    detail_lines.append(out.strip())
    _, out = await _run_cmd(["bluetoothctl", "trust", mac], timeout=30)
    detail_lines.append(out.strip())
    code, out = await _run_cmd(["bluetoothctl", "connect", mac], timeout=30)
    detail_lines.append(out.strip())
    connect_ok = code == 0 or "Connection successful" in out
    return {"ok": connect_ok, "detail": "\n".join(l for l in detail_lines if l)}


# --- mock-only helpers used by the debug API to exercise the precheck branch ---
#
# Three fixture shapes, matching the three ros_setup precheck scenarios:
#   seed          -- cube_petit_ros cloned but not built, + ripvcs present.
#                    ros_dir_exists is also true (it's under $HOME/ros), so
#                    this exercises skip/clean/build_only/separate_ws all at
#                    once.
#   seed_bare_ros -- just an empty $HOME/ros with nothing of ours in it.
#                    Only separate_ws (+ skip/clean) applies.
#   seed_built    -- like seed, but with a fake install/ directory, so
#                    build_only must NOT be offered (already built).

def mock_seed_existing(step_def: dict) -> None:
    if not MOCK:
        raise RuntimeError("mock_seed_existing is only available in --mock mode")
    precheck = step_def.get("precheck")
    if not precheck:
        return
    for p in precheck["paths"]:
        (MOCK_HOME / p["path"]).mkdir(parents=True, exist_ok=True)


def mock_seed_bare_ros() -> None:
    if not MOCK:
        raise RuntimeError("mock_seed_bare_ros is only available in --mock mode")
    (MOCK_HOME / "ros").mkdir(parents=True, exist_ok=True)


def mock_seed_built(step_def: dict) -> None:
    if not MOCK:
        raise RuntimeError("mock_seed_built is only available in --mock mode")
    mock_seed_existing(step_def)
    (MOCK_HOME / "ros" / "install" / "cube_petit_bringup").mkdir(parents=True, exist_ok=True)


def mock_clear_existing(step_def: dict) -> None:
    if not MOCK:
        raise RuntimeError("mock_clear_existing is only available in --mock mode")
    import shutil

    precheck = step_def.get("precheck")
    if precheck:
        for p in precheck["paths"]:
            shutil.rmtree(MOCK_HOME / p["path"], ignore_errors=True)
    # Also remove the bare/built fixtures above, and any cube_petit_ros2_ws
    # from a previous "separate workspace" run, for a full reset between
    # manual test scenarios.
    shutil.rmtree(MOCK_HOME / "ros", ignore_errors=True)
    shutil.rmtree(MOCK_HOME / "cube_petit_ros2_ws", ignore_errors=True)
