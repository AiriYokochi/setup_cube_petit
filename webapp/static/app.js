// cube_petit_setup wizard frontend. Plain JS, no build step, no CDN.

const state = {
  data: null,
  selectedId: null,
  eventSource: null,
  updates: null, // /api/updates result: {self, robot} upstream status
};

// --- i18n -------------------------------------------------------------------
//
// Three sources of user-facing text, three rules:
//   1. steps.yaml data: *_ja / *_en key pairs -> L(obj, "title") picks by
//      language, falling back to _ja so a missing translation never blanks.
//   2. server-produced messages: {message, message_en} pairs -> pickMsg().
//   3. frontend-owned strings: the STR table below -> t("key", args...).
// The choice is stored in localStorage and defaults to the browser language.

const STR = {
  ja: {
    app_title: "Cube Petit セットアップ",
    mock_badge: "MOCK モード(疑似実行)",
    report_btn: "不具合を報告",
    placeholder: "左のリストからステップを選んでください。",
    status_done: "完了しました",
    status_running: "実行中...",
    status_interrupted: "中断されました(サーバーが途中で終了しました)。もう一度実行してください。",
    status_failed: (code) => `失敗しました (終了コード: ${code})`,
    status_pending: "未実行",
    status_skipped: "スキップしました",
    progress_steps: (n, total) => `${n} / ${total} ステップ`,
    badge_update: "更新あり",
    log_panel: "実行ログ",
    log_truncated: (n) => `(先頭 ${n} 行は省略)`,
    error: (msg) => `エラー: ${msg}`,
    run: "実行",
    run_again: "もう一度実行",
    skip: "スキップ",
    cancel_run: "中断",
    cancel_failed: (msg) => `中断に失敗しました: ${msg}`,
    ignore_pkg_title: "ビルドに失敗したパッケージ",
    ignore_pkg_note: (pkg) => `${pkg} はROSの標準配布(underlay)にも同じ名前で存在するため、無視して次に進めます。`,
    ignore_pkg_btn: "このパッケージを無視して次に進む",
    ignore_pkg_done: (pkg) => `${pkg} を無視するよう設定しました。「もう一度実行」で反映されます。`,
    ignore_pkg_failed: (msg) => `無視の設定に失敗しました: ${msg}`,
    reboot_ack: "確認しました(この後、機体を再起動してください)",
    rerun_note: "このステップの処理内容がアップデートで変わっています。「もう一度実行」で反映してください(再実行しても安全です)。",
    bt_none: "デバイスが見つかりませんでした。コントローラをペアリングモードにしてから、もう一度スキャンしてください。",
    bt_unnamed: "(名称不明)",
    bt_paired: " [ペア済み]",
    bt_connect: "接続",
    bt_connected: "接続済み",
    bt_connecting: "接続中...",
    bt_connected_suffix: " — 接続しました",
    bt_connect_failed: (d) => `接続に失敗しました: ${d}`,
    bt_done: "Bluetoothコントローラの接続が完了しました。",
    bt_scan: "スキャン",
    bt_scanning: "スキャン中...(数秒かかります)",
    bt_found: (n) => `${n}件のデバイスが見つかりました。`,
    next: "次へ",
    copy: "コピー",
    copied: "コピーしました",
    copy_failed: "コピーできませんでした",
    pubkey_fetch_failed: (msg) => `公開鍵を取得できませんでした: ${msg}`,
    copy_pubkey: "公開鍵をコピー",
    connect_ok: "接続してpushしました 🎉 GitHub側にワークスペースが入っています。",
    connect_fail: "接続できませんでした。",
    exec_details: "実行内容の詳細",
    precheck_all_ok: "すべてOKです。「接続して送信」で仕上げてください。",
    guide_head: "導入できました!あと少し、下の手順で仕上げてください。",
    guide_sec1: "GitHubで個人の「privateリポジトリ」を作成",
    guide_repo_note: (repo) => `リポジトリ名は ${repo} にしてください(作業ログや記憶に内部情報が入るので、必ず private にしてください)`,
    guide_repo_options: "作成画面では「Add a README file」にチェックを入れてください。License は Apache License 2.0 を選ぶのがおすすめです(CubePetit系リポジトリと同じ)。どちらも手順3の接続がそのまま取り込みます。",
    guide_sec2: "この公開鍵をGitHubに登録",
    guide_mask_note: "画面では一部を伏せています。「コピー」を押すと全文がクリップボードに入ります。",
    guide_pubkey_missing: (path) => `公開鍵を読み取れませんでした。ターミナルで cat ${path} を実行して内容を登録してください。`,
    guide_sec3: "ワークスペースをGitHubにつなぐ",
    guide_connect_help: "GitHubアカウント名(またはOrganization名)を入れて「接続して送信」を押すと、接続と最初のpushまで自動で行います。",
    guide_url_preview: (acc, repo) => `接続先: git@github.com:${acc}/${repo}.git`,
    guide_account_placeholder_token: "<アカウント名>",
    gate_hint: "先に「チェック」を押してください",
    gate_note: "先に「チェック」を押してください(3項目すべてOKになると送信できます)。",
    check_btn: "チェック",
    checking: "確認中...",
    connect_btn: "接続して送信",
    connecting: "接続中...",
    manual_fallback: "手動でやる場合(ターミナルでコピー&ペースト)",
    guide_sec4: "Claude Codeを起動して初回ログイン",
    term_btn: "claudeをターミナルで起動",
    term_starting: "起動中...",
    term_started: "起動しました。",
    term_failed: "起動できませんでした。",
    term_failed_manual: (msg) => `起動できませんでした: ${msg} 手動でターミナルを開いて、コピーしたコマンドを実行してください。`,
    term_note: "※この機体の画面にターミナルが開きます(タブレットから操作している場合は機体の画面を見てください)。",
    check_run: "チェック実行",
    check_again: "もう一度チェック",
    check_ok_badge: "✓ 成功",
    check_ng_badge: "✗ 失敗",
    changes: "変更内容を見る",
    upd_release: (what, tag) => `${what}に新しいリリース ${tag} があります`,
    upd_behind: (what, n) => `${what}に更新があります(${n}件)`,
    upd_self_name: "セットアップツール",
    upd_robot_name: "ロボットのソフトウェア",
    upd_btn: "アップデート",
    updating: "更新中...",
    upd_latest: "すでに最新のリリースです。",
    upd_failed: (out) => `更新できませんでした: ${out}`,
    upd_failed_net: (msg) => `更新できませんでした(通信エラー): ${msg} — もう一度お試しください。`,
    upd_applying: "アップデートを適用しています。自動で再起動します…",
    upd_restarted: "再起動しました。画面を読み込み直します…",
    upd_no_restart: "自動再起動を確認できませんでした。ターミナルで run.sh を手動で起動し直してください。",
    reload_page: "ページを再読み込み",
    robot_upd_suffix: "。「ロボットソフトをアップデート」を押すと、取得して再ビルドします。",
    robot_upd_btn: "ロボットソフトをアップデート",
    installed_hint: "✓ インストール済みです(もう一度入れ直す場合はチェックしてください)",
    report_title: "不具合を報告",
    report_symptom_label: "どんな不具合ですか?(必須。1行目がタイトルになります)",
    report_symptom_placeholder: "例: ステップ7のデバイス設定を実行すると、スピーカーの設定で失敗します",
    report_diag_label: "自動で添付される診断情報(編集できます。個人情報が無いか確認してください)",
    report_loading: "読み込み中...",
    report_diag_failed: "(診断情報を取得できませんでした)",
    report_note: "「GitHubで報告する」には無料のGitHubアカウントが必要です。投稿画面で内容を確認してから送信してください。GitHubを使わない場合は「内容をコピー」でメール等に貼り付けられます。",
    report_gh_btn: "GitHubで報告する",
    report_copy_btn: "内容をコピー",
    close: "閉じる",
    report_default_title: "セットアップで不具合",
    report_no_symptom: "(症状未記入)",
    report_sec_symptom: "症状",
    report_sec_diag: "診断情報",
    report_trimmed: "(長いため以降を省略)",
    notice_none: "✅ アップデート完了。再実行が必要なステップはありません。これで完了です。",
    notice_some: "✅ アップデート完了。このアップデートで再実行が必要なステップ:",
  },
  en: {
    app_title: "Cube Petit Setup",
    mock_badge: "MOCK mode (simulated)",
    report_btn: "Report a problem",
    placeholder: "Pick a step from the list on the left.",
    status_done: "Done",
    status_running: "Running...",
    status_interrupted: "Interrupted (the server stopped mid-run). Please run it again.",
    status_failed: (code) => `Failed (exit code: ${code})`,
    status_pending: "Not run yet",
    status_skipped: "Skipped",
    progress_steps: (n, total) => `${n} / ${total} steps`,
    badge_update: "Update",
    log_panel: "Run log",
    log_truncated: (n) => `(first ${n} lines omitted)`,
    error: (msg) => `Error: ${msg}`,
    run: "Run",
    run_again: "Run again",
    skip: "Skip",
    cancel_run: "Stop",
    cancel_failed: (msg) => `Failed to stop: ${msg}`,
    ignore_pkg_title: "Packages that failed to build",
    ignore_pkg_note: (pkg) => `${pkg} is also provided by the ROS underlay under the same name, so it can be skipped.`,
    ignore_pkg_btn: "Ignore this package and continue",
    ignore_pkg_done: (pkg) => `${pkg} will be skipped from now on. Press "Run again" to apply it.`,
    ignore_pkg_failed: (msg) => `Failed to set ignore: ${msg}`,
    reboot_ack: "Got it (please reboot the robot after this)",
    rerun_note: "This step's behavior changed in an update. Press \"Run again\" to apply it (re-running is safe).",
    bt_none: "No devices found. Put the controller into pairing mode and scan again.",
    bt_unnamed: "(unnamed)",
    bt_paired: " [paired]",
    bt_connect: "Connect",
    bt_connected: "Connected",
    bt_connecting: "Connecting...",
    bt_connected_suffix: " — connected",
    bt_connect_failed: (d) => `Connection failed: ${d}`,
    bt_done: "The Bluetooth controller is connected.",
    bt_scan: "Scan",
    bt_scanning: "Scanning... (takes a few seconds)",
    bt_found: (n) => `${n} device(s) found.`,
    next: "Next",
    copy: "Copy",
    copied: "Copied",
    copy_failed: "Copy failed",
    pubkey_fetch_failed: (msg) => `Could not fetch the public key: ${msg}`,
    copy_pubkey: "Copy public key",
    connect_ok: "Connected and pushed 🎉 Your workspace is now on GitHub.",
    connect_fail: "Could not connect.",
    exec_details: "Execution details",
    precheck_all_ok: "All good. Press \"Connect & push\" to finish up.",
    guide_head: "Installed! Just a few more steps below to finish.",
    guide_sec1: "Create a personal private repository on GitHub",
    guide_repo_note: (repo) => `Name the repository ${repo} (worklogs and memory hold internal details, so make sure it is private).`,
    guide_repo_options: "On the create page, tick \"Add a README file\". Apache License 2.0 is the recommended license (same as the CubePetit repositories). Both get merged in by step 3.",
    guide_sec2: "Register this public key on GitHub",
    guide_mask_note: "Part of the key is hidden on screen. \"Copy\" puts the full key on your clipboard.",
    guide_pubkey_missing: (path) => `Could not read the public key. Run cat ${path} in a terminal and register its contents.`,
    guide_sec3: "Connect the workspace to GitHub",
    guide_connect_help: "Enter your GitHub account (or organization) name and press \"Connect & push\" — the connection and the first push happen automatically.",
    guide_url_preview: (acc, repo) => `Target: git@github.com:${acc}/${repo}.git`,
    guide_account_placeholder_token: "<account>",
    gate_hint: "Press \"Check\" first",
    gate_note: "Press \"Check\" first (all three items must pass before you can push).",
    check_btn: "Check",
    checking: "Checking...",
    connect_btn: "Connect & push",
    connecting: "Connecting...",
    manual_fallback: "Do it manually (copy & paste in a terminal)",
    guide_sec4: "Start Claude Code and log in",
    term_btn: "Open claude in a terminal",
    term_starting: "Starting...",
    term_started: "Started.",
    term_failed: "Could not start.",
    term_failed_manual: (msg) => `Could not start: ${msg} Open a terminal yourself and run the copied command.`,
    term_note: "* A terminal opens on the robot's own screen (if you are on a tablet, look at the robot).",
    check_run: "Run check",
    check_again: "Check again",
    check_ok_badge: "✓ OK",
    check_ng_badge: "✗ FAIL",
    changes: "See what changed",
    upd_release: (what, tag) => `A new release ${tag} of the ${what} is available`,
    upd_behind: (what, n) => `The ${what} has updates (${n} commits)`,
    upd_self_name: "setup tool",
    upd_robot_name: "robot software",
    upd_btn: "Update",
    updating: "Updating...",
    upd_latest: "Already on the latest release.",
    upd_failed: (out) => `Update failed: ${out}`,
    upd_failed_net: (msg) => `Update failed (network error): ${msg} — please try again.`,
    upd_applying: "Applying the update. The server restarts automatically…",
    upd_restarted: "Restarted. Reloading the page…",
    upd_no_restart: "Could not confirm the automatic restart. Please re-run run.sh in a terminal.",
    reload_page: "Reload page",
    robot_upd_suffix: ". Press \"Update robot software\" to pull and rebuild.",
    robot_upd_btn: "Update robot software",
    installed_hint: "✓ Already installed (tick the box to reinstall)",
    report_title: "Report a problem",
    report_symptom_label: "What went wrong? (required — the first line becomes the title)",
    report_symptom_placeholder: "e.g. Running step 7 (Device setup) fails at the speaker configuration",
    report_diag_label: "Diagnostics attached automatically (editable — check for anything personal)",
    report_loading: "Loading...",
    report_diag_failed: "(could not fetch diagnostics)",
    report_note: "\"Report on GitHub\" needs a free GitHub account; review the pre-filled issue before submitting. Without GitHub, use \"Copy contents\" and paste into an email.",
    report_gh_btn: "Report on GitHub",
    report_copy_btn: "Copy contents",
    close: "Close",
    report_default_title: "Setup problem",
    report_no_symptom: "(no symptom given)",
    report_sec_symptom: "Symptom",
    report_sec_diag: "Diagnostics",
    report_trimmed: "(trimmed for length)",
    notice_none: "✅ Update complete. No steps need a re-run — you're all set.",
    notice_some: "✅ Update complete. Steps that need a re-run after this update:",
  },
};

