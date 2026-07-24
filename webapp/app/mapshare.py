"""Map creation, saving, listing, and cross-robot sharing.

Several Cube Petit individuals doing a joint demo need to navigate on the
*exact same* map (same origin, same scale), so one robot creates the map and
the others receive a copy of the same files -- they never each run their own
SLAM. That doesn't fit steps.yaml's "one step, one script, one robot" shape,
so this lives on its own page (/map, wired up in main.py) instead of being
step 13 of the linear wizard. It still reuses the wizard's own execution
machinery: engine.start_command()/MOCK/resolved_ros_ws() and the generic
/api/runs/{run_key}/stream SSE endpoint (see main.py's map_create_start()
and map_save(), which run under the "map_create"/"map_save" pseudo step ids).

Map layout on disk (existing, pre-webapp convention -- kept as-is):
~/map/<name>/map.yaml + map.pgm, optionally also map_keepout.yaml/.pgm.
In --mock mode this is redirected under the same sandbox home the rest of
engine.py uses (engine._precheck_base()), so mock runs never touch a real
~/map.
"""
from __future__ import annotations

import asyncio
import io
import re
import shlex
import struct
import tarfile
import zlib
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml

from . import engine

# Map (directory) name rule: safe as a path component on both ends of a
# transfer -- no "..", no "/", no leading dot/hyphen.
MAP_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")

_NAME_ERROR = (
    "地図の名前は半角英数字・アンダースコア(_)・ハイフン(-)のみ、"
    "先頭は英数字にしてください(例: 20260724_venue)。"
)


def maps_root() -> Path:
    """~/map (or the --mock sandbox equivalent, see engine._precheck_base)."""
    return engine._precheck_base() / "map"


def validate_map_name(name: str) -> str:
    name = (name or "").strip()
    if not MAP_NAME_RE.match(name):
        raise ValueError(_NAME_ERROR)
    return name


# --- map creation (SLAM via cube_petit_navigation's create_map launch) -----

def _robot_suffix(robot_namespace: str) -> str:
    """cube_petit_orange -> orange (same convention as main.py's
    _suggested_face_color: the create_map_<suffix>.launch.py wrapper files
    are named after this suffix, not the full namespace)."""
    prefix = "cube_petit_"
    return robot_namespace[len(prefix):] if robot_namespace.startswith(prefix) else robot_namespace


def _ros_domain_id(state: dict) -> str:
    """Same value the env_setup step saved (setup_bashrc.bash writes it into
    ~/.bashrc), read straight from state so a non-interactive shell -- which
    never sources ~/.bashrc -- still gets it right."""
    return str(state.get("inputs", {}).get("env_setup", {}).get("ros_domain_id") or "94")


def _create_map_launch(state: dict) -> tuple[str, list[str]]:
    """(launch_file, extra_launch_args) for this robot's mapping launch.

    Prefers the per-robot wrapper create_map_<suffix>.launch.py when it is
    actually installed -- it may carry robot-specific extras beyond just the
    namespace (e.g. create_map_pink.launch.py also overrides params_file and
    scan_topic). Falls back to the generic create_map.launch.py with an
    explicit robot:=<namespace> argument when no such wrapper exists.
    """
    ns = state.get("robot_namespace") or ""
    if ns:
        suffix = _robot_suffix(ns)
        wrapper = f"create_map_{suffix}.launch.py"
        launch_path = (
            engine.resolved_ros_ws(state) / "install" / "cube_petit_navigation" /
            "share" / "cube_petit_navigation" / "launch" / wrapper
        )
        if launch_path.is_file():
            return wrapper, []
    return "create_map.launch.py", ([f"robot:={ns}"] if ns else [])


