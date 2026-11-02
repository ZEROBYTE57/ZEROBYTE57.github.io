// Small force-directed knowledge graph (Obsidian-style), no dependencies.
// Usage: const g = KnowledgeGraph(canvas, { nodes, links, onOpen, labelsAt });
//   nodes: [{ id, label, type: "post"|"project"|"tag", url? }]
//   links: [{ source: id, target: id }]
// Colors come from CSS variables on the canvas: --g-post, --g-project, --g-tag, --g-line, --g-text, --g-dim.
(function () {
  function KnowledgeGraph(canvas, opts) {
    const ctx = canvas.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const byId = new Map();
    const nodes = opts.nodes.map((n, i) => {
      const a = (i / opts.nodes.length) * Math.PI * 2;
      const node = { ...n, x: Math.cos(a) * 120 + Math.random() * 20, y: Math.sin(a) * 120 + Math.random() * 20, vx: 0, vy: 0, deg: 0 };
      byId.set(n.id, node);
      return node;
    });
    const links = opts.links.map((l) => ({ s: byId.get(l.source), t: byId.get(l.target) })).filter((l) => l.s && l.t);
    links.forEach((l) => { l.s.deg++; l.t.deg++; });
    const nbrs = new Map(nodes.map((n) => [n, new Set()]));
    links.forEach((l) => { nbrs.get(l.s).add(l.t); nbrs.get(l.t).add(l.s); });
    nodes.forEach((n) => (n.r = (n.type === "tag" ? 3.5 : n.type === "project" ? 6.5 : 7) + Math.min(6, Math.sqrt(n.deg) * 1.6)));

    let W = 0, H = 0, dpr = 1;
    let view = { x: 0, y: 0, k: opts.zoom || 1 };
    let alpha = 1, hover = null, drag = null, panning = null, running = true, visible = true, raf = 0;
    let focus = opts.focus ? byId.get(opts.focus) : null;
    let colors = {};

    const readColors = () => {
      const cs = getComputedStyle(canvas);
      const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
      colors = { post: v("--g-post", "#0e8fa0"), project: v("--g-project", "#d97706"), tag: v("--g-tag", "#8a8a96"),
        line: v("--g-line", "rgba(127,127,140,.35)"), text: v("--g-text", "#222"), dim: v("--g-dim", "rgba(127,127,140,.15)"), font: v("--g-font", "12px system-ui") };
    };

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      readColors();
      draw();
    }

    // ---- physics ----
    function tick() {
      const k = alpha;
      for (let i = 0; i < nodes.length; i++) {            // repulsion
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy || 0.01;
          if (d2 > 90000) continue;
          const f = (900 / d2) * k, d = Math.sqrt(d2);
          dx /= d; dy /= d;
          a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
        }
      }
      for (const l of links) {                            // springs
        const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const rest = l.s.type === "tag" || l.t.type === "tag" ? 60 : 90;
        const f = ((d - rest) / d) * 0.06 * k;
        l.s.vx += dx * f; l.s.vy += dy * f; l.t.vx -= dx * f; l.t.vy -= dy * f;
      }
      for (const n of nodes) {                            // gravity + integrate
        n.vx -= n.x * 0.004 * k; n.vy -= n.y * 0.004 * k;
        if (n === drag?.node) { n.vx = n.vy = 0; continue; }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += n.vx; n.y += n.vy;
      }
      alpha = Math.max(0, alpha - 0.006);
    }

    // ---- drawing ----
    const toScreen = (n) => [(n.x * view.k + view.x) + W / 2, (n.y * view.k + view.y) + H / 2];
    const toWorld = (sx, sy) => [((sx - W / 2) - view.x) / view.k, ((sy - H / 2) - view.y) / view.k];

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const active = hover || focus;
      const lit = active ? nbrs.get(active) : null;
      ctx.lineWidth = 1;
      for (const l of links) {
        const on = active && (l.s === active || l.t === active);
        ctx.strokeStyle = on ? colors[active.type] : active ? colors.dim : colors.line;
        ctx.lineWidth = on ? 1.6 : 1;
        const [x1, y1] = toScreen(l.s), [x2, y2] = toScreen(l.t);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.font = colors.font; ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (const n of nodes) {
        const [x, y] = toScreen(n);
        const faded = active && n !== active && !lit.has(n);
        const r = n.r * Math.max(0.7, Math.min(1.4, view.k));
        ctx.globalAlpha = faded ? 0.18 : 1;
        if (n === active) { ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.fillStyle = colors[n.type]; ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1; }
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = colors[n.type]; ctx.fill();
        const near = n === active || (lit && lit.has(n));
        const showLabel = near || (n.type === "tag" ? view.k > 1.3 : view.k > (opts.labelsAt ?? 0.55));
        if (showLabel && !faded) {
          ctx.globalAlpha = n === active ? 1 : 0.85;
          ctx.fillStyle = colors.text;
          const label = n.type === "tag" ? "#" + n.label : n.label.length > 34 ? n.label.slice(0, 33) + "…" : n.label;
          ctx.fillText(label, x, y + r + 4);
        }
      }
      ctx.globalAlpha = 1;
    }

    function loop() {
      raf = 0;
      if (!visible) return;
      if (alpha > 0.002 || drag) { tick(); draw(); raf = requestAnimationFrame(loop); }
      else running = false;
    }
    const reheat = (a = 0.5) => { alpha = Math.max(alpha, a); if (!raf && visible) { running = true; raf = requestAnimationFrame(loop); } };

    // ---- interaction ----
    function pick(sx, sy) {
      const [wx, wy] = toWorld(sx, sy);
      let best = null, bd = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - wx, n.y - wy), hit = (n.r + 6) / view.k;
        if (d < hit && d < bd) { bd = d; best = n; }
      }
      return best;
    }
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    let downAt = null;
    canvas.addEventListener("pointerdown", (e) => {
      const [sx, sy] = pos(e); downAt = [sx, sy];
      const n = pick(sx, sy);
      canvas.setPointerCapture(e.pointerId);
      if (n) { drag = { node: n }; reheat(0.3); }
      else panning = { sx, sy, vx: view.x, vy: view.y };
    });
    canvas.addEventListener("pointermove", (e) => {
      const [sx, sy] = pos(e);
      if (drag) { const [wx, wy] = toWorld(sx, sy); drag.node.x = wx; drag.node.y = wy; reheat(0.3); return; }
      if (panning) { view.x = panning.vx + (sx - panning.sx); view.y = panning.vy + (sy - panning.sy); draw(); return; }
      const h = pick(sx, sy);
      if (h !== hover) { hover = h; canvas.style.cursor = h ? "pointer" : "grab"; draw(); opts.onHover && opts.onHover(h); }
    });
    canvas.addEventListener("pointerup", (e) => {
      const [sx, sy] = pos(e);
      const moved = downAt && Math.hypot(sx - downAt[0], sy - downAt[1]) > 4;
      if (drag && !moved && opts.onOpen) opts.onOpen(drag.node);
      drag = null; panning = null; downAt = null;
    });
    canvas.addEventListener("pointerleave", () => { if (hover) { hover = null; draw(); opts.onHover && opts.onHover(null); } });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const [sx, sy] = pos(e);
      const k = Math.min(3, Math.max(0.3, view.k * Math.exp(-e.deltaY * 0.0015)));
      const [wx, wy] = toWorld(sx, sy);
      view.k = k;
      view.x = (sx - W / 2) - wx * k; view.y = (sy - H / 2) - wy * k;
      draw();
    }, { passive: false });

    new ResizeObserver(resize).observe(canvas);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && alpha > 0.002) reheat(alpha); }).observe(canvas);
    }
    // Recolor when the site theme changes.
    new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { readColors(); draw(); });

    resize();
    if (reduce) { for (let i = 0; i < 300; i++) tick(); alpha = 0; draw(); }
    else reheat(1);

    return {
      setFocus(id) { focus = id ? byId.get(id) : null; draw(); },
      zoom(f) { view.k = Math.min(3, Math.max(0.3, view.k * f)); draw(); },
      reset() { view = { x: 0, y: 0, k: opts.zoom || 1 }; reheat(0.6); },
    };
  }
  window.KnowledgeGraph = KnowledgeGraph;
})();
