"""FastAPI app for the cube_petit_setup non-engineer setup wizard.

Phase 1 (MVP) scope: steps 1-5 from docs/cube_petit_setup_survey.md section 8
(prereq check -> PC basic setup -> optional dev tools -> ROS install ->
reboot gate). See webapp/README.md for how to run it.
"""
from __future__ import annotations

import asyncio
import re
from pathlib import Path
from typing import Optional

import yaml
from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import engine, state as state_mod

APP_DIR = Path(__file__).resolve().parent
WEBAPP_DIR = APP_DIR.parent
STATIC_DIR = WEBAPP_DIR / "static"

with open(APP_DIR / "steps.yaml", encoding="utf-8") as f:
    _STEPS_YAML: dict = yaml.safe_load(f)
STEPS: list[dict] = _STEPS_YAML["steps"]
STEPS_BY_ID: dict[str, dict] = {s["id"]: s for s in STEPS}
# Celebration-screen data (title/labels/links), see steps.yaml's "completion"
# section -- kept as data so it can be edited without touching this file.
COMPLETION: dict = _STEPS_YAML.get("completion", {})

app = FastAPI(title="cube_petit_setup webapp")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.on_event("startup")
async def _reconcile_stale_running_steps() -> None:
    """If the process was killed mid-step (crash, reboot, closed terminal),
    state.json can be left with a step stuck at status "running" even though
    nothing is actually running anymore (the in-memory engine._runs registry
    is empty on a fresh process). Left alone, the frontend disables the run
    button whenever status == "running", so the wizard would be stuck
    forever with no way to retry. Demote any such step to "failed" so the
    user can just press "run again"."""
    state = state_mod.load_state()
    changed = False
    for step_id, step_state in state.get("steps", {}).items():
        if step_state.get("status") == "running" and not engine.is_running(step_id):
            step_state["status"] = "failed"
            step_state["exit_code"] = None
            changed = True
    if changed:
        state_mod.save_state(state)


def _get_step_or_404(step_id: str) -> dict:
    step_def = STEPS_BY_ID.get(step_id)
    if step_def is None:
        raise HTTPException(404, f"unknown step: {step_id}")
    return step_def


async def _watch_run(step_id: str, run: engine.StepRun) -> None:
    """Wait for a run to finish and persist its result into state.json."""
    assert run.task is not None
    await run.task
    state = state_mod.load_state()
    status = "done" if run.exit_code == 0 else "failed"
    state_mod.set_step_status(state, step_id, status=status, exit_code=run.exit_code)


# --- request bodies -----------------------------------------------------

class InputsBody(BaseModel):
    inputs: dict = {}


class RunBody(BaseModel):
    inputs: dict = {}


class PrecheckResolveBody(BaseModel):
    choice: str


class BluetoothConnectBody(BaseModel):
    mac: str


# --- sensor connection check (step 8) log parsing ---------------------------
#
# udev_check.sh (shell_scripts/udev_check.sh) prints one colored "[OK] ..."
# / "[NG] ..." line per item it checks. We don't reimplement the checks
# here, just parse its already-produced log.

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
_CHECK_ITEM_RE = re.compile(r"^\[(OK|NG)\]\s*(.+)$")

_CHECK_HINTS: list[tuple[re.Pattern, str]] = [
    (re.compile("imu", re.I), "IMUケーブルの接続を確認して、デバイス設定のIMUを実行しましたか?"),
    (re.compile(r"can0|canable|\bcan\b", re.I), "CANケーブルの接続を確認して、デバイス設定のCANを実行しましたか?"),
    (re.compile("lidar|ld06", re.I), "LiDARのUSB接続を確認してください。"),
    (re.compile("wi-?fi", re.I), "Wi-Fiに接続されているか確認してください。"),
    (re.compile("sound_blaster|audio", re.I), "SoundBlasterのUSB接続と、デバイス設定のスピーカーを確認してください。"),
    (re.compile("realsense", re.I), "RealSenseのUSB接続と、デバイス設定のRealSenseを実行しましたか?"),
    (re.compile("bluetooth|controller", re.I), "ステップ7でBluetoothコントローラを接続しましたか?"),
]


def _hint_for(label: str) -> str:
    for pattern, hint in _CHECK_HINTS:
        if pattern.search(label):
            return hint
    return "接続を確認し、必要ならデバイス設定をやり直してください。"


def _parse_check_log(raw_log: str) -> list[dict]:
    items = []
    for line in raw_log.splitlines():
        clean = _ANSI_RE.sub("", line).strip()
        m = _CHECK_ITEM_RE.match(clean)
        if not m:
            continue
        ok = m.group(1) == "OK"
        label = m.group(2).strip()
        items.append({"label": label, "ok": ok, "detail": None if ok else _hint_for(label)})
    return items


# --- pages ---------------------------------------------------------------

@app.get("/")
async def index():
    return FileResponse(str(STATIC_DIR / "index.html"))


# --- state / steps ---------------------------------------------------------

