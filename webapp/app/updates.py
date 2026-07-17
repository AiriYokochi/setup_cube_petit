"""Update detection and application (update feature v1).

The installed version is whatever git HEAD is -- nobody has to remember
version numbers. On server startup a background fetch compares the two
registered repos (this repo, and the robot source under the resolved ROS
workspace) against their upstreams; /api/updates serves the cached result
including the pending commit summaries, so the banner can show *what*
changed, not just that something did.

"Update" means:
  - self:  git pull --ff-only in this repo (the user restarts run.sh after)
  - robot: git pull the cube_petit_ros clone, then setup_ros.bash
           --build-only, streamed through the normal step-run machinery so
           it looks and logs like any other step run.
"""
from __future__ import annotations

import asyncio
import os
import shlex
from pathlib import Path
from typing import Optional

from . import engine, state as state_mod

FETCH_TIMEOUT = 15

# Populated by refresh() (kicked off at server startup); served by /api/updates.
_cache: dict = {"checked": False, "self": None, "robot": None}


def _robot_repo(state: dict) -> Path:
    return engine.resolved_ros_ws(state) / "src" / "cube_petit_ros"


async def _repo_status(repo: Path) -> Optional[dict]:
    """{behind, commits[]} vs the current branch's upstream, or None when the
    repo/upstream is missing or the fetch fails."""
    if not (repo / ".git").exists():
        return None

    async def git(*args: str, timeout: int = FETCH_TIMEOUT) -> tuple[int, str]:
        proc = await asyncio.create_subprocess_exec(
            "git", "-C", str(repo), *args,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=engine._child_env(),
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            return 124, ""
        return proc.returncode or 0, out.decode(errors="replace").strip()

    await git("fetch", "--quiet")  # best effort; offline still reports cached refs
    code, behind = await git("rev-list", "--count", "HEAD..@{u}", timeout=5)
    if code != 0:
        return None
    code, log = await git("log", "--oneline", "HEAD..@{u}", "-10", timeout=5)
    commits = [l for l in log.splitlines() if l.strip()] if code == 0 else []
    return {"behind": int(behind or 0), "commits": commits}


async def refresh() -> dict:
    """Re-fetch both repos and rewrite the in-memory cache."""
    if engine.MOCK:
        _cache.update({
            "checked": True,
            "self": {"behind": 2, "commits": [
                "abc1234 fix: sensor check hang on serial open",
                "def5678 feat: update banner with commit summaries",
            ]},
            "robot": {"behind": 1, "commits": ["1a2b3c4 fix: rosdep keys"]},
        })
        return dict(_cache)

    state = state_mod.load_state()
    self_status, robot_status = await asyncio.gather(
        _repo_status(engine.REPO_ROOT),
        _repo_status(_robot_repo(state)),
    )
    _cache.update({"checked": True, "self": self_status, "robot": robot_status})
    return dict(_cache)


def cached() -> dict:
    return dict(_cache)


async def update_self() -> dict:
    """git pull --ff-only this repo. The server keeps running the old code
    until the user restarts run.sh -- deliberate for v1 (no self-restart)."""
    if engine.MOCK:
        return {"ok": True, "output": "[mock] git pull --ff-only: Already up to date (simulated update)."}
    proc = await asyncio.create_subprocess_exec(
        "git", "-C", str(engine.REPO_ROOT), "pull", "--ff-only",
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        env=engine._child_env(),
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
    except asyncio.TimeoutError:
        proc.kill()
        return {"ok": False, "output": "git pull がタイムアウトしました。ネットワークを確認してください。"}
    text = out.decode(errors="replace").strip()
    if proc.returncode != 0:
        hint = (
            "ローカルに手作業の変更があると自動更新できません。"
            "ターミナルで git status を確認してください。"
        )
        return {"ok": False, "output": f"{text}\n{hint}"}
    await refresh()
    return {"ok": True, "output": text}


async def run_robot_update(step_def: dict, state: dict) -> engine.StepRun:
    """Pull the robot source and rebuild, as a run of the ros_setup step
    itself (so the log streams over SSE and success marks the step done)."""
    repo = _robot_repo(state)
    build = f"bash {shlex.quote(str(engine.script_path(step_def['script'])))} --build-only"
    real_cmd = (
        f"git -C {shlex.quote(str(repo))} pull --ff-only\n"
        f"{build}"
    )
    cmd = engine._cmd_or_mock(real_cmd, "robot update: git pull + setup_ros.bash --build-only", 3)
    extra_env = engine.ros_ws_env(state)
    run = await engine.start_command(step_def["id"], cmd, cwd=engine.REPO_ROOT, extra_env=extra_env)
    return run


# --- "this step needs a re-run" detection -----------------------------------

def repo_head() -> Optional[str]:
    """Current HEAD of this repo (recorded on each step run)."""
    import subprocess

    try:
        out = subprocess.run(
            ["git", "-C", str(engine.REPO_ROOT), "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=5,
        )
    except Exception:
        return None
    return out.stdout.strip() if out.returncode == 0 else None


# (ran_commit, head, script) -> bool; HEAD only moves on update, so this
# stays tiny and saves a git subprocess per step per /api/state call.
_rerun_memo: dict[tuple, bool] = {}


def needs_rerun(step_def: dict, step_state: dict) -> bool:
    """True when the step ran at an older commit AND its script changed
    since. Only meaningful for steps that wrap a script file."""
    script = step_def.get("script")
    ran_at = step_state.get("ran_at_commit")
    if not script or not ran_at or step_state.get("status") != "done":
        return False
    head = repo_head()
    if not head or head == ran_at:
        return False
    key = (ran_at, head, script)
    if key not in _rerun_memo:
        import subprocess

        try:
            out = subprocess.run(
                ["git", "-C", str(engine.REPO_ROOT), "diff", "--name-only",
                 f"{ran_at}..{head}", "--", script],
                capture_output=True, text=True, timeout=5,
            )
            _rerun_memo[key] = out.returncode == 0 and bool(out.stdout.strip())
        except Exception:
            _rerun_memo[key] = False
    return _rerun_memo[key]
