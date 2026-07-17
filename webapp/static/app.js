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

// Steps that show their own post-run guide panel instead of jumping ahead;
// the user leaves them via that panel's explicit "next" button.
const NO_AUTO_ADVANCE = new Set(["claude_support"]);

function advanceIfDone(stepId) {
  if (NO_AUTO_ADVANCE.has(stepId)) return;
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

function goToNextStep(id) {
  const idx = state.data.steps.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const next = state.data.steps[idx + 1];
  if (next) selectStep(next.id);
}

function renderBluetoothStep(id, step, el, actions) {
  if (step.status === "done") {
    // Connection already succeeded (either just now, or on a previous visit
    // to this step). Unlike run-type steps, there is no automatic advance
    // here -- show the result plainly and let the user press an explicit
    // "next" button, since re-scanning/re-connecting is still possible below.
    const doneBox = document.createElement("div");
    doneBox.className = "bt-done-box";
    doneBox.textContent = "Bluetoothコントローラの接続が完了しました。";
    el.appendChild(doneBox);

    const nextBtn = mkButton("primary", "次へ", () => goToNextStep(id));
    actions.appendChild(nextBtn);
  }

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

// --- claude code support (step 9) post-run guide panel ----------------------

async function copyText(text, btn) {
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (e) {
    // fall through to the legacy path
  }
  if (!ok) {
    // Fallback for non-secure contexts (e.g. http://<LAN IP>:8760 from a
    // tablet), where navigator.clipboard is unavailable.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
    ta.remove();
  }
  const orig = btn.textContent;
  btn.textContent = ok ? "コピーしました" : "コピーできませんでした";
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = orig;
    btn.disabled = false;
  }, 1500);
}

function copyButton(text) {
  const btn = mkButton("primary copy-btn", "コピー", () => copyText(text, btn));
  return btn;
}

function linkButton(link) {
  if (!link || !link.url) return null;
  const btn = mkButton("secondary link-btn", `${link.label_ja} ↗`, () => {
    window.open(link.url, "_blank", "noopener");
  });
  return btn;
}

function guideSection(no, titleText) {
  const sec = document.createElement("div");
  sec.className = "guide-section";
  const title = document.createElement("p");
  title.className = "guide-section-title";
  title.textContent = `${no}. ${titleText}`;
  sec.appendChild(title);
  return sec;
}

function codeRow(container, labelText, command) {
  if (labelText) {
    const label = document.createElement("div");
    label.className = "help";
    label.textContent = labelText;
    container.appendChild(label);
  }
  const row = document.createElement("div");
  row.className = "code-row";
  const code = document.createElement("code");
  code.className = "code-box";
  code.textContent = command;
  row.appendChild(code);
  row.appendChild(copyButton(command));
  container.appendChild(row);
}

function renderConnectResult(container, r) {
  container.innerHTML = "";
  const box = document.createElement("div");
  box.className = "connect-status " + (r.ok ? "ok" : "fail");
  box.textContent = r.ok
    ? "接続してpushしました 🎉 GitHub側にワークスペースが入っています。"
    : "接続できませんでした。" + (r.hint ? " " + r.hint : "");
  container.appendChild(box);
  if (r.output) {
    const details = document.createElement("details");
    if (!r.ok) details.open = true;
    const summary = document.createElement("summary");
    summary.textContent = "実行内容の詳細";
    details.appendChild(summary);
    const pre = document.createElement("div");
    pre.className = "log-output";
    pre.textContent = r.output;
    details.appendChild(pre);
    container.appendChild(details);
  }
}