@app.get("/api/state")
async def get_state():
    state = state_mod.load_state()
    steps_out = []
    for step_def in STEPS:
        st = state_mod.get_step_status(state, step_def["id"])
        steps_out.append(
            {
                **step_def,
                "status": st.get("status", "pending"),
                "exit_code": st.get("exit_code"),
            }
        )
    all_done = bool(steps_out) and all(s["status"] in ("done", "skipped") for s in steps_out)
    return {
        "robot_namespace": state.get("robot_namespace"),
        "awaiting_reboot": state.get("awaiting_reboot", False),
        "inputs": state.get("inputs", {}),
        "steps": steps_out,
        "mock": engine.MOCK,
        "all_done": all_done,
        "completion": COMPLETION,
    }


@app.post("/api/steps/{step_id}/inputs")
async def save_inputs(step_id: str, body: InputsBody):
    step_def = _get_step_or_404(step_id)
    input_defs = {d["id"]: d for d in step_def.get("inputs", [])}

    for key, value in body.inputs.items():
        d = input_defs.get(key)
        if not d:
            continue
        if d.get("required") and not value:
            raise HTTPException(400, f"「{d.get('label_ja', key)}」を入力してください")
        if d.get("type") == "text" and d.get("pattern") and value:
            if not re.match(d["pattern"], str(value)):
                raise HTTPException(
                    400,
                    d.get("error_ja") or f"「{d.get('label_ja', key)}」の形式が正しくありません",
                )

    state = state_mod.load_state()
    state["inputs"].setdefault(step_id, {}).update(body.inputs)
    if step_id == "prereq" and "robot_namespace" in body.inputs:
        state["robot_namespace"] = body.inputs["robot_namespace"]
    state_mod.save_state(state)
    return {"status": "saved"}


@app.get("/api/steps/{step_id}/precheck")
async def get_precheck(step_id: str):
    step_def = _get_step_or_404(step_id)
    if not step_def.get("precheck"):
        return {"needed": False}
    state = state_mod.load_state()
    return engine.precheck_status(step_def, state)


@app.post("/api/steps/{step_id}/precheck/resolve")
async def resolve_precheck(step_id: str, body: PrecheckResolveBody):
    step_def = _get_step_or_404(step_id)
    precheck = step_def.get("precheck")
    if not precheck:
        raise HTTPException(400, "this step has no precheck")

    state = state_mod.load_state()
    pre = engine.precheck_status(step_def, state)
    valid_ids = {c["id"] for c in pre["choices"]}
    if body.choice not in valid_ids:
        raise HTTPException(400, f"invalid choice, expected one of {sorted(valid_ids)}")

    if body.choice == "skip":
        state_mod.set_step_status(state, step_id, status="skipped")
        return {"status": "skipped"}

    if body.choice == "separate_ws":
        # No command to run: just record the choice. The next normal "run"
        # of this step will pick up CUBE_PETIT_ROS_WS via engine.ros_ws_env(),
        # and precheck_status() will report needed=False from then on.
        state["ros_ws"] = "separate"
        state_mod.save_state(state)
        return {"status": "ws_selected"}

    if body.choice == "build_only":
        if engine.is_running(step_id):
            raise HTTPException(409, "step is already running")
        state_mod.set_step_status(state, step_id, status="running", exit_code=None)
        run = await engine.run_build_only(step_def, state)
        asyncio.create_task(_watch_run(step_id, run))
        return {"status": "running", "run_key": step_id}

    # choice == "clean"
    run_key = f"{step_id}__precheck"
    if engine.is_running(run_key):
        raise HTTPException(409, "cleanup is already running")
    run = await engine.resolve_precheck(step_def, body.choice)
    asyncio.create_task(_watch_run(run_key, run))
    return {"status": "cleaning", "run_key": run_key}


@app.post("/api/steps/{step_id}/run")
async def run_step(step_id: str, body: RunBody = Body(default=RunBody())):
    step_def = _get_step_or_404(step_id)
    if step_def["type"] in _MANUALLY_COMPLETABLE_TYPES:
        raise HTTPException(400, "this step has no run action; call /complete instead")
    if engine.is_running(step_id):
        raise HTTPException(409, "step is already running")

    state = state_mod.load_state()
    if body.inputs:
        state["inputs"].setdefault(step_id, {}).update(body.inputs)
        state_mod.save_state(state)
    inputs = state["inputs"].get(step_id, {})

    if step_def.get("precheck"):
        pre = engine.precheck_status(step_def, state)
        if pre["needed"]:
            raise HTTPException(409, detail={"message": "precheck_required", "precheck": pre})

    state_mod.set_step_status(state, step_id, status="running", exit_code=None)
    run = await engine.run_step(step_def, inputs, state)
    asyncio.create_task(_watch_run(step_id, run))
    return {"status": "started", "run_key": step_id}


