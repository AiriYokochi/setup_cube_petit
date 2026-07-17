// cube_petit_setup wizard frontend. Plain JS, no build step, no CDN.

const state = {
  data: null,
  selectedId: null,
  eventSource: null,
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch (e) {
    // no/invalid JSON body
  }
  if (!res.ok) {
    const detail = payload && payload.detail;
    const message = (detail && detail.message) || detail || res.statusText;
    const err = new Error(typeof message === "string" ? message : JSON.stringify(message));
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

async function loadState() {
  state.data = await api("/api/state");
  const badge = document.getElementById("mock-badge");
  badge.hidden = !state.data.mock;
  renderStepList();
  if (state.selectedId) renderDetail(state.selectedId);
}

function findStep(id) {
  return state.data.steps.find((s) => s.id === id);
}

function isUnlocked(index) {
  for (let i = 0; i < index; i++) {
    if (!["done", "skipped"].includes(state.data.steps[i].status)) return false;
  }
  return true;
}

function statusIcon(status) {
  switch (status) {
    case "done":
      return "✓"; // check
    case "running":
      return "…"; // ellipsis
    case "failed":
      return "!";
    case "skipped":
      return "–"; // en dash
    default:
      return "";
  }
}

function statusLabel(status, exitCode) {
  switch (status) {
    case "done":
      return "完了しました";
    case "running":
      return "実行中...";
    case "failed":
      return exitCode === null || exitCode === undefined
        ? "中断されました(サーバーが途中で終了しました)。もう一度実行してください。"
        : `失敗しました (終了コード: ${exitCode})`;
    case "skipped":
      return "スキップしました";
    default:
      return "未実行";
  }
}

function updateProgress() {
  const steps = state.data.steps;
  const total = steps.length;
  const finished = steps.filter((s) => ["done", "skipped"].includes(s.status)).length;
  const running = steps.some((s) => s.status === "running");
  const pct = total ? (finished / total) * 100 : 0;
  // While a step runs, the petit runs ahead into that step's segment.
  const petitPct = total ? ((finished + (running ? 0.5 : 0)) / total) * 100 : 0;

  const wrap = document.getElementById("progress-wrap");
  wrap.classList.toggle("running", running);
  document.getElementById("progress-fill").style.width = pct + "%";
  // Keep the petit visually on the track at both extremes.
  document.getElementById("progress-petit").style.left = Math.min(97, Math.max(2, petitPct)) + "%";
  document.getElementById("progress-text").textContent = `${finished} / ${total} ステップ`;
}

function renderStepList() {
  updateProgress();
  const nav = document.getElementById("step-list");
  nav.innerHTML = "";
  state.data.steps.forEach((s, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `step-item status-${s.status}`;
    if (s.id === state.selectedId) btn.classList.add("current");
    if (!isUnlocked(idx)) btn.classList.add("locked");
    btn.innerHTML =
      `<span class="step-icon">${statusIcon(s.status)}</span>` +
      `<span class="step-title">${s.title_ja}</span>`;
    btn.addEventListener("click", () => selectStep(s.id));
    nav.appendChild(btn);
  });
}

function selectStep(id) {
  state.selectedId = id;
  closeStream();
  renderStepList();
  renderDetail(id);
}

function closeStream() {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
}

function mkButton(cls, label, onClick) {
  const b = document.createElement("button");
  b.className = cls;
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function buildLogPanel() {
  const details = document.createElement("details");
  details.className = "log-panel";
  const summary = document.createElement("summary");
  summary.textContent = "実行ログ";
  const pre = document.createElement("div");
  pre.className = "log-output";
  details.appendChild(summary);
  details.appendChild(pre);
  return details;
}

function appendLog(pre, line) {
  pre.textContent += line + "\n";
  pre.scrollTop = pre.scrollHeight;
}

function attachStream(runKey, stepId, opts = {}) {
  // reloadOnEnd must be false when replaying the log of an already-finished
  // step: reloading re-renders the detail pane, which replays the log again,
  // which fires "end" again -> infinite request loop.
  const reloadOnEnd = opts.reloadOnEnd ?? false;
  closeStream();
  const pre = document.querySelector("#step-detail .log-output");
  if (!pre) return;
  pre.textContent = "";
  const es = new EventSource(`/api/runs/${runKey}/stream`);
  state.eventSource = es;
  es.onmessage = (ev) => appendLog(pre, ev.data);
  es.addEventListener("end", async () => {
    es.close();
    if (state.eventSource === es) state.eventSource = null;
    if (!reloadOnEnd) return;
    await loadState();
    advanceIfDone(stepId);
  });
  es.onerror = () => {
    // EventSource retries by default; harmless since /stream replays from
    // the on-disk log each time it (re)connects.
  };
}

function advanceIfDone(stepId) {
  // After a run finishes successfully, move the user to the next step.
  const idx = state.data.steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return;
  if (state.data.steps[idx].status !== "done") return;
  if (state.selectedId !== stepId) return;
  const next = state.data.steps[idx + 1];
  if (next) selectStep(next.id);
}

function renderPrecheck(stepId, precheck, container) {
  container.innerHTML = "";
  const box = document.createElement("div");
  box.className = "precheck-box";

  const msg = document.createElement("p");
  msg.textContent = precheck.message_ja;
  box.appendChild(msg);

  const ul = document.createElement("ul");
  (precheck.existing || []).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p.label_ja;
    ul.appendChild(li);
  });
  box.appendChild(ul);

  const choicesDiv = document.createElement("div");
  choicesDiv.className = "choices";
  precheck.choices.forEach((choice) => {
    const btn = mkButton(choice.id === "clean" ? "danger" : "secondary", choice.label_ja, async () => {
      try {
        const res = await api(`/api/steps/${stepId}/precheck/resolve`, {
          method: "POST",
          body: { choice: choice.id },
        });
        if (res.run_key) {
          // "clean" (cleanup run) and "build_only" (runs the step itself)
          // both stream a real command's log. Attach before the DOM gets
          // rebuilt by loadState(); the "end" handler inside attachStream()
          // refreshes state once the run is done.
          attachStream(res.run_key, stepId, { reloadOnEnd: true });
        } else {
          // "separate_ws": nothing to run, just re-render with the choice saved.
          await loadState();
        }
      } catch (err) {
        alert("エラー: " + err.message);
      }
    });
    choicesDiv.appendChild(btn);
  });
  box.appendChild(choicesDiv);
  container.appendChild(box);
}

// --- bluetooth controller pairing (step 7) ---------------------------------

const BT_PRIORITY_RE = /controller|gamepad|joy-?stick|xbox|dualshock|dualsense/i;

function sortBtDevices(devices) {
  return [...devices].sort((a, b) => {
    const pa = BT_PRIORITY_RE.test(a.name) ? 0 : 1;
    const pb = BT_PRIORITY_RE.test(b.name) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.name || "").localeCompare(b.name || "");
  });
}

