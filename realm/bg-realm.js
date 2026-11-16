// 404 Realm page background (plain canvas, no libraries): a 3D arena floor in ROG red.
// A honeycomb floor runs to the horizon; energy waves ripple across it and light the cells, random cells
// power up and fire a beacon of light into the sky, and embers rise through the scene at different depths.
// Scrolling flies you forward over the floor; the camera leans toward the cursor.
// It stays faint over the first screen so the hero's own scan effect leads. Sits behind everything.
// Pauses when the tab is hidden; one still frame for reduced motion.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches, TAU = Math.PI * 2;
  const cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true"); cv.className = "bg-realm";
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none";
  document.body.prepend(cv);
  const pr = document.createElement("style"); pr.textContent = "@media print{.bg-realm{display:none}}"; document.head.append(pr);
  const ctx = cv.getContext("2d"), RED = "255,46,79", PINK = "255,107,128", AURA = "217,77,255", CYAN = "92,211,255";
  let W = 0, H = 0, raf = 0, last = performance.now(), t = 0, mx = 0, my = 0, cmx = 0, cmy = 0, sy = 0;
  const S = .3, DX = Math.sqrt(3) * S, DZ = 1.5 * S, PERIOD = DZ * 2, ZN = .45, ROWS = 26, FLOOR = .85;
  const hash = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
  const embers = Array.from({ length: 70 }, (_, i) => ({ x: hash(i, 1) * 2 - 1, y: hash(i, 2), z: .6 + hash(i, 3) * 3, sp: .03 + hash(i, 4) * .06, ph: hash(i, 5) * TAU }));

  function size() { const d = Math.min(devicePixelRatio || 1, 1.5); W = document.documentElement.clientWidth; H = document.documentElement.clientHeight;   // page area, without the scrollbar
    cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); draw(); }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    cmx += (mx - cmx) * .05; cmy += (my - cmy) * .05; sy += (scrollY - sy) * .12;
    const phone = W < 700, f = H * .95, hz = H * .4 + cmy * 18, camX = cmx * .9;
    const k = .5 * (phone ? .7 : 1) * (.3 + .7 * Math.min(1, sy / (H * .8)));   // kept dim so it never competes with the content above it
    const travel = sy * .0028 + t * .32, base = Math.floor(travel / PERIOD) * 2, off = travel % PERIOD;
    const far = ZN + ROWS * DZ, cols = Math.ceil(((W / 2) * far) / f / DX) + 2;
    const px = (x, z) => W / 2 + ((x - camX) * f) / z, py = (z) => hz + (FLOOR * f) / z;
    // horizon glow
    const g = ctx.createLinearGradient(0, hz - H * .12, 0, hz + H * .2);
    g.addColorStop(0, `rgba(${RED},0)`); g.addColorStop(.4, `rgba(${RED},${.13 * k})`); g.addColorStop(1, `rgba(${RED},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, hz - H * .12, W, H * .32);
    const beacons = [];
    // honeycomb floor, far rows first
    for (let r = ROWS; r >= 0; r--) {
      const zc = ZN + r * DZ - off; if (zc < .3) continue;
      const row = r + base, fog = Math.pow(Math.max(0, 1 - (zc - ZN) / (far - ZN)), 1.5) * Math.min(1, (zc - .3) * 4);
      if (fog < .01) continue;
      const lim = Math.ceil(((W / 2) * (zc + S)) / f / DX) + 1, shift = (((row % 2) + 2) % 2) * .5, c0 = Math.round(camX / DX);
      for (let ci = -Math.min(cols, lim); ci <= Math.min(cols, lim); ci++) {
        const col = ci + c0, xc = (col + shift) * DX, zw = zc + travel;
        // light: travelling energy waves plus cells that power up on their own
        const wave = Math.pow(Math.max(0, Math.sin(xc * .7 + zw * 1.1 - t * 1.5)), 10), h = hash(col, row);
        const live = h > .955 ? Math.max(0, Math.sin(t * (1 + h * 2) + h * 40)) : 0, lit = Math.min(1, wave * .8 + live);
        ctx.beginPath();
        for (let v = 0; v < 6; v++) { const a = (v / 6) * TAU + Math.PI / 6, X = px(xc + Math.cos(a) * S * .93, zc + Math.sin(a) * S * .93), Y = py(zc + Math.sin(a) * S * .93); v ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
        ctx.closePath();
        if (lit > .05) { ctx.fillStyle = `rgba(${live > wave ? PINK : RED},${lit * .34 * fog * k})`; ctx.fill(); }
        ctx.strokeStyle = `rgba(${RED},${(.07 + fog * .3 + lit * .45) * fog * k})`; ctx.lineWidth = .6 + fog * .9; ctx.stroke();
        if (live > .5 && !phone) beacons.push([px(xc, zc), py(zc), zc, (live - .5) * 2 * fog, h]);
      }
    }
    // beacons: pillars of light rising from powered-up cells
    for (const [X, Y, z, a, h] of beacons) {
      const top = Y - (1.5 * f) / z, col = h > .985 ? CYAN : h > .97 ? AURA : PINK, bg = ctx.createLinearGradient(0, Y, 0, top);
      bg.addColorStop(0, `rgba(${col},${.55 * a * k})`); bg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = bg; const w = Math.max(1.2, (S * .5 * f) / z); ctx.fillRect(X - w / 2, top, w, Y - top);
      ctx.fillStyle = `rgba(255,235,240,${.6 * a * k})`; ctx.fillRect(X - .6, top + (Y - top) * .35, 1.2, (Y - top) * .65);
    }
    // embers rising at different depths
    for (const e of embers) {
      const yy = (((e.y - t * e.sp - sy * .00012) % 1) + 1) % 1, x = e.x * 2.2 + Math.sin(t * .6 + e.ph) * .08, y = FLOOR - yy * 2.2;
      const X = px(x, e.z), Y = hz + (y * f) / e.z; if (X < -5 || X > W + 5 || Y < -5 || Y > H + 5) continue;
      const a = Math.sin(yy * Math.PI) * (.25 + .5 / e.z) * (.7 + .3 * Math.sin(t * 3 + e.ph));
      ctx.fillStyle = `rgba(${e.ph > 5.2 ? AURA : PINK},${a * k})`; ctx.beginPath(); ctx.arc(X, Y, .6 + 1.6 / e.z, 0, TAU); ctx.fill();
    }
  }
  function frame(now) { raf = 0; if (document.hidden) return; t += Math.max(0, Math.min(50, now - last)) / 1000; last = now; draw(); raf = requestAnimationFrame(frame); }
  const start = () => { if (!raf && !still) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  addEventListener("resize", size, { passive: true });
  addEventListener("pointermove", (e) => { mx = e.clientX / W - .5; my = e.clientY / H - .5; }, { passive: true });
  if (still) addEventListener("scroll", () => { sy = scrollY; if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }, { passive: true });
  document.addEventListener("visibilitychange", () => (document.hidden ? (cancelAnimationFrame(raf), (raf = 0)) : start()));
  if (still) sy = scrollY;
  size(); start();
})();