@app.post("/api/steps/{step_id}/skip")
async def skip_step(step_id: str):
    step_def = _get_step_or_404(step_id)
    if not step_def.get("skippable"):
        raise HTTPException(400, "this step cannot be skipped")
    state = state_mod.load_state()
    state_mod.set_step_status(state, step_id, status="skipped")
    return {"status": "skipped"}


# Step types with no single "run" command: reboot_gate has nothing to run
# (just an ack), bluetooth finishes via its own /api/bluetooth/* endpoints.
_MANUALLY_COMPLETABLE_TYPES = {"reboot_gate", "bluetooth"}


@app.post("/api/steps/{step_id}/complete")
async def complete_step(step_id: str):
    step_def = _get_step_or_404(step_id)
    if step_def["type"] not in _MANUALLY_COMPLETABLE_TYPES:
        raise HTTPException(400, "this step type does not support manual /complete")
    state = state_mod.load_state()
    state_mod.set_step_status(state, step_id, status="done")
    result = {"status": "done"}
    if step_def["type"] == "reboot_gate":
        state["awaiting_reboot"] = True
        result["awaiting_reboot"] = True
    state_mod.save_state(state)
    return result


# --- bluetooth controller pairing (step 7) ----------------------------------

@app.post("/api/bluetooth/scan")
async def bluetooth_scan():
    return {"devices": await engine.bluetooth_scan()}


@app.get("/api/bluetooth/devices")
async def bluetooth_devices():
    return {"devices": await engine.bluetooth_devices()}


@app.post("/api/bluetooth/connect")
async def bluetooth_connect(body: BluetoothConnectBody):
    return await engine.bluetooth_connect(body.mac)


# --- sensor connection check (step 8) ---------------------------------------

@app.get("/api/steps/{step_id}/result")
async def get_check_result(step_id: str):
    step_def = _get_step_or_404(step_id)
    if step_def["type"] != "check":
        raise HTTPException(400, "this step has no check result")
    log_path = state_mod.log_path_for(step_id)
    if not log_path.exists():
        return {"items": [], "ok_count": 0, "total": 0}
    items = _parse_check_log(log_path.read_text(encoding="utf-8"))
    ok_count = sum(1 for i in items if i["ok"])
    return {"items": items, "ok_count": ok_count, "total": len(items)}


# --- log streaming (SSE) ---------------------------------------------------

@app.get("/api/runs/{run_key}/stream")
async def stream_run(run_key: str):
    async def gen():
        run = engine.get_run(run_key)
        log_path = state_mod.log_path_for(run_key)

        if log_path.exists():
            for line in log_path.read_text(encoding="utf-8").splitlines():
                yield f"data: {line}\n\n"

        if run is None:
            state = state_mod.load_state()
            exit_code = state_mod.get_step_status(state, run_key).get("exit_code")
            yield f"event: end\ndata: {exit_code if exit_code is not None else ''}\n\n"
            return

        if run.done:
            yield f"event: end\ndata: {run.exit_code}\n\n"
            return

        q = run.subscribe()
        try:
            while True:
                line: str = await q.get()
                if line.startswith("__END__"):
                    code = line[len("__END__"):]
                    yield f"event: end\ndata: {code}\n\n"
                    break
                # SSE "data:" lines cannot contain a raw newline; our lines
                # are already single physical lines from readline().
                yield f"data: {line}\n\n"
        finally:
            run.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream")


# --- mock-only debug helpers (exercise the precheck branches deterministically) --
#
# Three seed shapes for the ros_setup precheck, matching engine.precheck_status():
#   seed             -- cube_petit_ros cloned but not built (+ ripvcs): all four
#                        choices (skip/clean/build_only/separate_ws) apply.
#   seed_bare_ros    -- an unrelated, empty $HOME/ros: only separate_ws applies
#                        (besides the always-on skip/clean).
#   seed_built       -- like seed, but already built: build_only must NOT appear.

@app.post("/api/debug/mock/seed/{step_id}")
async def debug_seed(step_id: str):
    if not engine.MOCK:
        raise HTTPException(400, "only available with --mock")
    engine.mock_seed_existing(_get_step_or_404(step_id))
    return {"status": "seeded"}


@app.post("/api/debug/mock/seed_bare_ros/{step_id}")
async def debug_seed_bare_ros(step_id: str):
    if not engine.MOCK:
        raise HTTPException(400, "only available with --mock")
    _get_step_or_404(step_id)  # validate step_id exists, even though unused
    engine.mock_seed_bare_ros()
    return {"status": "seeded"}


@app.post("/api/debug/mock/seed_built/{step_id}")
async def debug_seed_built(step_id: str):
    if not engine.MOCK:
        raise HTTPException(400, "only available with --mock")
    engine.mock_seed_built(_get_step_or_404(step_id))
    return {"status": "seeded"}


@app.post("/api/debug/mock/clear/{step_id}")
async def debug_clear(step_id: str):
    if not engine.MOCK:
        raise HTTPException(400, "only available with --mock")
    engine.mock_clear_existing(_get_step_or_404(step_id))
    return {"status": "cleared"}
