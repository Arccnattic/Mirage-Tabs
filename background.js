const api = globalThis.browser ?? globalThis.chrome;

// Small bits of state must survive the service worker being put to sleep, so they live in
// session storage (falls back to memory where that API doesn't exist).
const session = api.storage.session ?? null;
const memory = {};
async function readSet(key) {
  if (!session) return (memory[key] ??= new Set());
  const r = await session.get(key);
  return new Set(r[key] || []);
}
async function writeSet(key, set) {
  if (!session) { memory[key] = set; return; }
  await session.set({ [key]: [...set] });
}

// ---- install: reach tabs that were already open ------------------------------
api.runtime.onInstalled.addListener(async () => {
  const tabs = await api.tabs.query({ url: ["http://*/*", "https://*/*"] });
  for (const tab of tabs) {
    if (tab.discarded) continue; // sleeping tabs get the normal content script when they wake
    try {
      await api.scripting.executeScript({ target: { tabId: tab.id }, files: ["ntp.js", "covers.js", "content.js"] });
    } catch (e) { /* protected page; ignore */ }
  }
});

// ---- per-tab pin: "hide THIS tab" regardless of the site list -----------------
async function setPin(tabId, value) {
  const pinned = await readSet("pinned");
  if (value) pinned.add(tabId); else pinned.delete(tabId);
  await writeSet("pinned", pinned);
  api.tabs.sendMessage(tabId, { type: "PIN_CHANGED", value }).catch(() => {});
}

// ---- mute: only ever un-mute tabs that we muted ------------------------------
async function setMute(tabId, mute) {
  const ours = await readSet("muted");
  if (mute) {
    const tab = await api.tabs.get(tabId);
    if (tab.mutedInfo?.muted) return;
    ours.add(tabId);
    await writeSet("muted", ours);
    await api.tabs.update(tabId, { muted: true });
  } else if (ours.has(tabId)) {
    ours.delete(tabId);
    await writeSet("muted", ours);
    await api.tabs.update(tabId, { muted: false });
  }
}

api.tabs.onRemoved.addListener(async (tabId) => {
  for (const key of ["pinned", "muted"]) {
    const s = await readSet(key);
    if (s.delete(tabId)) await writeSet(key, s);
  }
});

// ---- panic shortcut (Alt+X): pin this tab and hide it right now ---------------
api.commands?.onCommand.addListener(async (command) => {
  if (command !== "panic-cloak") return;
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await setPin(tab.id, true);
  api.tabs.sendMessage(tab.id, { type: "CLOAK_NOW" }).catch(() => {});
});

// ---- messages from content scripts and the popup ----------------------------------
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  switch (msg?.type) {
    case "OPEN_URL":
      if (tabId !== undefined && /^https?:\/\//i.test(msg.url || "")) {
        api.tabs.create({ url: msg.url, index: sender.tab.index + 1 });
      }
      return;
    case "GET_TAB_STATE":
      readSet("pinned").then((s) => sendResponse({ pinned: tabId !== undefined && s.has(tabId) }));
      return true;
    case "SET_PIN":
      if (typeof msg.tabId !== "number") return;
      setPin(msg.tabId, !!msg.value).then(() => sendResponse({ ok: true }));
      return true;
    case "SET_MUTE":
      if (tabId === undefined) return;
      setMute(tabId, !!msg.mute).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
      return true;
  }
});
