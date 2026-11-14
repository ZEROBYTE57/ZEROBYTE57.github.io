const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Theme toggle: remembers the choice; otherwise follows the system setting.
const toggle = document.getElementById("themeToggle");
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
toggle.addEventListener("click", () => {
  const current = root.dataset.theme || (systemDark() ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  const apply = () => { root.dataset.theme = next; };
  if (document.startViewTransition && !reduceMotion) document.startViewTransition(apply); else apply();
  try { localStorage.setItem("theme", next); } catch (e) {}
});

document.getElementById("year").textContent = new Date().getFullYear();

// Live Bengaluru clock (IST).
const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const tickClock = () => {
  const t = clockFmt.format(new Date());
  const c1 = document.getElementById("clock"), c2 = document.getElementById("clock2");
  if (c1) c1.textContent = t + " IST";
  if (c2) c2.textContent = t;
};
tickClock();
setInterval(tickClock, 15000);

// Segmented scroll progress bar.
const bar = document.getElementById("progress");
const updateBar = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
};
addEventListener("scroll", updateBar, { passive: true });
updateBar();

// Typing effect for the role line.
const typed = document.getElementById("typed");
if (typed && !reduceMotion) {
  const words = typed.dataset.words.split("|");
  let w = 0, i = words[0].length, deleting = true;
  const tick = () => {
    const word = words[w];
    i += deleting ? -1 : 1;
    typed.textContent = word.slice(0, i);
    let delay = deleting ? 40 : 85;
    if (!deleting && i === word.length) { deleting = true; delay = 2200; }
    else if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; delay = 350; }
    setTimeout(tick, delay);
  };
  setTimeout(tick, 2400);
}

// Glitch the name once on load, then briefly every few seconds.
const glitchEl = document.querySelector(".glitch");
if (glitchEl && !reduceMotion) {
  const fire = () => {
    glitchEl.classList.remove("is-glitching");
    void glitchEl.offsetWidth; // restart the animation
    glitchEl.classList.add("is-glitching");
  };
  setTimeout(fire, 800);
  setInterval(fire, 8000);
  glitchEl.addEventListener("mouseenter", fire);
}

// Cursor-tracking border glow on every tile.
document.addEventListener("pointermove", (e) => {
  const tile = e.target.closest?.(".tile");
  if (!tile) return;
  const r = tile.getBoundingClientRect();
  tile.style.setProperty("--mx", `${e.clientX - r.left}px`);
  tile.style.setProperty("--my", `${e.clientY - r.top}px`);
}, { passive: true });

// Decode effect for section titles: each text part scrambles, then resolves.
// Works per text node so the serif <em> accents stay intact.
const GLYPHS = "!<>-_/[]{}=+*^?#01";
function decode(el) {
  el.setAttribute("aria-label", el.textContent);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push({ node: walker.currentNode, text: walker.currentNode.nodeValue });
  const total = 18;
  let frame = 0;
  const run = () => {
    const p = frame / total;
    nodes.forEach(({ node, text }) => {
      node.nodeValue = [...text].map((ch, i) => (ch === " " || i / text.length < p ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
    });
    if (frame++ < total) setTimeout(run, 30);
    else nodes.forEach(({ node, text }) => (node.nodeValue = text));
  };
  run();
}

// Blur-in reveal as elements scroll into view, with a small stagger inside groups.
const targets = document.querySelectorAll(".sec-head > *, section:not(.hero) .tile, .timeline li, .pipeline li, .list li");
if ("IntersectionObserver" in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      if (e.target.matches(".section-title")) decode(e.target);
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  targets.forEach((node) => {
    const idx = [...node.parentElement.children].indexOf(node);
    node.style.setProperty("--d", `${Math.min(idx, 6) * 0.07}s`);
    node.classList.add("reveal");
    io.observe(node);
  });
}


// Navigation: highlight the section on screen with a sliding pill.
const links = [...document.querySelectorAll(".nav-links a")];
const pill = document.getElementById("navPill");
const movePill = (a) => {
  if (!a) { pill.style.opacity = 0; return; }
  pill.style.opacity = 1;
  pill.style.width = a.offsetWidth + "px";
  pill.style.transform = `translateX(${a.offsetLeft}px)`;
};
const sections = links.map((a) => document.querySelector(a.getAttribute("href")));
const spy = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    let current = null;
    links.forEach((a) => {
      const on = a.getAttribute("href") === "#" + e.target.id;
      a.classList.toggle("active", on);
      if (on) current = a;
    });
    movePill(current);
  });
}, { rootMargin: "-45% 0px -50% 0px" });
sections.forEach((s) => s && spy.observe(s));
// Hide the pill when back at the top (hero has no nav link).
addEventListener("scroll", () => {
  if (scrollY < innerHeight * 0.4) { links.forEach((a) => a.classList.remove("active")); movePill(null); }
}, { passive: true });
addEventListener("resize", () => movePill(document.querySelector(".nav-links a.active")));
// The active link widens as its ▸ marker animates in; keep the pill matched to it while that happens.
if ("ResizeObserver" in window) { const ro = new ResizeObserver(() => { const a = document.querySelector(".nav-links a.active"); if (a) movePill(a); }); links.forEach((a) => ro.observe(a)); }

