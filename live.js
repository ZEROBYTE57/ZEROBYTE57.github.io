// Live coding activity.
// 1. Render the snapshot in data/stats.json (refreshed every 6 h by a GitHub Action).
// 2. Then fetch GitHub, LeetCode and Codeforces live and update in place.
//    (GeeksforGeeks and HackerRank block browser requests, so they use the snapshot.)
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const fmt = (n) => (n == null ? "–" : Number(n).toLocaleString("en-US"));
  const PROFILE_URL = {
    github: (h) => `https://github.com/${h}`,
    leetcode: (h) => `https://leetcode.com/u/${h}/`,
    gfg: (h) => `https://www.geeksforgeeks.org/user/${h}/`,
    codeforces: (h) => `https://codeforces.com/profile/${h}`,
    hackerrank: (h) => `https://www.hackerrank.com/profile/${h}`,
  };
  const CARD = { leetcode: "lc", gfg: "gfg", codeforces: "cf", hackerrank: "hr" };

  const set = (key, value) => document.querySelectorAll(`[data-k="${key}"]`).forEach((el) => (el.textContent = value));
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  function timeAgo(iso) {
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d < 30 ? `${d} day${d > 1 ? "s" : ""} ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  function profiles(p) {
    Object.entries(p).forEach(([site, handle]) => {
      document.querySelectorAll(`[data-link="${site}"]`).forEach((a) => {
        if (!handle) return;
        a.href = PROFILE_URL[site](handle);
        a.textContent = "@" + handle;
      });
      if (!handle && CARD[site]) $(`#${CARD[site]}`)?.remove();
    });
  }

  function github(g) {
    if (!g) return;
    set("gh.contributions", fmt(g.contributions));
    set("gh.repos", fmt(g.repos));
    set("gh.followers", fmt(g.followers));
    if (g.calendar) {
      const map = $("#heatmap");
      map.replaceChildren();
      // Pad so the first column starts on Sunday, like GitHub.
      const pad = new Date(g.calendar[0][0] + "T00:00:00").getDay();
      for (let i = 0; i < pad; i++) map.append(Object.assign(el("i"), { style: "visibility:hidden" }));
      g.calendar.forEach(([date, level], i) => {
        const c = el("i");
        c.dataset.l = level;
        c.title = date;
        c.style.setProperty("--w", Math.floor((i + pad) / 7));
        map.append(c);
      });
      const wrap = map.parentElement;
      wrap.scrollLeft = wrap.scrollWidth; // show the most recent weeks on small screens
    }
    if (g.recent) {
      const list = $("#repos");
      list.replaceChildren();
      g.recent.forEach((r) => {
        const a = Object.assign(el("a"), { href: r.url, target: "_blank", rel: "noopener" });
        const meta = el("span", "repo-meta");
        if (r.language) meta.append(el("span", "lang", r.language));
        meta.append(el("span", null, "Updated " + timeAgo(r.pushed)));
        a.append(el("b", null, r.name), el("p", null, r.description || ""), meta);
        const li = el("li"); li.append(a); list.append(li);
      });
    }
  }

  function leetcode(l) {
    if (!l) return;
    set("lc.solved", fmt(l.solved));
    [["easy", "totalEasy"], ["medium", "totalMedium"], ["hard", "totalHard"]].forEach(([k, t]) => {
      set(`lc.${k}`, fmt(l[k]));
      const bar = $(`[data-bar="lc.${k}"]`);
      // Bars show share of your solved problems, so small totals still read clearly.
      if (bar && l.solved) requestAnimationFrame(() => (bar.style.width = `${Math.max(4, (l[k] / l.solved) * 100)}%`));
    });
  }

  function gfg(g) { if (!g) return; set("gfg.solved", fmt(g.solved)); set("gfg.score", fmt(g.score)); }

  function codeforces(c) {
    if (!c) return;
    set("cf.rating", c.rating ?? "Unrated");
    set("cf.maxRating", c.maxRating ?? "–");
    set("cf.rank", c.rank ?? "Unrated");
  }

  function hackerrank(h) {
    if (!h) return;
    const earned = h.badges.filter((b) => b.stars > 0);
    set("hr.count", earned.length);
    const list = $("#hrBadges");
    list.replaceChildren();
    earned.sort((a, b) => b.stars - a.stars).forEach((b) => {
      const li = el("li", null, b.name === "Sql" ? "SQL" : b.name);
      li.append(el("span", "stars", "★".repeat(b.stars)));
      li.setAttribute("aria-label", `${b.name}: ${b.stars} star${b.stars > 1 ? "s" : ""}`);
      list.append(li);
    });
  }

  function render(d) {
    if (d.profiles) profiles(d.profiles);
    github(d.github); leetcode(d.leetcode); gfg(d.gfg); codeforces(d.codeforces); hackerrank(d.hackerrank);
    if (d.updated) $("#statsUpdated").textContent = `Last refreshed ${timeAgo(d.updated)}.`;
  }

  const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

  async function liveUpdate(p) {
    const tasks = [];
    if (p.github) {
      tasks.push(Promise.all([
        getJSON(`https://api.github.com/users/${p.github}`),
        getJSON(`https://api.github.com/users/${p.github}/repos?per_page=100&sort=pushed`),
        getJSON(`https://github-contributions-api.jogruber.de/v4/${p.github}?y=last`),
      ]).then(([u, repos, c]) => github({
        repos: u.public_repos,
        followers: u.followers,
        contributions: c.total.lastYear,
        calendar: c.contributions.map((x) => [x.date, x.level]),
        recent: repos.filter((r) => !r.fork && r.description && r.name.toLowerCase() !== `${p.github}.github.io`.toLowerCase())
          .slice(0, 3).map((r) => ({ name: r.name, url: r.html_url, language: r.language, description: r.description, pushed: r.pushed_at })),
      })));
    }
    if (p.leetcode) {
      tasks.push(getJSON(`https://alfa-leetcode-api.onrender.com/${p.leetcode}/solved`).then((s) =>
        leetcode({ solved: s.solvedProblem, easy: s.easySolved, medium: s.mediumSolved, hard: s.hardSolved })));
    }
    if (p.codeforces) {
      tasks.push(getJSON(`https://codeforces.com/api/user.info?handles=${p.codeforces}`).then((r) => codeforces(r.result[0])));
    }
    await Promise.allSettled(tasks); // a failed live call simply keeps the snapshot values
  }

  getJSON("data/stats.json")
    .then((d) => { render(d); return d.profiles || {}; })
    .catch(() => fetch("data/profiles.json").then((r) => r.json()).then((p) => { profiles(p); return p; }))
    .then(liveUpdate)
    .catch(() => {});
})();
