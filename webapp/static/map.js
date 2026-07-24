// Map management page (/map): create a map with SLAM, save it, and push a
// copy to another Cube Petit individual's webapp so every robot at an event
// navigates on the exact same map. Plain JS, no build step, no CDN --
// mirrors fleet.js's shape (same page family, same constraints).

// --- i18n ---------------------------------------------------------------
// Language choice is shared with the wizard/fleet pages via the same
// localStorage key, so switching on any page carries over everywhere.

const STR = {
  ja: {
    title: "Cube Petit 地図管理",
    home_link: "セットアップ",
    fleet_link: "機体一覧",
    no_robot_warning:
      "個体名が未設定です。先にセットアップの「1. 前提確認」で個体名を入力してください。",
    create_title: "地図の作成",
    create_hint:
      "SLAM(slam_toolbox)を起動して、この機体を動かしながら地図を作ります。" +
      "起動している間、下の「地図の保存」で好きなタイミングの地図を保存できます。" +
      "作り終えたら「停止」を押してください。",
    create_start: "地図作成を開始(SLAMを起動)",
    create_stop: "停止",
    save_title: "地図の保存",
    save_hint:
      "地図の名前を入力して保存すると、~/map/<名前>/ に map.yaml + map.pgm として保存されます" +
      "(既存の運用と同じ形式です)。地図作成中でないと保存できません。",
    save_name_label: "地図の名前",
    save_name_help: "半角英数字・アンダースコア(_)・ハイフン(-)のみ使えます。",
    save_btn: "この地図を保存",
    list_title: "保存済みの地図",
    refresh: "更新",
    log_panel: "実行ログ",
    status_pending: "未実行",
    status_running: "実行中...",
    status_done: "完了しました",
    status_failed: (code) => `失敗しました (終了コード: ${code})`,
    status_skipped: "スキップしました",
    resolution: (r) => `解像度: ${r} m/px`,
    created_at: (t) => `作成: ${t}`,
    badge_keepout: "keepoutあり",
    send_select_placeholder: "送信先を選ぶ",
    send_btn: "送信",
    sending: "送信中...",
    send_ok: (host) => `${host} に送信しました。`,
    send_fail: (msg) => `送信に失敗しました: ${msg}`,
    delete_btn: "削除",
    delete_confirm: (name) => `地図「${name}」を削除します。よろしいですか?`,
    delete_fail: (msg) => `削除に失敗しました: ${msg}`,
    empty_maps: "保存済みの地図はまだありません。",
    load_error: "読み込みに失敗しました。",
    name_required: "地図の名前を入力してください。",
  },
  en: {
    title: "Cube Petit Map Management",
    home_link: "Setup",
    fleet_link: "Fleet",
    no_robot_warning:
      "This robot has no name set yet. Enter it first in the setup wizard's " +
      '"1. Preflight check" step.',
    create_title: "Create a map",
    create_hint:
      "Starts SLAM (slam_toolbox) so you can drive the robot around to build a map. " +
      'While it is running, use "Save the map" below to save a snapshot at any time. ' +
      'Press "Stop" when you are done.',
    create_start: "Start mapping (launch SLAM)",
    create_stop: "Stop",
    save_title: "Save the map",
    save_hint:
      "Enter a name and save -- it is written to ~/map/<name>/ as map.yaml + map.pgm " +
      "(same format the existing workflow already uses). Saving requires mapping to be running.",
    save_name_label: "Map name",
    save_name_help: "Letters, digits, underscore (_) and hyphen (-) only.",
    save_btn: "Save this map",
    list_title: "Saved maps",
    refresh: "Refresh",
    log_panel: "Run log",
    status_pending: "Not run yet",
    status_running: "Running...",
    status_done: "Done",
    status_failed: (code) => `Failed (exit code: ${code})`,
    status_skipped: "Skipped",
    resolution: (r) => `Resolution: ${r} m/px`,
    created_at: (t) => `Created: ${t}`,
    badge_keepout: "has keepout",
    send_select_placeholder: "Pick a target robot",
    send_btn: "Send",
    sending: "Sending...",
    send_ok: (host) => `Sent to ${host}.`,
    send_fail: (msg) => `Send failed: ${msg}`,
    delete_btn: "Delete",
    delete_confirm: (name) => `Delete the map "${name}"? This cannot be undone.`,
    delete_fail: (msg) => `Delete failed: ${msg}`,
    empty_maps: "No saved maps yet.",
    load_error: "Could not load data.",
    name_required: "Enter a name for the map.",
  },
};