// Mobile menu: the nav opens as a dropdown under the dock below 920px.
(() => {
  const dock = document.querySelector(".dock"), btn = document.getElementById("menuBtn");
  if (!dock || !btn) return;
  const set = (open) => { dock.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); btn.setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
  btn.addEventListener("click", () => set(!dock.classList.contains("open")));
  dock.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => set(false)));
  document.addEventListener("click", (e) => { if (!dock.contains(e.target)) set(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
  addEventListener("resize", () => { if (innerWidth > 920) set(false); }, { passive: true });
})();

// Linux env terminal: types each command, then reveals its output (static if reduced motion).
(() => {
  const body = document.getElementById("termBody");
  if (!body || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const lines = [...body.children].map((p) => ({ cmd: p.classList.contains("t-cmd"), html: p.innerHTML, cls: p.className, text: p.textContent.replace(/^\$\s*/, "") }));
  body.replaceChildren();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function play() {
    for (const l of lines) {
      const p = document.createElement("p"); p.className = l.cls; body.append(p);
      if (!l.cmd) { await sleep(180); p.innerHTML = l.html; continue; }
      if (!l.text.trim()) { p.innerHTML = l.html; continue; }      // final prompt with cursor
      p.innerHTML = '<span class="t-p">$</span> <span class="typed"></span><span class="t-cursor"></span>';
      const t = p.querySelector(".typed");
      for (const ch of l.text) { t.textContent += ch; await sleep(28 + Math.random() * 40); }
      await sleep(260); p.querySelector(".t-cursor").remove();
    }
  }
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); play(); } }, { threshold: 0.4 });
  io.observe(body);
})();

