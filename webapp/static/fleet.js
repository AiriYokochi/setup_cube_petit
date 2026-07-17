// Fleet landing page: renders robot cards from /api/fleet and probes each
// robot's setup app for reachability. Plain JS, no build step, no CDN.

function makeCard(robot, ports) {
  const card = document.createElement("div");
  card.className = "fleet-card";

  const head = document.createElement("div");
  head.className = "fleet-card-head";
  const img = document.createElement("img");
  img.src = "/static/petit.png";
  img.alt = "";
  const name = document.createElement("span");
  name.className = "fleet-name";
  name.textContent = robot.name;
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