let LANG = (() => {
  const saved = localStorage.getItem("cps_lang");
  if (saved === "ja" || saved === "en") return saved;
  return (navigator.language || "ja").toLowerCase().startsWith("ja") ? "ja" : "en";
})();

function t(key, ...args) {
  const v = (STR[LANG] || STR.ja)[key];
  const fallback = STR.ja[key];
  const chosen = v === undefined ? fallback : v;
  return typeof chosen === "function" ? chosen(...args) : chosen;
}

const state = {
  robotNamespace: null,
  maps: [],
  runs: {},
  fleet: [],
  fleetPorts: { setup: 8760 },
  mock: false,
  streams: {}, // run_key -> EventSource
  nameFilled: false, // whether the save-name input has ever been auto-filled
};

// --- static text / page chrome ----------------------------------------

function applyStaticTexts() {
  document.documentElement.lang = LANG;
  document.title = t("title");
  document.getElementById("map-title").textContent = t("title");
  document.getElementById("lang-toggle").textContent = LANG === "ja" ? "EN" : "日本語";
  document.getElementById("link-home").textContent = t("home_link");
  document.getElementById("link-fleet").textContent = t("fleet_link");
  document.getElementById("no-robot-warning").textContent = t("no_robot_warning");
  document.getElementById("create-title").textContent = t("create_title");
  document.getElementById("create-hint").textContent = t("create_hint");
  document.getElementById("create-start-btn").textContent = t("create_start");
  document.getElementById("create-stop-btn").textContent = t("create_stop");
  document.getElementById("create-log-summary").textContent = t("log_panel");
  document.getElementById("save-title").textContent = t("save_title");
  document.getElementById("save-hint").textContent = t("save_hint");
  document.getElementById("save-name-label").textContent = t("save_name_label");
  document.getElementById("save-name-help").textContent = t("save_name_help");
  document.getElementById("save-btn").textContent = t("save_btn");
  document.getElementById("save-log-summary").textContent = t("log_panel");
  document.getElementById("list-title").textContent = t("list_title");
  document.getElementById("refresh-btn").textContent = t("refresh");
}

function statusText(status, exitCode) {
  switch (status) {
    case "running": return t("status_running");
    case "done": return t("status_done");
    case "failed": return t("status_failed", exitCode);
    case "skipped": return t("status_skipped");
    default: return t("status_pending");
  }
}

// --- log streaming (reuses the wizard's generic /api/runs/{run_key}/stream) --

const MAX_LOG_LINES = 1500;

function attachRunStream(runKey, outputEl, onEnd) {
  if (state.streams[runKey]) {
    state.streams[runKey].close();
    delete state.streams[runKey];
  }
  outputEl.textContent = "";
  const es = new EventSource(`/api/runs/${runKey}/stream`);
  state.streams[runKey] = es;

  const lines = [];
  let truncated = 0;
  let flushTimer = null;
  const flush = () => {
    flushTimer = null;
    const head = truncated > 0 ? `(...${truncated})\n` : "";
    outputEl.textContent = head + lines.join("\n") + (lines.length ? "\n" : "");
    outputEl.scrollTop = outputEl.scrollHeight;
  };
  es.onmessage = (ev) => {
    lines.push(ev.data);
    if (lines.length > MAX_LOG_LINES) {
      truncated += lines.length - MAX_LOG_LINES;
      lines.splice(0, lines.length - MAX_LOG_LINES);
    }
    if (flushTimer === null) flushTimer = setTimeout(flush, 100);
  };
  es.addEventListener("end", () => {
    es.close();
    if (flushTimer !== null) { clearTimeout(flushTimer); flushTimer = null; }
    flush();
    if (state.streams[runKey] === es) delete state.streams[runKey];
    if (onEnd) onEnd();
  });
  es.onerror = () => {
    // EventSource auto-retries; harmless, /stream replays from the on-disk
    // log each time it reconnects (same behavior the wizard's app.js relies on).
  };
}

