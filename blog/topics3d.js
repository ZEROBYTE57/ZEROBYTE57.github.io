// Blog home: a dot-matrix 3D sphere carrying the blog's real topics (plain canvas, no libraries).
// The sphere is drawn from small dots, in the same dot style as the portfolio portrait. Every tag from
// the articles sits on its surface, sized by how many articles use it. Hover a topic to see its article
// count (topics that share an article light up too), click it to filter the article list below.
// Drag to spin. Pauses off screen; still for reduced motion.
// Currently not loaded on the site (see the comment in blog/index.html to bring it back).
(() => {
  const cv = document.getElementById("blogNet");
  if (!cv) return;
  const ctx = cv.getContext("2d"), tip = document.getElementById("blogNetTip");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let t = 0, W = 0, H = 0, dpr = 1, rotY = .4, rotX = -.25, drag = null, hover = null, mouse = null, last = performance.now(), raf = 0, vis = true, moved = false;
  let nodes = [], edges = [], C = {};
  // the sphere's dot shell
  const SHELL = Array.from({ length: 520 }, (_, i) => { const y = 1 - (i / 519) * 2, r = Math.sqrt(1 - y * y), g = i * Math.PI * (3 - Math.sqrt(5)); return { x: Math.cos(g) * r, y, z: Math.sin(g) * r }; });

  fetch("posts/index.json").then((r) => r.json()).then((posts) => {
    const count = new Map(), pair = new Map();
    posts.forEach((p) => {
      const tags = [...new Set(p.tags || [])];
      tags.forEach((t) => count.set(t, (count.get(t) || 0) + 1));
      for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) { const k = [tags[i], tags[j]].sort().join("|"); pair.set(k, (pair.get(k) || 0) + 1); }
    });
    const list = [...count.entries()].sort((a, b) => b[1] - a[1]), n = list.length, gold = Math.PI * (3 - Math.sqrt(5)), max = list[0] ? list[0][1] : 1;
    nodes = list.map(([tag, c], i) => { const y = 1 - (i / Math.max(1, n - 1)) * 2, r = Math.sqrt(1 - y * y), a = gold * i;
      return { tag, c, w: c / max, x: Math.cos(a) * r * 1.04, y: y * .92 * 1.04, z: Math.sin(a) * r * 1.04 }; });
    const idx = new Map(nodes.map((nd, i) => [nd.tag, i]));
    edges = [...pair.entries()].map(([k, w]) => { const [a, b] = k.split("|"); return [idx.get(a), idx.get(b), w]; });
    cv.setAttribute("aria-label", `3D globe of ${n} blog topics. Most used: ${list.slice(0, 5).map(([t, c]) => `${t} (${c})`).join(", ")}.`);
    size(); start();
  }).catch(() => {});

  const readC = () => { const cs = getComputedStyle(document.documentElement); C = { text: cs.getPropertyValue("--text").trim(), muted: cs.getPropertyValue("--muted").trim(), accent: cs.getPropertyValue("--accent").trim(), ink: cs.getPropertyValue("--accent-ink").trim(), line: cs.getPropertyValue("--border-strong").trim(), font: cs.getPropertyValue("--mono").trim() || "monospace" }; };
  // layout size (clientWidth/Height) ignores the card's 3D entrance transform, so circles stay round
  function size() { dpr = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); readC(); if (still) draw(); }
  const R = () => Math.min(W * .34, (H - 40) * .38), cy0 = () => (H - 22) / 2 + 6;
  function project(p) {
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    let x = p.x * cy + p.z * sy, z = -p.x * sy + p.z * cy; const y = p.y * cx - z * sx; z = p.y * sx + z * cx;
    const s = R(), k = 2.4 / (2.4 + z); return { X: W / 2 + x * s * k, Y: cy0() + y * s * k, z, k };
  }
  function draw() {
    if (!nodes.length) return;
    ctx.clearRect(0, 0, W, H);
    const P = nodes.map(project);
    const hi = hover != null ? hover : -1;
    // dot shell: far dots small and faint, near dots brighter, a highlight band sweeps across
    ctx.fillStyle = C.accent;
    for (const d of SHELL) {
      const q = project(d), front = (1 - q.z) / 2;                     // 0 at the back, 1 at the front
      const band = Math.max(0, 1 - Math.abs(d.y - Math.sin(t * .6) * .9) / .12);
      ctx.globalAlpha = .06 + front * .32 + band * .35;
      const r = (.5 + front * .9 + band * .6) * q.k;
      ctx.beginPath(); ctx.arc(q.X, q.Y, r / 2, 0, Math.PI * 2); ctx.fill();
    }
    // topics, far ones first
    const order = P.map((q, i) => [i, q.z]).sort((a, b) => b[1] - a[1]);
    const near = hi >= 0 ? new Set(edges.filter(([a, b]) => a === hi || b === hi).flatMap(([a, b]) => [a, b])) : null;
    const placed = [], labels = [];
    for (const [i] of order) {
      const q = P[i], n = nodes[i], fog = Math.max(.18, Math.min(1, (1.35 - q.z) / 2.1)), on = i === hi, rel = near && near.has(i);
      const r = (2.4 + n.w * 6) * q.k;
      ctx.globalAlpha = near && !rel ? fog * .35 : fog;
      if (on) { ctx.fillStyle = C.accent; ctx.globalAlpha = .22; ctx.beginPath(); ctx.arc(q.X, q.Y, r * 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.fillStyle = on || rel ? C.accent : n.w > .5 ? C.ink : C.muted;
      ctx.beginPath(); ctx.arc(q.X, q.Y, r * .55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(q.X, q.Y, r * 1.15, 0, Math.PI * 2); ctx.stroke();
      if (q.z < .1 || on || rel) labels.push([i, on ? -9 : q.z, fog]);
    }
    // labels in a second pass, the hovered and nearest topics first, skipping any that would overlap
    labels.sort((a, b) => a[1] - b[1]);
    for (const [i, , fog] of labels) {
      const q = P[i], n = nodes[i], on = i === hi, r = (2.4 + n.w * 6) * q.k;
      ctx.font = `${on ? 600 : 500} ${Math.round((10 + n.w * 3.5) * q.k)}px ${C.font}`;
      const tw = ctx.measureText("#" + n.tag).width, lx = Math.min(W - 10 - tw / 2, Math.max(10 + tw / 2, q.X)), ly = q.Y - r - 5;
      if (placed.some((b) => Math.abs(b[0] - lx) < (b[2] + tw) / 2 + 4 && Math.abs(b[1] - ly) < 13)) continue;
      placed.push([lx, ly, tw]);
      ctx.globalAlpha = on ? 1 : Math.min(1, fog + .1); ctx.fillStyle = on ? C.ink : C.text; ctx.textAlign = "center";
      ctx.fillText("#" + n.tag, lx, ly);
    }
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    raf = 0; if (!vis || document.hidden) return;
    const dt = Math.max(0, Math.min(50, now - last)) / 1000; last = now;
    t += dt; if (!drag && hover == null) rotY += dt * .22;
    if (mouse && !drag) pick();
    draw(); raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf && !still && vis) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  function pick() {
    const P = nodes.map(project); let best = null, bd = 22;
    P.forEach((q, i) => { if (q.z > .5) return; const d = Math.hypot(q.X - mouse.x, q.Y - mouse.y); if (d < bd) { bd = d; best = i; } });
    if (best !== hover) {
      hover = best; cv.style.cursor = best != null ? "pointer" : "grab";
      if (tip) { if (best == null) tip.hidden = true; else { const n = nodes[best], q = P[best]; tip.hidden = false; tip.textContent = `#${n.tag} · ${n.c} article${n.c > 1 ? "s" : ""} · click to filter`; const tw = tip.offsetWidth, below = q.Y < 70; tip.style.left = Math.min(W - 8 - tw / 2, Math.max(8 + tw / 2, q.X)) + "px"; tip.style.top = q.Y + "px"; tip.classList.toggle("below", below); } }
      if (still) draw();
    }
  }
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, ry: rotY, rx: rotX }; moved = false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    const b = cv.getBoundingClientRect(); mouse = { x: e.clientX - b.left, y: e.clientY - b.top };
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 4) moved = true; rotY = drag.ry + dx * .008; rotX = Math.max(-1.2, Math.min(1.2, drag.rx + dy * .006)); if (still) draw(); }
    else if (still) pick();
  });
  cv.addEventListener("pointerup", () => {
    const was = drag; drag = null;
    if (was && !moved && hover != null) {                  // click a topic: filter the article list
      const tag = nodes[hover].tag, btn = [...document.querySelectorAll("#filters .filter")].find((b) => b.dataset.tag === tag);
      if (btn) { btn.click(); document.getElementById("postsTitle")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" }); }
    }
  });
  cv.addEventListener("pointerleave", () => { drag = null; mouse = null; hover = null; if (tip) tip.hidden = true; cv.style.cursor = "grab"; if (still) draw(); });
  new ResizeObserver(size).observe(cv);
  new MutationObserver(() => { readC(); if (still) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { readC(); if (still) draw(); });
  new IntersectionObserver(([en]) => { vis = en.isIntersecting; vis ? start() : (cancelAnimationFrame(raf), (raf = 0)); }).observe(cv);
  document.addEventListener("visibilitychange", () => (document.hidden ? (cancelAnimationFrame(raf), (raf = 0)) : start()));
})();
