const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Theme toggle: remembers the choice; otherwise follows the system setting.
const toggle = document.getElementById("themeToggle");
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
toggle.addEventListener("click", () => {
  const current = root.dataset.theme || (systemDark() ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
});

document.getElementById("year").textContent = new Date().getFullYear();

// Live Bengaluru clock (IST).
const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const tickClock = () => {
  const t = clockFmt.format(new Date());
  document.getElementById("clock").textContent = t + " IST";
  document.getElementById("clock2").textContent = t;
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

// Writing: latest blog articles.
const writing = document.getElementById("writingList");
if (writing) {
  fetch("blog/posts/index.json").then((r) => r.json()).then((posts) => {
    const fmtD = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    writing.replaceChildren(...posts.slice(0, 3).map((p) => {
      const a = document.createElement("a");
      a.className = "tile write-card"; a.href = "blog/post.html?p=" + encodeURIComponent(p.slug);
      const t = document.createElement("time"); t.textContent = `${fmtD(p.date)} · ${p.minutes} min read`;
      const h = document.createElement("h3"); h.textContent = p.title;
      const s = document.createElement("p"); s.textContent = p.summary || "";
      const ul = document.createElement("ul"); ul.className = "chips";
      p.tags.slice(0, 4).forEach((x) => { const li = document.createElement("li"); li.textContent = "#" + x; ul.append(li); });
      a.append(t, h, s, ul); return a;
    }));
  }).catch(() => { writing.closest("section").hidden = true; });
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