let LANG = (() => {
  const saved = localStorage.getItem("cps_lang");
  if (saved === "ja" || saved === "en") return saved;
  return (navigator.language || "ja").toLowerCase().startsWith("ja") ? "ja" : "en";
})();

function t(key, ...args) {
  let v = (STR[LANG] || STR.ja)[key];
  if (v === undefined) v = STR.ja[key];
  return typeof v === "function" ? v(...args) : v;
}

// steps.yaml fields: pick <base>_en / <base>_ja by language, _ja fallback.
function L(obj, base) {
  if (!obj) return "";
  if (LANG === "en" && obj[base + "_en"]) return obj[base + "_en"];
  return obj[base + "_ja"] ?? obj[base + "_en"] ?? "";
}

// Server-produced dual-language messages ({message, message_en} etc.).
function pickMsg(obj, base = "message") {
  if (!obj) return "";
  if (LANG === "en" && obj[base + "_en"]) return obj[base + "_en"];
  return obj[base] ?? "";
}

function linkUrl(link) {
  return (LANG === "en" && link.url_en) || link.url;
}

function applyStaticTexts() {
  document.documentElement.lang = LANG;
  document.title = t("app_title");
  document.getElementById("app-title").textContent = t("app_title");
  document.getElementById("mock-badge").textContent = t("mock_badge");
  document.getElementById("report-button").textContent = t("report_btn");
  const ph = document.getElementById("placeholder-text");
  if (ph) ph.textContent = t("placeholder");
  const toggle = document.getElementById("lang-toggle");
  toggle.textContent = LANG === "ja" ? "EN" : "日本語";
}

