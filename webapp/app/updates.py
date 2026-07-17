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


def _git_runner(repo: Path):
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
    return git


async def _next_release_tag(git) -> tuple[bool, Optional[str]]:
    """(any v* tags exist, the newest v* tag strictly ahead of HEAD or None).

    "Ahead" = HEAD is an ancestor of the tag and the tag is not HEAD itself:
    updates mean moving forward to a published release, never sideways."""
    code, tags = await git("tag", "--list", "v*", "--sort=-v:refname", timeout=5)
    tag_list = [t for t in tags.splitlines() if t.strip()] if code == 0 else []
    if not tag_list:
        return False, None
    _, head = await git("rev-parse", "HEAD", timeout=5)
    for tag in tag_list:
        code, _ = await git("merge-base", "--is-ancestor", "HEAD", tag, timeout=5)
        if code != 0:
            continue
        _, tag_commit = await git("rev-parse", f"{tag}^{{commit}}", timeout=5)
        if tag_commit != head:
            return True, tag
    return True, None


async def _repo_status(repo: Path) -> Optional[dict]:
    """Release status of a repo.

    mode "tag":    an update exists when a v* tag newer than HEAD appeared;
                   the tag's annotation message is the release note shown to
                   the user (commit summaries when the tag has none).
    mode "branch": fallback for repos without any v* tags -- compare against
                   the branch upstream as before.
    Returns None when the repo is missing or (in branch mode) has no upstream.
    """
    if not (repo / ".git").exists():
        return None
    git = _git_runner(repo)

    await git("fetch", "--tags", "--quiet")  # best effort; offline uses cached refs

    has_tags, tag = await _next_release_tag(git)
    if has_tags:
        if tag is None:
            return {"mode": "tag", "behind": 0, "tag": None, "notes": [], "commits": []}
        _, behind = await git("rev-list", "--count", f"HEAD..{tag}", timeout=5)
        _, contents = await git("tag", "-l", "--format=%(contents)", tag, timeout=5)
        notes = [l for l in contents.splitlines() if l.strip()]
        commits: list[str] = []
        if not notes:
            _, log = await git("log", "--oneline", f"HEAD..{tag}", "-10", timeout=5)
            commits = [l for l in log.splitlines() if l.strip()]
        return {"mode": "tag", "behind": int(behind or 0), "tag": tag,
                "notes": notes, "commits": commits}

    code, behind = await git("rev-list", "--count", "HEAD..@{u}", timeout=5)
    if code != 0:
        return None
    code, log = await git("log", "--oneline", "HEAD..@{u}", "-10", timeout=5)
    commits = [l for l in log.splitlines() if l.strip()] if code == 0 else []
    return {"mode": "branch", "behind": int(behind or 0), "tag": None,
            "notes": [], "commits": commits}


async def refresh() -> dict:
    """Re-fetch both repos and rewrite the in-memory cache."""
    if engine.MOCK:
        _cache.update({
            "checked": True,
            # One repo per mode so both banner variants can be exercised:
            # self = release tag with an annotation note, robot = tagless
            # branch fallback.
            "self": {"mode": "tag", "behind": 2, "tag": "v1.2.0", "notes": [
                "センサ確認が固まる問題を修正しました",
                "アップデート通知バナーを追加しました",
            ], "commits": []},
            "robot": {"mode": "branch", "behind": 1, "tag": None, "notes": [],
                      "commits": ["1a2b3c4 fix: rosdep keys"]},
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
    """Advance this repo to the newest release: `git merge --ff-only <tag>`
    when releases are tagged (moves exactly to the release point, even if
    the branch has moved further), falling back to `git pull --ff-only` for
    a tagless history. The server keeps running the old code until the user
    restarts run.sh -- deliberate for v1 (no self-restart)."""
    if engine.MOCK:
        return {"ok": True, "output": "[mock] git merge --ff-only v1.2.0 (simulated update)."}

    git = _git_runner(engine.REPO_ROOT)
    await git("fetch", "--tags", "--quiet", timeout=30)
    has_tags, tag = await _next_release_tag(git)
    if has_tags and tag is None:
        return {"ok": True, "output": "すでに最新のリリースです。"}
    if tag:
        code, text = await git("merge", "--ff-only", tag, timeout=60)
    else:
        code, text = await git("pull", "--ff-only", timeout=60)
    if code == 124:
        return {"ok": False, "output": "git の実行がタイムアウトしました。ネットワークを確認してください。"}
    if code != 0:
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
    # Same release semantics as update_self(): move exactly to the newest
    # tag when the repo uses release tags, plain pull otherwise.
    tag = None
    if not engine.MOCK and (repo / ".git").exists():
        _, tag = await _next_release_tag(_git_runner(repo))
    if tag:
        pull = (
            f"git -C {shlex.quote(str(repo))} fetch --tags --quiet\n"
            f"git -C {shlex.quote(str(repo))} merge --ff-only {shlex.quote(tag)}"
        )
    else:
        pull = f"git -C {shlex.quote(str(repo))} pull --ff-only"
    real_cmd = f"{pull}\n{build}"
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