// Floating back-to-top button.
(() => {
  const fab = document.createElement("button");
  fab.className = "fab-top"; fab.type = "button"; fab.setAttribute("aria-label", "Back to top");
  fab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  fab.addEventListener("click", () => scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  document.body.append(fab);
  const onScroll = () => fab.classList.toggle("show", scrollY > 700);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
})();


// Hero panel: particle portrait. The avatar is rebuilt from dots that scatter from the cursor and drift back.
(() => {
  const tile = document.querySelector(".tile.art"), cv = tile && tile.querySelector(".particles");
  const src = tile && tile.querySelector(".avatar");
  if (!cv || !src) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = cv.getContext("2d");
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = src.src;
  let W = 0, H = 0, dpr = 1, dots = [], dust = [], accent = "#45b5c2", dark = true, running = false, visible = true, raf = 0, t0 = performance.now();
  const mouse = { x: -1e4, y: -1e4 };
  const readAccent = () => {
    const cs = getComputedStyle(document.documentElement);
    accent = cs.getPropertyValue("--accent").trim() || accent;
    const th = document.documentElement.dataset.theme; dark = th ? th === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    if (still && W) frame(performance.now());
  };

  function build() {
    const r = cv.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; if (!W || !H) return;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = Math.min(W, H) * 0.36, N = W < 420 ? 56 : 72, step = (2 * R) / N, cx = W / 2, cy = H / 2;
    const off = document.createElement("canvas"); off.width = off.height = N;
    const o = off.getContext("2d"); o.drawImage(img, 0, 0, N, N);
    let px; try { px = o.getImageData(0, 0, N, N).data; } catch (e) { return false; }
    const old = dots; dots = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - N / 2 + .5, dy = y - N / 2 + .5;
      if (dx * dx + dy * dy > (N / 2) ** 2) continue;
      const i = (y * N + x) * 4, lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      const tx = cx + dx * step, ty = cy + dy * step, prev = old[dots.length];
      dots.push({ tx, ty, x: prev ? prev.x : Math.random() * W, y: prev ? prev.y : Math.random() * H, vx: 0, vy: 0,
        step, lum, c: `rgb(${px[i]},${px[i + 1]},${px[i + 2]})`, ph: Math.random() * 6.28 });
    }
    // Ring of accent dots around the portrait.
    const ringN = Math.round(2 * Math.PI * (R + step * 3) / (step * 1.6));
    for (let k = 0; k < ringN; k++) {
      const a = (k / ringN) * Math.PI * 2, rr = R + step * 3;
      dots.push({ tx: cx + Math.cos(a) * rr, ty: cy + Math.sin(a) * rr, x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, s: step * .3, c: null, ph: a, ring: true });
    }
    dust = Array.from({ length: 40 }, () => ({ a: Math.random() * 6.28, r: R * (1.15 + Math.random() * .5), sp: (Math.random() * .5 + .2) * (Math.random() < .5 ? -1 : 1) / 1000, s: Math.random() * 1.4 + .4 }));
    return true;
  }

  function frame(now) {
    const t = now - t0; ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    ctx.fillStyle = accent;
    for (const d of dust) {
      const a = d.a + t * d.sp; ctx.globalAlpha = .35 + .25 * Math.sin(t / 900 + d.a);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d.r, cy + Math.sin(a) * d.r * .92, d.s, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!dark) {
      // Light mode: a dark round "screen" so the photo reads the same as in dark mode.
      const R = Math.min(W, H) * 0.36, g = ctx.createRadialGradient(cx, cy, R * .2, cx, cy, R * 1.08);
      g.addColorStop(0, "#14262a"); g.addColorStop(.75, "#0b0f12"); g.addColorStop(1, "#0b0f12");
      ctx.save(); ctx.shadowColor = accent; ctx.shadowBlur = 28; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.06, 0, 6.283); ctx.fill(); ctx.restore();
    }
    const RAD = Math.min(W, H) * 0.16, R2 = RAD * RAD;
    for (const d of dots) {
      if (!still) {
        const ddx = d.x - mouse.x, ddy = d.y - mouse.y, dist2 = ddx * ddx + ddy * ddy;
        if (dist2 < R2) { const f = (1 - dist2 / R2) * 2.6, dist = Math.sqrt(dist2) || 1; d.vx += (ddx / dist) * f; d.vy += (ddy / dist) * f; }
        const wob = Math.sin(t / 1400 + d.ph) * .6;
        d.vx += (d.tx + wob - d.x) * .045; d.vy += (d.ty + Math.cos(t / 1600 + d.ph) * .6 - d.y) * .045;
        d.vx *= .86; d.vy *= .86; d.x += d.vx; d.y += d.vy;
      } else { d.x = d.tx; d.y = d.ty; }
      if (d.ring) { ctx.fillStyle = accent; ctx.globalAlpha = .45 + .45 * Math.sin(t / 700 + d.ph * 3); }
      else { ctx.fillStyle = d.c; ctx.globalAlpha = 1; }
      const sz = d.ring ? d.s : d.step * (0.28 + 0.2 * d.lum);
      ctx.beginPath(); ctx.arc(d.x, d.y, sz, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (running && !still) raf = requestAnimationFrame(frame);
  }
  const start = () => { if (running || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  img.onload = () => {
    readAccent();
    if (build() === false) return;            // image unreadable: keep the original panel
    tile.classList.add("is-particles");
    if (still) { frame(performance.now()); return; }
    start();
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(tile);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  };
  const setPt = (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; };
  cv.addEventListener("pointermove", setPt, { passive: true });
  cv.addEventListener("pointerdown", setPt, { passive: true });
  cv.addEventListener("pointerleave", () => { mouse.x = mouse.y = -1e4; });
  cv.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") mouse.x = mouse.y = -1e4; });
  new ResizeObserver(() => { if (tile.classList.contains("is-particles")) { build(); if (still) frame(performance.now()); } }).observe(cv);
  new MutationObserver(readAccent).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readAccent);
})();

// Portal cards: latest blog post + counts, and stats for 404 Realm.
(() => {
  const li = (t) => Object.assign(document.createElement("li"), { textContent: t });
  const bold = (t) => Object.assign(document.createElement("b"), { textContent: t });
  const latest = document.getElementById("portalLatest"), bStats = document.getElementById("portalBlogStats");
  const getJSON = (u) => fetch(u).then((r) => r.json()).catch(() => []);
  // Same topic count as the blog page: tags from posts, projects and GitHub notes.
  if (bStats) Promise.all(["blog/posts/index.json", "blog/projects.json", "blog/notes.json"].map(getJSON)).then(([posts, projects, notes]) => {
    if (!posts.length) return;
    const topics = new Set([...posts.flatMap((p) => p.tags || []), ...projects.flatMap((p) => p.topics || []), ...notes.flatMap((n) => n.topics || [])]);
    if (latest) latest.replaceChildren("Latest: ", bold(posts[0].title));
    bStats.replaceChildren(li(posts.length + " articles"), li(topics.size + " topics"), li("Linked graph"));
  }).catch(() => {});
  const realm = document.getElementById("portalRealm"), rStats = document.getElementById("portalRealmStats");
  if (realm && rStats) fetch("data/gaming.json").then((r) => r.json()).then((g) => {
    const s = g.steam || {}, top = (s.recent || []).slice().sort((a, b) => b.hours - a.hours)[0];
    if (top) realm.replaceChildren("Most played: ", bold(top.name + " · " + Math.round(top.hours) + " h"));
    rStats.replaceChildren(...[s.gameCount ? s.gameCount + " Steam games" : "", "ROG Strix G16", "Discord server"].filter(Boolean).map(li));
  }).catch(() => {});
})();

// Hero "Latest post" tile: newest blog article.
(() => {
  const tile = document.getElementById("miniPost");
  if (!tile) return;
  fetch("blog/posts/index.json").then((r) => r.json()).then((posts) => {
    const p = posts[0]; if (!p) return;
    const d = new Date(p.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    tile.href = "blog/post.html?p=" + encodeURIComponent(p.slug);
    document.getElementById("miniPostTitle").textContent = p.title;
    document.getElementById("miniPostMeta").textContent = d + " · " + p.minutes + " min read";
  }).catch(() => {});
})();

// Floating dock (bottom centre, macOS style): Blog + 404 Realm with an article count and a live dot. Shows after the hero, hides once the
// contact section or the contact section is on screen.
(() => {
  const hero = document.querySelector(".hero"), beyond = document.getElementById("contact");
  if (!hero) return;
  const dock = document.createElement("nav");
  dock.className = "explore-dock"; dock.setAttribute("aria-label", "Blog and 404 Realm");
  dock.innerHTML =
    '<a class="ed-btn ed-blog" href="blog/"><span class="ed-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z"/><path d="M8 7h6M8 11h6"/></svg><b class="ed-count" id="edCount" hidden></b></span>' +
      '<span class="ed-text">Blog<small id="edCountLabel">articles</small></span></a>' +
    '<span class="ed-sep" aria-hidden="true"></span>' +
    '<a class="ed-btn ed-realm" href="realm/"><span class="ed-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01"/></svg><i class="ed-live" aria-hidden="true"></i></span>' +
      '<span class="ed-text">404 Realm<small>● live</small></span></a>';
  document.body.append(dock);
  fetch("blog/posts/index.json").then((r) => r.json()).then((p) => {
    const n = dock.querySelector("#edCount"); n.textContent = p.length; n.hidden = false;
    dock.querySelector("#edCountLabel").textContent = p.length + " articles";
  }).catch(() => {});
  const update = () => {
    const past = hero.getBoundingClientRect().bottom < 0;
    const near = beyond && beyond.getBoundingClientRect().top < innerHeight * 0.9;
    dock.classList.toggle("show", past && !near);
  };
  addEventListener("scroll", update, { passive: true }); addEventListener("resize", update); update();
})();

// Footer prompt: types "cd ~/404-realm" when the footer comes into view.
(() => {
  const cmd = document.querySelector(".foot-prompt .fp-cmd");
  if (!cmd || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const full = cmd.textContent;
  cmd.style.minWidth = full.length + "ch";   // reserve the final width so the bar does not shift while typing
  cmd.textContent = "";
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return; io.disconnect();
    let i = 0; const step = () => { cmd.textContent = full.slice(0, ++i); if (i < full.length) setTimeout(step, 70 + Math.random() * 60); };
    setTimeout(step, 300);
  }, { threshold: 1 });
  io.observe(cmd.parentElement);
})();

// Contact: copy the email address.
document.querySelectorAll(".cp-copy").forEach((b) => b.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; } catch (e) { b.textContent = "Failed"; }
  setTimeout(() => { b.textContent = "Copy"; }, 1600);
}));
