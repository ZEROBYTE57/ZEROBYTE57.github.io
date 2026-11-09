// 404 REALM: esports-broadcast gaming page. Data: config.js, ../data/*.json,
// ../blog/posts/index.json, Discord (live) and Lanyard (live, optional).
(() => {
  const R = window.REALM || {}, G = R.gaming || {}, P = R.player || {};
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const getJSON = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  const fmt = (n) => (n == null || Number.isNaN(n) ? "–" : Number(n).toLocaleString("en-US"));
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const empty = (html) => { const n = el("p", "empty"); n.innerHTML = html; return n; };

  // Animated number for the headline strip.
  function countTo(node, value) {
    if (value == null) return;
    if (reduce) { node.textContent = fmt(value); return; }
    const start = performance.now(), dur = 1100;
    const step = (t) => { const p = Math.min(1, (t - start) / dur); node.textContent = fmt(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // ---------- intro stinger (once per session), clock, year ----------
  let seen = false;
  try { seen = sessionStorage.getItem("realm-stinger") === "1"; sessionStorage.setItem("realm-stinger", "1"); } catch (e) {}
  const st = $("#stinger");
  if (seen || reduce) st.classList.add("off"); else setTimeout(() => st.classList.add("off"), 1400);
  $("#year").textContent = new Date().getFullYear();
  const clockF = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  const tickClock = () => { const t = clockF.format(new Date()); $("#clock").textContent = t + " IST"; const f = $("#footClock"); if (f) f.textContent = t; };
  tickClock(); setInterval(tickClock, 30000);

  let toastT;
  function toast(text) { $("#toastText").textContent = text; $("#toast").classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => $("#toast").classList.remove("show"), 3600); }
  if (!seen && !reduce) setTimeout(() => toast("Entered the Realm"), 1700);
  const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
  let kk = 0;
  addEventListener("keydown", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kk = key === KONAMI[kk] ? kk + 1 : key === KONAMI[0] ? 1 : 0;
    if (kk === KONAMI.length) { kk = 0; toast(document.documentElement.classList.toggle("replay") ? "Replay colours on" : "Replay colours off"); }
  });

  // ---------- ticker ----------
  const ticker = new Map();
  function setTicker(key, badge, text, cls = "") { ticker.set(key, { badge, text, cls }); renderTicker(); }
  function renderTicker() {
    const items = [...ticker.values()];
    if (!items.length) return;
    const make = () => items.map(({ badge, text, cls }) => { const s = el("span"); const b = el("em", cls, badge); s.append(b); const t = el("b", null, text); s.append(t); return s; });
    $("#tickerTrack").replaceChildren(...make(), ...make()); // duplicated for a seamless loop
  }
  (R.tips || []).slice(0, 2).forEach((t, i) => setTicker("tip" + i, "TIP", t, "v"));

  // ---------- hero ----------
  if (P.tag) {
    $("#cardTag").textContent = P.tag;
    const m = P.tag.match(/^(VOID)(.+)$/i);
    if (m) { $("#nameA").textContent = m[1].toUpperCase(); $("#nameB").textContent = m[2].toUpperCase(); } else { $("#nameA").textContent = P.tag; $("#nameB").textContent = ""; }
  }
  if (P.title) $("#title").textContent = P.title;
  if (P.bio) $("#bio").textContent = P.bio;
  const q = P.quest;
  const questPct = q ? Math.round(Math.min(1, Math.max(0, (Date.now() - Date.parse(q.start)) / (Date.parse(q.end) - Date.parse(q.start)))) * 100) : null;
  if (q) {
    $("#hsQuest").textContent = questPct + "%";
    $("#hsQuestLabel").textContent = q.name + " progress";
    $("#mqName").textContent = q.name; $("#mqPct").textContent = questPct + "% complete";
    setTimeout(() => ($("#mqFill").style.width = questPct + "%"), 400);
    setTicker("quest", "QUEST", `${q.name} · ${questPct}% complete`);
  }

  // ---------- off-game stats (coding platforms) ----------
  getJSON("../data/stats.json").then((s) => {
    const stars = (s.hackerrank?.badges || []).reduce((a, b) => a + (b.stars || 0), 0);
    const set = (k, v) => { const n = $(`[data-rec="${k}"]`); if (n) n.textContent = fmt(v); };
    set("gh", s.github?.contributions); set("lc", s.leetcode?.solved); set("gfg", s.gfg?.solved); set("hr", stars);
    countTo($("#hsSolved"), s.leetcode?.solved);
    if (hoursFallback) { countTo($("#hsHours"), s.github?.contributions); }
    window.__gh = s.github?.contributions;
  }).catch(() => {});
  let hoursFallback = false;

  // ---------- Discord: server (invite + widget) ----------
  const STATUS = { online: "Online", idle: "Idle", dnd: "Do not disturb", offline: "Offline" };
  const guildIcon = (id, icon) => (icon ? `https://cdn.discordapp.com/icons/${id}/${icon}.${icon.startsWith("a_") ? "gif" : "png"}?size=128` : "");
  let firstInvite = true;
  function loadInvite() {
    if (!G.discordInvite) return;
    getJSON(`https://discord.com/api/v10/invites/${G.discordInvite}?with_counts=true`).then((d) => {
      const on = d.approximate_presence_count;
      if (firstInvite) { countTo($("#hsOnline"), on); firstInvite = false; } else $("#hsOnline").textContent = fmt(on);
      $("#gOnline").textContent = fmt(on); $("#gMembers").textContent = fmt(d.approximate_member_count);
      $("#gName").textContent = d.guild?.name || "404 REALM";
      const ic = guildIcon(d.guild?.id, d.guild?.icon); if (ic) $("#gIcon").src = ic;
      setTicker("guild", "LIVE", `${d.guild?.name || "404 REALM"} · ${fmt(on)} online of ${fmt(d.approximate_member_count)}`, "c");
    }).catch(() => {});
  }
  function loadWidget() {
    if (!G.discordGuildId) return;
    getJSON(`https://discord.com/api/guilds/${G.discordGuildId}/widget.json`).then((w) => {
      const members = w.members || [], playing = {};
      members.forEach((m) => { if (m.game?.name) playing[m.game.name] = (playing[m.game.name] || 0) + 1; });
      $("#gPlaying").textContent = fmt(members.filter((m) => m.game).length);
      $("#gAvatars").replaceChildren(...members.slice(0, 24).map((m) => {
        const a = el("span", "av"); a.title = m.username + (m.game ? ` · playing ${m.game.name}` : "");
        a.append(Object.assign(el("img"), { src: m.avatar_url, alt: "", width: 36, height: 36, loading: "lazy", decoding: "async" }), el("span", `sdot s-${m.status}`));
        return a;
      }));
      const games = Object.entries(playing).sort((a, b) => b[1] - a[1]);
      $("#gNowLabel").hidden = !games.length;
      $("#gNow").replaceChildren(...games.slice(0, 5).map(([n, c]) => el("li", null, c > 1 ? `${n} · ${c} players` : n)));
      $("#gChannels").replaceChildren(...(w.channels || []).sort((a, b) => a.position - b.position).map((c) => el("span", null, "🔊 " + c.name)));
      if (games.length) setTicker("now", "NOW", `In the server: ${games.slice(0, 3).map(([n]) => n).join(" · ")}`);
    }).catch(() => $("#gAvatars").replaceChildren(empty("Server widget is offline right now.")));
  }

  // ---------- Discord: personal presence (Lanyard, optional) ----------
  function activityImg(a) {
    const img = a.assets?.large_image; if (!img) return "";
    if (img.startsWith("mp:external/")) return "https://media.discordapp.net/external/" + img.slice(12);
    if (img.startsWith("spotify:")) return "https://i.scdn.co/image/" + img.slice(8);
    return a.application_id ? `https://cdn.discordapp.com/app-assets/${a.application_id}/${img}.png` : "";
  }
  const since = (ms) => { const m = Math.floor((Date.now() - ms) / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  function loadPresence() {
    if (!G.discordUserId) return;
    getJSON(`https://api.lanyard.rest/v1/users/${G.discordUserId}`).then(({ data: d }) => {
      if (!d) return;
      $("#presence").hidden = false;
      const u = d.discord_user;
      $("#pName").textContent = u.global_name || u.username;
      if (u.avatar) $("#pAvatar").src = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith("a_") ? "gif" : "png"}?size=128`;
      $("#pDot").className = `sdot s-${d.discord_status}`; $("#pStatus").textContent = STATUS[d.discord_status] || d.discord_status;
      const box = $("#pActivities"); box.replaceChildren();
      const game = d.activities.find((a) => a.type === 0);
      d.activities.filter((a) => a.type !== 4 && a.type !== 2).forEach((a) => {
        const row = el("div", "activity"), src = activityImg(a), t = el("div");
        if (src) row.append(Object.assign(el("img"), { src, alt: "", width: 56, height: 56, loading: "lazy" }));
        t.append(el("small", "cap", ["Playing", "Streaming", "Listening to", "Watching", "", "Competing in"][a.type] || "Playing"), el("b", null, a.name));
        if (a.details) t.append(el("small", null, a.details));
        if (a.state) t.append(el("small", null, a.state));
        if (a.timestamps?.start) t.append(el("small", null, `for ${since(a.timestamps.start)}`));
        row.append(t); box.append(row);
      });
      if (d.listening_to_spotify && d.spotify) {
        const s = d.spotify, row = el("div", "activity spotify"), t = el("div");
        if (s.album_art_url) row.append(Object.assign(el("img"), { src: s.album_art_url, alt: "", width: 56, height: 56, loading: "lazy" }));
        t.append(el("small", "cap", "Spotify"), el("b", null, s.song), el("small", null, s.artist));
        if (s.timestamps?.start && s.timestamps?.end) { const tr = el("div", "track"), f = el("span"); f.style.width = Math.min(100, ((Date.now() - s.timestamps.start) / (s.timestamps.end - s.timestamps.start)) * 100) + "%"; tr.append(f); t.append(tr); }
        row.append(t); box.append(row);
      }
      const custom = d.activities.find((a) => a.type === 4);
      if (!box.children.length) box.append(el("p", "empty", custom?.state ? `“${custom.state}”` : d.discord_status === "offline" ? "Offline right now." : "Online, not in a game."));
      setTicker("me", "ME", game ? `Voidsorrow is playing ${game.name}` : `Voidsorrow is ${(STATUS[d.discord_status] || "online").toLowerCase()}`, game ? "" : "v");
    }).catch(() => {});
  }

  // ---------- Steam + manual games ----------
  const steamCDN = (id) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/header.jpg`;
  getJSON("../data/gaming.json").catch(() => ({})).then((g) => {
    const s = g.steam, manual = R.games || [];
    if (s) {
      $("#steamBlock").hidden = false;
      $("#steamUpdated").textContent = g.updated ? "· synced " + new Date(g.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
      $("#sName").textContent = s.name || "Steam";
      if (s.avatar) $("#sAvatar").src = s.avatar;
      if (s.url) $("#sLink").href = s.url;
      $("#sLevel").textContent = fmt(s.level); $("#sGames").textContent = fmt(s.gameCount);
      $("#sHours").textContent = fmt(Math.round(s.totalHours)); $("#sRecent").textContent = fmt(s.recentHours);
      const list = (s.recent || []).length ? s.recent : (s.top || []).slice(0, 4);
      $("#sRecentList").replaceChildren(...list.map((x) => {
        const c = Object.assign(el("a", "card rgame"), { href: `https://store.steampowered.com/app/${x.appid}`, target: "_blank", rel: "noopener" });
        c.append(Object.assign(el("img"), { src: steamCDN(x.appid), alt: "", width: 460, height: 215, loading: "lazy", decoding: "async" }));
        const d = el("div"); d.append(el("b", null, x.name), el("small", null, x.hours2w != null ? `${x.hours2w} h past 2 weeks · ${fmt(x.hours)} h total` : `${fmt(x.hours)} h total`));
        c.append(d); return c;
      }));
      if (s.playing) setTicker("steam-now", "STEAM", `In game: ${s.playing}`);
      // Live now: Steam summary in the Discord status card, so both cards carry the same weight.
      $("#pSteam").hidden = false;
      $("#psLevel").textContent = fmt(s.level); $("#psGames").textContent = fmt(s.gameCount); $("#psHours").textContent = fmt(Math.round(s.totalHours));
      const top = (s.recent || []).slice().sort((a, b) => b.hours - a.hours)[0];
      if (s.playing || top) { const p = $("#psLast"); p.hidden = false; p.replaceChildren(el("span", null, s.playing ? "In game" : "Most played"), el("b", null, s.playing || top.name), el("em", null, s.playing ? "now" : `${fmt(Math.round(top.hours))} h`)); }
      if (s.url) $("#psLink").href = s.url;
    }

    renderTracker(g);

    // Leaderboard: Steam top games + manual games with hours.
    const rows = new Map();
    (s?.top || []).forEach((x) => rows.set(x.name.toLowerCase(), { name: x.name, hours: x.hours, plat: "Steam" }));
    manual.filter((m) => m.hours).forEach((m) => { const k = m.title.toLowerCase(), prev = rows.get(k); if (!prev || m.hours > prev.hours) rows.set(k, { name: m.title, hours: m.hours, plat: m.platform || "Other" }); });
    const data = [...rows.values()].sort((a, b) => b.hours - a.hours);
    const manualHours = manual.reduce((a, m) => a + (m.hours || 0), 0);
    const total = s?.totalHours != null ? s.totalHours + manualHours : data.reduce((a, b) => a + b.hours, 0);
    if (data.length) {
      const max = data[0].hours;
      $("#playtime").replaceChildren(...data.slice(0, 8).map((r) => {
        const li = el("li"), row = el("div", "row"), bar = el("div", "bar"), fill = el("i", r.plat === "Steam" ? "" : /epic/i.test(r.plat) ? "epic" : "other");
        bar.append(fill); row.append(el("b", null, r.name), el("small", null, r.plat), bar);
        li.append(row, el("em", null, fmt(Math.round(r.hours)) + " h"));
        requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.width = Math.max(3, (r.hours / max) * 100) + "%")));
        return li;
      }));
      const gameCount = (s?.library || []).length + manual.filter((m) => m.hours).length || data.length;
      $("#playTotal").textContent = `Total tracked: ${fmt(Math.round(total))} h across ${gameCount} game${gameCount > 1 ? "s" : ""}`;
      countTo($("#hsHours"), Math.round(total)); $("#hsHoursLabel").textContent = "Hours of playtime tracked";
      setTicker("hours", "STATS", `${fmt(Math.round(total))} h tracked · top game: ${data[0].name}`);
    } else {
      $("#playtime").replaceWith(empty("The leaderboard fills in once Steam is connected or games with <code>hours</code> are added to <code>realm/config.js</code>. Epic Games has no public API, so add Epic hours there."));
      hoursFallback = true;
      $("#hsHoursLabel").textContent = "GitHub contributions, last year";
      if (window.__gh != null) countTo($("#hsHours"), window.__gh);
    }

    // Library = hand-added games + Tracker Network games + Steam games (deduplicated by title).
    const lib = new Map();
    const addGame = (x) => { const k = x.title.toLowerCase(); if (!lib.has(k)) lib.set(k, x); };
    manual.forEach(addGame);
    (g.tracker || []).forEach((t) => addGame({ title: t.label || t.game, platform: `${t.platform === "riot" ? "Riot" : t.platform} · Tracker Network`, status: "playing", rank: t.rank?.name }));
    const recentIds = new Set((s?.recent || []).map((x) => x.appid));
    (s?.library || s?.top || []).forEach((x) => addGame({ title: x.name, platform: "Steam", status: recentIds.has(x.appid) ? "playing" : "owned", hours: x.hours >= 1 ? Math.round(x.hours) : x.hours }));
    const games = [...lib.values()];
    if (games.length) {
      $("#library").replaceChildren(...games.map((m) => {
        const c = el("div", "game");
        c.append(el("span", `st st-${m.status || "playing"}`, m.status || "playing"), el("b", null, m.title));
        const sub = [m.platform, m.genre, m.rank, m.hours ? `${fmt(m.hours)} h` : ""].filter(Boolean).join(" · ");
        if (sub) c.append(el("small", null, sub));
        if (m.note) c.append(el("small", null, m.note));
        return c;
      }));
    } else $("#library").replaceWith(empty("Library syncing. Add games from any platform to <code>realm/config.js</code> → <code>games</code>."));
  });

  // ---------- Lobby: gamer handles + Tracker Network profiles ----------
  const ABBR = { discord: "DC", x: "X", steam: "ST", epic: "EG", riot: "RI", valorant: "VA", xbox: "XB", psn: "PS", twitch: "TW", itch: "IO", coc: "CC" };
  function slot({ platform, handle, url, icon, extra }) {
    const node = url ? Object.assign(el("a", "card slot"), { href: url, target: "_blank", rel: "noopener" }) : el("div", "card slot");
    const t = el("div"); t.append(el("small", null, platform), el("b", null, handle));
    if (extra) t.append(el("span", "slot-extra", extra));
    node.append(el("span", "slot-ic", ABBR[icon] || "◆"), t);
    return node;
  }
  (R.handles || []).filter((h) => h.handle).forEach((h) => $("#slots").append(slot(h)));

  // Tracker Network: handles in data/profiles.json -> tracker; ranks/stats (if any) in data/gaming.json.
  const trnUrl = (e) => `https://tracker.gg/${e.game}/profile/${e.platform}/${encodeURIComponent(e.handle_in || e.handle)}/overview`;
  function renderTracker(g) {
    getJSON("../data/profiles.json").catch(() => ({})).then((prof) => {
      const synced = new Map((g.tracker || []).map((x) => [`${x.game}|${x.platform}|${x.handle_in}`, x]));
      const entries = (prof.tracker || []).filter((e) => e.handle && e.game && e.platform)
        .map((e) => ({ ...e, handle_in: e.handle, ...(synced.get(`${e.game}|${e.platform}|${e.handle}`) || {}) }));
      entries.forEach((e) => {
        const top = (e.stats || []).slice(0, 2).map((s) => `${s.name} ${s.value}`).join(" · ");
        $("#slots").append(slot({
          platform: `${e.label || e.game} · Tracker Network`, handle: e.handle || e.handle_in, url: trnUrl(e),
          icon: e.game === "valorant" ? "valorant" : "riot", extra: [e.rank?.name, top].filter(Boolean).join(" · ") || "View stats on tracker.gg ↗",
        }));
      });
      if (!entries.length) return;
      const ranked = entries.find((e) => e.rank);
      setTicker("trn", "TRN", ranked ? `${ranked.label || ranked.game} · ${ranked.rank.name}` : `Tracker: ${entries.map((e) => e.label || e.game).join(" · ")}`, "c");
    });
  }

  // ---------- My rig: "Main rig" panel (left) + spec and accessory cards (right) ----------
  const SPEC_ICONS = {
    cpu: '<rect x="6" y="6" width="12" height="12" rx="1"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    gpu: '<rect x="2" y="6" width="20" height="11" rx="1"/><circle cx="9" cy="11.5" r="3"/><circle cx="16" cy="11.5" r="2"/><path d="M5 17v3M9 17v3"/>',
    ram: '<rect x="2" y="7" width="20" height="9" rx="1"/><path d="M6 10v3M10 10v3M14 10v3M18 10v3M5 16v3M19 16v3"/>',
    ssd: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h6M17 15h.01"/>',
    display: '<rect x="2" y="4" width="20" height="13" rx="1"/><path d="M8 21h8M12 17v4"/>',
    os: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/>',
    headset: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="2" y="14" width="5" height="7" rx="1"/><rect x="17" y="14" width="5" height="7" rx="1"/>',
    pad: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-4 3.6l-.6 6A3 3 0 0 0 5 18c1 0 1.6-.5 2.1-1.2L8.5 15h7l1.4 1.8c.5.7 1.1 1.2 2.1 1.2a3 3 0 0 0 2.9-3.4l-.6-6A4 4 0 0 0 17.3 5z"/>',
  };
  function specItem(s) {
    const li = el("li", "spec-item");
    const ic = el("span", "spec-ic"); ic.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEC_ICONS[s.icon] || SPEC_ICONS.cpu}</svg>`;
    const t = el("div"); t.append(el("small", null, s.label), el("b", null, s.value));
    if (s.detail) t.append(el("span", null, s.detail));
    li.append(ic, t);
    return li;
  }
  const rigCfg = R.rig || {};
  const rigSpecs = (rigCfg.specs || []).filter((s) => s.value), rigGear = (rigCfg.accessories || []).filter((s) => s.value);
  if (rigSpecs.length || rigGear.length) {
    const wrap = el("div", "rig-wrap");
    const id = el("article", "card rig-id");
    id.append(el("small", null, "Main rig"), el("h3", null, rigCfg.name || "My setup"));
    if (rigCfg.model) id.append(el("p", null, rigCfg.model));
    // Line-art laptop: sharp square corners, thin bezels, flat base and an RGB strip (decorative, no logos).
    id.insertAdjacentHTML("beforeend", `<svg class="rig-glyph" viewBox="0 0 240 150" aria-hidden="true">
      <defs><linearGradient id="rgb" gradientUnits="userSpaceOnUse" x1="44" y1="0" x2="196" y2="0"><stop offset="0" stop-color="#ff2e4f"/><stop offset=".5" stop-color="#d94dff"/><stop offset="1" stop-color="#5cd3ff"/></linearGradient></defs>
      <rect class="k" x="38" y="12" width="164" height="96"/>
      <rect class="s" x="42.5" y="16.5" width="155" height="85"/>
      <path class="s" d="M62 38l26 16M146 32l-22 28M166 82l-38-6"/>
      <path class="k" d="M30 110H210V114H222V132H18V114H30Z"/>
      <path class="glow" d="M40 122H200"/>
      <path class="s" d="M100 128H140"/></svg>`);
    const lists = el("div", "rig-lists");
    const specUl = el("ul", "spec-col specs-side"); specUl.setAttribute("aria-label", "PC specs");
    const gearUl = el("ul", "spec-col gear-side"); gearUl.setAttribute("aria-label", "Accessories");
    rigSpecs.forEach((s) => specUl.append(specItem(s)));
    rigGear.forEach((s) => gearUl.append(specItem(s)));
    if (rigSpecs.length) lists.append(specUl);
    if (rigGear.length) lists.append(gearUl);
    wrap.append(id, lists);
    $("#setup").append(wrap);
    const gpu = rigSpecs.find((s) => s.icon === "gpu");
    setTicker("rig", "RIG", [rigCfg.name, gpu?.value].filter(Boolean).join(" · "), "v");
  } else $("#rig").hidden = true;

  // ---------- footer links ----------
  (R.devLinks || []).forEach((d) => $("#devlinks").append(Object.assign(el("a", null, d.label), { href: d.url, target: "_blank", rel: "noopener" })));

  // ---------- blog ----------
  getJSON("../blog/posts/index.json").then((posts) => {
    if (!posts.length) { $("#blogRow").append(empty("No articles yet.")); return; }
    $("#blogRow").replaceChildren(...posts.slice(0, 3).map((p) => {
      const a = Object.assign(el("a", "card post"), { href: `../blog/post.html?p=${encodeURIComponent(p.slug)}` });
      const tags = el("div", "tags"); p.tags.slice(0, 4).forEach((t) => tags.append(el("span", null, "#" + t)));
      a.append(el("time", null, `${fmtDate(p.date)} · ${p.minutes} min`), el("h3", null, p.title));
      if (p.summary) a.append(el("p", null, p.summary));
      a.append(tags); return a;
    }));
    setTicker("blog", "BLOG", `Latest: ${posts[0].title}`, "v");
  }).catch(() => $("#blogRow").append(empty("Could not load articles.")));

  // ---------- live refresh: only while the Live section is on screen ----------
  loadInvite(); loadWidget(); loadPresence();
  let liveVisible = false;
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => (liveVisible = e.isIntersecting)).observe($("#live"));
  setInterval(() => { if (!document.hidden && liveVisible) { loadInvite(); loadWidget(); loadPresence(); } }, 60000);

  // ---------- nav highlight + reveal ----------
  const links = [...document.querySelectorAll(".sb-nav a[href^='#']")];
  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-45% 0px -50% 0px" });
    links.forEach((a) => { const s = document.querySelector(a.getAttribute("href")); if (s) spy.observe(s); });
    if (!reduce) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
      document.querySelectorAll(".sec-h, .sec .card:not(.rgame), .statstrip li, .spec-item, .rig-art").forEach((n, i) => {
        n.style.setProperty("--d", `${(i % 4) * 0.06}s`); n.classList.add("rv"); io.observe(n);
      });
    }
  }

  // ---------- Section menu (phones and tablets) ----------
  const sb = document.querySelector(".scorebug"), sbBtn = $("#sbMenu");
  if (sb && sbBtn) {
    const setMenu = (open) => { sb.classList.toggle("open", open); sbBtn.setAttribute("aria-expanded", String(open)); sbBtn.setAttribute("aria-label", open ? "Close sections menu" : "Open sections menu"); };
    sbBtn.addEventListener("click", () => setMenu(!sb.classList.contains("open")));
    sb.querySelectorAll(".sb-nav a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("click", (e) => { if (!sb.contains(e.target)) setMenu(false); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
    addEventListener("resize", () => { if (innerWidth > 900) setMenu(false); }, { passive: true });
  }
})();

// Footer prompt: types "cd ~/portfolio" when the footer comes into view.
(() => {
  const cmd = document.querySelector(".foot-prompt .fp-cmd");
  if (!cmd || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const full = cmd.textContent;
  cmd.style.minWidth = full.length + "ch";
  cmd.textContent = "";
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return; io.disconnect();
    let i = 0; const step = () => { cmd.textContent = full.slice(0, ++i); if (i < full.length) setTimeout(step, 70 + Math.random() * 60); };
    setTimeout(step, 300);
  }, { threshold: 1 });
  io.observe(cmd.parentElement);
})();
