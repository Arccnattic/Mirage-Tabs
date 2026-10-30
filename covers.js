// Dummy pages that can hide a tab instead of the New tab page. Each is a plain, static, believable page.
// They have no search box: the unlock word is typed blind (see onCoverKey in content.js).
(() => {
  const N = globalThis.MirageNtp;
  const { el } = N;
  const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

  const h = (tag, st = {}, ...kids) => {
    const e = el(tag, st);
    for (const k of kids.flat()) if (k !== null && k !== undefined) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const row = (st, ...kids) => h("div", { display: "flex", "align-items": "center", ...st }, ...kids);
  const root = (bg, font = FONT, color = "#202124") => h("div", {
    position: "absolute", inset: "0", overflow: "hidden", background: bg, "font-family": font, color, cursor: "default", "user-select": "none",
  });
  const done = (r, title, iconSvg, input) => ({ root: r, input: input || null, keyOnly: true, setImage() {}, destroy() {}, title, iconSvg });

  // A real <input> dressed up as part of the page. Enter with the unlock word restores the page; anything else is ignored.
  // With `initial`, the text is pre-filled and selected on focus (like editing a cell) and put back afterwards.
  const field = (opts, placeholder, st = {}, initial = "") => {
    const i = el("input", { border: "0", outline: "0", background: "transparent", color: "inherit", font: "inherit", padding: "0", margin: "0", width: "100%", "min-width": "0", ...st });
    i.type = "text";
    i.setAttribute("autocomplete", "off");
    i.setAttribute("spellcheck", "false");
    if (placeholder) i.placeholder = placeholder;
    i.value = initial;
    const reset = () => { i.value = initial; };
    if (initial) { i.addEventListener("focus", () => i.select()); i.addEventListener("blur", reset); }
    i.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const v = i.value;
      reset();
      opts.onSubmit?.(v);
    });
    if (!opts.onSubmit) i.disabled = true;
    return i;
  };
  // An invisible input laid over some existing text: click the text, type the word (nothing shows), press Enter.
  const hotspot = (opts, textEl, st = {}) => {
    const i = field(opts, "", { position: "absolute", inset: "0", height: "100%", color: "transparent", "caret-color": "transparent" });
    return [h("div", { position: "relative", width: "fit-content", ...st }, textEl, i), i];
  };
  const sysDark = () => !!globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const svg = (inner, bg) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' + (bg || "") + inner + "</svg>";
  const ICON = {
    doc: svg('<path d="M8 8h8M8 12h8M8 16h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>', '<rect x="3" y="1" width="18" height="22" rx="3" fill="#4a86e8"/>'),
    sheet: svg('<path d="M7 8h10M7 12h10M7 16h10M12 6v12" stroke="#fff" stroke-width="1.6"/>', '<rect x="3" y="1" width="18" height="22" rx="3" fill="#2e9d5a"/>'),
    mail: svg('<path d="M5 8l7 5 7-5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>', '<rect x="2" y="4" width="20" height="16" rx="3" fill="#d9534f"/>'),
    pdf: svg('<text x="12" y="15.5" font-family="Arial" font-size="7.5" font-weight="700" text-anchor="middle" fill="#fff">PDF</text>', '<rect x="3" y="1" width="18" height="22" rx="3" fill="#e04b3f"/>'),
    book: svg('<path d="M6 6h12v13H6zM12 6v13" fill="none" stroke="#fff" stroke-width="1.6"/>', '<rect x="3" y="2" width="18" height="20" rx="3" fill="#6b7280"/>'),
    globe: svg('<circle cx="12" cy="12" r="9" fill="none" stroke="#80868b" stroke-width="2"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" fill="none" stroke="#80868b" stroke-width="1.6"/>'),
  };

  // ---- Document ---------------------------------------------------------------
  function documentCover(opts) {
    const r = root("#f9fbfd");
    const search = field(opts, "Search the menus");
    const menu = ["File", "Edit", "View", "Insert", "Format", "Tools", "Extensions", "Help"];
    r.append(
      h("div", { background: "#fff", padding: "10px 18px 0", "border-bottom": "1px solid #e3e6ea" },
        row({ gap: "12px", "justify-content": "space-between", "align-items": "flex-start" },
          row({ gap: "12px" },
            h("div", { width: "26px", height: "34px", "border-radius": "4px", background: "#4a86e8" }),
            h("div", {},
              h("div", { "font-size": "18px" }, "Untitled document"),
              row({ gap: "16px", "font-size": "13px", margin: "2px 0 8px" }, ...menu.map((m) => h("span", {}, m))))),
          row({ background: "#edf2fa", "border-radius": "20px", padding: "7px 16px", width: "230px", "box-sizing": "border-box", "font-size": "13px", "margin-top": "2px" }, search))),
      row({ gap: "20px", margin: "10px 18px", padding: "7px 16px", background: "#edf2fa", "border-radius": "22px", "font-size": "13px", width: "fit-content" },
        ...["100%", "Normal text", "Arial", "11", "B", "I", "U", "A"].map((t) => h("span", {
          "font-weight": t === "B" ? "700" : "400", "font-style": t === "I" ? "italic" : "normal", "text-decoration": t === "U" ? "underline" : "none",
        }, t))),
      h("div", {
        width: "816px", "max-width": "86%", height: "100%", margin: "14px auto 0", background: "#fff", "box-shadow": "0 0 0 1px #dadce0",
        padding: "72px 80px", "box-sizing": "border-box", "font-family": "Arial, sans-serif", "font-size": "14px", "line-height": "1.65",
      },
        h("div", { "font-size": "26px", "font-weight": "700", "margin-bottom": "2px" }, "Project status update"),
        h("div", { color: "#5f6368", "margin-bottom": "22px" }, "Prepared for the weekly review"),
        h("div", { "font-weight": "700" }, "1. Overview"),
        h("div", { "margin-bottom": "14px" }, "This document summarises progress across the active workstreams since the last review and lists the items that still need a decision. Figures are provisional and will be confirmed once the month-end close is complete."),
        h("div", { "font-weight": "700" }, "2. Progress"),
        h("div", { "margin-bottom": "14px" },
          h("div", {}, "\u2022  Onboarding materials have been drafted and sent to the team for comments."),
          h("div", {}, "\u2022  The vendor comparison is complete; two options remain under consideration."),
          h("div", {}, "\u2022  Testing of the revised workflow is scheduled to start next week.")),
        h("div", { "font-weight": "700" }, "3. Open items"),
        h("div", {},
          h("div", {}, "\u2022  Confirm the timeline with the steering group."),
          h("div", {}, "\u2022  Agree who owns the follow-up actions."),
          h("div", {}, "\u2022  Update the risk register before the next meeting."))),
    );
    return done(r, "Untitled document", ICON.doc, search);
  }

  // ---- Spreadsheet ------------------------------------------------------------
  function sheetCover(opts) {
    const r = root("#fff");
    const formula = field(opts, "", {}, "4200");
    const menu = ["File", "Edit", "View", "Insert", "Format", "Data", "Tools", "Help"];
    r.append(
      h("div", { padding: "10px 18px 0", "border-bottom": "1px solid #e3e6ea" },
        row({ gap: "12px" },
          h("div", { width: "26px", height: "34px", "border-radius": "4px", background: "#2e9d5a" }),
          h("div", {},
            h("div", { "font-size": "18px" }, "Untitled spreadsheet"),
            row({ gap: "16px", "font-size": "13px", margin: "2px 0 8px" }, ...menu.map((m) => h("span", {}, m)))))),
      row({ gap: "14px", padding: "6px 14px", "border-bottom": "1px solid #e3e6ea", "font-size": "13px" },
        h("span", { color: "#5f6368", width: "60px" }, "B2"), h("span", { color: "#5f6368", "font-style": "italic" }, "fx"), row({ flex: "1" }, formula)),
    );
    const data = [["Item", "Q1", "Q2", "Q3", "Q4", "Total"], ["Licences", 4200, 4350, 4100, 4600], ["Hardware", 12800, 9400, 7600, 11200],
      ["Travel", 3100, 2800, 4400, 3900], ["Training", 1800, 2200, 1500, 2600], ["Support", 5200, 5200, 5400, 5600]];
    for (const d of data.slice(1)) d.push(d.slice(1, 5).reduce((a, b) => a + b, 0));
    const totals = ["Total"]; for (let c = 1; c <= 5; c++) totals.push(data.slice(1).reduce((a, d) => a + d[c], 0));
    data.push(totals);
    const grid = h("div", { display: "grid", "grid-template-columns": "46px repeat(10, 96px)", "grid-auto-rows": "26px", "font-size": "13px", "line-height": "26px" });
    const cell = (text, st = {}) => grid.append(h("div", { padding: "0 6px", "border-right": "1px solid #e2e3e3", "border-bottom": "1px solid #e2e3e3", overflow: "hidden", "white-space": "nowrap", ...st }, text));
    cell("", { background: "#f8f9fa" });
    for (let c = 0; c < 10; c++) cell(String.fromCharCode(65 + c), { background: "#f8f9fa", "text-align": "center", color: "#5f6368" });
    for (let rr = 0; rr < 30; rr++) {
      cell(String(rr + 1), { background: "#f8f9fa", "text-align": "center", color: "#5f6368" });
      for (let c = 0; c < 10; c++) {
        const v = data[rr]?.[c];
        const head = rr === 0 && v !== undefined, sum = (rr === 6 || c === 5) && v !== undefined;
        cell(v === undefined ? "" : typeof v === "number" ? v.toLocaleString() : v, {
          "text-align": typeof v === "number" ? "right" : "left", "font-weight": head || sum ? "700" : "400",
          background: head ? "#e8f0fe" : "#fff", ...(rr === 1 && c === 1 ? { outline: "2px solid #1a73e8", "outline-offset": "-2px" } : {}),
        });
      }
    }
    r.append(h("div", { overflow: "hidden", height: "100%" }, grid),
      row({ position: "absolute", left: "0", right: "0", bottom: "0", height: "34px", background: "#f8f9fa", "border-top": "1px solid #e3e6ea", padding: "0 14px", gap: "18px", "font-size": "13px" },
        h("span", { "font-weight": "600", color: "#188038" }, "Sheet1"), h("span", { color: "#5f6368" }, "+")));
    return done(r, "Untitled spreadsheet", ICON.sheet, formula);
  }

  // ---- Inbox ----------------------------------------------------------------------
  function inboxCover(opts) {
    const r = root("#f6f8fc");
    const search = field(opts, "Search mail");
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString([], { month: "short", day: "numeric" }); };
    const mails = [
      ["Team Digest", "Your weekly summary is ready", "See what changed across your projects this week\u2026", "9:42 AM", 1],
      ["Calendar", "Reminder: planning review at 3 PM", "Tomorrow \u2022 Conference room B \u2022 45 min", "8:15 AM", 1],
      ["Billing", "Your invoice for this month is available", "Amount due and payment details are attached\u2026", day(1), 1],
      ["Library Services", "Items due soon", "Two items are due on Friday. Renew online to avoid\u2026", day(2), 0],
      ["HR Portal", "Benefits enrolment closes soon", "Review your choices before the deadline\u2026", day(3), 0],
      ["Campus News", "This week on campus", "Events, notices and deadlines you may have missed\u2026", day(4), 0],
      ["Travel Desk", "Booking confirmation", "Your reservation has been confirmed. Details below\u2026", day(5), 0],
      ["Support", "Re: Your request has been updated", "Hi, we've looked into this and have a few\u2026", day(6), 0],
      ["Newsletter", "Ten tips for better meetings", "Short, practical ideas you can use right away\u2026", day(7), 0],
      ["Security Team", "New sign-in to your account", "We noticed a sign-in from a new device. If this\u2026", day(8), 0],
      ["Facilities", "Planned maintenance on Saturday", "Some services may be unavailable between 6 and\u2026", day(9), 0],
      ["Recruiting", "Interview schedule for next week", "Please find the updated schedule attached for\u2026", day(10), 0],
    ];
    const folders = [["Inbox", "3"], ["Starred", ""], ["Sent", ""], ["Drafts", ""], ["Spam", ""], ["Trash", ""]];
    r.append(row({ height: "100%", "align-items": "stretch" },
      h("div", { width: "230px", padding: "16px 12px", "box-sizing": "border-box", "flex-shrink": "0" },
        h("div", { background: "#c2e7ff", "border-radius": "16px", padding: "14px 22px", "font-weight": "600", "font-size": "14px", width: "fit-content", margin: "0 0 18px 4px" }, "Compose"),
        ...folders.map(([n, c], i) => row({ "justify-content": "space-between", padding: "7px 14px", "border-radius": "0 16px 16px 0", "font-size": "14px", background: i === 0 ? "#d3e3fd" : "none", "font-weight": i === 0 ? "700" : "400" }, h("span", {}, n), h("span", {}, c)))),
      h("div", { flex: "1", "min-width": "0", background: "#fff", "border-radius": "16px 0 0 0", overflow: "hidden", "margin-top": "8px" },
        row({ height: "52px", padding: "0 20px", "border-bottom": "1px solid #eceff3" },
          row({ background: "#eaf1fb", "border-radius": "24px", padding: "9px 20px", width: "55%", "box-sizing": "border-box", "font-size": "14px" }, search)),
        ...mails.map(([from, subj, snip, when, unread]) => row({ height: "42px", padding: "0 20px", gap: "16px", "border-bottom": "1px solid #f0f2f5", "font-size": "14px", background: unread ? "#fff" : "#f6f8fc", "font-weight": unread ? "700" : "400" },
          h("span", { width: "170px", "flex-shrink": "0", overflow: "hidden", "white-space": "nowrap", "text-overflow": "ellipsis" }, from),
          h("span", { flex: "1", "min-width": "0", overflow: "hidden", "white-space": "nowrap", "text-overflow": "ellipsis" }, subj, h("span", { "font-weight": "400", color: "#5f6368" }, "  \u2013  " + snip)),
          h("span", { "flex-shrink": "0", "font-size": "12px" }, when))))));
    return done(r, "Inbox (3)", ICON.mail, search);
  }

  // ---- PDF report -------------------------------------------------------------------
  function pdfCover(opts) {
    const r = root("#525659");
    const page = field(opts, "", { width: "30px", "text-align": "center", background: "#1f2123", "border-radius": "3px", padding: "3px 0", color: "#e8eaed" }, "1");
    r.append(
      row({ position: "absolute", top: "0", left: "0", right: "0", height: "48px", background: "#323639", color: "#e8eaed", padding: "0 18px", "justify-content": "space-between", "font-size": "13px", "z-index": "1" },
        h("span", {}, "report.pdf"), row({ gap: "6px" }, page, h("span", {}, "/ 8")), h("span", {}, "100%")),
      h("div", { width: "640px", "max-width": "80%", height: "100%", margin: "72px auto 0", background: "#fff", padding: "56px 64px", "box-sizing": "border-box", "font-family": "Arial, sans-serif", "font-size": "12px", "line-height": "1.7", color: "#222", "box-shadow": "0 2px 10px rgba(0,0,0,.4)" },
        h("div", { "font-size": "28px", "font-weight": "700", "margin-bottom": "4px" }, "Annual Report"),
        h("div", { color: "#666", "margin-bottom": "26px" }, "Summary of activities and results"),
        h("div", { "font-size": "15px", "font-weight": "700", "margin-bottom": "6px" }, "Contents"),
        ...["1. Executive summary", "2. Key results", "3. Resources and spending", "4. Priorities for next year"].map((t) => h("div", {}, t)),
        h("div", { "font-size": "15px", "font-weight": "700", margin: "24px 0 6px" }, "1. Executive summary"),
        h("div", {}, "This report presents an overview of the organisation's activities during the year, including key results, resource use and priorities for the period ahead. Detailed tables are provided in the appendices."),
        h("div", { margin: "12px 0" }, "Overall, the year was characterised by steady progress against the agreed plan. Most targets were met, and the remaining items have been carried into the next planning cycle.")));
    return done(r, "report.pdf", ICON.pdf, page);
  }

  // ---- Encyclopedia article ---------------------------------------------------------------
  function articleCover(opts) {
    const r = root("#fff", "Georgia, 'Times New Roman', serif");
    const search = field(opts, "Search", { "font-family": FONT });
    const sans = { "font-family": FONT };
    const p = (t) => h("div", { margin: "0 0 12px", "font-size": "15px", "line-height": "1.7" }, t);
    r.append(
      row({ height: "52px", padding: "0 24px", "justify-content": "space-between", "border-bottom": "1px solid #dfe1e5", ...sans },
        h("span", { "font-size": "20px", "font-family": "Georgia, serif" }, "Encyclopedia"),
        row({ border: "1px solid #c8ccd1", padding: "6px 14px", width: "220px", "box-sizing": "border-box", "font-size": "13px" }, search)),
      h("div", { width: "880px", "max-width": "88%", margin: "22px auto 0" },
        h("div", { "font-size": "30px", "border-bottom": "1px solid #a2a9b1", "padding-bottom": "6px", "margin-bottom": "4px" }, "History of the printing press"),
        h("div", { ...sans, "font-size": "12px", color: "#54595d", "margin-bottom": "14px" }, "From the free encyclopedia"),
        p("The history of the printing press covers the development of mechanical printing from early block printing to the movable-type presses of the fifteenth century and beyond. Block printing was used in East Asia for centuries, and movable type was developed in China and Korea well before it appeared in Europe."),
        h("div", { ...sans, border: "1px solid #a2a9b1", background: "#f8f9fa", padding: "10px 16px", width: "fit-content", margin: "4px 0 14px", "font-size": "13px", "line-height": "1.6" },
          h("div", { "font-weight": "700" }, "Contents"), ...["1  Early printing", "2  Movable type", "3  Spread in Europe", "4  Later developments"].map((t) => h("div", { color: "#0645ad" }, t))),
        h("div", { "font-size": "22px", "border-bottom": "1px solid #a2a9b1", margin: "6px 0 10px" }, "Early printing"),
        p("The earliest surviving printed texts were produced from carved wooden blocks. The technique allowed a single design to be copied many times, but a new block had to be carved for every page."),
        p("Around 1440 the goldsmith Johannes Gutenberg began working in Mainz on a system that combined metal type, oil-based ink and a screw press. Within a few decades printing workshops had spread across much of Europe, sharply reducing the cost of books.")));
    return done(r, "History of the printing press \u2013 Encyclopedia", ICON.book, search);
  }

  // ---- 404 Not Found ---------------------------------------------------------------------------
  function notFoundCover(opts) {
    const r = root("#fff", "'Times New Roman', Times, serif", "#000");
    const [spot, input] = hotspot(opts, h("div", { "font-size": "16px" }, "nginx"), { margin: "0 auto" });
    r.append(h("div", { "text-align": "center", "padding-top": "8px" },
      h("div", { "font-size": "32px", "font-weight": "700", margin: "21px 0" }, "404 Not Found"),
      h("div", { height: "1px", background: "#9a9a9a", margin: "8px 8px" }),
      spot));
    return done(r, "404 Not Found", ICON.globe, input);
  }

  // ---- "Can't reach this page" (matches the address bar, which still shows the real site) --------
  function errorCover(opts) {
    const dark = sysDark();
    const host = (opts.hostname || "example.com").replace(/^www\./, "");
    const sub = dark ? "#9aa0a6" : "#5f6368";
    const r = root(dark ? "#202124" : "#fff", FONT, dark ? "#e8eaed" : "#202124");
    const [spot, input] = hotspot(opts, h("div", { "font-size": "12px", color: sub }, "ERR_CONNECTION_TIMED_OUT"), { "margin-bottom": "22px" });
    r.append(h("div", { width: "560px", "max-width": "86%", margin: "16vh auto 0" },
      h("div", { "font-size": "64px", color: sub, "margin-bottom": "14px", "line-height": "1" }, ":("),
      h("div", { "font-size": "28px", "font-weight": "600", "margin-bottom": "12px" }, "Hmmm\u2026 can\u2019t reach this page"),
      h("div", { "font-size": "15px", "margin-bottom": "18px" }, host + " took too long to respond."),
      h("div", { "font-size": "14px", color: sub, "line-height": "1.8", "margin-bottom": "18px" },
        h("div", {}, "Try:"), h("div", {}, "\u2022  Checking the connection"), h("div", {}, "\u2022  Checking the proxy and the firewall")),
      spot,
      h("div", { background: "#0b57d0", color: "#fff", padding: "9px 26px", "border-radius": "6px", width: "fit-content", "font-size": "14px", "font-weight": "600" }, "Refresh")));
    return done(r, host, ICON.globe, input);
  }

  const BUILDERS = { document: documentCover, sheet: sheetCover, inbox: inboxCover, pdf: pdfCover, article: articleCover, notfound: notFoundCover, error: errorCover };
  N.buildCover = (id, opts) => (BUILDERS[id] ? BUILDERS[id](opts || {}) : N.build(opts));
})();