function setLang(l) {
  LANG = l;
  localStorage.setItem("cps_lang", l);
  applyStaticTexts();
  if (state.data) {
    renderStepList();
    if (state.selectedId) renderDetail(state.selectedId);
  }
  renderUpdateBanner();
  const pu = document.getElementById("post-update-notice");
  if (pu && !pu.hidden) renderPostUpdateNotice();
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
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
      return t("status_done");
    case "running":
      return t("status_running");
    case "failed":
      return exitCode === null || exitCode === undefined
        ? t("status_interrupted")
        : t("status_failed", exitCode);
    case "skipped":
      return t("status_skipped");
    default:
      return t("status_pending");
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
  document.getElementById("progress-text").textContent = t("progress_steps", finished, total);
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
      `<span class="step-title">${L(s, "title")}</span>` +
      (s.needs_rerun ? `<span class="step-badge">${t("badge_update")}</span>` : "");
    btn.addEventListener("click", () => selectStep(s.id));
    nav.appendChild(btn);
  });
}

function selectStep(id) {
  state.selectedId = id;
  closeStream();
  // A render failure for one step must never leave the whole sidebar dead:
  // log it and keep the click handlers alive.
  try {
    renderStepList();
    renderDetail(id);
  } catch (err) {
    console.error("render failed for step", id, err);
  }
}

