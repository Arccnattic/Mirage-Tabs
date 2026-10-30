const api = globalThis.browser ?? globalThis.chrome;
const G = globalThis.MirageNtp;

const $ = (id) => document.getElementById(id);
const status = $("status");
let tab = null;
let host = null;
let settings = null;

function say(text) {
  status.textContent = text;
  setTimeout(() => { if (status.textContent === text) status.textContent = ""; }, 2500);
}

async function load() {
  settings = { ...G.DEFAULTS, ...(await api.storage.sync.get(G.DEFAULTS)) };
  $("enabled").checked = settings.enabled;
  $("mode").value = settings.mode;
  const sel = $("cover");
  for (const [v, t] of [["random", "Random page"], ...G.COVERS.map((c) => [c.id, c.name])]) {
    const o = document.createElement("option"); o.value = v; o.textContent = t; sel.append(o);
  }
  sel.value = settings.cover;

  [tab] = await api.tabs.query({ active: true, currentWindow: true });
  try {
    const u = new URL(tab.url);
    if (/^https?:$/.test(u.protocol)) host = G.normHost(u.hostname);
  } catch (e) { /* no url */ }
  renderSite();

  if (host) {
    try {
      const res = await api.tabs.sendMessage(tab.id, { type: "PING" });
      $("tabPin").checked = !!res?.pinned;
    } catch (e) {
      status.textContent = "Not running on this tab yet. Reload the page (F5).";
    }
  }
}

function renderSite() {
  const btn = $("toggleSite");
  if (!host) {
    $("siteName").textContent = "This page can't be hidden";
    btn.hidden = true;
    $("tabPin").disabled = true;
    $("hideNow").disabled = true;
    return;
  }
  $("siteName").textContent = host;
  btn.textContent = G.hostListed(host, settings.sites) ? "Stop hiding this site" : "Hide this site when I switch away";
}

async function saveMode() {
  settings.mode = $("mode").value;
  await api.storage.sync.set({ mode: settings.mode });
}

$("enabled").addEventListener("change", () => api.storage.sync.set({ enabled: $("enabled").checked }));
$("mode").addEventListener("change", saveMode);
$("cover").addEventListener("change", () => api.storage.sync.set({ cover: $("cover").value }));

$("toggleSite").addEventListener("click", async () => {
  const on = G.hostListed(host, settings.sites);
  settings.sites = on ? settings.sites.filter((s) => !G.hostListed(host, [s])) : [...settings.sites, host];
  await api.storage.sync.set({ sites: settings.sites });
  if (!on && settings.mode === "manual") {   // a listed site does nothing in "pinned only" mode
    settings.mode = "listed"; $("mode").value = "listed";
    await api.storage.sync.set({ mode: "listed" });
  }
  say(on ? host + " won't be hidden." : host + " hides when you switch away.");
  renderSite();
});

$("tabPin").addEventListener("change", async () => {
  await api.runtime.sendMessage({ type: "SET_PIN", tabId: tab.id, value: $("tabPin").checked }).catch(() => {});
  say($("tabPin").checked ? "This tab will hide when you switch away." : "This tab is no longer pinned.");
});

$("hideNow").addEventListener("click", async () => {
  try {
    await api.tabs.sendMessage(tab.id, { type: "CLOAK_NOW" });
    window.close();
  } catch (e) {
    say("Can't hide this page. Reload it (F5) and try again.");
  }
});

$("more").addEventListener("click", () => { api.runtime.openOptionsPage(); window.close(); });

load();
