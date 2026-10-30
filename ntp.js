// Shared by the content script (the real cover), the options page (live preview) and the popup (helpers).
(() => {
  const DEFAULTS = {
    enabled: true,
    mode: "listed",            // "listed" = sites below + pinned tabs | "manual" = pinned tabs only | "all" = every site
    sites: [],
    unlockWord: "unlock",      // typed into the fake search box to bring the real page back
    searchEngine: "google",    // "google" | "bing" | "duckduckgo"
    searchIn: "newtab",        // where searches / shortcut tiles open: "newtab" | "same"
    cover: "random",           // which page hides the tab: a COVERS id, or "random" (picked from coverPool each time)
    coverPool: ["newtab", "document", "sheet", "inbox", "pdf", "article", "notfound", "error"],
    theme: "auto",             // New tab cover only: a THEMES id or "custom"
    layout: "search",          // "search" | "clock" | "homepage" | "minimal"
    greeting: "",              // clock layout subtitle (empty = today's date)
    wordmark: "Google",        // big title in the "homepage" layout
    shortcuts: "Google|https://www.google.com\nWikipedia|https://www.wikipedia.org",
    customCss: "",             // custom theme: CSS gradient / colour, or an image URL
    dim: 0.25,                 // darkening over a custom image
    cloakTitle: true,          // swap title + icon while hidden
    coverTitle: "New tab",
    iconStyle: "blank",        // "blank" | "globe" | "magnifier"
    muteOnCloak: true,
    pauseMedia: true,
    idleMinutes: 0,            // 0 = off
  };

  // ---- themes -------------------------------------------------------------
  const C = (bg, text, sub, box, boxText, tile, extra = {}) => ({ bg, text, sub, box, boxText, tile, ...extra });
  const SKY = C("linear-gradient(160deg,#eaf1fb 0%,#d9e6f6 55%,#cddff2 100%)", "#4a4d52", "#6b6f76", "rgba(255,255,255,.95)", "#202124", "rgba(255,255,255,.78)");
  const GRAPHITE = C("linear-gradient(160deg,#2b2d31 0%,#1b1d20 100%)", "#e8eaed", "#aeb2b8", "rgba(255,255,255,.14)", "#e8eaed", "rgba(255,255,255,.14)");
  const THEMES = [
    { id: "auto", name: "Auto (light/dark)", swatch: "linear-gradient(135deg,#d9e6f6 50%,#2b2d31 50%)", light: SKY, dark: GRAPHITE },
    { id: "sky", name: "Sky", c: SKY },
    { id: "mist", name: "Mist", c: C("linear-gradient(160deg,#f5f6f8 0%,#e4e7ec 100%)", "#4a4d52", "#6b6f76", "rgba(255,255,255,.95)", "#202124", "rgba(255,255,255,.78)") },
    { id: "classic", name: "Classic white", swatch: "linear-gradient(135deg,#fff 50%,#202124 50%)",
      light: C("#ffffff", "#202124", "#5f6368", "#ffffff", "#202124", "#f1f3f4", { border: "1px solid #dfe1e5" }),
      dark: C("#202124", "#e8eaed", "#9aa0a6", "#303134", "#e8eaed", "#303134", { border: "1px solid #5f6368" }) },
    { id: "minimal", name: "Minimal", swatch: "linear-gradient(135deg,#f8fafc 50%,#121212 50%)",
      light: C("#f8fafc", "#0f172a", "#64748b", "#ffffff", "#0f172a", "rgba(15,23,42,.06)"),
      dark: C("#121212", "#f1f5f9", "#94a3b8", "#1e1e1e", "#f1f5f9", "rgba(255,255,255,.08)") },
    { id: "peach", name: "Peach", c: C("linear-gradient(160deg,#fff1e6 0%,#fbd9c4 100%)", "#5a4638", "#7d6a5d", "rgba(255,255,255,.95)", "#2a1f18", "rgba(255,255,255,.78)") },
    { id: "mint", name: "Mint", c: C("linear-gradient(160deg,#e9f8f1 0%,#c9ecdc 100%)", "#2f4a3e", "#58786a", "rgba(255,255,255,.95)", "#16241d", "rgba(255,255,255,.78)") },
    { id: "ocean", name: "Ocean", c: C("linear-gradient(160deg,#0f4c5c 0%,#0b2e45 100%)", "#e8f4f8", "#a9c7d3", "rgba(255,255,255,.14)", "#e8f4f8", "rgba(255,255,255,.14)") },
    { id: "sunset", name: "Sunset", c: C("linear-gradient(160deg,#5b2a86 0%,#b8426b 55%,#f08a4b 100%)", "#fff5ee", "#ffd9c2", "rgba(255,255,255,.18)", "#fff5ee", "rgba(255,255,255,.18)") },
    { id: "forest", name: "Forest", c: C("linear-gradient(160deg,#1f3d2b 0%,#0f2318 100%)", "#e6f2ea", "#9dbba8", "rgba(255,255,255,.12)", "#e6f2ea", "rgba(255,255,255,.12)") },
    { id: "midnight", name: "Midnight", c: C("linear-gradient(160deg,#1b1f3b 0%,#0b0d1f 100%)", "#e6e8ff", "#9aa0d0", "rgba(255,255,255,.12)", "#e6e8ff", "rgba(255,255,255,.12)") },
    { id: "graphite", name: "Graphite", c: GRAPHITE },
    { id: "aurora", name: "Aurora glass", c: C("linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)", "#ffffff", "#cbd5e1", "rgba(255,255,255,.14)", "#ffffff", "rgba(255,255,255,.12)", { blur: true }) },
    { id: "cyberpunk", name: "Cyberpunk", c: C("radial-gradient(circle at 50% 20%,#2a0845 0%,#090a0f 85%)", "#00ffcc", "#ff2a85", "rgba(20,20,35,.85)", "#00ffcc", "rgba(0,255,204,.1)", { border: "1px solid rgba(0,255,204,.45)", glow: "0 0 14px rgba(0,255,204,.35)" }) },
    { id: "terminal", name: "Terminal", c: C("#0a0e0a", "#22c55e", "#15803d", "#111911", "#22c55e", "#111911", { font: "'Courier New', monospace", prompt: "guest@browser:~$ search or type a URL" }) },
  ];
  for (const t of THEMES) if (!t.swatch) t.swatch = t.c.bg;

  // Pages that can hide a tab. "newtab" is built here; the dummy pages live in covers.js.
  const COVERS = [
    { id: "newtab", name: "New tab (with search box)" },
    { id: "document", name: "Document" },
    { id: "sheet", name: "Spreadsheet" },
    { id: "inbox", name: "Email inbox" },
    { id: "pdf", name: "PDF report" },
    { id: "article", name: "Encyclopedia article" },
    { id: "notfound", name: "404 Not Found" },
    { id: "error", name: "Can't reach this page" },
  ];
  function pickCover(settings) {
    const valid = new Set(COVERS.map((c) => c.id));
    if (settings.cover !== "random" && valid.has(settings.cover)) return settings.cover;
    const pool = (settings.coverPool || []).filter((id) => valid.has(id));
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "newtab";
  }

  const ENGINES = {
    google: "https://www.google.com/search?q=",
    bing: "https://www.bing.com/search?q=",
    duckduckgo: "https://duckduckgo.com/?q=",
  };

  // ---- helpers ------------------------------------------------------------
  function normHost(raw) {
    return String(raw || "").trim().toLowerCase()
      .replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/^\*\./, "").replace(/^www\./, "");
  }
  function hostListed(host, sites) {
    const h = normHost(host);
    if (!h) return false;
    return (sites || []).some((s) => { const n = normHost(s); return n && (h === n || h.endsWith("." + n)); });
  }
  function toUrl(text, engine) {
    const t = text.trim();
    if (/^https?:\/\/\S+$/i.test(t)) return t;
    if (/^(localhost|([\w-]+\.)+[a-z]{2,})(:\d+)?([/?#]\S*)?$/i.test(t)) return "https://" + t;
    return (ENGINES[engine] || ENGINES.google) + encodeURIComponent(t);
  }
  function parseShortcuts(text) {
    const out = [];
    for (const line of String(text || "").split("\n")) {
      const [name, url] = line.split("|").map((s) => (s || "").trim());
      if (name && /^https?:\/\/\S+$/i.test(url || "")) out.push({ name, url });
      if (out.length >= 6) break;
    }
    return out;
  }
  function sysDark() { return !!globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches; }
  function resolveTheme(id) {
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    return t.c || (sysDark() ? t.dark : t.light);
  }
  // Custom theme background: a CSS gradient/colour, or an http(s)/data image URL.
  function customBackground(css) {
    const v = String(css || "").trim();
    if (!v) return null;
    if (/^(https?:\/\/|data:image\/)/i.test(v)) return { url: v };
    if (/^(linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient)\(/i.test(v) || /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|hsl)a?\(/i.test(v)) return { bg: v };
    return null;
  }
  function el(tag, styles = {}, text) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(styles)) e.style.setProperty(k, v);
    if (text) e.textContent = text;
    return e;
  }

  // ---- the fake "New tab" page --------------------------------------------
  // opts: { theme, layout, greeting, wordmark, shortcuts, customCss, customImage, dim, onSubmit | null, onOpenUrl }
  function build(opts) {
    const isCustom = opts.theme === "custom";
    let c = resolveTheme(isCustom ? "graphite" : opts.theme);
    let image = null;
    if (isCustom) {
      const cb = customBackground(opts.customCss);
      c = { ...c, text: "#ffffff", sub: "#e2e8f0", box: "rgba(255,255,255,.92)", boxText: "#202124", tile: "rgba(255,255,255,.85)", shadow: "0 1px 6px rgba(0,0,0,.6)" };
      if (cb?.bg) c.bg = cb.bg;
      else if (cb?.url) image = cb.url;
      if (opts.customImage) image = opts.customImage;
    }

    const root = el("div", {
      position: "absolute", inset: "0", overflow: "hidden", background: c.bg, color: c.text, cursor: "default",
      "font-family": c.font || "'Segoe UI', system-ui, sans-serif", "background-size": "cover", "background-position": "center",
    });
    const overlay = el("div", { position: "absolute", inset: "0", "z-index": "0", "pointer-events": "none", background: "rgba(0,0,0,0)" });
    const inner = el("div", {
      position: "relative", "z-index": "1", display: "flex", "flex-direction": "column",
      "align-items": "center", width: "100%", height: "100%", "text-shadow": c.shadow || "none", "user-select": "none",
    });
    root.append(overlay, inner);

    const layout = opts.layout || "search";
    inner.append(el("div", { flex: "0 0 " + (layout === "clock" ? "15%" : layout === "homepage" ? "20%" : layout === "minimal" ? "38%" : "24%") }));

    let timer = null;
    if (layout === "clock") {
      const time = el("div", { "font-size": "88px", "font-weight": "300", "line-height": "1", "letter-spacing": "-1px" });
      const sub = el("div", { "font-size": "18px", "margin-top": "10px", "margin-bottom": "34px", color: c.sub });
      const tick = () => {
        const d = new Date();
        time.textContent = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        sub.textContent = (opts.greeting || "").trim() || d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
      };
      tick();
      timer = setInterval(tick, 15000);
      inner.append(time, sub);
    }
    if (layout === "homepage") {
      inner.append(el("div", { "font-size": "64px", "font-weight": "700", "letter-spacing": "-2px", "margin-bottom": "28px", "line-height": "1.1" }, (opts.wordmark || "").trim() || "Search"));
    }

    // search box: a real <input>, so the unlock word can be typed
    const box = el("div", {
      position: "relative", display: "flex", "align-items": "center", gap: "12px", width: "600px", "max-width": "86%",
      height: "46px", padding: "0 18px", "box-sizing": "border-box", "border-radius": "24px",
      background: c.box, color: c.boxText, "box-shadow": c.glow || "0 2px 10px rgba(0,0,0,.18)", "font-size": "15px", "text-shadow": "none",
      border: c.border || "1px solid rgba(128,128,128,.18)",
    });
    if (c.blur) box.style.setProperty("backdrop-filter", "blur(12px)");
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    for (const [k, v] of Object.entries({ width: 18, height: 18, viewBox: "0 0 18 18", fill: "none", stroke: c.sub, "stroke-width": 1.8 })) svg.setAttribute(k, v);
    const circle = document.createElementNS(svgNS, "circle");
    for (const [k, v] of Object.entries({ cx: 7.5, cy: 7.5, r: 5.5 })) circle.setAttribute(k, v);
    const line = document.createElementNS(svgNS, "line");
    for (const [k, v] of Object.entries({ x1: 11.7, y1: 11.7, x2: 16, y2: 16 })) line.setAttribute(k, v);
    svg.append(circle, line);

    const input = el("input", {
      flex: "1", width: "100%", border: "0", outline: "0", background: "transparent", color: "inherit",
      font: "inherit", padding: "0", margin: "0", "min-width": "0",
    });
    input.type = "text";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");
    const hint = el("span", { position: "absolute", left: "48px", color: c.sub, "pointer-events": "none", "white-space": "nowrap" }, c.prompt || "Search the web");
    input.addEventListener("input", () => hint.style.setProperty("display", input.value ? "none" : "block"));
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const v = input.value;
      input.value = "";
      hint.style.setProperty("display", "block");
      opts.onSubmit?.(v);
    });
    if (!opts.onSubmit) input.disabled = true;
    box.append(svg, input, hint);
    inner.append(box);

    if (layout !== "minimal") {
      const tiles = el("div", { display: "flex", gap: "22px", "margin-top": "34px", "flex-wrap": "wrap", "justify-content": "center", padding: "0 20px" });
      const makeTile = (label, glyph, onClick) => {
        const tile = el("div", { display: "flex", "flex-direction": "column", "align-items": "center", gap: "8px", "font-size": "12px", width: "72px", cursor: "default" });
        tile.append(
          el("div", {
            width: "52px", height: "52px", "border-radius": "14px", background: c.tile, color: c.boxText,
            display: "flex", "align-items": "center", "justify-content": "center", "font-size": "22px", "font-weight": "600",
            "line-height": "1", "box-shadow": "0 1px 4px rgba(0,0,0,.15)", "text-shadow": "none",
            border: c.border ? c.border : "0",
          }, glyph),
          el("span", { "max-width": "72px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }, label),
        );
        if (onClick) tile.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
        tiles.append(tile);
      };
      for (const s of parseShortcuts(opts.shortcuts)) makeTile(s.name, s.name[0].toUpperCase(), opts.onOpenUrl ? () => opts.onOpenUrl(s.url) : null);
      makeTile("Add shortcut", "+", () => input.focus());
      inner.append(tiles);
    }

    function setImage(url) {
      if (!url) return;
      root.style.setProperty("background-image", 'url("' + String(url).replace(/"/g, "%22") + '")');
      overlay.style.setProperty("background", "rgba(0,0,0," + Math.min(0.8, Math.max(0, Number(opts.dim) || 0)) + ")");
    }
    if (image) setImage(image);

    return { root, input, setImage, destroy: () => timer && clearInterval(timer) };
  }

  // covers.js replaces this with a version that also knows the dummy pages.
  function buildCover(id, opts) { return build(opts); }

  globalThis.MirageNtp = { DEFAULTS, THEMES, COVERS, ENGINES, el, normHost, hostListed, toUrl, parseShortcuts, pickCover, build, buildCover };
})();