def _source_ros_lines(state: dict) -> list[str]:
    """Shell lines that get a plain (non-login, non-interactive) shell to a
    working `ros2` -- ~/.bashrc is never read by the subprocess this module
    starts, same reasoning as setup_autostart.bash's generated launcher."""
    ws_setup = engine.resolved_ros_ws(state) / "install" / "setup.bash"
    return [
        "source /opt/ros/jazzy/setup.bash",
        f"if [ -f {shlex.quote(str(ws_setup))} ]; then",
        f"  source {shlex.quote(str(ws_setup))}",
        "else",
        f"  echo 'ERROR: {ws_setup} not found (is the ROS workspace built?)' >&2",
        "  exit 1",
        "fi",
        f"export ROS_DOMAIN_ID={shlex.quote(_ros_domain_id(state))}",
        "export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp",
        "export CYCLONEDDS_URI=file://$HOME/cyclonedds.xml",
    ]


def build_create_cmd(state: dict) -> str:
    """Command for the "start mapping" button: launches SLAM (via
    cube_petit_navigation's create_map launch) in the foreground. It runs
    until the user presses "stop" (engine.cancel(), same SIGTERM-to-process-
    group path every other step's cancel button uses) -- there is no natural
    "done" for a mapping session."""
    launch_file, extra_args = _create_map_launch(state)
    args_str = " ".join(shlex.quote(a) for a in extra_args)
    launch_line = f"exec ros2 launch cube_petit_navigation {shlex.quote(launch_file)}"
    if args_str:
        launch_line += f" {args_str}"
    real_cmd = "\n".join(["set -e", *_source_ros_lines(state), launch_line])
    if not engine.MOCK:
        return real_cmd

    mock_desc = f"ros2 launch cube_petit_navigation {launch_file} {args_str}".rstrip()
    return (
        f'echo "[mock] would run: {mock_desc}"\n'
        'i=0\n'
        'while true; do\n'
        '  i=$((i+1))\n'
        '  echo "[mock] SLAM running... (${i}s) -- press [stop] to end this session"\n'
        '  sleep 1\n'
        'done\n'
    )


# --- map saving (nav2_map_server's map_saver_cli) ---------------------------

def build_save_cmd(name: str, state: dict) -> str:
    name = validate_map_name(name)
    ns = state.get("robot_namespace") or ""
    map_topic = f"/{ns}/navigation/map" if ns else "/map"
    target_dir = maps_root() / name

    real_cmd = "\n".join([
        "set -e",
        *_source_ros_lines(state),
        f"mkdir -p {shlex.quote(str(target_dir))}",
        "ros2 run nav2_map_server map_saver_cli "
        f"-f {shlex.quote(str(target_dir / 'map'))} -t {shlex.quote(map_topic)}",
    ])
    if not engine.MOCK:
        return real_cmd
    return _mock_save_cmd(target_dir)


def _mock_save_cmd(target_dir: Path) -> str:
    """Mock variant: actually writes a small but genuine map.yaml + map.pgm
    (same trick as engine._build_claude_support_cmd's seeded artifacts) so
    the list/thumbnail below the fold can be exercised end to end without a
    real SLAM session ever running."""
    seed = (
        "import pathlib\n"
        f"d = pathlib.Path({str(target_dir)!r})\n"
        "d.mkdir(parents=True, exist_ok=True)\n"
        "w, h = 60, 40\n"
        "pixels = bytearray()\n"
        "for y in range(h):\n"
        "    for x in range(w):\n"
        "        if x in (0, w - 1) or y in (0, h - 1):\n"
        "            pixels.append(0)\n"  # occupied (wall) border
        "        elif (x + y) % 23 == 0:\n"
        "            pixels.append(205)\n"  # unknown speckle
        "        else:\n"
        "            pixels.append(254)\n"  # free
        "(d / 'map.pgm').write_bytes(b'P5\\n%d %d\\n255\\n' % (w, h) + bytes(pixels))\n"
        "(d / 'map.yaml').write_text(\n"
        "    'image: map.pgm\\nresolution: 0.05\\norigin: [0.0, 0.0, 0.0]\\n'\n"
        "    'negate: 0\\noccupied_thresh: 0.65\\nfree_thresh: 0.25\\n'\n"
        ")\n"
        "print('[mock] wrote', d / 'map.yaml')\n"
    )
    return (
        f'echo "[mock] would run: map_saver_cli -> {target_dir}/map.yaml"\n'
        f"python3 -c {shlex.quote(seed)}\n"
    )


