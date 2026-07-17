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


async def start_command(
    step_id: str,
    cmd: str,
    *,
    cwd: Optional[Path] = None,
    stdin_text: Optional[str] = None,
) -> StepRun:
    if is_running(step_id):
        raise RuntimeError(f"step {step_id} is already running")

    run = StepRun(step_id)
    _runs[step_id] = run

    log_path = state_mod.log_path_for(step_id)
    log_path.write_text("", encoding="utf-8")  # fresh log for this run

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


def _build_script_cmd(script_name: str) -> str:
    real_cmd = f"bash {shlex.quote(str(script_path(script_name)))}"
    return _cmd_or_mock(real_cmd, f"bash {script_name}", 3)


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


async def run_step(step_def: dict, inputs: dict) -> StepRun:
    step_id = step_def["id"]
    step_type = step_def["type"]

    if step_type == "prereq_check":
        return await start_command(step_id, _build_prereq_cmd(), cwd=REPO_ROOT)
    if step_type in ("script", "script_with_precheck"):
        return await start_command(step_id, _build_script_cmd(step_def["script"]), cwd=REPO_ROOT)
    if step_type == "toggle_script":
        cmd, stdin_text = _build_toggle_cmd(step_def["script"], step_def["inputs"], inputs)
        return await start_command(step_id, cmd, cwd=REPO_ROOT, stdin_text=stdin_text)
    raise ValueError(f"step type {step_type!r} is not directly runnable via run_step()")


def _precheck_base() -> Path:
    return MOCK_HOME if MOCK else Path.home()


def precheck_status(step_def: dict) -> dict:
    """Report which of the step's 'existing work' paths are present."""
    precheck = step_def.get("precheck")
    if not precheck:
        return {"needed": False}

    base = _precheck_base()
    existing = [p for p in precheck["paths"] if (base / p["path"]).exists()]
    return {
        "needed": bool(existing),
        "existing": existing,
        "message_ja": precheck.get("message_ja", ""),
        "choices": precheck.get("choices", []),
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


# --- mock-only helpers used by the debug API to exercise the precheck branch ---

def mock_seed_existing(step_def: dict) -> None:
    if not MOCK:
        raise RuntimeError("mock_seed_existing is only available in --mock mode")
    precheck = step_def.get("precheck")
    if not precheck:
        return
    for p in precheck["paths"]:
        (MOCK_HOME / p["path"]).mkdir(parents=True, exist_ok=True)


def mock_clear_existing(step_def: dict) -> None:
    if not MOCK:
        raise RuntimeError("mock_clear_existing is only available in --mock mode")
    import shutil

    precheck = step_def.get("precheck")
    if not precheck:
        return
    for p in precheck["paths"]:
        shutil.rmtree(MOCK_HOME / p["path"], ignore_errors=True)