// --- create (SLAM) section -----------------------------------------------

function renderCreateSection() {
  const run = state.runs.map_create || { status: "pending", running: false };
  const statusEl = document.getElementById("create-status");
  statusEl.textContent = statusText(run.status, run.exit_code);
  statusEl.className = `status-line status-${run.status || "pending"}`;

  const startBtn = document.getElementById("create-start-btn");
  const stopBtn = document.getElementById("create-stop-btn");
  startBtn.disabled = !state.robotNamespace || run.running;
  stopBtn.disabled = !run.running;
}

async function startCreate() {
  try {
    const res = await fetch("/api/maps/create/start", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.detail || t("load_error"));
      return;
    }
  } catch (e) {
    alert(t("load_error"));
    return;
  }
  await loadState();
  attachRunStream("map_create", document.getElementById("create-log-output"), () => loadState());
}

async function stopCreate() {
  try {
    await fetch("/api/maps/create/stop", { method: "POST" });
  } catch (e) {
    // fall through to reload -- state will reflect whatever actually happened
  }
  await loadState();
}

// --- save section ----------------------------------------------------------

function defaultMapName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const suffix = (state.robotNamespace || "").replace(/^cube_petit_/, "");
  return suffix ? `${stamp}_${suffix}` : stamp;
}

function renderSaveSection() {
  const run = state.runs.map_save || { status: "pending", running: false };
  const statusEl = document.getElementById("save-status");
  statusEl.textContent = statusText(run.status, run.exit_code);
  statusEl.className = `status-line status-${run.status || "pending"}`;

  const saveBtn = document.getElementById("save-btn");
  saveBtn.disabled = !state.robotNamespace || run.running;

  const input = document.getElementById("save-name-input");
  if (!state.nameFilled && !input.value) {
    input.value = defaultMapName();
    state.nameFilled = true;
  }
}

async function saveMap() {
  const input = document.getElementById("save-name-input");
  const name = input.value.trim();
  if (!name) {
    alert(t("name_required"));
    return;
  }
  try {
    const res = await fetch("/api/maps/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.detail || t("load_error"));
      return;
    }
  } catch (e) {
    alert(t("load_error"));
    return;
  }
  await loadState();
  attachRunStream("map_save", document.getElementById("save-log-output"), async () => {
    await loadState();
    await loadMaps();
  });
}

// --- saved-maps grid ---------------------------------------------------------

function fleetOptionsHtml() {
  if (!state.fleet.length) return "";
  return state.fleet
    .map((r) => `<option value="${r.host}|${r.port}">${r.name} (${r.host})</option>`)
    .join("");
}