function renderBtDeviceList(container, devices, stepId) {
  container.innerHTML = "";
  if (!devices.length) {
    const p = document.createElement("p");
    p.className = "help";
    p.textContent = "デバイスが見つかりませんでした。コントローラをペアリングモードにしてから、もう一度スキャンしてください。";
    container.appendChild(p);
    return;
  }
  const ul = document.createElement("ul");
  ul.className = "bt-device-list";
  sortBtDevices(devices).forEach((dev) => {
    const li = document.createElement("li");
    li.className = "bt-device-item";

    const info = document.createElement("span");
    info.className = "bt-device-info";
    info.textContent = `${dev.name || "(名称不明)"} (${dev.mac})` + (dev.paired ? " [ペア済み]" : "");
    li.appendChild(info);

    const btn = mkButton("primary", dev.connected ? "接続済み" : "接続", async () => {
      btn.disabled = true;
      btn.textContent = "接続中...";
      try {
        const res = await api("/api/bluetooth/connect", { method: "POST", body: { mac: dev.mac } });
        if (res.ok) {
          btn.textContent = "接続済み";
          info.textContent += " — 接続しました";
          await api(`/api/steps/${stepId}/complete`, { method: "POST" });
          await loadState();
        } else {
          btn.disabled = false;
          btn.textContent = "接続";
          alert("接続に失敗しました: " + (res.detail || ""));
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "接続";
        alert("エラー: " + err.message);
      }
    });
    btn.disabled = !!dev.connected;
    li.appendChild(btn);
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

function renderBluetoothStep(id, step, el, actions) {
  const scanStatus = document.createElement("p");
  scanStatus.className = "help";
  el.appendChild(scanStatus);

  const deviceBox = document.createElement("div");
  deviceBox.className = "bt-devices";
  el.appendChild(deviceBox);

  const scanBtn = mkButton("primary", "スキャン", async () => {
    scanBtn.disabled = true;
    scanStatus.textContent = "スキャン中...(数秒かかります)";
    try {
      const res = await api("/api/bluetooth/scan", { method: "POST" });
      renderBtDeviceList(deviceBox, res.devices, id);
      scanStatus.textContent = `${res.devices.length}件のデバイスが見つかりました。`;
    } catch (err) {
      scanStatus.textContent = "エラー: " + err.message;
    } finally {
      scanBtn.disabled = false;
    }
  });
  actions.appendChild(scanBtn);

  if (step.skippable && step.status !== "done") {
    const skipBtn = mkButton("secondary", "スキップ", async () => {
      await api(`/api/steps/${id}/skip`, { method: "POST" });
      await loadState();
    });
    actions.appendChild(skipBtn);
  }

  // Show already-known devices (no fresh scan) as soon as the step opens.
  api("/api/bluetooth/devices")
    .then((res) => renderBtDeviceList(deviceBox, res.devices, id))
    .catch(() => {});
}

// --- sensor connection check (step 8) ---------------------------------------

function checkItemEl(item) {
  const li = document.createElement("li");
  li.className = "check-item " + (item.ok ? "ok" : "ng");
  const mark = document.createElement("span");
  mark.className = "check-mark";
  mark.textContent = item.ok ? "✓" : "✗";
  li.appendChild(mark);
  const label = document.createElement("span");
  label.className = "check-label";
  label.textContent = item.label;
  li.appendChild(label);
  if (!item.ok && item.detail) {
    const hint = document.createElement("div");
    hint.className = "check-hint";
    hint.textContent = item.detail;
    li.appendChild(hint);
  }
  return li;
}

async function loadCheckResult(id, container, statusEl) {
  try {
    const res = await api(`/api/steps/${id}/result`);
    container.innerHTML = "";
    if (!res.items.length) {
      statusEl.textContent = "";
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "check-list";
    res.items.forEach((item) => ul.appendChild(checkItemEl(item)));
    container.appendChild(ul);
    statusEl.textContent = `${res.ok_count} / ${res.total} OK`;
  } catch (err) {
    // no result yet (never run): leave the panel empty
  }
}

function renderCheckStep(id, step, el, actions, running) {
  const statusEl = document.createElement("p");
  statusEl.className = "help check-status";
  el.appendChild(statusEl);

  const resultBox = document.createElement("div");
  resultBox.className = "check-result";
  el.appendChild(resultBox);

  const runBtn = mkButton("primary", step.status === "pending" ? "チェック実行" : "もう一度チェック", async () => {
    runBtn.disabled = true;
    try {
      await api(`/api/steps/${id}/run`, { method: "POST" });
      await loadState();
    } catch (err) {
      alert("エラー: " + err.message);
    }
  });
  runBtn.disabled = running;
  actions.appendChild(runBtn);

  loadCheckResult(id, resultBox, statusEl);
}

function renderDetail(id) {
  const step = findStep(id);
  const el = document.getElementById("step-detail");
  el.innerHTML = "";

  const h2 = document.createElement("h2");
  h2.textContent = step.title_ja;
  el.appendChild(h2);

  const desc = document.createElement("p");
  desc.className = "description";
  desc.textContent = step.description_ja;
  el.appendChild(desc);

  if (step.warning_ja) {
    const w = document.createElement("div");
    w.className = "warning-box";
    w.textContent = step.warning_ja;
    el.appendChild(w);
  }

  const statusLine = document.createElement("p");
  statusLine.className = `status-line status-${step.status}`;
  statusLine.textContent = statusLabel(step.status, step.exit_code);
  el.appendChild(statusLine);

  const savedInputs = (state.data.inputs && state.data.inputs[id]) || {};
  const formGetters = {};
  (step.inputs || []).forEach((inputDef) => {
    const row = document.createElement("div");
    row.className = "input-row" + (inputDef.type === "bool" ? " bool" : "");
    const label = document.createElement("label");
    label.textContent = inputDef.label_ja;

    if (inputDef.type === "bool") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = savedInputs[inputDef.id] ?? inputDef.default ?? false;
      row.appendChild(input);
      row.appendChild(label);
      formGetters[inputDef.id] = () => input.checked;
    } else {
      row.appendChild(label);
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = inputDef.placeholder || "";
      input.value = savedInputs[inputDef.id] ?? inputDef.default ?? "";
      row.appendChild(input);
      if (inputDef.help_ja) {
        const help = document.createElement("div");
        help.className = "help";
        help.textContent = inputDef.help_ja;
        row.appendChild(help);
      }
      formGetters[inputDef.id] = () => input.value;
    }
    el.appendChild(row);
  });

  const precheckContainer = document.createElement("div");
  el.appendChild(precheckContainer);

  const actions = document.createElement("div");
  actions.className = "actions";
  el.appendChild(actions);

  const logPanel = buildLogPanel();
  el.appendChild(logPanel);

  const running = step.status === "running";

  if (step.type === "reboot_gate") {
    const btn = mkButton(
      "primary",
      "確認しました(この後、機体を再起動してください)",
      async () => {
        await api(`/api/steps/${id}/complete`, { method: "POST" });
        await loadState();
      }
    );
    btn.disabled = step.status === "done";
    actions.appendChild(btn);
  } else if (step.type === "bluetooth") {
    renderBluetoothStep(id, step, el, actions);
  } else if (step.type === "check") {
    renderCheckStep(id, step, el, actions, running);
  } else {
    const runLabel = step.status === "failed" ? "もう一度実行" : "実行";
    const runBtn = mkButton("primary", runLabel, async () => {
      const inputs = {};
      Object.entries(formGetters).forEach(([k, get]) => {
        inputs[k] = get();
      });
      try {
        if (Object.keys(inputs).length) {
          await api(`/api/steps/${id}/inputs`, { method: "POST", body: { inputs } });
        }
        await api(`/api/steps/${id}/run`, { method: "POST", body: { inputs } });
        await loadState();
      } catch (err) {
        if (err.status === 409 && err.payload && err.payload.detail && err.payload.detail.message === "precheck_required") {
          renderPrecheck(id, err.payload.detail.precheck, precheckContainer);
        } else {
          alert("エラー: " + err.message);
        }
      }
    });
    runBtn.disabled = running;
    actions.appendChild(runBtn);

    if (step.skippable && step.status !== "done") {
      const skipBtn = mkButton("secondary", "スキップ", async () => {
        await api(`/api/steps/${id}/skip`, { method: "POST" });
        await loadState();
      });
      skipBtn.disabled = running;
      actions.appendChild(skipBtn);
    }
  }

  // For a not-yet-resolved precheck step, surface the choice up front.
  if (step.type === "script_with_precheck" && !running && step.status !== "done" && step.status !== "skipped") {
    api(`/api/steps/${id}/precheck`)
      .then((pre) => {
        if (pre.needed) renderPrecheck(id, pre, precheckContainer);
      })
      .catch(() => {});
  }

  if (running || step.status === "done" || step.status === "failed") {
    // Finished steps only replay their log; reloading state on "end" there
    // would loop (see attachStream).
    attachStream(id, id, { reloadOnEnd: running });
    logPanel.open = running || step.status === "failed";
  }
}

async function init() {
  await loadState();
  if (state.data.steps.length) {
    const firstNotDone = state.data.steps.find((s) => !["done", "skipped"].includes(s.status));
    selectStep(firstNotDone ? firstNotDone.id : state.data.steps[0].id);
  }

  // Safety-net poll: only kicks in if something is running without a live
  // SSE connection (e.g. after a dropped connection during pc_setup's gdm
  // restart). Idle/finished steps are never re-polled to avoid log flicker.
  setInterval(() => {
    if (state.eventSource) return;
    if (state.data && state.data.steps.some((s) => s.status === "running")) {
      loadState();
    }
  }, 4000);
}

init();
