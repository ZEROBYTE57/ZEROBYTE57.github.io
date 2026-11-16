// Case-study pages: theme toggle, clock, mobile menu, reading progress, contents highlight.
(() => {
  const root = document.documentElement, $ = (s) => document.querySelector(s);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("#themeToggle")?.addEventListener("click", () => {
    const cur = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark", apply = () => { root.dataset.theme = next; };
    if (document.startViewTransition && !still) document.startViewTransition(apply); else apply();
    try { localStorage.setItem("theme", next); } catch (e) {}
  });
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();
  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  const tick = () => { const c = $("#clock2"); if (c) c.textContent = fmt.format(new Date()); };
  tick(); setInterval(tick, 15000);

  const dock = $(".dock"), btn = $("#menuBtn");
  const set = (open) => { dock.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); btn.setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
  btn?.addEventListener("click", () => set(!dock.classList.contains("open")));
  document.addEventListener("click", (e) => { if (dock && !dock.contains(e.target)) set(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });

  const bar = $("#progress");
  const toc = [...document.querySelectorAll(".cs-toc a")], secs = toc.map((a) => document.querySelector(a.getAttribute("href")));
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const max = root.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    let cur = 0; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < 140) cur = i; });
    toc.forEach((a, i) => a.classList.toggle("active", i === cur));
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // footer prompt types itself once
  const cmd = $(".foot-prompt .fp-cmd");
  if (cmd && !still && "IntersectionObserver" in window) {
    const full = cmd.textContent; cmd.style.minWidth = full.length + "ch"; cmd.textContent = "";
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; io.disconnect(); let i = 0; const step = () => { cmd.textContent = full.slice(0, ++i); if (i < full.length) setTimeout(step, 70 + Math.random() * 60); }; setTimeout(step, 300); }, { threshold: 1 });
    io.observe(cmd.parentElement);
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
})();