function closeStream() {
  if (state.eventSource) {
    if (state.eventSource._cancelFlush) state.eventSource._cancelFlush();
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
  summary.textContent = t("log_panel");
  const pre = document.createElement("div");
  pre.className = "log-output";
  details.appendChild(summary);
  details.appendChild(pre);
  return details;
}

// Cap on displayed log lines: a real ros_setup log easily exceeds 10k lines
// and rendering all of it is pointless -- the tail is what matters.
const MAX_LOG_LINES = 1500;

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

  // Batch incoming lines into one DOM update per 100ms. The naive
  // one-update-per-line version (textContent += line; scrollTop = ...)
  // rebuilt the whole text node AND forced a layout for every single line;
  // replaying a real 10k-line apt/colcon log froze the page for minutes,
  // which is what "clicking steps stops working" was (verified with a
  // 12k-line log: the page wedged until the tab was killed).
  const lines = [];
  let truncated = 0;
  let flushTimer = null;
  const flush = () => {
    flushTimer = null;
    const head = truncated > 0 ? t("log_truncated", truncated) + "\n" : "";
    pre.textContent = head + lines.join("\n") + (lines.length ? "\n" : "");
    pre.scrollTop = pre.scrollHeight;
  };
  es._cancelFlush = () => {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  };
  es.onmessage = (ev) => {
    lines.push(ev.data);
    if (lines.length > MAX_LOG_LINES) {
      truncated += lines.length - MAX_LOG_LINES;
      lines.splice(0, lines.length - MAX_LOG_LINES);
    }
    if (flushTimer === null) flushTimer = setTimeout(flush, 100);
  };
  es.addEventListener("end", async () => {
    es.close();
    es._cancelFlush();
    flush(); // make sure the final tail is on screen
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
// device_check is here too: udev_check.sh always exits 0 (NG items are
// meant to be reviewable, not auto-skipped -- see steps.yaml), so without
// this a run that only passed 6/11 would still jump straight to the next
// step the instant it finished.
const NO_AUTO_ADVANCE = new Set(["claude_support", "device_check"]);

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
  msg.textContent = L(precheck, "message");
  box.appendChild(msg);

  const ul = document.createElement("ul");
  (precheck.existing || []).forEach((p) => {
    const li = document.createElement("li");
    li.textContent = L(p, "label");
    ul.appendChild(li);
  });
  box.appendChild(ul);

  const choicesDiv = document.createElement("div");
  choicesDiv.className = "choices";
  precheck.choices.forEach((choice) => {
    const btn = mkButton(choice.id === "clean" ? "danger" : "secondary", L(choice, "label"), async () => {
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
        alert(t("error", err.message));
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
    p.textContent = t("bt_none");
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
    info.textContent = `${dev.name || t("bt_unnamed")} (${dev.mac})` + (dev.paired ? t("bt_paired") : "");
    li.appendChild(info);

    const btn = mkButton("primary", dev.connected ? t("bt_connected") : t("bt_connect"), async () => {
      btn.disabled = true;
      btn.textContent = t("bt_connecting");
      try {
        const res = await api("/api/bluetooth/connect", { method: "POST", body: { mac: dev.mac } });
        if (res.ok) {
          btn.textContent = t("bt_connected");
          info.textContent += t("bt_connected_suffix");
          await api(`/api/steps/${stepId}/complete`, { method: "POST" });
          await loadState();
        } else {
          btn.disabled = false;
          btn.textContent = t("bt_connect");
          alert(t("bt_connect_failed", res.detail || ""));
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = t("bt_connect");
        alert(t("error", err.message));
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
    doneBox.textContent = t("bt_done");
    el.appendChild(doneBox);

    const nextBtn = mkButton("primary", t("next"), () => goToNextStep(id));
    actions.appendChild(nextBtn);
  }

  const scanStatus = document.createElement("p");
  scanStatus.className = "help";
  el.appendChild(scanStatus);

  const deviceBox = document.createElement("div");
  deviceBox.className = "bt-devices";
  el.appendChild(deviceBox);

  const scanBtn = mkButton("primary", t("bt_scan"), async () => {
    scanBtn.disabled = true;
    scanStatus.textContent = t("bt_scanning");
    try {
      const res = await api("/api/bluetooth/scan", { method: "POST" });
      renderBtDeviceList(deviceBox, res.devices, id);
      scanStatus.textContent = t("bt_found", res.devices.length);
    } catch (err) {
      scanStatus.textContent = t("error", err.message);
    } finally {
      scanBtn.disabled = false;
    }
  });
  actions.appendChild(scanBtn);

  if (step.skippable && step.status !== "done") {
    const skipBtn = mkButton("secondary", t("skip"), async () => {
      await api(`/api/steps/${id}/skip`, { method: "POST" });
      await loadState();
    });
    actions.appendChild(skipBtn);
  }

  // Show already-known devices (no fresh scan) as soon as the step opens.
  // Guard: by the time this resolves the user may have moved to another
  // step, in which case deviceBox is detached -- skip quietly.
  api("/api/bluetooth/devices")
    .then((res) => {
      if (deviceBox.isConnected) renderBtDeviceList(deviceBox, res.devices, id);
    })
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
  btn.textContent = ok ? t("copied") : t("copy_failed");
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = orig;
    btn.disabled = false;
  }, 1500);
}

function copyButton(text) {
  const btn = mkButton("primary copy-btn", t("copy"), () => copyText(text, btn));
  return btn;
}

function linkButton(link) {
  if (!link || !link.url) return null;
  const btn = mkButton("secondary link-btn", `${L(link, "label")} ↗`, () => {
    window.open(linkUrl(link), "_blank", "noopener");
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

// Recovery actions shown next to any SSH-authentication failure: copy the
// public key again and jump straight to GitHub's key registration page.
function sshRecoveryActions(id, links) {
  const row = document.createElement("div");
  row.className = "guide-links ssh-recovery";
  const keyBtn = mkButton("primary copy-btn", t("copy_pubkey"), async () => {
    try {
      const r = await api(`/api/steps/${id}/pubkey`);
      await copyText(r.pubkey, keyBtn);
    } catch (err) {
      alert(t("pubkey_fetch_failed", err.message));
    }
  });
  row.appendChild(keyBtn);
  const b = linkButton((links || {}).ssh_keys);
  if (b) row.appendChild(b);
  return row;
}

function renderConnectResult(container, r, id, links) {
  container.innerHTML = "";
  const box = document.createElement("div");
  box.className = "connect-status " + (r.ok ? "ok" : "fail");
  const hint = pickMsg(r, "hint");
  box.textContent = r.ok
    ? t("connect_ok")
    : t("connect_fail") + (hint ? " " + hint : "");
  if (!r.ok && r.ssh_issue) {
    box.appendChild(sshRecoveryActions(id, links));
  }
  container.appendChild(box);
  if (r.output) {
    const details = document.createElement("details");
    if (!r.ok) details.open = true;
    const summary = document.createElement("summary");
    summary.textContent = t("exec_details");
    details.appendChild(summary);
    const pre = document.createElement("div");
    pre.className = "log-output";
    pre.textContent = r.output;
    details.appendChild(pre);
    container.appendChild(details);
  }
}

function renderPrecheckRepoResult(container, res, id, links) {
  container.innerHTML = "";
  const ul = document.createElement("ul");
  ul.className = "check-list";
  res.items.forEach((item) => {
    const li = document.createElement("li");
    const warn = item.warn || item.ok === null;
    li.className = "check-item " + (warn ? "warn" : item.ok ? "ok" : "ng");
    const mark = document.createElement("span");
    mark.className = "check-mark";
    mark.textContent = warn ? "!" : item.ok ? "✓" : "✗";
    li.appendChild(mark);
    const label = document.createElement("span");
    label.className = "check-label";
    label.textContent = pickMsg(item);
    li.appendChild(label);
    if (item.ssh_issue) {
      li.appendChild(sshRecoveryActions(id, links));
    }
    ul.appendChild(li);
  });
  container.appendChild(ul);
  if (res.all_ok) {
    const p = document.createElement("p");
    p.className = "help precheck-all-ok";
    p.textContent = t("precheck_all_ok");
    container.appendChild(p);
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
  // The user may have clicked to another step while the fetch was in
  // flight; #step-detail is a singleton, so appending now would inject
  // this panel into whatever step is currently shown.
  if (state.selectedId !== id || !el.isConnected) return;

  const links = step.guide_links || {};
  const box = document.createElement("div");
  box.className = "claude-guide-box";

  const head = document.createElement("p");
  head.className = "guide-head";
  head.textContent = t("guide_head");
  box.appendChild(head);

  const introLinks = document.createElement("div");
  introLinks.className = "guide-links";
  [linkButton(links.about_claude), linkButton(links.github_signup)].forEach((b) => {
    if (b) introLinks.appendChild(b);
  });
  box.appendChild(introLinks);

  // 1. create the private repository
  const sec1 = guideSection(1, t("guide_sec1"));
  const repoNote = document.createElement("p");
  repoNote.className = "help";
  repoNote.textContent = t("guide_repo_note", res.repo_suggestion);
  sec1.appendChild(repoNote);
  const repoOptions = document.createElement("p");
  repoOptions.className = "help";
  repoOptions.textContent = t("guide_repo_options");
  sec1.appendChild(repoOptions);
  const b1 = linkButton(links.new_repo);
  if (b1) sec1.appendChild(b1);
  box.appendChild(sec1);

  // 2. register the public key (masked on screen; copy fetches the full key)
  const sec2 = guideSection(2, t("guide_sec2"));
  if (res.pubkey_masked) {
    const row = document.createElement("div");
    row.className = "code-row";
    const code = document.createElement("code");
    code.className = "code-box pubkey";
    code.textContent = res.pubkey_masked;
    row.appendChild(code);
    const keyBtn = mkButton("primary copy-btn", t("copy"), async () => {
      try {
        const r = await api(`/api/steps/${id}/pubkey`);
        await copyText(r.pubkey, keyBtn);
      } catch (err) {
        alert(t("pubkey_fetch_failed", err.message));
      }
    });
    row.appendChild(keyBtn);
    sec2.appendChild(row);
    const note = document.createElement("p");
    note.className = "help";
    note.textContent = t("guide_mask_note");
    sec2.appendChild(note);
  } else {
    const p = document.createElement("p");
    p.className = "help";
    p.textContent = t("guide_pubkey_missing", res.pubkey_path || "~/.ssh/id_ed25519.pub");
    sec2.appendChild(p);
  }
  const b2 = linkButton(links.ssh_keys);
  if (b2) sec2.appendChild(b2);
  box.appendChild(sec2);

  // 3. connect the workspace to the repository (one button; manual fallback)
  const sec3 = guideSection(3, t("guide_sec3"));
  const connectHelp = document.createElement("p");
  connectHelp.className = "help";
  connectHelp.textContent = t("guide_connect_help");
  sec3.appendChild(connectHelp);

  const connectRow = document.createElement("div");
  connectRow.className = "code-row";
  const accountInput = document.createElement("input");
  accountInput.type = "text";
  accountInput.className = "repo-input";
  accountInput.placeholder = "your-account";
  connectRow.appendChild(accountInput);
  const connectStatus = document.createElement("div");

  // Live preview of the URL that will be used, so the user can eyeball the
  // destination before pressing the button. The repo name is fixed to
  // <robot_namespace>_claude -- only the account is typed in.
  const urlPreview = document.createElement("p");
  urlPreview.className = "help url-preview";
  const updatePreview = () => {
    const acc = accountInput.value.trim() || t("guide_account_placeholder_token");
    urlPreview.textContent = t("guide_url_preview", acc, res.repo_suggestion);
  };
  updatePreview();
  accountInput.addEventListener("input", () => {
    updatePreview();
    // Editing the account invalidates any previous check result.
    precheckPassed = false;
    precheckStatus.innerHTML = "";
    applyGate();
  });

  const precheckStatus = document.createElement("div");

  // The connect button stays disabled until a pre-connect check has passed
  // all three items; editing the account re-requires a check.
  let precheckPassed = false;
  const gateNote = document.createElement("p");
  gateNote.className = "help gate-note";
  gateNote.textContent = t("gate_note");

  const applyGate = () => {
    connectBtn.disabled = !precheckPassed;
    connectBtn.title = precheckPassed ? "" : t("gate_hint");
    gateNote.hidden = precheckPassed;
  };

  const checkBtn = mkButton("secondary", t("check_btn"), async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = t("checking");
    precheckStatus.innerHTML = "";
    try {
      const r = await api(`/api/steps/${id}/precheck_repo`, {
        method: "POST",
        body: { account: accountInput.value, lang: LANG },
      });
      renderPrecheckRepoResult(precheckStatus, r, id, links);
      precheckPassed = !!r.all_ok;
    } catch (err) {
      renderConnectResult(precheckStatus, { ok: false, output: "", hint: err.message }, id, links);
      precheckPassed = false;
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = t("check_btn");
      applyGate();
    }
  });
  connectRow.appendChild(checkBtn);

  const connectBtn = mkButton("primary", t("connect_btn"), async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = t("connecting");
    connectStatus.innerHTML = "";
    try {
      const r = await api(`/api/steps/${id}/connect_repo`, {
        method: "POST",
        body: { account: accountInput.value, lang: LANG },
      });
      renderConnectResult(connectStatus, r, id, links);
    } catch (err) {
      renderConnectResult(connectStatus, { ok: false, output: "", hint: err.message }, id, links);
    } finally {
      connectBtn.disabled = false;
      connectBtn.textContent = t("connect_btn");
    }
  });
  connectRow.appendChild(connectBtn);
  applyGate();
  sec3.appendChild(connectRow);
  sec3.appendChild(urlPreview);
  sec3.appendChild(gateNote);
  sec3.appendChild(precheckStatus);
  sec3.appendChild(connectStatus);

  const manual = document.createElement("details");
  manual.className = "manual-fallback";
  const manualSummary = document.createElement("summary");
  manualSummary.textContent = t("manual_fallback");
  manual.appendChild(manualSummary);
  (res.connect_commands || []).forEach((c) => codeRow(manual, L(c, "label"), c.command));
  sec3.appendChild(manual);
  box.appendChild(sec3);

  // 4. first login: one-click terminal on the robot's screen, with the
  // copy-paste command kept as the manual alternative
  const sec4 = guideSection(4, t("guide_sec4"));
  const termStatus = document.createElement("p");
  termStatus.className = "help";
  const termBtn = mkButton("primary", t("term_btn"), async () => {
    termBtn.disabled = true;
    termStatus.classList.remove("term-fail");
    termStatus.textContent = t("term_starting");
    try {
      const r = await api(`/api/steps/${id}/open_terminal`, { method: "POST", body: { lang: LANG } });
      termStatus.textContent = pickMsg(r) || (r.ok ? t("term_started") : t("term_failed"));
      termStatus.classList.toggle("term-fail", !r.ok);
    } catch (err) {
      termStatus.textContent = t("term_failed_manual", err.message);
      termStatus.classList.add("term-fail");
    } finally {
      termBtn.disabled = false;
    }
  });
  const termRow = document.createElement("div");
  termRow.className = "guide-links";
  termRow.appendChild(termBtn);
  sec4.appendChild(termRow);
  const termNote = document.createElement("p");
  termNote.className = "help";
  termNote.textContent = t("term_note");
  sec4.appendChild(termNote);
  sec4.appendChild(termStatus);
  if (res.login_command) {
    codeRow(sec4, L(res.login_command, "label"), res.login_command.command);
  }
  box.appendChild(sec4);

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.appendChild(mkButton("primary", t("next"), () => goToNextStep(id)));
  box.appendChild(actions);

  el.appendChild(box);
}

// --- sensor connection check (step 8) ---------------------------------------

function checkItemEl(item) {
  const li = document.createElement("li");
  li.className = "check-item " + (item.ok ? "ok" : "ng");
  const mark = document.createElement("span");
  mark.className = "check-mark check-badge";
  mark.textContent = item.ok ? t("check_ok_badge") : t("check_ng_badge");
  li.appendChild(mark);
  const label = document.createElement("span");
  label.className = "check-label";
  // Japanese: translated form ("IMU(姿勢センサ): データがきています…") when the
  // server recognized the line, raw text as fallback. English: the check
  // script's own output is already English, so show it as-is.
  const translated = LANG !== "en" && item.label_ja;
  label.textContent = translated ? `${item.label_ja}: ${item.message_ja}` : item.label;
  li.appendChild(label);
  const detail = LANG === "en" ? item.detail_en : item.detail;
  if (!item.ok && detail) {
    const hint = document.createElement("div");
    hint.className = "check-hint";
    hint.textContent = detail;
    li.appendChild(hint);
  }
  return li;
}

async function loadCheckResult(id, container, statusEl) {
  try {
    const res = await api(`/api/steps/${id}/result`);
    if (!container.isConnected) return; // user already moved to another step
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

  const runBtn = mkButton("primary", step.status === "pending" ? t("check_run") : t("check_again"), async () => {
    runBtn.disabled = true;
    try {
      await api(`/api/steps/${id}/run`, { method: "POST" });
      await loadState();
    } catch (err) {
      alert(t("error", err.message));
    }
  });
  runBtn.disabled = running;
  actions.appendChild(runBtn);

  // No auto-advance for this step (see NO_AUTO_ADVANCE) -- offer an
  // explicit way forward once a check has actually finished, same as the
  // bluetooth step.
  if (step.status === "done") {
    actions.appendChild(mkButton("primary", t("next"), () => goToNextStep(id)));
  }

  loadCheckResult(id, resultBox, statusEl);
}

// --- update banner (feature v1) ---------------------------------------------

// Release notes (the tag's annotation message) when available, commit
// summaries otherwise.
function changeList(status) {
  const lines = (status.notes && status.notes.length) ? status.notes : (status.commits || []);
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = t("changes");
  details.appendChild(summary);
  const ul = document.createElement("ul");
  ul.className = "update-commits";
  lines.forEach((c) => {
    const li = document.createElement("li");
    li.textContent = c;
    ul.appendChild(li);
  });
  details.appendChild(ul);
  return details;
}

function updateHeadline(whatKey, status) {
  const what = t(whatKey);
  return status.tag
    ? t("upd_release", what, status.tag)
    : t("upd_behind", what, status.behind);
}

async function loadUpdates() {
  try {
    state.updates = await api("/api/updates");
  } catch (e) {
    state.updates = null;
  }
  renderUpdateBanner();
  // needs_rerun / the ros_setup update button depend on this data too.
  if (state.selectedId) renderDetail(state.selectedId);
}

function renderUpdateBanner() {
  const banner = document.getElementById("update-banner");
  const self = state.updates && state.updates.self;
  if (!self || !self.behind) {
    banner.hidden = true;
    banner.innerHTML = "";
    return;
  }
  banner.hidden = false;
  banner.innerHTML = "";

  const text = document.createElement("span");
  text.className = "update-banner-text";
  text.textContent = updateHeadline("upd_self_name", self);
  banner.appendChild(text);

  banner.appendChild(changeList(self));

  const status = document.createElement("span");
  status.className = "update-banner-status";

  const btn = mkButton("primary", t("upd_btn"), async () => {
    btn.disabled = true;
    status.textContent = t("updating");
    try {
      // Time-box the request: the server may exit for its restart while this
      // request is in flight, and a fetch left pending forever would strand
      // the banner on 更新中 with no way out.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 15000);
      let r;
      try {
        r = await api("/api/updates/self", { method: "POST", signal: abort.signal });
      } finally {
        clearTimeout(timer);
      }
      if (r.ok && r.restarting) {
        btn.remove();
        await waitForRestart(status);
      } else if (r.ok) {
        status.textContent = pickMsg(r, "output") || t("upd_latest");
        btn.remove();
      } else {
        status.textContent = t("upd_failed", pickMsg(r, "output") || "");
        btn.disabled = false;
      }
    } catch (err) {
      // The request failed -- but the server may have applied the update and
      // exited before answering. Probe once: if it is already down, treat
      // this as the normal restart path; if it is still up, it never
      // restarted and this was a real error.
      const alive = await api("/api/state").then(() => true).catch(() => false);
      if (!alive) {
        btn.remove();
        await waitForRestart(status);
      } else {
        status.textContent = t("upd_failed_net", err.message);
        btn.disabled = false;
      }
    }
  });
  banner.appendChild(btn);
  banner.appendChild(status);
}

// After a self-update the server exits and run.sh's supervisor loop starts
// it again on the new code. Wait out the gap, then reload onto the new UI.
async function waitForRestart(status) {
  status.textContent = t("upd_applying");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(3000); // let the old server actually exit first
  for (let i = 0; i < 60; i++) {
    try {
      await api("/api/state");
      status.textContent = t("upd_restarted");
      // Survives the reload below: init() sees it and shows the
      // "which steps need a re-run" summary on the new version.
      sessionStorage.setItem("cps_just_updated", "1");
      location.reload();
      return;
    } catch (e) {
      // server still down -- keep waiting
    }
    await sleep(1000);
  }
  status.textContent = t("upd_no_restart");
  // Escape hatch: never leave the user without a clickable way forward.
  const reloadBtn = mkButton("secondary", t("reload_page"), () => location.reload());
  status.insertAdjacentElement("afterend", reloadBtn);
}

// The ros_setup step gets its own "update the robot software" action when
// the robot source is behind upstream: pull + rebuild, streamed like a run.
function renderRobotUpdate(id, el, actions) {
  const robot = state.updates && state.updates.robot;
  if (!robot || !robot.behind) return;

  const box = document.createElement("div");
  box.className = "warning-box";
  box.textContent = updateHeadline("upd_robot_name", robot) + t("robot_upd_suffix");
  box.appendChild(changeList(robot));
  el.insertBefore(box, actions);

  const btn = mkButton("primary", t("robot_upd_btn"), async () => {
    btn.disabled = true;
    try {
      const res = await api("/api/updates/robot", { method: "POST" });
      await loadState();
      attachStream(res.run_key, id, { reloadOnEnd: true });
    } catch (err) {
      btn.disabled = false;
      alert(t("error", err.message));
    }
  });
  actions.appendChild(btn);
}

// --- ros_setup: recover from a single failed package (COLCON_IGNORE) --------

function renderFailedPackages(id, el, actions) {
  api("/api/steps/ros_setup/failed_packages")
    .then((res) => {
      const ignorable = (res.packages || []).filter((p) => p.ignorable && !p.already_ignored);
      if (!ignorable.length) return;

      const box = document.createElement("div");
      box.className = "warning-box";
      const title = document.createElement("div");
      title.textContent = t("ignore_pkg_title");
      box.appendChild(title);

      ignorable.forEach((p) => {
        const row = document.createElement("div");
        row.textContent = t("ignore_pkg_note", p.package);
        box.appendChild(row);

        const btn = mkButton("secondary", t("ignore_pkg_btn"), async () => {
          btn.disabled = true;
          try {
            await api("/api/steps/ros_setup/ignore_package", {
              method: "POST",
              body: { package: p.package },
            });
            row.textContent = t("ignore_pkg_done", p.package);
          } catch (err) {
            alert(t("ignore_pkg_failed", err.message));
            btn.disabled = false;
          }
        });
        box.appendChild(btn);
      });

      el.insertBefore(box, actions);
    })
    .catch(() => {});
}

// --- installed-tool detection (dev_tools) ------------------------------------

function applyInstalledInfo(id, boolRows) {
  // Only steps that declare detect_cmd on some input need the probe at all.
  if (!Object.keys(boolRows).length) return;
  api(`/api/steps/${id}/installed`)
    .then((res) => {
      if (state.selectedId !== id) return;
      Object.entries(res.installed || {}).forEach(([inputId, installed]) => {
        const row = boolRows[inputId];
        if (!row || !installed || !row.row.isConnected) return;
        // Already installed: default the checkbox to OFF (checking it means
        // "reinstall") and say so.
        row.input.checked = false;
        const hint = document.createElement("div");
        hint.className = "help bool-help installed-hint";
        hint.textContent = t("installed_hint");
        row.row.appendChild(hint);
      });
    })
    .catch(() => {});
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
  title.textContent = L(completion, "title") || "🎉";
  box.appendChild(title);

  const subtitle_text = L(completion, "subtitle");
  if (subtitle_text) {
    const subtitle = document.createElement("p");
    subtitle.className = "celebration-subtitle";
    subtitle.textContent = subtitle_text;
    box.appendChild(subtitle);
  }

  const actionsWrap = document.createElement("div");
  actionsWrap.className = "celebration-actions";
  (completion.next_actions || []).forEach((action) => {
    const btn = mkButton("primary", L(action, "label"), () => {
      if (action.url) window.open(linkUrl(action), "_blank", "noopener");
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
  h2.textContent = L(step, "title");
  el.appendChild(h2);

  const desc = document.createElement("p");
  desc.className = "description";
  desc.textContent = L(step, "description");
  el.appendChild(desc);

  if (step.warning_ja || step.warning_en) {
    const w = document.createElement("div");
    w.className = "warning-box";
    w.textContent = L(step, "warning");
    el.appendChild(w);
  }

  const statusLine = document.createElement("p");
  statusLine.className = `status-line status-${step.status}`;
  statusLine.textContent = statusLabel(step.status, step.exit_code);
  el.appendChild(statusLine);

  if (step.needs_rerun) {
    const rerunNote = document.createElement("div");
    rerunNote.className = "warning-box";
    rerunNote.textContent = t("rerun_note");
    el.appendChild(rerunNote);
  }

  const savedInputs = (state.data.inputs && state.data.inputs[id]) || {};
  const formGetters = {};
  const boolRows = {}; // detect_cmd inputs only, for applyInstalledInfo()
  (step.inputs || []).forEach((inputDef) => {
    const row = document.createElement("div");
    row.className = "input-row" + (inputDef.type === "bool" ? " bool" : "");
    const label = document.createElement("label");
    label.textContent = L(inputDef, "label");

    if (inputDef.type === "bool") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = savedInputs[inputDef.id] ?? inputDef.default ?? false;
      row.appendChild(input);
      row.appendChild(label);
      if (inputDef.help_ja || inputDef.help_en) {
        const help = document.createElement("div");
        help.className = "help bool-help";
        help.textContent = L(inputDef, "help");
        row.appendChild(help);
      }
      if (inputDef.detect_cmd) boolRows[inputDef.id] = { row, input };
      formGetters[inputDef.id] = () => input.checked;
    } else if (inputDef.type === "color") {
      row.appendChild(label);

      const picker = document.createElement("div");
      picker.className = "color-picker";

      const swatchWrap = document.createElement("div");
      swatchWrap.className = "color-swatches";
      const swatches = [];

      const hexRow = document.createElement("div");
      hexRow.className = "color-hex-row";
      const preview = document.createElement("span");
      preview.className = "color-preview";
      const hexInput = document.createElement("input");
      hexInput.type = "text";
      hexInput.className = "color-hex-input";
      hexInput.placeholder = "#RRGGBB";
      hexInput.value = savedInputs[inputDef.id] ?? inputDef.default ?? "";

      const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v);
      const sync = () => {
        const v = hexInput.value.trim();
        preview.style.background = isHex(v) ? v : "transparent";
        swatches.forEach(({ btn, hex }) => {
          btn.classList.toggle("selected", hex.toLowerCase() === v.toLowerCase());
        });
      };

      (inputDef.options || []).forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "color-swatch";
        btn.style.background = opt.hex;
        const optLabel = L(opt, "label") || opt.hex;
        btn.title = optLabel;
        btn.setAttribute("aria-label", optLabel);
        btn.addEventListener("click", () => {
          hexInput.value = opt.hex;
          sync();
        });
        swatchWrap.appendChild(btn);
        swatches.push({ btn, hex: opt.hex });
      });
      picker.appendChild(swatchWrap);

      hexInput.addEventListener("input", sync);
      hexRow.appendChild(preview);
      hexRow.appendChild(hexInput);
      picker.appendChild(hexRow);

      row.appendChild(picker);
      sync();

      if (inputDef.help_ja || inputDef.help_en) {
        const help = document.createElement("div");
        help.className = "help";
        help.textContent = L(inputDef, "help");
        row.appendChild(help);
      }
      formGetters[inputDef.id] = () => hexInput.value.trim();
    } else {
      row.appendChild(label);
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = inputDef.placeholder || "";
      input.value = savedInputs[inputDef.id] ?? inputDef.default ?? "";
      row.appendChild(input);
      if (inputDef.help_ja || inputDef.help_en) {
        const help = document.createElement("div");
        help.className = "help";
        help.textContent = L(inputDef, "help");
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
      t("reboot_ack"),
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
    const runLabel = step.status === "failed" ? t("run_again") : t("run");
    const runBtn = mkButton("primary", runLabel, async () => {
      const inputs = {};
      Object.entries(formGetters).forEach(([k, get]) => {
        inputs[k] = get();
      });
      try {
        if (Object.keys(inputs).length) {
          await api(`/api/steps/${id}/inputs`, { method: "POST", body: { inputs, lang: LANG } });
        }
        await api(`/api/steps/${id}/run`, { method: "POST", body: { inputs } });
        await loadState();
      } catch (err) {
        if (err.status === 409 && err.payload && err.payload.detail && err.payload.detail.message === "precheck_required") {
          renderPrecheck(id, err.payload.detail.precheck, precheckContainer);
        } else {
          alert(t("error", err.message));
        }
      }
    });
    runBtn.disabled = running;
    actions.appendChild(runBtn);

    if (running) {
      const cancelBtn = mkButton("secondary", t("cancel_run"), async () => {
        cancelBtn.disabled = true;
        try {
          const res = await api(`/api/steps/${id}/cancel`, { method: "POST" });
          if (res.warning) alert(res.warning);
          await loadState();
        } catch (err) {
          alert(t("cancel_failed", err.message));
          cancelBtn.disabled = false;
        }
      });
      actions.appendChild(cancelBtn);
    }

    if (step.skippable && step.status !== "done") {
      const skipBtn = mkButton("secondary", t("skip"), async () => {
        await api(`/api/steps/${id}/skip`, { method: "POST" });
        await loadState();
      });
      skipBtn.disabled = running;
      actions.appendChild(skipBtn);
    }
  }

  // "already installed" hints for tools with a detect_cmd probe.
  applyInstalledInfo(id, boolRows);

  // Robot-source update action (shown on the ROS step when behind upstream).
  if (id === "ros_setup" && !running) {
    renderRobotUpdate(id, el, actions);
  }

  // Offer to skip a single failed package (COLCON_IGNORE) instead of
  // blocking the whole wizard on it -- only when it's safe (see
  // renderFailedPackages / engine.failed_packages_info).
  if (id === "ros_setup" && step.status === "failed") {
    renderFailedPackages(id, el, actions);
  }

  // For a not-yet-resolved precheck step, surface the choice up front.
  if (step.type === "script_with_precheck" && !running && step.status !== "done" && step.status !== "skipped") {
    api(`/api/steps/${id}/precheck`)
      .then((pre) => {
        if (pre.needed && precheckContainer.isConnected) renderPrecheck(id, pre, precheckContainer);
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

// --- bug report ("不具合を報告") ---------------------------------------------

const REPORT_REPO_URL = "https://github.com/sbgisen/cube_petit_setup";
// GitHub rejects very long URLs (~8KB); keep the prefill comfortably under.
const REPORT_URL_LIMIT = 7000;

function reportBody(symptom, diagnostics) {
  return `## ${t("report_sec_symptom")}\n\n${symptom.trim()}\n\n## ${t("report_sec_diag")}\n\n\`\`\`\n${diagnostics.trim()}\n\`\`\`\n`;
}

function reportIssueUrl(symptom, diagnostics) {
  const title = (symptom.trim().split("\n")[0] || t("report_default_title")).slice(0, 100);
  let url =
    `${REPORT_REPO_URL}/issues/new?title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(reportBody(symptom, diagnostics))}`;
  if (url.length > REPORT_URL_LIMIT) {
    // Trim the diagnostics until the URL fits; note the cut in the body.
    let diag = diagnostics;
    while (url.length > REPORT_URL_LIMIT && diag.length > 200) {
      diag = diag.slice(0, Math.floor(diag.length * 0.8));
      url =
        `${REPORT_REPO_URL}/issues/new?title=${encodeURIComponent(title)}` +
        `&body=${encodeURIComponent(reportBody(symptom, diag + "\n" + t("report_trimmed")))}`;
    }
  }
  return url;
}

async function openReportPanel() {
  const overlay = document.getElementById("report-overlay");
  overlay.hidden = false;
  overlay.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "report-panel";
  overlay.appendChild(panel);

  const h2 = document.createElement("h2");
  h2.textContent = t("report_title");
  panel.appendChild(h2);

  const symptomLabel = document.createElement("label");
  symptomLabel.textContent = t("report_symptom_label");
  panel.appendChild(symptomLabel);
  const symptom = document.createElement("textarea");
  symptom.className = "report-symptom";
  symptom.placeholder = t("report_symptom_placeholder");
  panel.appendChild(symptom);

  const diagLabel = document.createElement("label");
  diagLabel.textContent = t("report_diag_label");
  panel.appendChild(diagLabel);
  const diag = document.createElement("textarea");
  diag.className = "report-diagnostics";
  diag.value = t("report_loading");
  panel.appendChild(diag);
  api("/api/report/draft")
    .then((r) => { diag.value = r.diagnostics || ""; })
    .catch(() => { diag.value = t("report_diag_failed"); });

  const note = document.createElement("p");
  note.className = "report-note";
  note.textContent = t("report_note");
  panel.appendChild(note);

  const actions = document.createElement("div");
  actions.className = "actions";
  panel.appendChild(actions);

  const ghBtn = mkButton("primary", t("report_gh_btn"), () => {
    window.open(reportIssueUrl(symptom.value, diag.value), "_blank");
  });
  ghBtn.disabled = true;
  actions.appendChild(ghBtn);
  symptom.addEventListener("input", () => {
    ghBtn.disabled = !symptom.value.trim();
  });

  const copyBtn = mkButton("secondary", t("report_copy_btn"), () => {
    copyText(reportBody(symptom.value || t("report_no_symptom"), diag.value), copyBtn);
  });
  actions.appendChild(copyBtn);

  const closeBtn = mkButton("secondary", t("close"), () => {
    overlay.hidden = true;
    overlay.innerHTML = "";
  });
  actions.appendChild(closeBtn);
}

// Shown once, right after a self-update finished and the page reloaded onto
// the new version: says explicitly which steps need a re-run -- or that none
// do (Airi's real confusion after the first update: "which step do I press?").
function renderPostUpdateNotice() {
  const box = document.getElementById("post-update-notice");
  if (!box || !state.data) return;
  box.hidden = false;
  box.innerHTML = "";

  const title = document.createElement("span");
  title.className = "notice-title";
  const stale = state.data.steps.filter((s) => s.needs_rerun);
  box.appendChild(title);
  if (!stale.length) {
    title.textContent = t("notice_none");
  } else {
    title.textContent = t("notice_some");
    const ul = document.createElement("ul");
    stale.forEach((s) => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = L(s, "title");
      link.addEventListener("click", (ev) => {
        ev.preventDefault();
        selectStep(s.id);
      });
      li.appendChild(link);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  const close = mkButton("secondary", t("close"), () => {
    box.hidden = true;
    box.innerHTML = "";
  });
  close.classList.add("notice-close");
  box.appendChild(close);
}

async function init() {
  applyStaticTexts();
  document.getElementById("lang-toggle").addEventListener("click", () => {
    setLang(LANG === "ja" ? "en" : "ja");
  });

  await loadState();
  if (state.data.steps.length) {
    const firstNotDone = state.data.steps.find((s) => !["done", "skipped"].includes(s.status));
    selectStep(firstNotDone ? firstNotDone.id : state.data.steps[0].id);
  }

  if (sessionStorage.getItem("cps_just_updated")) {
    sessionStorage.removeItem("cps_just_updated");
    renderPostUpdateNotice();
  }

  // Fetch upstream-update status in the background (may take a few seconds
  // on first load while the server finishes its git fetch).
  loadUpdates();

  document.getElementById("report-button").addEventListener("click", openReportPanel);

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
