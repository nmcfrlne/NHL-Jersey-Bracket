(() => {
  "use strict";

  const LOGO_EXTS = ["webp","png","svg"];
  const JERSEY_EXTS = [ "png","avif","jpg","webp"];

  const SHOW_TEAM_LABELS = true;

  const withExts = (base, exts) => exts.map(e => `${base}.${e}`);
  const logoSrcs = base => withExts(`images/logos/${base}`, LOGO_EXTS);

  const DEFAULT_JERSEYS = ["home", "away" ,"remix"];
  const STORAGE_KEY = "nhlJerseyBracket.v1";

  const t = (id, name, abbr, color, jerseys = DEFAULT_JERSEYS) =>
    ({ id, name, abbr, color, jerseys });

  const CONFS = ["West", "East"];
  const CONF_NAME = { East: "Eastern Conference", West: "Western Conference" };
  const CONF_COLOR = { East: "#013369", West: "#c8102e" };

  const DIVISIONS = [
    { id: "atlantic", conf: "East", name: "Atlantic Division", abbr: "ATL", teams: [
      t("bruins", "Boston Bruins", "BOS", "#fcb514"),
      t("sabres", "Buffalo Sabres", "BUF", "#002654",["home", "away", "remix", "alternate"]),
      t("red-wings", "Detroit Red Wings", "DET", "#ce1126",["home", "away", "remix", "centennial"]),
      t("panthers", "Florida Panthers", "FLA", "#041e42"),
      t("canadiens", "Montreal Canadiens", "MTL", "#af1e2d"),
      t("senators", "Ottawa Senators", "OTT", "#c52032",["home", "away", "remix", "alternate"]),
      t("lightning", "Tampa Bay Lightning", "TBL", "#002868",["home", "away", "remix", "alternate"]),
      t("maple-leafs", "Toronto Maple Leafs", "TOR", "#00205b",["home", "away", "remix", "alternate"]),
    ]},
    { id: "metropolitan", conf: "East", name: "Metropolitan Division", abbr: "METRO", teams: [
      t("hurricanes", "Carolina Hurricanes", "CAR", "#cc0000",["home", "away", "remix", "alternate"]),
      t("blue-jackets", "Columbus Blue Jackets", "CBJ", "#002654",["home", "away", "remix", "alternate"]),
      t("devils", "New Jersey Devils", "NJD", "#ce1126"),
      t("islanders", "New York Islanders", "NYI", "#00539b"),
      t("rangers", "New York Rangers", "NYR", "#0038a8",["home", "away", "remix", "alternate","centennial"]),
      t("flyers", "Philadelphia Flyers", "PHI", "#f74902"),
      t("penguins", "Pittsburgh Penguins", "PIT", "#fcb514",["home", "away", "remix", "alternate"]),
      t("capitals", "Washington Capitals", "WSH", "#c8102e",["home", "away", "remix", "alternate"]),
    ]},
    { id: "central", conf: "West", name: "Central Division", abbr: "CEN", teams: [
      t("blackhawks", "Chicago Blackhawks", "CHI", "#cf0a2c",["home", "away", "remix", "alternate"]),
      t("avalanche", "Colorado Avalanche", "COL", "#6f263d",["home", "away", "remix","alternate","winter classic"]),
      t("stars", "Dallas Stars", "DAL", "#006847",["home", "away", "remix", "alternate"]),
      t("wild", "Minnesota Wild", "MIN", "#154734",["home", "away", "remix", "alternate"]),
      t("predators", "Nashville Predators", "NSH", "#ffb81c"),
      t("blues", "St. Louis Blues", "STL", "#002f87",["home", "away", "remix", "alternate"]),
      t("mammoth", "Utah Mammoth", "UTA", "#6cace4",["home", "away", "remix", "winter classic"]),
      t("jets", "Winnipeg Jets", "WPG", "#041e42",["home", "away", "remix", "alternate white","alternate navy"]),
    ]},
    { id: "pacific", conf: "West", name: "Pacific Division", abbr: "PAC", teams: [
      t("ducks", "Anaheim Ducks", "ANA", "#f47a38"),
      t("flames", "Calgary Flames", "CGY", "#d2001c",["home", "away", "remix", "alternate"]),
      t("oilers", "Edmonton Oilers", "EDM", "#041e42",["home", "away", "remix", "alternate"]),
      t("kings", "Los Angeles Kings", "LAK", "#111111",["home", "away", "remix", "alternate"]),
      t("sharks", "San Jose Sharks", "SJS", "#006d75",["home", "away", "remix", "alternate"]),
      t("kraken", "Seattle Kraken", "SEA", "#001628",["home", "away", "remix", "alternate"]),
      t("canucks", "Vancouver Canucks", "VAN", "#00205b",["home", "away", "remix", "alternate"]),
      t("golden-knights", "Vegas Golden Knights", "VGK", "#b4975a",["home", "away", "remix", "alternate"]),
    ]},
  ];

  const TEAM = {};
  const DIV = {};
  DIVISIONS.forEach(d => {
    DIV[d.id] = d;
    d.teams.forEach(tm => { TEAM[tm.id] = tm; });
  });
  const ALL_TEAMS = DIVISIONS.flatMap(d => d.teams);

  const state = {
    team: {},        // teamId     -> jersey name
    division: {},    // divisionId -> teamId
    conf: {},        // "East"|"West" -> teamId
    cup: null, // teamId
    toilet: null,    // teamId
  };

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved) Object.assign(state, saved);
    } catch (e) { /* ignore */ }
  }

  // Drop any pick that no longer makes sense after something below it changed.
  function cleanup() {
    DIVISIONS.forEach(d => {
      const w = state.division[d.id];
      if (w && !d.teams.some(tm => tm.id === w)) delete state.division[d.id];
    });
    CONFS.forEach(c => {
      const valid = DIVISIONS.filter(d => d.conf === c).map(d => state.division[d.id]);
      if (state.conf[c] && !valid.includes(state.conf[c])) delete state.conf[c];
    });
    if (state.cup && !CONFS.some(c => state.conf[c] === state.cup)) {
      state.cup = null;
    }
    if (state.toilet) {
      const tm = TEAM[state.toilet.team];
      if (!tm || !tm.jerseys.includes(state.toilet.jersey) || state.team[tm.id] === state.toilet.jersey) {
        state.toilet = null;
      }
    }
  }

  function commit() { cleanup(); save(); render(); }

  const pretty = s => s.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  function isLight(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  function placeholder(line1, line2, color) {
    const fg = isLight(color) ? "#111" : "#fff";
    const second = line2
      ? `<text x="100" y="140" font-family="Arial,sans-serif" font-size="26" text-anchor="middle" fill="${fg}">${line2}</text>`
      : "";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">` +
      `<rect width="200" height="200" rx="16" fill="${color}"/>` +
      `<text x="100" y="${line2 ? 98 : 112}" font-family="Arial,sans-serif" font-size="46" font-weight="700" text-anchor="middle" fill="${fg}">${line1}</text>` +
      second + `</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  const logoAsset = tm => ({
    srcs: logoSrcs(tm.id),
    fallback: placeholder(tm.abbr, "logo", tm.color),
    label: tm.name,
  });

  const jerseyAsset = (tm, j) => ({
    srcs: withExts(`images/jerseys/${tm.id}/${j}`, JERSEY_EXTS),
    fallback: placeholder(tm.abbr, pretty(j), tm.color),
    label: `${tm.name} – ${pretty(j)}`,
  });

  const resolved = new Map();


  function makeImg(asset) {
    const img = new Image();
    const key = asset.srcs.join("|");
    const queue = [...asset.srcs, asset.fallback];
    img.alt = asset.label;
    img.draggable = false;
    img.addEventListener("load", () => { resolved.set(key, img.src); });
    img.addEventListener("error", () => {
      if (queue.length) img.src = queue.shift();
    });
    img.src = resolved.get(key) || queue.shift();
    return img;
  }

  function validPick(tm) {
    const j = state.team[tm.id];
    return j && tm.jerseys.includes(j) ? j : null;
  }

  function teamDisplay(tm) {
    const j = validPick(tm);
    return j ? jerseyAsset(tm, j) : logoAsset(tm);
  }

  function describeSlot(kind, key) {
    if (kind === "team") {
      const tm = TEAM[key];
      return { asset: teamDisplay(tm), picked: !!validPick(tm) };
    }
    if (kind === "division") {
      const d = DIV[key];
      const w = state.division[key];
      if (w) return { asset: teamDisplay(TEAM[w]), picked: true };
      return {
        asset: {
          srcs: logoSrcs(d.id),
          fallback: placeholder(d.abbr, "Division", CONF_COLOR[d.conf]),
          label: d.name,
        },
        picked: false,
      };
    }
    if (kind === "conf") {
      const w = state.conf[key];
      if (w) return { asset: teamDisplay(TEAM[w]), picked: true };
      return {
        asset: {
          srcs: logoSrcs(`${key.toLowerCase()}-championship`),
          fallback: placeholder(key, "Final", CONF_COLOR[key]),
          label: `${CONF_NAME[key]} Championship`,
        },
        picked: false,
      };
    }

    const cupLogo = { srcs: logoSrcs("stanley-cup"), fallback: placeholder("Stanley", "Cup", "#b8860b"), label: "Stanley Cup" };
    const toiletLogo = { srcs: logoSrcs("toilet-bowl"), fallback: placeholder("Toilet", "Bowl", "#777777"), label: "Toilet Bowl (worst jersey)" };

    if (kind === "cup") {
      if (state.cup) {
        return { asset: teamDisplay(TEAM[state.cup]), backdrop: cupLogo, picked: true };
      }
      return { asset: cupLogo, picked: false };
    }

    if (state.toilet) {
      return {
        asset: jerseyAsset(TEAM[state.toilet.team], state.toilet.jersey),
        backdrop: toiletLogo,
        picked: true,
      };
    }
    return { asset: toiletLogo, picked: false };
  }

  const slots = [];

  const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  function addLabel(slot, text) {
    const l = el("span", "label");
    l.textContent = text;
    slot.appendChild(l);
  }

  function slotEl(kind, key, cls = "") {
    const b = el("button", `slot ${kind} ${cls}`.trim());
    b.type = "button";
    b.dataset.kind = kind;
    b.dataset.key = key;
    b.addEventListener("click", e => {
      e.stopPropagation();
      if (anchor === b && !popup.hidden) closePopup();
      else openFor(b);
    });
    slots.push(b);
    return b;
  }

  function buildHalf(conf) {
    const half = el("section", `half ${conf.toLowerCase()}`);
    const divs = el("div", "divisions");

    DIVISIONS.filter(d => d.conf === conf).forEach(d => {
      const row = el("div", "division");
      row.appendChild(slotEl("division", d.id, "light"));
      const grid = el("div", "teams");
      d.teams.forEach(tm => grid.appendChild(slotEl("team", tm.id)));
      row.appendChild(grid);
      divs.appendChild(row);
    });

    const champ = el("div", "champ");
    const wrap = el("div", "champ-wrap");
    const champLabel = el("div", "champ-label");
    champLabel.textContent = CONF_NAME[conf];
    wrap.append(slotEl("conf", conf, "bare"), champLabel);
    champ.appendChild(wrap);
    half.append(divs, champ);
    return half;
  }

  function render() {
    slots.forEach(b => {
      const { asset, backdrop, picked } = describeSlot(b.dataset.kind, b.dataset.key);
      const sig = asset.srcs.join("|") + (backdrop ? "+" + backdrop.srcs.join("|") : "");
      if (b.dataset.sig !== sig) {
        b.dataset.sig = sig;
        if (backdrop) {
          const back = makeImg(backdrop);
          back.className = "backdrop";
          const front = makeImg(asset);
          front.className = "front";
          b.replaceChildren(back, front);
        } else {
          b.replaceChildren(makeImg(asset));
        }
        if (b.dataset.kind === "team") {
          const tm = TEAM[b.dataset.key];
          const j = validPick(tm);
          const tag = el("span", "tag");
          tag.textContent = j ? pretty(j) : tm.name;
          b.appendChild(tag);
          if (SHOW_TEAM_LABELS) addLabel(b, tm.name);
        } else if (b.dataset.kind === "division") {
          addLabel(b, DIV[b.dataset.key].name);
        }
      }
      b.classList.toggle("picked", picked);
      b.classList.toggle("layered", !!backdrop);
      b.title = asset.label;
      b.setAttribute("aria-label", asset.label);
    });
  }

  const popup = document.getElementById("popup");
  let anchor = null;

  function closePopup() {
    popup.hidden = true;
    popup.replaceChildren();
    anchor = null;
  }

  function positionPopup(slot) {
    const r = slot.getBoundingClientRect();
    const pw = popup.offsetWidth, ph = popup.offsetHeight, m = 8;
    let left = r.left + r.width / 2 - pw / 2;
    left = Math.max(m, Math.min(left, window.innerWidth - pw - m));
    let top = r.bottom + m;
    if (top + ph > window.innerHeight - m) top = Math.max(m, r.top - ph - m);
    popup.style.left = left + "px";
    popup.style.top = top + "px";
  }

  function showPopup(slot, { title, items, empty, onClear }) {
    popup.replaceChildren();

    const head = el("div", "popup-head");
    const h = el("span");
    h.textContent = title;
    head.appendChild(h);
    if (onClear) {
      const c = el("button");
      c.type = "button";
      c.textContent = "Clear";
      c.addEventListener("click", () => { onClear(); commit(); closePopup(); });
      head.appendChild(c);
    }
    popup.appendChild(head);

    if (!items.length) {
      const p = el("div", "popup-empty");
      p.textContent = empty;
      popup.appendChild(p);
    } else {
      const grid = el("div", "popup-grid");
      grid.style.setProperty("--cols", Math.min(items.length, items.length > 8 ? 6 : 4));
      items.forEach(item => {
        const b = el("button", "choice");
        b.type = "button";
        const cap = el("span");
        cap.textContent = item.caption;
        b.append(makeImg(item.asset), cap);
        b.addEventListener("click", () => { item.onPick(); commit(); closePopup(); });
        grid.appendChild(b);
      });
      popup.appendChild(grid);
    }

    popup.hidden = false;
    anchor = slot;
    positionPopup(slot);
  }

  function openFor(slot) {
    const { kind, key } = slot.dataset;

    const teamItems = ids => ids.map(id => ({
      asset: teamDisplay(TEAM[id]),
      caption: TEAM[id].name,
      onPick: null,
    }));

    if (kind === "team") {
      const tm = TEAM[key];
      showPopup(slot, {
        title: `${tm.name}`,
        items: tm.jerseys.map(j => ({
          asset: jerseyAsset(tm, j),
          caption: pretty(j),
          onPick: () => { state.team[tm.id] = j; },
        })),
        onClear: state.team[tm.id] ? () => { delete state.team[tm.id]; } : null,
      });
      return;
    }

    if (kind === "toilet") {
      const items = [];
      ALL_TEAMS.forEach(tm => tm.jerseys.forEach(j => {
        if (state.team[tm.id] === j) return;
        items.push({
          asset: jerseyAsset(tm, j),
          caption: `${tm.name} – ${pretty(j)}`,
          onPick: () => { state.toilet = { team: tm.id, jersey: j }; },
        });
      }));
      showPopup(slot, {
        title: "Toilet Bowl – worst jersey (jerseys you didn't pick as a favourite)",
        items,
        empty: "Every jersey has been picked as a favourite.",
        onClear: state.toilet ? () => { state.toilet = null; } : null,
      });
      return;
    }

    let title, ids, empty, get, set, clear;

    if (kind === "division") {
      const d = DIV[key];
      title = `${d.name} winner`;
      ids = d.teams.map(tm => tm.id);
      get = () => state.division[d.id];
      set = id => { state.division[d.id] = id; };
      clear = () => { delete state.division[d.id]; };
    } else if (kind === "conf") {
      title = `${CONF_NAME[key]} champion`;
      ids = DIVISIONS.filter(d => d.conf === key).map(d => state.division[d.id]).filter(Boolean);
      empty = "Pick your division winners first.";
      get = () => state.conf[key];
      set = id => { state.conf[key] = id; };
      clear = () => { delete state.conf[key]; };
    } else if (kind === "cup") {
      title = "Stanley Cup champion";
      ids = CONFS.map(c => state.conf[c]).filter(Boolean);
      empty = "Pick both conference champions first.";
      get = () => state.cup;
      set = id => { state.cup = id; };
      clear = () => { state.cup = null; };
    } else {
      return;
    }

    const items = teamItems(ids).map((it, i) => ({ ...it, onPick: () => set(ids[i]) }));
    showPopup(slot, { title, items, empty, onClear: get() ? clear : null });
  }

  document.addEventListener("click", e => {
    if (!popup.hidden && !popup.contains(e.target)) closePopup();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closePopup(); });
  window.addEventListener("resize", closePopup);


  document.body.classList.toggle("show-team-labels", SHOW_TEAM_LABELS);

  const halves = document.getElementById("halves");
  halves.append(buildHalf("West"), buildHalf("East"));
  document.getElementById("center-top").appendChild(slotEl("cup", "cup", "bare"));
  document.getElementById("center-bottom").appendChild(slotEl("toilet", "toilet", "bare"));

  document.getElementById("reset").addEventListener("click", () => {
    if (!confirm("Clear all of your picks?")) return;
    state.team = {}; state.division = {}; state.conf = {};
    state.cup = null; state.toilet = null;
    commit();
  });

  const WATERMARK_TEXT = "github.com/nmcfrlne/";
  const EXPORT_SCALE = 2;              // 2 = double resolution (sharper image)
  const EXPORT_FILENAME = "nhl-jersey-bracket.png";

  const bgImg = new Image();
  bgImg.src = "images/background.jpg";

  const stageEl = document.querySelector(".stage");
  const watermark = el("div", "watermark");
  watermark.textContent = WATERMARK_TEXT;
  stageEl.appendChild(watermark);

  const exportBtn = el("button");
  exportBtn.type = "button";
  exportBtn.id = "export";
  exportBtn.textContent = "Export image";
  document.getElementById("reset").after(exportBtn);

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Same as CSS linear-gradient(<deg>, ...) for a box.
  function cssGradient(ctx, x, y, w, h, deg) {
    const a = deg * Math.PI / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const len = Math.abs(w * dx) + Math.abs(h * dy);
    const cx = x + w / 2, cy = y + h / 2;
    return ctx.createLinearGradient(
      cx - dx * len / 2, cy - dy * len / 2,
      cx + dx * len / 2, cy + dy * len / 2);
  }

  function drawContain(ctx, img, r) {
    if (!img.complete || !img.naturalWidth) return;
    const k = Math.min(r.w / img.naturalWidth, r.h / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
  }

  function fitText(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + "…").width > maxW) text = text.slice(0, -1);
    return text + "…";
  }

  function exportImage() {
    closePopup();
    const sr = stageEl.getBoundingClientRect();
    const S = EXPORT_SCALE;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sr.width * S);
    canvas.height = Math.round(sr.height * S);
    const ctx = canvas.getContext("2d");
    ctx.scale(S, S);

    const box = e => {
      const r = e.getBoundingClientRect();
      return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    };

    if (bgImg.complete && bgImg.naturalWidth) {
  const k = Math.max(sr.width / bgImg.naturalWidth, sr.height / bgImg.naturalHeight);
  const w = bgImg.naturalWidth * k, h = bgImg.naturalHeight * k;
  ctx.drawImage(bgImg, (sr.width - w) / 2, (sr.height - h) / 2, w, h);
} else {
  ctx.fillStyle = "#001b36";
  ctx.fillRect(0, 0, sr.width, sr.height);
}
const bg = ctx.createLinearGradient(0, 0, sr.width, 0);
bg.addColorStop(0, "rgba(0,27,54,.85)");
bg.addColorStop(0.3, "rgba(0,27,54,.85)");
bg.addColorStop(0.7, "rgba(138,11,36,.85)");
bg.addColorStop(1, "rgba(138,11,36,.85)");
ctx.fillStyle = bg;
ctx.fillRect(0, 0, sr.width, sr.height);

    slots.forEach(slot => {
      const r = box(slot);
      const picked = slot.classList.contains("picked");
      const layered = slot.classList.contains("layered");
      const bare = slot.classList.contains("bare");

      if (!layered && !(bare && !picked)) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,.4)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        roundRectPath(ctx, r.x, r.y, r.w, r.h, 14);
        if (picked) {
          ctx.fillStyle = "#141414";
        } else {
          const g = cssGradient(ctx, r.x, r.y, r.w, r.h, 145);
          g.addColorStop(0, "rgba(255,255,255,.13)");
          g.addColorStop(1, "rgba(0,0,0,.30)");
          ctx.fillStyle = g;
        }
        ctx.fill();
        ctx.restore();
        roundRectPath(ctx, r.x + .5, r.y + .5, r.w - 1, r.h - 1, 14);
        ctx.lineWidth = 1;
        ctx.strokeStyle = picked ? "#ffd54a"
          : slot.classList.contains("light") ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.16)";
        ctx.stroke();
      }

      ctx.save();
      if (!layered) { roundRectPath(ctx, r.x, r.y, r.w, r.h, 14); ctx.clip(); }
      slot.querySelectorAll("img").forEach(img => {
        ctx.save();
        if (img.classList.contains("front")) {
          ctx.shadowColor = "rgba(0,0,0,.45)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 4;
        }
        drawContain(ctx, img, box(img));
        ctx.restore();
      });

      slot.querySelectorAll(".label").forEach(lab => {
        const lr = box(lab);
        const cs = getComputedStyle(lab);
        const g = ctx.createLinearGradient(0, lr.y, 0, lr.y + lr.h);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,.85)");
        ctx.fillStyle = g;
        ctx.fillRect(lr.x, lr.y, lr.w, lr.h);
        ctx.fillStyle = "#fff";
        ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const fs = parseFloat(cs.fontSize);
        const pb = parseFloat(cs.paddingBottom);
        ctx.fillText(fitText(ctx, lab.textContent, lr.w - 12), lr.x + lr.w / 2, lr.y + lr.h - pb - fs * 0.6);
      });
      ctx.restore();
    });

    document.querySelectorAll(".champ-label").forEach(p => {
      const pr = box(p);
      const cs = getComputedStyle(p);
      ctx.fillStyle = "rgba(0,0,0,.4)";
      roundRectPath(ctx, pr.x, pr.y, pr.w, pr.h, pr.h / 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.textContent, pr.x + pr.w / 2, pr.y + pr.h / 2 + 0.5);
    });

    // watermark
    const wr = box(watermark);
    const wcs = getComputedStyle(watermark);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = `${wcs.fontWeight} ${wcs.fontSize} ${wcs.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(watermark.textContent, wr.x + wr.w / 2, wr.y + wr.h / 2);

    try {
      canvas.toBlob(blob => {
        if (!blob) { alert("Sorry, the image could not be created."); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = EXPORT_FILENAME;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    } catch (err) {
      alert("The browser blocked the export because the images were loaded from local files. " +
            "Open the page through a web server (or GitHub Pages) and try again.");
    }
  }

  exportBtn.addEventListener("click", exportImage);

  load();
  cleanup();
  render();
})();