async function renderClaudeSupportPanel(id, step, el) {
  let res;
  try {
    res = await api(`/api/steps/${id}/result`);
  } catch (err) {
    return;
  }
  if (!res.available) return;

  const links = step.guide_links || {};
  const box = document.createElement("div");
  box.className = "claude-guide-box";

  const head = document.createElement("p");
  head.className = "guide-head";
  head.textContent = "導入できました!あと少し、下の手順で仕上げてください。";
  box.appendChild(head);

  const introLinks = document.createElement("div");
  introLinks.className = "guide-links";
  [linkButton(links.about_claude), linkButton(links.github_signup)].forEach((b) => {
    if (b) introLinks.appendChild(b);
  });
  box.appendChild(introLinks);

  // 1. create the private repository
  const sec1 = guideSection(1, "GitHubで個人の「privateリポジトリ」を作成");
  const repoNote = document.createElement("p");
  repoNote.className = "help";
  repoNote.textContent =
    `リポジトリ名の例: ${res.repo_suggestion}(作業ログや記憶に内部情報が入るので、必ず private にしてください)`;
  sec1.appendChild(repoNote);
  const b1 = linkButton(links.new_repo);
  if (b1) sec1.appendChild(b1);
  box.appendChild(sec1);

  // 2. register the public key (masked on screen; copy fetches the full key)
  const sec2 = guideSection(2, "この公開鍵をGitHubに登録");
  if (res.pubkey_masked) {
    const row = document.createElement("div");
    row.className = "code-row";
    const code = document.createElement("code");
    code.className = "code-box pubkey";
    code.textContent = res.pubkey_masked;
    row.appendChild(code);
    const keyBtn = mkButton("primary copy-btn", "コピー", async () => {
      try {
        const r = await api(`/api/steps/${id}/pubkey`);
        await copyText(r.pubkey, keyBtn);
      } catch (err) {
        alert("公開鍵を取得できませんでした: " + err.message);
      }
    });
    row.appendChild(keyBtn);
    sec2.appendChild(row);
    const note = document.createElement("p");
    note.className = "help";
    note.textContent = "画面では一部を伏せています。「コピー」を押すと全文がクリップボードに入ります。";
    sec2.appendChild(note);
  } else {
    const p = document.createElement("p");
    p.className = "help";
    p.textContent = `公開鍵を読み取れませんでした。ターミナルで cat ${res.pubkey_path || "~/.ssh/id_ed25519.pub"} を実行して内容を登録してください。`;
    sec2.appendChild(p);
  }
  const b2 = linkButton(links.ssh_keys);
  if (b2) sec2.appendChild(b2);
  box.appendChild(sec2);

  // 3. connect the workspace to the repository (one button; manual fallback)
  const sec3 = guideSection(3, "ワークスペースをGitHubにつなぐ");
  const connectHelp = document.createElement("p");
  connectHelp.className = "help";
  connectHelp.textContent = "作ったリポジトリのURLを入れて「接続して送信」を押すと、接続と最初のpushまで自動で行います。";
  sec3.appendChild(connectHelp);

  const connectRow = document.createElement("div");
  connectRow.className = "code-row";
  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.className = "repo-input";
  urlInput.placeholder = `git@github.com:あなたのアカウント/${res.repo_suggestion}.git`;
  connectRow.appendChild(urlInput);
  const connectStatus = document.createElement("div");
  const connectBtn = mkButton("primary", "接続して送信", async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = "接続中...";
    connectStatus.innerHTML = "";
    try {
      const r = await api(`/api/steps/${id}/connect_repo`, {
        method: "POST",
        body: { repo_url: urlInput.value },
      });
      renderConnectResult(connectStatus, r);
    } catch (err) {
      renderConnectResult(connectStatus, { ok: false, output: "", hint: err.message });
    } finally {
      connectBtn.disabled = false;
      connectBtn.textContent = "接続して送信";
    }
  });
  connectRow.appendChild(connectBtn);
  sec3.appendChild(connectRow);
  sec3.appendChild(connectStatus);

  const manual = document.createElement("details");
  manual.className = "manual-fallback";
  const manualSummary = document.createElement("summary");
  manualSummary.textContent = "手動でやる場合(ターミナルでコピー&ペースト)";
  manual.appendChild(manualSummary);
  (res.connect_commands || []).forEach((c) => codeRow(manual, c.label_ja, c.command));
  sec3.appendChild(manual);
  box.appendChild(sec3);

  // 4. first login (interactive, so it stays a copy-paste command)
  const sec4 = guideSection(4, "Claude Codeを起動して初回ログイン");
  if (res.login_command) {
    codeRow(sec4, res.login_command.label_ja, res.login_command.command);
  }
  box.appendChild(sec4);

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.appendChild(mkButton("primary", "次へ", () => goToNextStep(id)));
  box.appendChild(actions);

  el.appendChild(box);
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

// --- completion celebration screen ------------------------------------------

function buildCelebrationPanel() {
  const completion = (state.data && state.data.completion) || {};
  const box = document.createElement("div");
  box.className = "celebration-box";

  const img = document.createElement("img");
  img.className = "celebration-petit";
  img.src = "/static/petit.png";
  img.alt = "";
  box.appendChild(img);

  const title = document.createElement("h2");
  title.className = "celebration-title";
  title.textContent = completion.title_ja || "🎉 セットアップ完了です!";
  box.appendChild(title);

  if (completion.subtitle_ja) {
    const subtitle = document.createElement("p");
    subtitle.className = "celebration-subtitle";
    subtitle.textContent = completion.subtitle_ja;
    box.appendChild(subtitle);
  }

  const actionsWrap = document.createElement("div");
  actionsWrap.className = "celebration-actions";
  (completion.next_actions || []).forEach((action) => {
    const btn = mkButton("primary", action.label_ja, () => {
      if (action.url) window.open(action.url, "_blank", "noopener");
    });
    actionsWrap.appendChild(btn);
  });
  box.appendChild(actionsWrap);

  return box;
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

  // The claude_support step renders a post-run guide panel (repo / key /
  // commands, each with copy buttons) instead of auto-advancing; the user
  // moves on via the panel's explicit "next" button.
  if (id === "claude_support" && step.status === "done") {
    renderClaudeSupportPanel(id, step, el);
  }

  // Celebrate once every step is done/skipped, shown below the last step's
  // own detail (its log/results stay visible above, e.g. the sensor check
  // list) so nothing about the final step's own status is hidden.
  const isLastStep = state.data.steps.length > 0 && state.data.steps[state.data.steps.length - 1].id === id;
  if (isLastStep && state.data.all_done) {
    el.appendChild(buildCelebrationPanel());
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