function makeMapCard(map) {
  const tpl = document.getElementById("tpl-map-card");
  const node = tpl.content.firstElementChild.cloneNode(true);

  const img = node.querySelector(".map-thumb");
  if (map.has_thumbnail) {
    img.src = `/api/maps/${encodeURIComponent(map.name)}/thumbnail.png?ts=${Date.now()}`;
  } else {
    img.remove();
  }

  node.querySelector(".map-name").textContent = map.name;
  const meta = node.querySelector(".map-meta");
  const metaParts = [t("created_at", map.created_at)];
  if (map.resolution) metaParts.push(t("resolution", map.resolution));
  meta.textContent = metaParts.join(" / ");

  const badges = node.querySelector(".map-badges");
  if (map.has_keepout) {
    const b = document.createElement("span");
    b.className = "map-badge";
    b.textContent = t("badge_keepout");
    badges.appendChild(b);
  }

  const select = node.querySelector(".map-send-select");
  select.innerHTML =
    `<option value="">${t("send_select_placeholder")}</option>` + fleetOptionsHtml();

  const sendBtn = node.querySelector(".map-send-btn");
  sendBtn.textContent = t("send_btn");
  const resultEl = node.querySelector(".map-send-result");
  sendBtn.addEventListener("click", async () => {
    const val = select.value;
    if (!val) return;
    const [host, port] = val.split("|");
    sendBtn.disabled = true;
    sendBtn.textContent = t("sending");
    resultEl.hidden = true;
    try {
      const res = await fetch(`/api/maps/${encodeURIComponent(map.name)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_host: host, target_port: Number(port) }),
      });
      const body = await res.json();
      resultEl.hidden = false;
      if (body.ok) {
        resultEl.textContent = t("send_ok", host);
        resultEl.className = "map-send-result ok";
      } else {
        resultEl.textContent = t("send_fail", body.message || "");
        resultEl.className = "map-send-result fail";
      }
    } catch (e) {
      resultEl.hidden = false;
      resultEl.textContent = t("send_fail", String(e));
      resultEl.className = "map-send-result fail";
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = t("send_btn");
    }
  });

  const deleteBtn = node.querySelector(".map-delete-btn");
  deleteBtn.textContent = t("delete_btn");
  deleteBtn.addEventListener("click", async () => {
    if (!confirm(t("delete_confirm", map.name))) return;
    try {
      const res = await fetch(`/api/maps/${encodeURIComponent(map.name)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.detail || t("delete_fail", res.status));
        return;
      }
      await loadMaps();
    } catch (e) {
      alert(t("delete_fail", String(e)));
    }
  });

  return node;
}

function renderMapGrid() {
  const grid = document.getElementById("map-grid");
  grid.innerHTML = "";
  if (!state.maps.length) {
    grid.innerHTML = `<p class="map-grid-empty">${t("empty_maps")}</p>`;
    return;
  }
  state.maps.forEach((m) => grid.appendChild(makeMapCard(m)));
}

// --- data loading ------------------------------------------------------------

async function loadMaps() {
  try {
    const res = await fetch("/api/maps");
    const data = await res.json();
    state.robotNamespace = data.robot_namespace;
    state.maps = data.maps || [];
    state.runs = data.runs || {};
    state.mock = !!data.mock;
  } catch (e) {
    document.getElementById("map-grid").innerHTML = `<p class="map-grid-empty">${t("load_error")}</p>`;
    return;
  }
  document.getElementById("mock-badge").hidden = !state.mock;
  document.getElementById("no-robot-warning").hidden = !!state.robotNamespace;
  renderCreateSection();
  renderSaveSection();
  renderMapGrid();
}

async function loadFleet() {
  try {
    const res = await fetch("/api/fleet");
    const data = await res.json();
    const ports = Object.assign({ setup: 8760 }, data.ports || {});
    state.fleetPorts = ports;
    state.fleet = (data.robots || []).map((r) => ({ ...r, port: ports.setup }));
  } catch (e) {
    state.fleet = [];
  }
}

async function loadState() {
  await loadMaps();
}

async function init() {
  applyStaticTexts();
  await loadFleet();
  await loadState();

  // Resume watching an already-running (or just-finished) session across a
  // page reload -- /stream replays the on-disk log from the start either way.
  const createRun = state.runs.map_create;
  if (createRun && createRun.status && createRun.status !== "pending") {
    attachRunStream("map_create", document.getElementById("create-log-output"), () => loadState());
  }
  const saveRun = state.runs.map_save;
  if (saveRun && saveRun.status && saveRun.status !== "pending") {
    attachRunStream("map_save", document.getElementById("save-log-output"), () => loadState());
  }
}

document.getElementById("lang-toggle").addEventListener("click", () => {
  LANG = LANG === "ja" ? "en" : "ja";
  localStorage.setItem("cps_lang", LANG);
  applyStaticTexts();
  renderCreateSection();
  renderSaveSection();
  renderMapGrid();
});
document.getElementById("create-start-btn").addEventListener("click", startCreate);
document.getElementById("create-stop-btn").addEventListener("click", stopCreate);
document.getElementById("save-btn").addEventListener("click", saveMap);
document.getElementById("refresh-btn").addEventListener("click", loadMaps);

init();