# --- listing / thumbnails ----------------------------------------------------

def _load_map_meta(map_dir: Path) -> dict:
    yaml_path = map_dir / "map.yaml"
    try:
        return yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        return {}


def list_maps() -> list[dict]:
    base = maps_root()
    if not base.is_dir():
        return []
    out = []
    for d in sorted(base.iterdir()):
        if not d.is_dir() or not (d / "map.yaml").is_file():
            continue
        meta = _load_map_meta(d)
        pgm_path = d / (meta.get("image") or "map.pgm")
        try:
            mtime = (d / "map.yaml").stat().st_mtime
        except OSError:
            mtime = 0
        out.append({
            "name": d.name,
            "created_at": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M"),
            "created_at_ts": mtime,
            "resolution": meta.get("resolution"),
            "has_thumbnail": pgm_path.is_file(),
            "has_keepout": (d / "map_keepout.yaml").is_file(),
        })
    out.sort(key=lambda m: m["created_at_ts"], reverse=True)
    for m in out:
        del m["created_at_ts"]
    return out


def _map_pgm_path(name: str) -> Optional[Path]:
    d = maps_root() / validate_map_name(name)
    if not (d / "map.yaml").is_file():
        return None
    meta = _load_map_meta(d)
    pgm_path = d / (meta.get("image") or "map.pgm")
    return pgm_path if pgm_path.is_file() else None


def delete_map(name: str) -> None:
    d = maps_root() / validate_map_name(name)
    if not d.is_dir():
        raise FileNotFoundError(name)
    import shutil

    shutil.rmtree(d)


# --- PGM -> PNG thumbnail (pure stdlib: struct + zlib, no Pillow) -----------
#
# map_saver_cli writes binary PGM (P5), 8-bit grayscale, in the same value
# convention nav2 uses to display maps: occupied ~0 (black), free ~254
# (white), unknown 205 (gray) -- which already renders sensibly as a plain
# grayscale image with no further remapping needed.

def _read_pgm(path: Path) -> tuple[int, int, bytes]:
    data = path.read_bytes()
    if data[:2] != b"P5":
        raise ValueError(f"{path} is not a binary PGM (P5) file")
    idx = 2
    values: list[int] = []
    while len(values) < 3:
        while idx < len(data) and data[idx:idx + 1].isspace():
            idx += 1
        if idx < len(data) and data[idx:idx + 1] == b"#":
            while idx < len(data) and data[idx:idx + 1] != b"\n":
                idx += 1
            continue
        start = idx
        while idx < len(data) and not data[idx:idx + 1].isspace():
            idx += 1
        values.append(int(data[start:idx]))
    idx += 1  # the single whitespace byte separating the header from the raster
    width, height, _maxval = values
    raster = data[idx:idx + width * height]
    return width, height, raster


