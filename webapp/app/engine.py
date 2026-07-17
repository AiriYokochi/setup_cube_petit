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
        ng("No can0"),
        'echo ""',
        'echo "=== Wi-Fi interface ==="',
        ok("Wi-Fi IF = wlan0, IP = 192.168.1.50"),
        'echo ""',
        'echo "=== Audio Device Check (Sound_Blaster required) ==="',
        ok("Sound_Blaster microphone found: alsa_input.mock"),
        ok("Sound_Blaster speaker found: alsa_output.mock"),
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
    # setup_dev_tools.sh asks two sequential "[y/n]" confirm() prompts, in the
    # order the inputs are declared in steps.yaml (GitKraken, then VS Code).
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
    of _child_env(). Centralizes cases where a step needs values that live
    elsewhere in state rather than the server's own environment."""
    if step_id == "ros_setup":
        return ros_ws_env(state)
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
