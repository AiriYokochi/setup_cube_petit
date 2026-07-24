// Fleet landing page: renders robot cards from /api/fleet and probes each
// robot's setup app for reachability. Plain JS, no build step, no CDN.

// Language handling mirrors the wizard (app.js): the choice is shared via
// the same localStorage key, so switching on either page carries over.
const STR = {
  ja: {
    title: "Cube Petit 機体一覧",
    hint:
      "機体を選んで開いてください。●は「この端末からセットアップ画面に届くか」の目安です" +
      "(電源が入っていない機体や別ネットワークの機体は灰色になります)。",
    footnote: "機体の追加・削除は <code>webapp/fleet.yaml</code> を編集してください。",
    loading: "読み込み中...",
    checking: "確認中...",
    up: "接続できます",
    down: "届きません(電源オフ or 別ネットワーク)",
    empty: "fleet.yaml に機体が登録されていません。",
    load_error: "一覧を読み込めませんでした。",
    setup: "セットアップ",
    update_restart: "アップデート&再起動",
    updating: "更新中...",
    checking_update: "更新の確認中...",
    cannot_check_update: "更新の確認に失敗しました(未接続の可能性があります)",
    latest: "最新です",
    available: "が利用可能です",
    commits_behind: "件の更新があります",
    waiting_back: "起動待ち...",
    back_up: "起動しました",
    no_response: "応答がありません(時間をおいて確認してください)",
    action_failed: "失敗しました",
  },
  en: {
    title: "Cube Petit Fleet",
    hint:
      "Pick a robot to open it. The ● dot shows whether its setup page is " +
      "reachable from this device (robots that are powered off or on another " +
      "network appear gray).",
    footnote: "To add or remove robots, edit <code>webapp/fleet.yaml</code>.",
    loading: "Loading...",
    checking: "Checking...",
    up: "Reachable",
    down: "Not reachable (powered off or on another network)",
    empty: "No robots are registered in fleet.yaml.",
    load_error: "Could not load the fleet list.",
    setup: "Setup",
    update_restart: "Update & restart",
    updating: "Updating...",
    checking_update: "Checking for updates...",
    cannot_check_update: "Could not check for updates (may be unreachable)",
    latest: "Already up to date",
    available: " available",
    commits_behind: " commit(s) behind",
    waiting_back: "Waiting for it to come back...",
    back_up: "Back up",
    no_response: "No response (check back in a bit)",
    action_failed: "Failed",
  },
};

let LANG = (() => {
  const saved = localStorage.getItem("cps_lang");
  if (saved === "ja" || saved === "en") return saved;
  return (navigator.language || "ja").toLowerCase().startsWith("ja") ? "ja" : "en";
})();

function t(key) {
  const v = (STR[LANG] || STR.ja)[key];
  return v === undefined ? STR.ja[key] : v;
}

function applyStaticTexts() {
  document.documentElement.lang = LANG;
  document.title = t("title");
  document.getElementById("fleet-title").textContent = t("title");
  document.getElementById("fleet-hint").textContent = t("hint");
  document.getElementById("fleet-footnote").innerHTML = t("footnote");
  document.getElementById("lang-toggle").textContent = LANG === "ja" ? "EN" : "日本語";
}

// Built-in accent palette, used when fleet.yaml doesn't give a color.
const DEFAULT_COLORS = {
  orange: "#E8830C",
  yellow: "#F5C518",
  pink: "#F472B6",
  violet: "#A78BFA",
  clear: "#B7C5CC",
};

// CSS filters that shift the (orange) petit sprite toward each body color.
// Keyed by robot name; unknown names keep the original sprite.
const PETIT_FILTERS = {
  orange: "none",
  yellow: "hue-rotate(28deg) saturate(1.2) brightness(1.08)",
  pink: "hue-rotate(-62deg) saturate(1.1)",
  violet: "hue-rotate(221deg)",
  clear: "grayscale(0.85) brightness(1.25)",
};