def _downsample(width: int, height: int, raster: bytes, max_dim: int) -> tuple[int, int, bytes]:
    stride = max(1, max(width, height) // max_dim)
    new_w = max(1, width // stride)
    new_h = max(1, height // stride)
    out = bytearray(new_w * new_h)
    for y in range(new_h):
        row_start = y * stride * width
        row = raster[row_start:row_start + width]
        out[y * new_w:(y + 1) * new_w] = row[0:new_w * stride:stride]
    return new_w, new_h, bytes(out)


def _encode_png_grayscale(width: int, height: int, raster: bytes) -> bytes:
    def chunk(tag: bytes, payload: bytes) -> bytes:
        return (struct.pack(">I", len(payload)) + tag + payload +
                struct.pack(">I", zlib.crc32(tag + payload) & 0xffffffff))

    raw = bytearray()
    for y in range(height):
        raw.append(0)  # per-scanline filter type 0 (None)
        raw.extend(raster[y * width:(y + 1) * width])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)  # 8-bit grayscale, no interlace
    idat = zlib.compress(bytes(raw), 6)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def thumbnail_png(name: str, max_dim: int = 240) -> Optional[bytes]:
    """A small grayscale PNG of the map's occupancy grid, or None if the map
    (or its .pgm) doesn't exist yet. Computed on request, not cached to disk
    -- map counts per robot are small (a handful) and a 240px render is
    cheap even for a large map."""
    pgm_path = _map_pgm_path(name)
    if pgm_path is None:
        return None
    width, height, raster = _read_pgm(pgm_path)
    if width <= 0 or height <= 0:
        return None
    new_w, new_h, small = _downsample(width, height, raster, max_dim)
    return _encode_png_grayscale(new_w, new_h, small)


# --- cross-robot transfer (push over HTTP) ----------------------------------
#
# Push, not pull: the robot that just finished mapping already knows which
# map to send and already has the fleet list (webapp/fleet.yaml) to pick a
# target from, so the whole hand-off is one click on the mapping robot's own
# screen. Same-LAN, no auth -- matches /fleet's existing trust model.

_SEND_TIMEOUT = 30


def _tar_map_dir(name: str) -> bytes:
    d = maps_root() / validate_map_name(name)
    if not d.is_dir():
        raise FileNotFoundError(name)
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for item in sorted(d.iterdir()):
            if item.is_file():
                tar.add(item, arcname=item.name)
    return buf.getvalue()


def _post_map(host: str, port: int, name: str, payload: bytes) -> tuple[bool, str]:
    """Blocking HTTP POST (urllib, same choice as engine._github_account_exists)
    -- called via asyncio.to_thread so it doesn't block the event loop."""
    import urllib.error
    import urllib.parse
    import urllib.request

    url = f"http://{host}:{port}/api/maps/receive?name={urllib.parse.quote(name)}"
    req = urllib.request.Request(
        url, data=payload, method="POST", headers={"Content-Type": "application/gzip"},
    )
    try:
        with urllib.request.urlopen(req, timeout=_SEND_TIMEOUT) as resp:
            return True, resp.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.read().decode(errors='replace')[:200]}"
    except Exception as e:  # noqa: BLE001 -- surfaced to the UI as-is, any cause
        return False, str(e)


async def send_map(name: str, host: str, port: int) -> dict:
    """Push a saved map to another robot's webapp (this robot -> target)."""
    name = validate_map_name(name)
    if engine.MOCK:
        await asyncio.sleep(0.5)
        return {"ok": True, "message": f"[mock] {name} を {host}:{port} に送信しました(疑似)。"}
    try:
        payload = await asyncio.to_thread(_tar_map_dir, name)
    except FileNotFoundError:
        return {"ok": False, "message": f"地図 {name} が見つかりません。"}
    ok, detail = await asyncio.to_thread(_post_map, host, port, name, payload)
    if ok:
        return {"ok": True, "message": f"{name} を {host}:{port} に送信しました。"}
    return {"ok": False, "message": f"送信に失敗しました: {detail}"}


def receive_map(name: str, payload: bytes) -> dict:
    """Extract a tar.gz map bundle (sent by send_map() above) into
    ~/map/<name>/, overwriting any existing map of the same name.

    Path-traversal hardened: every member must be a plain file with no ".."
    component and no absolute path. Same-LAN trust does not mean "run
    whatever a tar archive says" -- see tarfile's own extractall() advisory.
    """
    name = validate_map_name(name)
    target_dir = maps_root() / name
    target_dir.mkdir(parents=True, exist_ok=True)

    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as tar:
        members = tar.getmembers()
        for m in members:
            if not m.isfile():
                raise ValueError(f"refusing non-regular tar entry: {m.name}")
            member_path = Path(m.name)
            if member_path.is_absolute() or ".." in member_path.parts:
                raise ValueError(f"refusing unsafe path in archive: {m.name}")
        tar.extractall(target_dir, members=members, filter="data")

    files = sorted(p.name for p in target_dir.iterdir() if p.is_file())
    return {"ok": True, "name": name, "files": files}
