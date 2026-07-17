"""Persisted setup state: ~/.cube_petit_setup/state.json

The whole point of Phase 1 is that the user can close the terminal / reboot
the machine and re-run ``./webapp/run.sh`` to continue from where they left
off. All progress lives in a single JSON file so a restart of the FastAPI
process (or the whole machine) never loses anything.
"""
from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

STATE_DIR = Path(os.environ.get("CUBE_PETIT_SETUP_HOME", str(Path.home() / ".cube_petit_setup")))
STATE_FILE = STATE_DIR / "state.json"
LOG_DIR = STATE_DIR / "logs"

_lock = threading.Lock()

DEFAULT_STATE: dict[str, Any] = {
    "version": 1,
    "robot_namespace": None,
    "awaiting_reboot": False,
    # per-step arbitrary saved inputs, e.g. {"dev_tools": {"install_gitkraken": false}}
    "inputs": {},
    # per-step run status: pending | running | done | failed | skipped
    "steps": {},
    # ros_setup precheck resolution: None (default $HOME/ros) | "separate"
    # (use $HOME/cube_petit_ros2_ws instead, see engine.resolved_ros_ws()).
    "ros_ws": None,
}


def _ensure_dirs() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def load_state() -> dict[str, Any]:
    _ensure_dirs()
    if not STATE_FILE.exists():
        return json.loads(json.dumps(DEFAULT_STATE))
    with _lock:
        try:
            with open(STATE_FILE, encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            # Corrupt state file: don't crash the whole app, start fresh.
            return json.loads(json.dumps(DEFAULT_STATE))
    merged = json.loads(json.dumps(DEFAULT_STATE))
    merged.update(data)
    merged.setdefault("steps", {})
    merged.setdefault("inputs", {})
    return merged


def save_state(state: dict[str, Any]) -> None:
    _ensure_dirs()
    with _lock:
        fd, tmp_path = tempfile.mkstemp(dir=str(STATE_DIR), prefix=".state-", suffix=".json.tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, STATE_FILE)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


def get_step_status(state: dict[str, Any], step_id: str) -> dict[str, Any]:
    return state["steps"].get(step_id, {"status": "pending"})


def set_step_status(state: dict[str, Any], step_id: str, **fields: Any) -> dict[str, Any]:
    step_state = state["steps"].setdefault(step_id, {"status": "pending"})
    step_state.update(fields)
    save_state(state)
    return step_state


def log_path_for(step_id: str) -> Path:
    _ensure_dirs()
    return LOG_DIR / f"{step_id}.log"
