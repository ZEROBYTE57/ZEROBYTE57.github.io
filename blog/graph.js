// Knowledge graph in the style of Quartz (quartz.jzhao.xyz), no dependencies.
// d3-like force simulation (many-body repulsion, links, centering, collision),
// small nodes sized by degree, fixed-size labels placed without overlaps,
// smooth hover focus, visited-page colouring, drag / wheel zoom / pinch zoom.
//
// Usage: const g = KnowledgeGraph(canvas, { nodes, links, mode, focus, visited, onOpen, onHover });
//   nodes:   [{ id, label, type: "post"|"project"|"note"|"tag", ref? }]
//   links:   [{ source: id, target: id }]
//   mode:    "local" (small sidebar graph) or "global" (big / fullscreen graph)
//   focus:   id of the current page (drawn in the accent colour)
//   visited: Set of ids the reader has already opened
// Colours come from CSS variables on the canvas (see blog.css).
(function () {
  const MODES = {
    local:  { repel: 55, linkDistance: 34, center: 0.3, gravity: 0.05, font: 11, maxZoom: 2.2 },
    global: { repel: 70, linkDistance: 46, center: 0.2, gravity: 0.03, font: 12, maxZoom: 3 },
  };

  function KnowledgeGraph(canvas, opts) {
    const cfg = { ...MODES[opts.mode || "global"], ...(opts.config || {}) };
    const ctx = canvas.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const visited = opts.visited || new Set();
    const byId = new Map();

    // ---------- data ----------
    const nodes = opts.nodes.map((n, i) => {
      const a = i * 2.399963;                                 // golden-angle spiral start, like d3
      const r = 8 * Math.sqrt(i + 0.5);
      const node = { ...n, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0, fx: null, fy: null, deg: 0, hidden: false, fade: 1,
        // floating motion: each node drifts on its own slow Lissajous path; z = depth (0 far, 1 near)
        z: 0.35 + Math.random() * 0.65, ph1: Math.random() * 6.283, ph2: Math.random() * 6.283,
        f1: 0.00035 + Math.random() * 0.00035, f2: 0.00028 + Math.random() * 0.0003, ox: 0, oy: 0 };
      byId.set(n.id, node);
      return node;
    });
    const links = opts.links.map((l) => ({ s: byId.get(l.source), t: byId.get(l.target) })).filter((l) => l.s && l.t);
    links.forEach((l) => { l.s.deg++; l.t.deg++; });
    links.forEach((l) => { l.strength = 1 / Math.min(l.s.deg, l.t.deg); l.bias = l.s.deg / (l.s.deg + l.t.deg); });
    const nbrs = new Map(nodes.map((n) => [n, new Set()]));
    links.forEach((l) => { nbrs.get(l.s).add(l.t); nbrs.get(l.t).add(l.s); });
    nodes.forEach((n) => (n.r = (n.type === "tag" ? 1.6 : 2) + Math.sqrt(n.deg)));   // Quartz: 2 + sqrt(links)
    let focus = opts.focus ? byId.get(opts.focus) : null;
    const shown = (n) => !n.hidden;

    // ---------- view + colours ----------
    let W = 0, H = 0, dpr = 1, view = { x: 0, y: 0, k: 1 };
    let colors = {};
    const readColors = () => {
      const cs = getComputedStyle(canvas);
      const v = (name, fb) => cs.getPropertyValue(name).trim() || fb;
      colors = {
        post: v("--g-post", "#8a8a96"), project: v("--g-project", "#d97706"), note: v("--g-note", "#7c3aed"),
        tag: v("--g-tag", "#a1a1aa"), current: v("--g-current", "#0e8fa0"), visited: v("--g-visited", "#6b9aa3"),
        line: v("--g-line", "rgba(127,127,140,.35)"), lineActive: v("--g-line-active", "#0e8fa0"),
        text: v("--g-text", "#222"), bg: v("--g-bg", "#fff"), font: v("--g-font-family", "system-ui, sans-serif"),
        star: v("--g-star", "#9aa3b2"),
      };
    };
    const colorOf = (n) => n === focus ? colors.current : n.type === "post" ? (visited.has(n.id) ? colors.visited : colors.post) : colors[n.type];
    const toScreen = (n) => [(n.x + n.ox) * view.k + view.x + W / 2, (n.y + n.oy) * view.k + view.y + H / 2];
    const toWorld = (sx, sy) => [(sx - W / 2 - view.x) / view.k, (sy - H / 2 - view.y) / view.k];

    // ---------- simulation (d3-force style) ----------
    let alpha = 1, alphaTarget = 0;
    const alphaMin = 0.001, alphaDecay = 1 - Math.pow(alphaMin, 1 / 300), velocityDecay = 0.6;
    function tick() {
      alpha += (alphaTarget - alpha) * alphaDecay;
      const vis = nodes.filter(shown);
      // many-body repulsion
      for (let i = 0; i < vis.length; i++) {
        const a = vis[i];
        for (let j = i + 1; j < vis.length; j++) {
          const b = vis[j];
          let dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
          if (l < 1e-6) { dx = (Math.random() - 0.5) * 1e-3; dy = (Math.random() - 0.5) * 1e-3; l = dx * dx + dy * dy; }
          if (l < 1) l = Math.sqrt(l);
          const w = (cfg.repel * alpha) / l;
          a.vx -= dx * w; a.vy -= dy * w; b.vx += dx * w; b.vy += dy * w;
        }
      }
      // links
      for (const lk of links) {
        if (!shown(lk.s) || !shown(lk.t)) continue;
        let x = lk.t.x + lk.t.vx - lk.s.x - lk.s.vx, y = lk.t.y + lk.t.vy - lk.s.y - lk.s.vy;
        let l = Math.sqrt(x * x + y * y) || 1e-3;
        l = ((l - cfg.linkDistance) / l) * alpha * lk.strength;
        x *= l; y *= l;
        lk.t.vx -= x * lk.bias; lk.t.vy -= y * lk.bias;
        lk.s.vx += x * (1 - lk.bias); lk.s.vy += y * (1 - lk.bias);
      }
      // weak gravity keeps loose nodes and small components nearby
      for (const n of vis) { n.vx -= n.x * cfg.gravity * alpha; n.vy -= n.y * cfg.gravity * alpha; }
      // collision
      for (let i = 0; i < vis.length; i++) {
        const a = vis[i];
        for (let j = i + 1; j < vis.length; j++) {
          const b = vis[j], r = a.r + b.r + 4;
          let dx = b.x + b.vx - a.x - a.vx, dy = b.y + b.vy - a.y - a.vy, l = dx * dx + dy * dy;
          if (l >= r * r) continue;
          l = Math.sqrt(l) || 1e-3;
          const m = ((r - l) / l) * 0.5;
          a.vx -= dx * m; a.vy -= dy * m; b.vx += dx * m; b.vy += dy * m;
        }
      }
      // integrate
      let sx = 0, sy = 0;
      for (const n of vis) {
        if (n.fx != null) { n.x = n.fx; n.y = n.fy; n.vx = n.vy = 0; }
        else { n.x += (n.vx *= velocityDecay); n.y += (n.vy *= velocityDecay); }
        sx += n.x; sy += n.y;
      }
      // centering (like d3.forceCenter)
      if (vis.length) {
        sx = (sx / vis.length) * cfg.center; sy = (sy / vis.length) * cfg.center;
        for (const n of vis) if (n.fx == null) { n.x -= sx; n.y -= sy; }
      }
    }

    // Turn the layout so its longest direction lines up with the canvas' longest side.
    function alignToCanvas() {
      const vis = nodes.filter(shown);
      if (vis.length < 3 || !W || !H) return;
      let mx = 0, my = 0;
      vis.forEach((n) => { mx += n.x; my += n.y; }); mx /= vis.length; my /= vis.length;
      let sxx = 0, syy = 0, sxy = 0;
      vis.forEach((n) => { const dx = n.x - mx, dy = n.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
      const major = 0.5 * Math.atan2(2 * sxy, sxx - syy);            // angle of the principal axis
      const rot = (W >= H ? 0 : Math.PI / 2) - major;
      const c = Math.cos(rot), sn = Math.sin(rot);
      vis.forEach((n) => {
        const dx = n.x - mx, dy = n.y - my;
        n.x = dx * c - dy * sn; n.y = dx * sn + dy * c;
        const vx = n.vx; n.vx = vx * c - n.vy * sn; n.vy = vx * sn + n.vy * c;
      });
    }

    // ---------- space: drifting starfield, floating offsets, signal pulses ----------
    const FLOAT = !reduce && opts.float !== false;
    const stars = Array.from({ length: opts.mode === "local" ? 26 : 70 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.3, a: Math.random() * 0.5 + 0.15,
      tw: Math.random() * 6.283, sp: (Math.random() * 0.6 + 0.2) * 0.000012,
    }));
    let pulses = [], lastPulse = 0, now = 0;
    function updateFloat(t) {
      now = t;
      if (!FLOAT) return;
      for (const n of nodes) {
        if (n === drag?.node) { n.ox *= 0.85; n.oy *= 0.85; continue; }      // settle while dragged
        const amp = (n.type === "tag" ? 4 : 3) * n.z;
        n.ox = Math.sin(t * n.f1 + n.ph1) * amp + Math.sin(t * n.f2 * 0.6 + n.ph2) * amp * 0.4;
        n.oy = Math.cos(t * n.f2 + n.ph2) * amp + Math.cos(t * n.f1 * 0.7 + n.ph1) * amp * 0.4;
      }
      // signal pulses run along the hovered node's links
      if (hover && t - lastPulse > 420) {
        lastPulse = t;
        for (const lk of links) if ((lk.s === hover || lk.t === hover) && shown(lk.s) && shown(lk.t))
          pulses.push({ from: hover, to: lk.s === hover ? lk.t : lk.s, t0: t });
      }
      pulses = pulses.filter((p) => t - p.t0 < 900 && hover);
    }
    function drawSpace() {
      for (const st of stars) {
        const x = ((st.x + now * st.sp) % 1) * W, y = st.y * H;
        const a = FLOAT ? st.a * (0.6 + 0.4 * Math.sin(now * 0.0012 + st.tw)) : st.a;
        ctx.globalAlpha = a; ctx.fillStyle = colors.star;
        ctx.beginPath(); ctx.arc(x, y, st.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ---------- hover focus (animated) ----------
    let hover = null, fadeAnim = false;
    const isLit = (n, active) => !active || n === active || nbrs.get(active).has(n);
    function stepFades() {
      const active = hover;
      let moving = false;
      for (const n of nodes) {
        const target = isLit(n, active) ? 1 : 0.18;
        const d = target - n.fade;
        if (Math.abs(d) > 0.01) { n.fade += reduce ? d : d * 0.25; moving = true; } else n.fade = target;
      }
      return moving;
    }

    // ---------- drawing ----------
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const active = hover;
      const nodeScale = Math.max(0.8, Math.min(2.2, view.k));
      drawSpace();
      // links
      for (const lk of links) {
        if (!shown(lk.s) || !shown(lk.t)) continue;
        const on = active && (lk.s === active || lk.t === active);
        ctx.globalAlpha = Math.min(lk.s.fade, lk.t.fade) * (on ? 1 : 0.9);
        ctx.strokeStyle = on ? colors.lineActive : colors.line;
        ctx.lineWidth = on ? 1.5 : 1;
        const [x1, y1] = toScreen(lk.s), [x2, y2] = toScreen(lk.t);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      // nodes
      for (const n of nodes) {
        if (!shown(n)) continue;
        const [x, y] = toScreen(n);
        if (x < -30 || y < -30 || x > W + 30 || y > H + 30) continue;
        const depth = FLOAT ? 0.82 + n.z * 0.18 : 1;                  // far nodes a touch smaller and softer
        const r = n.r * nodeScale * depth * (n === active ? 1.25 : 1);
        if (n.type !== "tag") {                                         // soft glow halo
          ctx.globalAlpha = n.fade * (n === active || n === focus ? 0.32 : 0.16) * depth;
          ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, Math.PI * 2); ctx.fillStyle = colorOf(n); ctx.fill();
        }
        ctx.globalAlpha = n.fade * (FLOAT ? 0.75 + n.z * 0.25 : 1);
        if (n === focus) { ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.strokeStyle = colors.current; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = colorOf(n); ctx.fill();
      }
      // signal pulses travelling along the hovered node's links
      for (const p of pulses) {
        const k = Math.min(1, (now - p.t0) / 900), e = k * (2 - k);
        const [x1, y1] = toScreen(p.from), [x2, y2] = toScreen(p.to);
        ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = colors.lineActive;
        ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * e, y1 + (y2 - y1) * e, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      // labels: fixed screen size, placed in priority order, skipped if they would overlap
      ctx.globalAlpha = 1;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      // Node circles are obstacles too, so labels never sit on top of another node.
      const placed = [];
      const obstacles = nodes.filter((n) => shown(n) && n.type !== "tag").map((n) => { const [x, y] = toScreen(n), r = n.r * nodeScale + 1; return { n, x: x - r, y: y - r, w: r * 2, h: r * 2 }; });
      const overlaps = (b) => placed.some((p) => b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y);
      const prio = (n) => n === active ? 0 : n === focus ? 1 : active && nbrs.get(active).has(n) ? 2 : n.type === "post" ? 3 : n.type === "tag" ? 5 : 4;
      const cand = nodes.filter((n) => shown(n) && n.fade > 0.5).sort((a, b) => prio(a) - prio(b) || b.deg - a.deg);
      for (const n of cand) {
        const p = prio(n);
        if (p >= 3) {                                       // ordinary labels appear as you zoom in
          const small = W < 520;                            // phones zoom out further to fit, so lower the bar there
          const need = n.type === "tag" ? 1.3 : opts.mode === "local" ? 0.5 : n.type === "post" ? (small ? 0.3 : 0.6) : small ? 0.45 : 0.6;
          if (view.k < need) continue;
        }
        const [x, y] = toScreen(n);
        const size = p <= 1 ? cfg.font + 1 : n.type === "tag" ? cfg.font - 1.5 : cfg.font;
        ctx.font = `${p <= 1 ? 600 : 500} ${size}px ${colors.font}`;
        let label = n.type === "tag" ? "#" + n.label : n.label;
        const max = W < 420 ? 20 : 30;
        if (label.length > max && p > 0) label = label.slice(0, max - 1) + "…";
        const w = ctx.measureText(label).width + 6, h = size + 4;
        const ly = y + n.r * nodeScale + 4;
        const lx = Math.min(Math.max(x, w / 2 + 2), W - w / 2 - 2);   // keep the label inside the canvas
        const box = { x: lx - w / 2, y: ly - 1, w, h };
        if (p > 0 && (overlaps(box) || obstacles.some((o) => o.n !== n && box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y))) continue;
        placed.push(box);
        ctx.globalAlpha = n.fade * (p <= 2 ? 1 : 0.82);
        ctx.lineWidth = 3; ctx.strokeStyle = colors.bg; ctx.lineJoin = "round";
        ctx.strokeText(label, lx, ly);                      // halo keeps labels readable over links
        ctx.fillStyle = colors.text; ctx.fillText(label, lx, ly);
      }
      ctx.globalAlpha = 1;
    }

    // ---------- loop ----------
    let raf = 0, visible = true, dead = false, lastDraw = 0;
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
    function frame(t) {
      raf = 0;
      if (dead || !visible) return;
      updateFloat(t || performance.now());
      let busy = FLOAT && !document.hidden;                            // floating keeps the loop alive
      if (busy && t && t - lastDraw < 30 && alpha <= alphaMin && !anim && !drag) { raf = requestAnimationFrame(frame); return; } // ~33 fps idle cap
      lastDraw = t || 0;
      if (alpha > alphaMin || alphaTarget > 0) { tick(); busy = true; }
      if (stepFades()) busy = true;
      if (!aligned && alpha < 0.35) { aligned = true; if (!opts.focusCentered) alignToCanvas(); }
      if (!fitted && alpha < 0.12) { fitted = true; if (!userMoved) fit(true); }
      draw();
      if (busy || anim) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && visible && !dead) raf = requestAnimationFrame(frame); };
    const reheat = (a = 0.3) => { alpha = Math.max(alpha, a); kick(); };

    // ---------- fit / animated view ----------
    let fitted = false, aligned = false, userMoved = false, anim = null;
    function animateView(target, ms = 450) {
      if (reduce) { view = target; draw(); return; }
      const from = { ...view }, t0 = performance.now();
      anim = { from, target, t0, ms };
      const step = (t) => {
        if (!anim || anim.t0 !== t0) return;
        const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
        view = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e };
        draw();
        if (p < 1) requestAnimationFrame(step); else anim = null;
      };
      requestAnimationFrame(step);
    }
    function fit(animated = true) {
      const vis = nodes.filter(shown);
      if (!vis.length || !W) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of vis) { x0 = Math.min(x0, n.x - n.r); x1 = Math.max(x1, n.x + n.r); y0 = Math.min(y0, n.y - n.r); y1 = Math.max(y1, n.y + n.r + 14); }
      const pad = W < 420 ? 28 : 48;
      const k = Math.max(0.25, Math.min(cfg.maxZoom, Math.min((W - pad * 2) / Math.max(1, x1 - x0), (H - pad * 2) / Math.max(1, y1 - y0))));
      const target = { k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k };
      animated ? animateView(target) : ((view = target), draw());
    }

    // ---------- interaction ----------
    function pick(sx, sy) {
      const [wx, wy] = toWorld(sx, sy);
      let best = null, bd = Infinity;
      for (const n of nodes) {
        if (!shown(n)) continue;
        const d = Math.hypot(n.x + n.ox - wx, n.y + n.oy - wy), hit = (n.r * Math.max(0.8, Math.min(2.2, view.k)) + 8) / view.k;
        if (d < hit && d < bd) { bd = d; best = n; }
      }
      return best;
    }
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const emitHover = (n) => { if (!opts.onHover) return; if (!n) return opts.onHover(null); const [x, y] = toScreen(n); opts.onHover(n, x, y); };
    const setHover = (n) => { if (n === hover) return; hover = n; canvas.style.cursor = n ? "pointer" : "grab"; emitHover(n); kick(); };

    // Click-to-engage: on the page the graph lets scrolling pass through until you click it.
    // While engaged, wheel zooms, drag pans and touch moves nodes. Esc, a click outside or
    // scrolling the graph off screen releases it. The fullscreen view (modal) is always engaged.
    const needsEngage = !canvas.classList.contains("modal") && opts.engage !== false;
    let engaged = !needsEngage;
    const host = canvas.parentElement;
    function setEngaged(on) {
      if (!needsEngage || on === engaged) return;
      engaged = on;
      canvas.classList.toggle("engaged", on);
      host && host.setAttribute("data-graph", on ? "live" : "idle");
      if (!on) { setHover(null); drag && (drag.node.fx = drag.node.fy = null); drag = pan = pinch = downAt = null; pointers.clear(); alphaTarget = 0; }
    }
    // Small status badge in the graph's corner (its own element, so it never clashes with the card's glow layer).
    if (needsEngage && host) {
      host.setAttribute("data-graph", "idle");
      host.classList.add("graph-host");
      const badge = document.createElement("span"); badge.className = "graph-badge"; badge.setAttribute("aria-hidden", "true");
      host.append(badge);
    }
    const onDocDown = (e) => { if (engaged && !canvas.contains(e.target) && !(host && host.contains(e.target) && e.target.closest(".gbtn-s, .graph-find"))) setEngaged(false); };
    const onKeyEsc = (e) => { if (e.key === "Escape") setEngaged(false); };
    if (needsEngage) { document.addEventListener("pointerdown", onDocDown, true); addEventListener("keydown", onKeyEsc); }

    const pointers = new Map();
    let drag = null, pan = null, pinch = null, downAt = null;
    function onDown(e) {
      const [sx, sy] = pos(e);
      if (!engaged) {
        // First click (or tap) only engages. A click straight on a node still opens it.
        if (e.pointerType !== "touch") { const n = pick(sx, sy); if (n) { downAt = [sx, sy]; drag = { node: n, peek: true }; return; } }
        setEngaged(true); return;
      }
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, [sx, sy]);
      if (pointers.size === 2) {                            // pinch zoom
        const [[ax, ay], [bx, by]] = [...pointers.values()];
        pinch = { d: Math.hypot(bx - ax, by - ay), k: view.k, cx: (ax + bx) / 2, cy: (ay + by) / 2, vx: view.x, vy: view.y };
        drag = null; pan = null; return;
      }
      downAt = [sx, sy];
      const n = pick(sx, sy);
      if (n) { drag = { node: n }; n.fx = n.x; n.fy = n.y; alphaTarget = 0.3; kick(); }
      else pan = { sx, sy, vx: view.x, vy: view.y };
    }
    function onMove(e) {
      const [sx, sy] = pos(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [sx, sy]);
      if (pinch && pointers.size === 2) {
        const [[ax, ay], [bx, by]] = [...pointers.values()];
        const k = Math.min(cfg.maxZoom + 1, Math.max(0.25, pinch.k * (Math.hypot(bx - ax, by - ay) / pinch.d)));
        const wx = (pinch.cx - W / 2 - pinch.vx) / pinch.k, wy = (pinch.cy - H / 2 - pinch.vy) / pinch.k;
        view = { k, x: pinch.cx - W / 2 - wx * k, y: pinch.cy - H / 2 - wy * k };
        userMoved = true; draw(); return;
      }
      if (drag && drag.peek) { if (Math.hypot(sx - downAt[0], sy - downAt[1]) > 5) { drag = null; downAt = null; setEngaged(true); } return; }
      if (drag) { const [wx, wy] = toWorld(sx, sy); drag.node.fx = wx; drag.node.fy = wy; kick(); emitHover(drag.node); return; }
      if (pan) { userMoved = true; view.x = pan.vx + (sx - pan.sx); view.y = pan.vy + (sy - pan.sy); draw(); emitHover(hover); return; }
      if (e.pointerType !== "touch") setHover(pick(sx, sy));
    }
    function onUp(e) {
      const [sx, sy] = pos(e);
      pointers.delete(e.pointerId);
      if (pinch) { if (pointers.size < 2) pinch = null; return; }
      const moved = downAt && Math.hypot(sx - downAt[0], sy - downAt[1]) > 5;
      if (drag && drag.peek) { const n = drag.node; drag = null; downAt = null; if (opts.onOpen) opts.onOpen(n); return; }
      if (drag) {
        drag.node.fx = drag.node.fy = null; alphaTarget = 0;
        if (!moved && opts.onOpen) opts.onOpen(drag.node);
      }
      drag = null; pan = null; downAt = null;
    }
    function onCancel(e) { pointers.delete(e.pointerId); if (drag) { drag.node.fx = drag.node.fy = null; alphaTarget = 0; } drag = pan = pinch = downAt = null; }
    function onWheel(e) {
      if (!engaged) return;                                   // let the page scroll
      e.preventDefault(); userMoved = true;
      const [sx, sy] = pos(e);
      const k = Math.min(cfg.maxZoom + 1, Math.max(0.25, view.k * Math.exp(-e.deltaY * 0.0015)));
      const [wx, wy] = toWorld(sx, sy);
      view = { k, x: sx - W / 2 - wx * k, y: sy - H / 2 - wy * k };
      draw(); emitHover(hover);
    }
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", () => { if (!drag && !pan) setHover(null); });
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // ---------- lifecycle ----------
    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      readColors();
      if (fitted && !userMoved) fit(false); else draw();
    }
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const io = "IntersectionObserver" in window ? new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); else setEngaged(false); }) : null;
    io && io.observe(canvas);
    const mo = new MutationObserver(() => { readColors(); draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)"); const onScheme = () => { readColors(); draw(); };
    mq.addEventListener?.("change", onScheme);

    resize();
    // Pre-settle most of the layout synchronously so the graph appears already arranged and fitted
    // (no zoomed-in, half-settled first frame), then let the last bit settle with animation.
    for (let i = 0; i < (reduce ? 400 : 160); i++) tick();
    if (reduce) alpha = 0;
    aligned = fitted = true; alignToCanvas(); fit(false);
    if (!reduce) kick();

    return {
      setFocus(id) { focus = id ? byId.get(id) : null; draw(); },
      zoom(f) { userMoved = true; animateView({ k: Math.min(cfg.maxZoom + 1, Math.max(0.25, view.k * f)), x: view.x * f, y: view.y * f }, 220); },
      reset() { userMoved = false; fit(true); },
      setHidden(types) { nodes.forEach((n) => (n.hidden = types.has(n.type))); if (hover?.hidden) setHover(null); reheat(0.5); fitted = aligned = false; userMoved = false; },
      find(query) {
        const q = query.trim().toLowerCase();
        if (!q) { setHover(null); return null; }
        const n = nodes.filter(shown).find((x) => x.label.toLowerCase().includes(q));
        setHover(n || null);
        if (n) { userMoved = true; const k = Math.max(view.k, 1.4); animateView({ k, x: -n.x * k, y: -n.y * k }); }
        return n;
      },
      engage(on = true) { setEngaged(on); },
      destroy() { dead = true; host && host.querySelector(":scope > .graph-badge")?.remove(); document.removeEventListener("pointerdown", onDocDown, true); removeEventListener("keydown", onKeyEsc); cancelAnimationFrame(raf); ro.disconnect(); io && io.disconnect(); mo.disconnect(); mq.removeEventListener?.("change", onScheme); },
    };
  }
  window.KnowledgeGraph = KnowledgeGraph;
})();
