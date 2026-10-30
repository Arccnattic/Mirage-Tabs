const api = globalThis.browser ?? globalThis.chrome;
const G = globalThis.MirageNtp;
const $ = (id) => document.getElementById(id);

const TEXT = ["unlockWord", "coverTitle", "greeting", "wordmark", "shortcuts", "customCss"];
const CHOICE = ["mode", "cover", "searchEngine", "searchIn", "layout", "iconStyle"];
const CHECK = ["enabled", "cloakTitle", "muteOnCloak", "pauseMedia"];

let settings = { ...G.DEFAULTS };
let bgImage = null;
let preview = null;
let saveTimer = null;
let previewIdx = 0;

// ---- preview -------------------------------------------------------------
function fitStage() {
  $("screen").style.transform = "scale(" + document.querySelector(".stage").clientWidth / 1280 + ")";
}
function previewId() {
  if (settings.cover !== "random") return settings.cover;
  const pool = settings.coverPool.length ? settings.coverPool : ["newtab"];
  return pool[previewIdx % pool.length];
}
function renderPreview() {
  preview?.destroy();
  preview = G.buildCover(previewId(), {
    hostname: "example.com",
    theme: settings.theme, layout: settings.layout, greeting: settings.greeting, wordmark: settings.wordmark,
    shortcuts: settings.shortcuts, customCss: settings.customCss, customImage: bgImage, dim: settings.dim,
    onSubmit: null, onOpenUrl: null,
  });
  $("screen").replaceChildren(preview.root);
  fitStage();
}

// ---- background swatches --------------------------------------------------
function renderSwatches() {
  const box = $("swatches");
  box.replaceChildren();
  for (const t of G.THEMES) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sw"; b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(settings.theme === t.id));
    const chip = document.createElement("i");
    chip.style.background = t.swatch;
    b.append(chip, document.createTextNode(t.name.replace(" (light/dark)", "")));
    b.addEventListener("click", () => { settings.theme = t.id; changed(); });
    box.append(b);
  }
  const c = document.createElement("button");
  c.type = "button"; c.className = "sw"; c.setAttribute("role", "radio");
  c.setAttribute("aria-checked", String(settings.theme === "custom"));
  const chip = document.createElement("i");
  if (bgImage) chip.style.backgroundImage = 'url("' + bgImage + '")';
  else chip.textContent = "+";
  if (!bgImage) c.classList.add("add");
  c.append(chip, document.createTextNode("Custom"));
  c.addEventListener("click", () => { settings.theme = "custom"; changed(); });
  box.append(c);

  const custom = settings.theme === "custom";
  $("customRow").hidden = !custom;
  $("removeImage").hidden = !bgImage;
  $("greetingRow").hidden = settings.layout !== "clock";
  $("wordmarkRow").hidden = settings.layout !== "homepage";
  $("shortcutsRow").hidden = settings.layout === "minimal";
  $("poolRow").hidden = settings.cover !== "random";
  $("shuffle").hidden = settings.cover !== "random";
}

// ---- cover page choices ------------------------------------------------------
function buildCoverControls() {
  const sel = $("cover");
  const add = (value, text) => { const o = document.createElement("option"); o.value = value; o.textContent = text; sel.append(o); };
  add("random", "A random page (from the list below)");
  for (const c of G.COVERS) add(c.id, c.name);
  for (const c of G.COVERS) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox"; box.dataset.id = c.id;
    box.addEventListener("input", () => { collect(); changed(); });
    label.append(box, document.createTextNode(c.name));
    $("pool").append(label);
  }
}
$("shuffle").addEventListener("click", () => { previewIdx++; renderPreview(); });

// ---- image upload (resized so it fits comfortably in extension storage) ----
async function fileToDataUrl(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / bmp.width, 1200 / bmp.height);
  const cv = document.createElement("canvas");
  cv.width = Math.round(bmp.width * scale);
  cv.height = Math.round(bmp.height * scale);
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", 0.82);
}
$("uploadImage").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", async () => {
  const f = $("file").files[0];
  $("file").value = "";
  if (!f) return;
  try {
    bgImage = await fileToDataUrl(f);
    await api.storage.local.set({ bgImage });
    settings.theme = "custom";
    changed();
  } catch (e) {
    $("imageNote").textContent = "Couldn't use that image. Try a different file.";
  }
});
$("removeImage").addEventListener("click", async () => {
  await api.storage.local.remove("bgImage");
  bgImage = null;
  changed();
});

// ---- form <-> settings -----------------------------------------------------
function collect() {
  for (const id of TEXT) settings[id] = $(id).value;
  for (const id of CHOICE) settings[id] = $(id).value;
  for (const id of CHECK) settings[id] = $(id).checked;
  settings.sites = $("sites").value.split(/[\n,]+/).map(G.normHost).filter(Boolean);
  settings.unlockWord = settings.unlockWord.trim();
  settings.idleMinutes = Math.max(0, Math.min(120, Number($("idleMinutes").value) || 0));
  settings.dim = Number($("dim").value);
  const pool = [...document.querySelectorAll("#pool input")].filter((b) => b.checked).map((b) => b.dataset.id);
  settings.coverPool = pool.length ? pool : ["newtab"];
}
function fill() {
  for (const id of TEXT) $(id).value = settings[id];
  for (const id of CHOICE) $(id).value = settings[id];
  for (const id of CHECK) $(id).checked = settings[id];
  $("sites").value = settings.sites.join("\n");
  $("idleMinutes").value = settings.idleMinutes;
  $("dim").value = settings.dim;
  for (const b of document.querySelectorAll("#pool input")) b.checked = settings.coverPool.includes(b.dataset.id);
}
function changed() {
  renderSwatches();
  renderPreview();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await api.storage.sync.set(settings);
    $("saved").textContent = "Saved \u2713";
    setTimeout(() => { $("saved").textContent = ""; }, 1500);
  }, 300);
}
for (const id of [...TEXT, ...CHOICE, ...CHECK, "sites", "idleMinutes", "dim"]) {
  $(id).addEventListener("input", () => { collect(); changed(); });
}
window.addEventListener("resize", fitStage);

(async () => {
  settings = { ...G.DEFAULTS, ...(await api.storage.sync.get(G.DEFAULTS)) };
  bgImage = (await api.storage.local.get("bgImage")).bgImage || null;
  buildCoverControls();
  fill();
  renderSwatches();
  renderPreview();
})();
