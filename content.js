(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const G = globalThis.MirageNtp;
  if (!G) return;

  // Don't run twice in one page, but let a fresh copy replace one orphaned by an extension reload.
  if (globalThis.__mirageTabs?.alive()) return;
  globalThis.__mirageTabs = { alive: () => !!api.runtime?.id };

  const HOST_ATTR = "data-mirage-tabs";

  let settings = { ...G.DEFAULTS };
  let cloaked = false;
  let forced = false;        // cloaked by Alt+X / "Cloak now" / idle: ignores the site list
  let pinned = false;        // this one tab is marked for hiding (kept by the background script)
  let host = null;
  let ui = null;
  let coverShadow = null;
  let observer = null;
  let savedTitle = null;
  let iconState = [];        // original <link rel=icon> attributes, restored on reveal
  let addedIcon = null;      // our own <link>, only when the page had none
  let iconCache = null;
  let pausedMedia = [];
  let idleTimer = null;
  let lastActive = Date.now();
  let keyBuf = "";
  let keyTime = 0;

  const hasWord = () => !!(settings.unlockWord && settings.unlockWord.trim());
  const listed = () => G.hostListed(location.hostname, settings.sites);
  const shouldCloak = () =>
    settings.enabled && (pinned || settings.mode === "all" || (settings.mode === "listed" && listed()));
  const coverTitle = () => (settings.coverTitle || "").trim() || "New tab";

  function send(msg) {
    try {
      const p = api.runtime.sendMessage(msg);
      return p && p.catch ? p.catch(() => null) : Promise.resolve(null);
    } catch (e) { return Promise.resolve(null); }
  }
  function openUrl(url) {
    if (settings.searchIn === "same") location.href = url;
    else send({ type: "OPEN_URL", url });
  }

  // ---- favicon -----------------------------------------------------------
  function disguiseIcon() {
    const style = settings.iconStyle;
    const svgSrc = ui?.iconSvg || null;                  // dummy pages bring a matching icon
    const key = svgSrc ? "svg:" + svgSrc : style;
    if (iconCache?.key === key) return iconCache;
    if (svgSrc) {
      iconCache = { key, href: "data:image/svg+xml;utf8," + encodeURIComponent(svgSrc), type: "image/svg+xml" };
      return iconCache;
    }
    let href, type;
    if (style === "globe" || style === "magnifier") {
      const body = style === "globe"
        ? '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'
        : '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/>';
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#80868b" stroke-width="2" stroke-linecap="round">' + body + "</svg>";
      href = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
      type = "image/svg+xml";
    } else {
      // "blank": one almost-invisible pixel, so browsers don't discard the image as empty
      const cv = document.createElement("canvas");
      cv.width = cv.height = 16;
      const ctx = cv.getContext("2d");
      if (ctx) { ctx.fillStyle = "rgba(128,128,128,0.01)"; ctx.fillRect(0, 0, 1, 1); }
      href = cv.toDataURL("image/png");
      type = "image/png";
    }
    iconCache = { key, href, type };
    return iconCache;
  }
  function setAttr(node, name, value) {
    if (value === null || value === undefined) node.removeAttribute(name);
    else node.setAttribute(name, value);
  }

  // Point every existing icon link at the disguise (changing href is what browsers reliably
  // pick up). A link is added only if the page has none.
  function cloakIcons() {
    const icon = disguiseIcon();
    const links = document.querySelectorAll('link[rel~="icon" i]');
    for (const l of links) {
      if (l === addedIcon) continue;
      const href = l.getAttribute("href");
      let st = iconState.find((s) => s.el === l);
      if (!st) {
        st = { el: l, href, type: l.getAttribute("type"), sizes: l.getAttribute("sizes") };
        iconState.push(st);
      } else if (href !== icon.href) {
        st.href = href;                         // page changed its icon while hidden: remember the new one
      }
      if (href !== icon.href) l.setAttribute("href", icon.href);
      if (l.getAttribute("type") !== icon.type) l.setAttribute("type", icon.type);
      if (l.hasAttribute("sizes")) l.removeAttribute("sizes");
    }
    if (!addedIcon && !iconState.length) {
      addedIcon = document.createElement("link");
      addedIcon.setAttribute("rel", "icon");
      addedIcon.setAttribute("type", icon.type);
      addedIcon.setAttribute("href", icon.href);
      (document.head || document.documentElement).appendChild(addedIcon);
    } else if (addedIcon && addedIcon.getAttribute("href") !== icon.href) {
      addedIcon.setAttribute("href", icon.href);
      addedIcon.setAttribute("type", icon.type);
    }
  }
  function restoreIcons() {
    for (const s of iconState) {
      if (!s.el.isConnected) continue;
      setAttr(s.el, "href", s.href);
      setAttr(s.el, "type", s.type);
      setAttr(s.el, "sizes", s.sizes);
    }
    iconState = [];
    if (addedIcon) { addedIcon.remove(); addedIcon = null; }
  }

  // ---- title + icon ------------------------------------------------------
  function cloakTab() {
    const title = ui?.title || coverTitle();
    if (savedTitle === null) savedTitle = document.title;
    if (document.title !== title) {
      savedTitle = document.title;              // page changed it while hidden: remember the new one
      document.title = title;
    }
    cloakIcons();
  }
  function startObserver() {
    observer = new MutationObserver(() => { if (cloaked && settings.cloakTitle) cloakTab(); }); // idempotent
    observer.observe(document.head || document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["href", "rel"],
    });
  }

  // ---- media -------------------------------------------------------------
  function onCloakMedia() {
    if (settings.pauseMedia) {
      pausedMedia = [];
      for (const m of document.querySelectorAll("video, audio")) {
        if (!m.paused) { m.pause(); pausedMedia.push(m); }
      }
    }
    if (settings.muteOnCloak) send({ type: "SET_MUTE", mute: true });
  }
  function onRevealMedia() {
    for (const m of pausedMedia) m.play().catch(() => {});
    pausedMedia = [];
    send({ type: "SET_MUTE", mute: false });   // background only un-mutes tabs it muted itself
  }

  // ---- unlock / search ---------------------------------------------------
  function onSubmit(text) {
    const t = text.trim();
    if (!t) return;
    if (hasWord() && t.toLowerCase() === settings.unlockWord.trim().toLowerCase()) { reveal(); return; }
    if (ui?.keyOnly) return;                       // dummy pages: only the unlock word does anything
    openUrl(G.toUrl(t, settings.searchEngine));   // New tab: anything else behaves like a browser search box
  }

  // Dummy pages: swallow keystrokes (so the page underneath never sees them) and watch for the word.
  function onCoverKey(e) {
    if (!cloaked || !ui?.keyOnly) return;
    if ((e.ctrlKey || e.metaKey || e.altKey) && !e.getModifierState?.("AltGraph")) return; // browser shortcuts pass through
    if (ui.input && coverShadow?.activeElement === ui.input) return;   // typing in the page's own field
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.type !== "keydown" || e.key.length !== 1 || !hasWord()) return;
    const word = settings.unlockWord.trim().toLowerCase();
    const now = Date.now();
    if (now - keyTime > 5000) keyBuf = "";      // typing must be one continuous burst
    keyTime = now;
    keyBuf = (keyBuf + e.key.toLowerCase()).slice(-word.length);
    if (keyBuf === word) reveal();
  }

  // ---- cloak / reveal ----------------------------------------------------
  function cloak(force = false) {
    if (cloaked || !document.documentElement) return;
    if (!force && !shouldCloak()) return;
    cloaked = true;
    forced = force;

    try { document.activeElement?.blur(); } catch (e) { /* ignore */ }

    host = document.createElement("div");
    host.setAttribute(HOST_ATTR, "");
    const style = {
      position: "fixed", inset: "0", width: "100vw", height: "100vh", "z-index": "2147483647",
      cursor: "default", margin: "0", padding: "0", border: "0", opacity: "1", display: "block", "pointer-events": "auto",
    };
    for (const [k, v] of Object.entries(style)) host.style.setProperty(k, v, "important");

    ui = G.buildCover(G.pickCover(settings), {
      theme: settings.theme, layout: settings.layout, greeting: settings.greeting, wordmark: settings.wordmark,
      shortcuts: settings.shortcuts, customCss: settings.customCss, dim: settings.dim, onSubmit, onOpenUrl: openUrl,
      hostname: location.hostname,
    });
    coverShadow = host.attachShadow({ mode: "closed" });
    coverShadow.appendChild(ui.root);

    if (settings.theme === "custom") {
      // Loaded lazily so the (large) image isn't held in every tab's memory.
      api.storage.local.get("bgImage").then((r) => { if (cloaked && ui && r?.bgImage) ui.setImage(r.bgImage); }).catch(() => {});
    }

    host.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!hasWord()) reveal();                 // no unlock word set: click to restore
      else if (!ui?.keyOnly) ui?.input?.focus();   // New tab: click anywhere to start typing
    });
    if (ui.keyOnly) {                           // dummy pages have no search box: the word is typed blind
      keyBuf = "";
      for (const t of ["keydown", "keyup", "keypress"]) window.addEventListener(t, onCoverKey, true);
    }
    // Keep typed keys away from the page's own shortcuts, and stop it scrolling underneath.
    for (const t of ["keydown", "keyup", "keypress", "input"]) host.addEventListener(t, (e) => e.stopPropagation());
    host.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
    host.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    host.addEventListener("contextmenu", (e) => e.preventDefault());
    document.documentElement.appendChild(host);

    onCloakMedia();
    if (settings.cloakTitle) { cloakTab(); startObserver(); }
    if (!document.hidden && !ui.keyOnly) ui.input?.focus();
  }

  function reveal() {
    if (!cloaked) return;
    cloaked = false;
    forced = false;

    for (const t of ["keydown", "keyup", "keypress"]) window.removeEventListener(t, onCoverKey, true);
    keyBuf = "";
    if (observer) { observer.disconnect(); observer = null; }
    if (ui) { ui.destroy(); ui = null; }
    coverShadow = null;
    if (host) { host.remove(); host = null; }

    if (savedTitle !== null) { document.title = savedTitle; savedTitle = null; }
    restoreIcons();
    onRevealMedia();
    lastActive = Date.now();
  }

  // ---- idle auto-hide ----------------------------------------------------
  for (const evt of ["mousemove", "keydown", "mousedown", "wheel", "touchstart"]) {
    window.addEventListener(evt, () => { lastActive = Date.now(); }, { passive: true, capture: true });
  }
  function checkIdle() {
    if (!api.runtime?.id) { clearInterval(idleTimer); return; }
    const mins = Number(settings.idleMinutes) || 0;
    if (mins <= 0 || cloaked || document.hidden || !shouldCloak()) return;
    if (Date.now() - lastActive >= mins * 60000) cloak(true);
  }
  function syncIdleTimer() {
    if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
    if ((Number(settings.idleMinutes) || 0) > 0) idleTimer = setInterval(checkIdle, 10000);
  }

  // ---- wiring ------------------------------------------------------------
  function onVisibility() {
    if (!api.runtime?.id) {                    // extension was reloaded: this copy is orphaned
      document.removeEventListener("visibilitychange", onVisibility);
      reveal();
      return;
    }
    if (document.hidden) cloak();
    else if (cloaked && !ui?.keyOnly) setTimeout(() => ui?.input?.focus(), 50);   // ready to type the unlock word
  }
  document.addEventListener("visibilitychange", onVisibility);

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg?.type) {
      case "PING":
        sendResponse({ ok: true, cloaked, pinned, listed: listed(), hostname: location.hostname });
        break;
      case "CLOAK_NOW":     // hiding is always allowed; unlocking needs the word
        cloak(true);
        sendResponse({ ok: true, cloaked });
        break;
      case "PIN_CHANGED":
        pinned = !!msg.value;
        sendResponse({ ok: true });
        break;
    }
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue ?? G.DEFAULTS[key];
    iconCache = null;
    const was = cloaked, wasForced = forced;
    if (was) reveal();
    if (was && (wasForced || shouldCloak())) cloak(wasForced);   // re-apply with the new look / settings
    else if (!was && document.hidden) cloak();                   // site may have just been added
    syncIdleTimer();
  });

  (async () => {
    try {
      settings = { ...G.DEFAULTS, ...(await api.storage.sync.get(G.DEFAULTS)) };
    } catch (e) { /* keep defaults */ }
    const st = await send({ type: "GET_TAB_STATE" });
    pinned = !!st?.pinned;
    syncIdleTimer();
    if (document.hidden) cloak();   // tab opened in the background
  })();
})();