// Cross-origin counterpart of the wizard's api() (app.js): this page is
// served by one robot but the update/restart buttons act on whichever
// robot the card belongs to, so every call crosses origins. CORSMiddleware
// on the target robot's FastAPI app (main.py) is what makes the response
// body readable here instead of an opaque no-cors result.
async function crossApi(host, port, path, opts = {}) {
  const res = await fetch(`http://${host}:${port}${path}`, {
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
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
}

// After triggering an update/restart the target process exits, so the
// triggering request itself may error out with a connection reset even on
// success. Poll the same reachability probe the dot already uses until the
// robot answers again (or give up after a while).
async function waitForBackUp(host, port, status) {
  status.textContent = t("waiting_back");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(2000); // let the old process actually exit first
  for (let i = 0; i < 30; i++) {
    const alive = await crossApi(host, port, "/api/state").then(() => true).catch(() => false);
    if (alive) {
      status.textContent = t("back_up");
      return;
    }
    await sleep(1000);
  }
  status.textContent = t("no_response");
}

function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function makeCard(robot, ports) {
  const card = document.createElement("div");
  card.className = "fleet-card";
  const color = robot.color || DEFAULT_COLORS[robot.name] || "#d97706";
  card.style.borderTop = `6px solid ${color}`;
  const tint = hexToRgba(color, 0.07);
  if (tint) card.style.background = `linear-gradient(${tint}, ${tint}), var(--panel-bg)`;

  const head = document.createElement("div");
  head.className = "fleet-card-head";
  const img = document.createElement("img");
  img.src = "/static/petit.png";
  img.alt = "";
  img.style.filter = PETIT_FILTERS[robot.name] || "none";
  const name = document.createElement("span");
  name.className = "fleet-name";
  name.textContent = robot.name;
  name.style.color = color;
  const dot = document.createElement("span");
  dot.className = "fleet-dot checking";
  dot.title = t("checking");
  head.appendChild(img);
  head.appendChild(name);
  head.appendChild(dot);
  card.appendChild(head);

  const host = document.createElement("div");
  host.className = "fleet-host";
  host.textContent = robot.host;
  card.appendChild(host);

  const links = document.createElement("div");
  links.className = "fleet-links";
  const setup = document.createElement("a");
  setup.className = "setup";
  setup.href = `http://${robot.host}:${ports.setup}/`;
  setup.textContent = t("setup");
  setup.style.background = color;
  // Light accents (yellow/clear) need dark text to stay readable.
  const rgb = /^#?([0-9a-f]{6})$/i.exec(color || "");
  if (rgb) {
    const n = parseInt(rgb[1], 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    setup.style.color = lum > 0.62 ? "#3b3325" : "#ffffff";
  }
  links.appendChild(setup);
  card.appendChild(links);

  card.appendChild(makeFleetActions(robot.host, ports.setup));

  probe(robot.host, ports.setup, dot);
  return card;
}

// "アップデート&再起動" button: lets Airi manage every robot's setup webapp
// checkout from one page (/fleet) instead of SSHing into each one, same
// operation as `git pull` + `systemctl --user restart
// cube-petit-setup-webapp.service` done by hand. Single combined button
// (not separate update/restart buttons) per her feedback: a standalone
// "再起動" button reads as "restart the robot", not "restart this setup
// app", and there is no reason to update without also restarting into the
// new code. Disabled until a check confirms this robot's checkout is
// actually behind -- there is nothing useful to press otherwise.
function makeFleetActions(host, port) {
  const row = document.createElement("div");
  row.className = "fleet-actions";

  const status = document.createElement("span");
  status.className = "fleet-action-status";

  const pickErr = (r) => r.output || r.error || null;

  const updateBtn = document.createElement("button");
  updateBtn.type = "button";
  updateBtn.className = "fleet-action-btn";
  updateBtn.textContent = t("update_restart");
  updateBtn.disabled = true;
  updateBtn.title = t("checking_update");

  updateBtn.addEventListener("click", async () => {
    updateBtn.disabled = true;
    status.textContent = t("updating");
    status.classList.remove("error");
    try {
      const r = await crossApi(host, port, "/api/updates/self", { method: "POST" });
      if (r && r.restarting) {
        await waitForBackUp(host, port, status);
      } else if (r && r.ok === false) {
        status.textContent = pickErr(r) || t("action_failed");
        status.classList.add("error");
        updateBtn.disabled = false;
      } else {
        // Nothing was actually pending after all (e.g. someone else just
        // updated it) -- re-disable rather than leave a stale "latest".
        status.textContent = t("latest");
      }
    } catch (err) {
      // The request may have failed simply because the process exited
      // before answering (success path) -- probe once before treating this
      // as a real error.
      const alive = await crossApi(host, port, "/api/state").then(() => true).catch(() => false);
      if (!alive) {
        await waitForBackUp(host, port, status);
      } else {
        status.textContent = `${t("action_failed")}: ${err.message}`;
        status.classList.add("error");
        updateBtn.disabled = false;
      }
    }
  });

  row.appendChild(updateBtn);
  row.appendChild(status);
  checkUpdateStatus(host, port, updateBtn, status);
  return row;
}

// Cross-origin GET /api/updates to decide whether the update button should
// be clickable at all. Unreachable robots and robots already on the latest
// code both leave it disabled.
async function checkUpdateStatus(host, port, updateBtn, status) {
  try {
    const data = await crossApi(host, port, "/api/updates");
    const self = data && data.self;
    if (self && self.behind) {
      updateBtn.disabled = false;
      updateBtn.title = "";
      status.textContent = updateHeadlineFor(self);
    } else {
      updateBtn.title = t("latest");
    }
  } catch (e) {
    updateBtn.title = t("cannot_check_update");
  }
}

function updateHeadlineFor(self) {
  return self.tag ? `${self.tag}${t("available")}` : `${self.behind}${t("commits_behind")}`;
}

function probe(host, port, dot) {
  // no-cors: we cannot read the response, but a resolved fetch means the
  // host answered on that port -- good enough for a reachability dot.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  fetch(`http://${host}:${port}/`, { mode: "no-cors", cache: "no-store", signal: ctrl.signal })
    .then(() => {
      dot.className = "fleet-dot up";
      dot.title = t("up");
    })
    .catch(() => {
      dot.className = "fleet-dot down";
      dot.title = t("down");
    })
    .finally(() => clearTimeout(timer));
}

async function init() {
  const grid = document.getElementById("fleet-grid");
  grid.innerHTML = `<p class='fleet-loading'>${t("loading")}</p>`;
  try {
    const res = await fetch("/api/fleet");
    const data = await res.json();
    const ports = Object.assign({ setup: 8760 }, data.ports || {});
    grid.innerHTML = "";
    const robots = data.robots || [];
    if (!robots.length) {
      grid.innerHTML = `<p class='fleet-loading'>${t("empty")}</p>`;
      return;
    }
    robots.forEach((r) => grid.appendChild(makeCard(r, ports)));
  } catch (e) {
    grid.innerHTML = `<p class='fleet-loading'>${t("load_error")}</p>`;
  }
}

document.getElementById("lang-toggle").addEventListener("click", () => {
  LANG = LANG === "ja" ? "en" : "ja";
  localStorage.setItem("cps_lang", LANG);
  applyStaticTexts();
  init(); // re-render cards (button labels, dot tooltips)
});

applyStaticTexts();
init();
