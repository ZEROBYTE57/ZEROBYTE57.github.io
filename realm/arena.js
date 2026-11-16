// 404 Realm hero backdrop: "tactical scan" in ROG red (plain canvas, no libraries).
// A LiDAR-style point cloud of rolling terrain is swept by a scan beam, while a holographic
// targeting rig (rotating segmented rings, tick marks, lock-on brackets) spins behind the player card.
// The camera leans toward the cursor. Pauses off screen; still for reduced motion.
(() => {
  const cv = document.getElementById("heroArena");
  if (!cv) return;
  const ctx = cv.getContext("2d"), host = cv.parentElement;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RED = "255,46,79", PINK = "255,107,128", CYAN = "92,211,255", AURA = "217,77,255";
  let W = 0, H = 0, dpr = 1, t = 0, last = performance.now(), raf = 0, vis = true, cam = { x: 0, y: 0 }, aim = { x: 0, y: 0 };

  // point-cloud terrain: a grid of points in the x-z plane, height from layered waves
  const GX = 64, GZ = 34, pts = [];
  for (let iz = 0; iz < GZ; iz++) for (let ix = 0; ix < GX; ix++) pts.push({ x: (ix / (GX - 1) - .5) * 4.2, z: iz / (GZ - 1) * 3.4 + .25, j: Math.random() });
  const height = (x, z, t) => Math.sin(x * 1.6 + t * .6) * .12 + Math.sin(z * 2.3 - t * .9) * .1 + Math.sin((x + z) * 3.1 + t * .4) * .05;

  // layout size (clientWidth/Height) ignores entrance transforms, so the drawing is never stretched
  function size() { dpr = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (still) draw(); }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    cam.x += (aim.x - cam.x) * .05; cam.y += (aim.y - cam.y) * .05;
    const phone = W < 700, cx = phone ? W * .5 : W * .66, hz = H * (phone ? .5 : .46);
    // ---------- LiDAR point cloud ----------
    const scanZ = .25 + ((t * .55) % 1) * 3.6;                    // beam sweeping away from the viewer
    const f = Math.min(W, H) * (phone ? .9 : 1.05);
    for (const p of pts) {
      const y = height(p.x, p.z, t) + .55, z = p.z;
      const px = cx + ((p.x - cam.x * .6) * f) / (z + .6), py = hz + ((y + cam.y * .25) * f) / (z + .6);
      if (px < -4 || px > W + 4 || py > H + 4) continue;
      const near = 1 - z / 3.8, d = Math.abs(z - scanZ), hit = Math.max(0, 1 - d / .22);
      const r = (.6 + near * 1.3) * (1 + hit * .9);
      ctx.fillStyle = hit > .05 ? `rgba(${hit > .6 ? "255,220,228" : PINK},${.35 + hit * .65})` : `rgba(${RED},${.12 + near * .45})`;
      ctx.beginPath(); ctx.arc(px, py, r / 2, 0, 6.283); ctx.fill();
    }
    // scan beam glow line on the terrain
    const by = hz + ((.55 + height(0, scanZ, t)) * f) / (scanZ + .6);
    const bg = ctx.createLinearGradient(0, by - 30, 0, by + 30); bg.addColorStop(0, `rgba(${RED},0)`); bg.addColorStop(.5, `rgba(${RED},.16)`); bg.addColorStop(1, `rgba(${RED},0)`);
    ctx.fillStyle = bg; ctx.fillRect(0, by - 30, W, 60);

    // ---------- holographic targeting rig (desktop and tablet; on phones it would sit behind the text) ----------
    if (phone) return;
    const ox = cx + cam.x * 18, oy = H * (phone ? .32 : .4) + cam.y * 12, R = Math.min(W, H) * (phone ? .26 : .34);
    const ring = (r, a0, segs, gap, width, rgb, alpha, dash) => {
      ctx.strokeStyle = `rgba(${rgb},${alpha})`; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      for (let k = 0; k < segs; k++) { const a = a0 + (k / segs) * Math.PI * 2; ctx.beginPath(); ctx.arc(ox, oy, r, a, a + (Math.PI * 2) / segs - gap); ctx.stroke(); }
      ctx.setLineDash([]);
    };
    ctx.save(); ctx.shadowColor = `rgb(${RED})`; ctx.shadowBlur = 10;
    ring(R * 1.18, t * .35, 3, .5, 2, PINK, .75);
    ring(R * 1.02, -t * .5, 6, .22, 1.2, RED, .55);
    ring(R * .86, t * .8, 1, .0, 1, CYAN, .35, [2, 7]);
    ctx.restore();
    // tick marks
    ctx.strokeStyle = `rgba(${PINK},.5)`; ctx.lineWidth = 1;
    for (let k = 0; k < 72; k++) { const a = (k / 72) * Math.PI * 2 - t * .12, l = k % 6 === 0 ? 10 : 4;
      ctx.beginPath(); ctx.moveTo(ox + Math.cos(a) * R * 1.3, oy + Math.sin(a) * R * 1.3); ctx.lineTo(ox + Math.cos(a) * (R * 1.3 + l), oy + Math.sin(a) * (R * 1.3 + l)); ctx.stroke(); }
    // sweeping radar wedge
    const sa = t * 1.1, wedge = ctx.createConicGradient ? ctx.createConicGradient(sa, ox, oy) : null;
    if (wedge) { wedge.addColorStop(0, `rgba(${RED},.18)`); wedge.addColorStop(.12, `rgba(${RED},0)`); wedge.addColorStop(1, `rgba(${RED},0)`);
      ctx.fillStyle = wedge; ctx.beginPath(); ctx.arc(ox, oy, R * 1.3, 0, Math.PI * 2); ctx.fill(); }
    // lock-on brackets that breathe
    const b = R * (1.42 + Math.sin(t * 2.2) * .03), L = R * .16;
    ctx.strokeStyle = `rgba(${PINK},.85)`; ctx.lineWidth = 2;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const x = ox + sx * b * .72, y = oy + sy * b * .72;
      ctx.beginPath(); ctx.moveTo(x, y + -sy * L); ctx.lineTo(x, y); ctx.lineTo(x + -sx * L, y); ctx.stroke(); });
    // orbiting blips
    for (let k = 0; k < 3; k++) { const a = t * (.6 + k * .25) + k * 2.1, r = R * (1.02 + k * .08);
      ctx.fillStyle = `rgba(${k === 1 ? CYAN : k === 2 ? AURA : PINK},.95)`; ctx.beginPath(); ctx.arc(ox + Math.cos(a) * r, oy + Math.sin(a) * r, 2.6, 0, Math.PI * 2); ctx.fill(); }
    // HUD readouts
    if (!phone) {
      ctx.font = "500 11px 'JetBrains Mono', monospace"; ctx.fillStyle = `rgba(${PINK},.75)`;
      ctx.fillText(`SCAN ${String(Math.floor((t * 37) % 1000)).padStart(3, "0")}  ·  LOCK ${Math.round(50 + Math.sin(t) * 49)}%`, ox - R * 1.3, oy + R * 1.55);
      ctx.fillText(`AZ ${((t * 41) % 360).toFixed(0).padStart(3, "0")}°`, ox + R * 1.05, oy - R * 1.32);
    }
  }
  function frame(now) {
    raf = 0; if (!vis || document.hidden) return;
    t += Math.max(0, Math.min(50, now - last)) / 1000; last = now;
    draw(); raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf && !still && vis) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  host.addEventListener("pointermove", (e) => { const b = cv.getBoundingClientRect(); aim = { x: (e.clientX - b.left) / b.width - .5, y: (e.clientY - b.top) / b.height - .5 }; }, { passive: true });
  host.addEventListener("pointerleave", () => (aim = { x: 0, y: 0 }));
  new ResizeObserver(size).observe(cv); size();
  new IntersectionObserver(([en]) => { vis = en.isIntersecting; vis ? start() : (cancelAnimationFrame(raf), (raf = 0)); }).observe(cv);
  document.addEventListener("visibilitychange", () => (document.hidden ? (cancelAnimationFrame(raf), (raf = 0)) : start()));
  if (still) draw(); else start();
})();
