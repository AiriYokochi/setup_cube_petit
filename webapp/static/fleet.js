// Fleet landing page: renders robot cards from /api/fleet and probes each
// robot's setup app for reachability. Plain JS, no build step, no CDN.

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
  dot.title = "確認中...";
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
  setup.textContent = "セットアップ";
  setup.style.background = color;
  // Light accents (yellow/clear) need dark text to stay readable.
  const rgb = /^#?([0-9a-f]{6})$/i.exec(color || "");
  if (rgb) {
    const n = parseInt(rgb[1], 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    setup.style.color = lum > 0.62 ? "#3b3325" : "#ffffff";
  }
  const control = document.createElement("a");
  control.className = "control";
  control.href = `http://${robot.host}:${ports.control}/`;
  control.textContent = "操作画面";
  links.appendChild(setup);
  links.appendChild(control);
  card.appendChild(links);

  probe(robot.host, ports.setup, dot);
  return card;
}

function probe(host, port, dot) {
  // no-cors: we cannot read the response, but a resolved fetch means the
  // host answered on that port -- good enough for a reachability dot.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  fetch(`http://${host}:${port}/`, { mode: "no-cors", cache: "no-store", signal: ctrl.signal })
    .then(() => {
      dot.className = "fleet-dot up";
      dot.title = "接続できます";
    })
    .catch(() => {
      dot.className = "fleet-dot down";
      dot.title = "届きません(電源オフ or 別ネットワーク)";
    })
    .finally(() => clearTimeout(timer));
}

async function init() {
  const grid = document.getElementById("fleet-grid");
  try {
    const res = await fetch("/api/fleet");
    const data = await res.json();
    const ports = Object.assign({ setup: 8760, control: 5173, api: 8000 }, data.ports || {});
    grid.innerHTML = "";
    const robots = data.robots || [];
    if (!robots.length) {
      grid.innerHTML = "<p class='fleet-loading'>fleet.yaml に機体が登録されていません。</p>";
      return;
    }
    robots.forEach((r) => grid.appendChild(makeCard(r, ports)));
  } catch (e) {
    grid.innerHTML = "<p class='fleet-loading'>一覧を読み込めませんでした。</p>";
  }
}

init();
