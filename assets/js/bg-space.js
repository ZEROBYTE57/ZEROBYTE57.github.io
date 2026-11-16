// Site background for the portfolio, blog and case studies (plain canvas, no libraries): deep space in 3D.
// A black hole (the size of the portfolio's logo circle, wrapped in a dense blurred glow) starts behind the logo
// and, as you scroll, travels a parabola from the top right through the centre to the lower left.
// It is a dark shadow edged by a thin ring of light, circled by a
// tilted disk of glowing matter whose inner parts orbit faster, with one side brighter (the side moving
// toward you). The far side of the disk is bent up over the top and under the bottom of the shadow, and
// stars behind the hole are pushed outward around it, as gravity would bend their light.
// Around it is a field of stars with real depth: scrolling carries you forward through them, while the
// disk tips open. The view leans slightly toward the cursor. Kept dim.
// Options on the script tag: data-intensity (0-1); data-fade (long reads: the black hole shows for the first screen,
// then fades away so it never sits behind article text); data-anchor (selector: the hole starts framing that element,
// as it frames the portfolio logo by default); data-hole="off" (the starfield only, no black hole).
// Pauses when the tab is hidden; still for reduced motion.
// Two layers: the starfield (fixed to the screen) and, above it, the black hole on a layer of its own (see hv).
(() => {
  const opt = (document.currentScript && document.currentScript.dataset) || {};
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches, root = document.documentElement, TAU = Math.PI * 2;
  const cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true"); cv.className = "bg-space";
  cv.style.cssText = "position:fixed;left:0;top:0;width:100%;height:100vh;height:100lvh;z-index:-1;pointer-events:none";   // lvh: steady while the address bar slides
  document.body.prepend(cv);
  const pr = document.createElement("style"); pr.textContent = "@media print{.bg-space{display:none}}"; document.head.append(pr);
  const ctx = cv.getContext("2d"), power = Math.max(0, Math.min(1, parseFloat(opt.intensity || "1")));
  let W = 0, H = 0, rgb = "69,181,194", dark = true, raf = 0, last = performance.now(), t = 0, mx = 0, my = 0, cmx = 0, cmy = 0, sy = 0, maxScroll = 1;
  const logo = document.querySelector(opt.anchor || ".tile.art"), isLogo = !!(logo && logo.matches(".tile.art"));
  if (logo) {   // the logo panel turns see-through around the logo circle, so the black hole shows around it (styles.css)
    logo.classList.add("bh-behind");
    if (isLogo) { const disc = document.createElement("i"); disc.className = "bh-disc"; disc.setAttribute("aria-hidden", "true"); logo.prepend(disc); }
  }
  // The black hole is drawn on a layer of its own (hv). On the portfolio that layer starts out scrolling with the page
  // and stops once the logo has carried the hole up to the height of its path (position: sticky with top: -S). So while
  // the hole sits behind the logo, the browser itself moves the two together, frame for frame. (A script redrawing a
  // fixed canvas always trails a fast swipe on a phone by a few frames, because the page scrolls on a thread of its
  // own: the hole showed below the logo.) The layer is as tall as the screen plus S, so it still fills the screen
  // once it has stopped; its wrapper spans the whole page, which is how far the sticky layer may travel.
  const hv = opt.hole === "off" ? null : document.createElement("canvas"), hctx = hv && hv.getContext("2d");
  let wrap = null, S = 0, HW = 0, HH = 0, lxRest = 0, rest = 0, hasLogo = false;
  if (hv) {
    hv.setAttribute("aria-hidden", "true");
    if (logo) {
      wrap = document.createElement("div"); wrap.className = "bg-space"; wrap.setAttribute("aria-hidden", "true");
      wrap.style.cssText = "position:absolute;left:0;top:0;width:100%;height:0;z-index:-1;pointer-events:none;overflow:clip";
      hv.style.cssText = "position:sticky;top:0;display:block;width:100%;height:100vh;height:100lvh";
      wrap.append(hv); cv.after(wrap);
    } else { hv.className = "bg-space"; hv.style.cssText = cv.style.cssText; cv.after(hv); }
  }
  let seed = 31; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647), gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) / .58;

  // ---- the disk: particles in the plane around the hole (r in units of the shadow's radius, a = angle)
  const RIN = 1.22, ROUT = 4.4, D = [];
  for (let i = 0; i < 2600; i++) { const u = Math.pow(rnd(), 1.2); D.push({ r: RIN + u * (ROUT - RIN) + gauss() * .04, u, a: rnd() * TAU, s: rnd(), h: gauss() * .035 }); }
  // colour of each particle by distance (white-hot inside, amber, then the accent at the rim, a few violet), grouped by
  // colour so every frame sets each colour once and only changes the opacity per particle
  D.forEach((q) => (q.ci = q.u < .1 ? 0 : q.u < .42 ? 1 : q.s > .9 ? 3 : 2)); D.sort((a, b) => a.ci - b.ci);
  // ---- stars in a deep box that wraps around as you travel through it
  const DEPTH = 5, STARS = Array.from({ length: 300 }, () => ({ x: (rnd() * 2 - 1) * 2.6, y: (rnd() * 2 - 1) * 1.8, z: rnd() * DEPTH, s: rnd(), c: rnd(), ph: rnd() * TAU }));
  STARS.forEach((s) => (s.cc = s.c > .85 ? 0 : s.c > .6 ? 1 : 2)); STARS.sort((a, b) => a.cc - b.cc);   // grouped by colour, as above

  const readColor = () => {
    const c = getComputedStyle(root).getPropertyValue("--accent").trim(), m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); rgb = `${n >> 16},${(n >> 8) & 255},${n & 255}`; }
    const th = root.dataset.theme; dark = th ? th === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    // the browser's own UI colour (address bar on phones) follows the page, including a theme picked with the toggle
    const pageBg = getComputedStyle(root).getPropertyValue("--bg").trim();
    if (pageBg) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", pageBg));
    build(); if (W) measure();   // the hole's size differs a little between the themes
  };
  // Pre-painted glow images: a ring of light that is white-hot at its inner edge and fades outward, brighter on the
  // right (the side moving toward you). [0] the disk, [1] the arch of bent light over the top, [2] the arch underneath.
  let sprites = [];
  const sprite = (rin, rout, hot) => { const n = 384, c = document.createElement("canvas"); c.width = c.height = n; const g = c.getContext("2d"), m = n / 2, e = rin / rout;
    const gr = g.createRadialGradient(m, m, 0, m, m, m);
    // a soft inner edge: a hard one reads as a sharp line where the disk crosses in front of the hole
    gr.addColorStop(0, `rgba(${hot[0]},0)`); gr.addColorStop(Math.max(0, e - .1), `rgba(${hot[0]},0)`);
    gr.addColorStop(Math.max(0, e - .04), `rgba(${hot[0]},.32)`); gr.addColorStop(e, `rgba(${hot[0]},.82)`);
    gr.addColorStop(e + (1 - e) * .16, `rgba(${hot[1]},.6)`); gr.addColorStop(e + (1 - e) * .5, `rgba(${hot[2]},.2)`); gr.addColorStop(1, `rgba(${hot[2]},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    g.globalCompositeOperation = "destination-in"; const dg = g.createLinearGradient(0, 0, n, 0); dg.addColorStop(0, "rgba(0,0,0,.16)"); dg.addColorStop(.5, "rgba(0,0,0,.55)"); dg.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = dg; g.fillRect(0, 0, n, n); return c; };
  const hotColours = () => (dark ? ["255,240,220", "255,196,132", rgb, "190,150,255"] : ["11,110,138", "6,160,196", rgb, "109,90,205"]);
  // the blurred halo: an even glow from the shadow's edge (1/3 of the image's radius) fading outward
  let halo = null;
  const haloImg = (hot) => { const n = 384, c = document.createElement("canvas"); c.width = c.height = n; const g = c.getContext("2d"), m = n / 2, e = 1 / 3;
    const gr = g.createRadialGradient(m, m, 0, m, m, m);
    gr.addColorStop(0, `rgba(${hot[1]},0)`); gr.addColorStop(e * .9, `rgba(${hot[1]},.4)`); gr.addColorStop(e, `rgba(${hot[0]},.5)`);
    gr.addColorStop(e + .08, `rgba(${hot[1]},.3)`); gr.addColorStop(e + .28, `rgba(${hot[2]},.13)`); gr.addColorStop(1, `rgba(${hot[2]},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, n, n); return c; };
  // Each glow image is split into a top and a bottom half along the disk plane with a wide, soft seam (a smoothstep
  // fade), never a hard cut: a hard cut shows as a sharp straight line through the hole. f = half-width of the seam,
  // as a fraction of the image radius. The two halves add back up to the whole image.
  const split = (src, f) => [1, 0].map((top) => { const n = src.width, c = document.createElement("canvas"); c.width = c.height = n; const g = c.getContext("2d"), m = n / 2;
    g.drawImage(src, 0, 0); g.globalCompositeOperation = "destination-in";
    const lg = g.createLinearGradient(0, m * (1 - f), 0, m * (1 + f));
    [[0, 1], [.25, .844], [.5, .5], [.75, .156], [1, 0]].forEach(([o, a]) => lg.addColorStop(o, `rgba(0,0,0,${top ? a : 1 - a})`));
    g.fillStyle = lg; g.fillRect(0, 0, n, n); return c; });
  const build = () => { const h = hotColours(), disk = split(sprite(RIN, ROUT, h), .2);
    sprites = { far: disk[0], near: disk[1], over: split(sprite(1.09, 2.7, h), .42)[0], under: split(sprite(1.06, 1.6, h), .42)[1] }; halo = haloImg(h); };
  // R0 = radius of the logo circle (portrait + its ring of dots), measured on the portfolio. Other pages use the
  // same layout maths (the logo panel is 5 of 12 columns of the content width, or full width when stacked).
  const dock = document.querySelector(".dock"), logoCv = logo && logo.querySelector(".particles");
  let R0 = 160, gx = null, gy = null, dtF = 0;   // gx, gy: the hole's glide position; dtF: frame time (s)
  const measure = () => {
    maxScroll = Math.max(1, root.scrollHeight - (H || root.clientHeight));
    const D = dock ? dock.clientWidth : Math.min(W - 32, 1112);
    const m = logoCv && logoCv.clientWidth ? Math.min(logoCv.clientWidth, logoCv.clientHeight) : D >= 960 ? ((D - 176) / 12) * 5 + 62 : Math.min(D - 2, 338);
    // logo (or no anchor at all): the logo circle's size; another anchor (data-anchor): frame that element
    R0 = logo && !isLogo ? Math.min(logo.clientWidth, logo.clientHeight) * .4 : m * .36 * (dark ? 1.14 : 1.06);
    if (logo) logo.style.setProperty("--bh-r", (dark ? R0 : R0 - 1) + "px");   // light: tucked just under the logo's own screen
    if (wrap) {
      // where the logo's centre sits on the page (its layout position: the entrance animation and the 3D tilt don't
      // move it), and S: how far the page scrolls before the logo's centre reaches the height of the hole's path
      hasLogo = logo.offsetWidth > 0;
      if (hasLogo) { let x = logo.offsetWidth / 2, y = logo.offsetHeight / 2;
        for (let e = logo; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; if (e !== logo) { x += e.clientLeft; y += e.clientTop; } }
        lxRest = x; rest = y; }
      const h = H || root.clientHeight, pathY0 = Math.max(R0 * .9, Math.min(h - R0 * .9, h * PATH(.8))), s = hasLogo ? Math.max(0, Math.round(rest - pathY0)) : 0;
      if (s !== S) { S = s; hv.style.top = -S + "px"; hv.style.height = `calc(100vh + ${S}px)`; hv.style.height = `calc(100lvh + ${S}px)`; }
      wrap.style.height = "0px"; const docH = root.scrollHeight; wrap.style.height = docH + "px";   // the page's own height
    }
    if (W && (cv.clientWidth !== W || cv.clientHeight !== H || (hv && (hv.clientWidth !== HW || hv.clientHeight !== HH)))) size();   // e.g. a scrollbar appeared or went away
  };
  // the parabola through (top right) .8,.26 → (centre) .5,.5 → (lower left) .2,.62, in screen fractions
  const PATH = (x) => { const P = [[.8, .26], [.5, .5], [.2, .62]];
    return P.reduce((s, [xi, yi], i) => s + yi * P.reduce((f, [xj], j) => (j === i ? f : (f * (x - xj)) / (xi - xj)), 1), 0); };
  // The canvas's own size (the page area without the scrollbar; innerWidth would include the scrollbar and squeeze
  // the drawing sideways). Nothing is reallocated unless the size really changed, so resize events from the phone's
  // address bar cost nothing. Phones draw at up to 1.25x pixel density (the glow is soft anyway), desktops 1.5x.
  let dpr = 0;
  function size() {
    const w = cv.clientWidth, h = cv.clientHeight, d = Math.min(devicePixelRatio || 1, w < 700 ? 1.25 : 1.5), hw = hv ? hv.clientWidth : 0, hh = hv ? hv.clientHeight : 0;
    if (w === W && h === H && d === dpr && hw === HW && hh === HH) { measure(); return; }
    if (w !== W || h !== H || d !== dpr) { W = w; H = h; cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
    if (hv && (hw !== HW || hh !== HH || d !== dpr)) { HW = hw; HH = hh; hv.width = Math.round(hw * d); hv.height = Math.round(hh * d); }
    dpr = d; ctx.setTransform(d, 0, 0, d, 0, 0); measure(); draw();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // the real scroll position (a smoothed copy lagged behind the page on phones, so the hand-off from the logo,
    // which moves with the real scroll, to the path, which followed the lagging copy, jittered)
    cmx += (mx - cmx) * .05; cmy += (my - cmy) * .05; sy = scrollY;
    const phone = W < 700, p0 = Math.max(0, Math.min(1, sy / maxScroll)), p = p0 * p0 * (3 - 2 * p0);
    const k = power * (dark ? .68 : .6) * (phone ? .7 : 1), ink = dark ? null : "22,70,80";
    const PAL = dark ? ["255,222,186", "196,222,255", rgb, "190,150,255"] : [ink, ink, rgb, "120,90,190"];
    ctx.globalCompositeOperation = dark ? "lighter" : "source-over";

    // ---- the black hole's place and pose for this frame
    // Size: the same on every page and at every scroll position, equal to the logo circle (portrait plus its ring).
    const Rs = R0;
    // Path: as you scroll, the hole travels a parabola from the top right, through the centre of the screen,
    // curving out to the lower left (steep at first, flattening toward the end, like one arm of a U).
    // Glide: the point on the path is eased toward (a follower like this never overshoots), so a jump in the scroll
    // position (Home/End, a restored position, a resize) glides instead of snapping. Ordinary scrolling moves the path
    // point slowly, so it hardly lags. The logo is never eased: while anchored the hole stays exactly on it.
    const px = .8 - .6 * p, py = PATH(px), a = gx === null || still ? 1 : 1 - Math.exp(-dtF / .2);
    gx = gx === null ? W * px : gx + (W * px - gx) * a;
    gy = gy === null ? H * py : gy + (H * py - gy) * a;
    const pathY = Math.max(Rs * .9, Math.min(H - Rs * .9, gy));
    let cx = gx - cmx * 36, cy = pathY - cmy * 26;
    // On the portfolio it starts directly behind the logo; the logo circle itself stays exactly as on the live site
    // (an opaque disc in the panel, see .bh-disc), so only the glow, disk and ring show around it.
    // Hand-off: until the page has scrolled S, the hole rides behind the logo on its scrolling layer (drawn at one spot
    // on the layer, so this needs nothing from the script). Then the layer stops, at the height of the path, the logo
    // scrolls on, off the hole, and the hole slides over onto its path while the page scrolls another 40% of a screen
    // (its height barely changes: it is already there). When the logo rests above the path (tall portrait screens),
    // S is 0: the layer never moves and the hole eases down from the logo to the path instead.
    let on = 0;   // how fully the hole sits behind the logo (0..1)
    if (hasLogo) {
      if (sy <= S) { cx = lxRest; cy = rest - sy; on = 1; }
      else { const u = Math.min(1, (sy - S) / (H * .4)), w = u * u * (3 - 2 * u), top = rest - S; on = 1 - w;
        cx = lxRest + (cx - lxRest) * w; cy = top + (pathY - top) * w - cmy * 26 * w; } }   // the mouse lean only once it lets go
    // hf: how visible the hole is (data-fade pages: full for the first half screen, gone after about 1.2 screens)
    const f0 = opt.fade != null ? Math.max(0, Math.min(1, 1 - (sy - H * .45) / (H * .75))) : 1, hf = opt.hole === "off" ? 0 : f0 * f0 * (3 - 2 * f0);
    const tilt = (77 - p * 15) * Math.PI / 180, sq = Math.cos(tilt), roll = (-14 + p * 22) * Math.PI / 180, cr = Math.cos(roll), sr = Math.sin(roll), lens = Rs * 1.5 * Math.sqrt(hf);

    // ---- stars: scrolling (and a little time) moves you forward; near ones grow into soft discs.
    //      Stars near the hole are pushed outward around it (gravitational lensing).
    const ks = k * (dark ? .55 : 1), f = Math.min(W, H) * .6, travel = sy * .0012 + t * .02,   // ks: stars a little darker in the dark theme
    SC = dark ? [PAL[0], PAL[1], "235,240,255"] : [ink, ink, ink];
    let cc = -1;
    for (const s of STARS) {
      let z = (s.z - travel) % DEPTH; if (z < 0) z += DEPTH; z += .2;
      let X = W / 2 + ((s.x - cmx * .5) * f) / z, Y = H / 2 + ((s.y - cmy * .35) * f) / z;
      if (X < -20 || X > W + 20 || Y < -20 || Y > H + 20) continue;
      const hd = Math.hypot(X - cx, Y - cy);
      if (hf > .01 && hd < Rs * 7) { const m = hd < 1 ? 0 : 1 + (lens * lens) / (hd * hd); X = cx + (X - cx) * m; Y = cy + (Y - cy) * m; }
      const near = 1 - z / (DEPTH + .2), fade = Math.min(1, (DEPTH + .2 - z) * 1.2) * Math.min(1, z * 2.5), tw = still ? 1 : .8 + .2 * Math.sin(t * (1 + s.s * 2) + s.ph);
      if (s.cc !== cc) { cc = s.cc; ctx.fillStyle = `rgb(${SC[cc]})`; }
      if (z < .9) { ctx.globalAlpha = Math.min(1, .12 * fade * ks); ctx.beginPath(); ctx.arc(X, Y, (1 - z) * 9 + 2, 0, TAU); ctx.fill(); }      // out-of-focus foreground star
      ctx.globalAlpha = Math.min(1, (.2 + near * .6) * fade * tw * ks); ctx.beginPath(); ctx.arc(X, Y, .5 + near * near * 1.5, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";

    // ---- the black hole, on its own layer: screen positions are shifted by how far that layer has scrolled up (off),
    //      which keeps the hole at one spot on the layer while it rides behind the logo
    if (!hv) return;
    hctx.setTransform(1, 0, 0, 1, 0, 0); hctx.clearRect(0, 0, hv.width, hv.height);
    if (hf < .01) return;   // faded out (data-fade pages)
    const off = wrap ? Math.min(sy, S) : 0;
    hctx.setTransform(dpr, 0, 0, dpr, 0, off * dpr); hctx.globalCompositeOperation = dark ? "lighter" : "source-over";
    // colour of the disk by distance: white-hot inside, amber, then the site's accent colour at the rim
    const HOT = hotColours();
    // a dot at screen position x, y (opacity via globalAlpha; the colour is set once per colour group)
    const dot = (x, y, r, a) => { hctx.globalAlpha = a > 1 ? 1 : a; if (r < 1.1) hctx.fillRect(x - r * .8, y - r * .8, r * 1.6, r * 1.6); else { hctx.beginPath(); hctx.arc(x, y, r, 0, TAU); hctx.fill(); } };
    const fx = (x, y) => cx + (x * cr - y * sr) * Rs, fy = (x, y) => cy + (x * sr + y * cr) * Rs;   // disk plane → screen
    // The glowing disk is a smooth pre-painted image (see sprites), with the particles on top for texture and motion.
    const layer = (img, rad, yScale, alpha) => { const n = rad * Rs; hctx.save(); hctx.translate(cx, cy); hctx.rotate(roll); hctx.scale(1, yScale);
      hctx.globalAlpha = alpha; hctx.drawImage(img, -n, -n, n * 2, n * 2); hctx.restore(); hctx.globalAlpha = 1; };
    const glow = (dark ? .62 : .5) * k * hf;
    layer(sprites.far, ROUT, sq, glow);              // far half of the disk
    layer(sprites.over, 2.7, .94, glow * .9);        // its light bent around the hole: an arch over the top, fading smoothly into the disk
    layer(sprites.under, 1.6, .96, glow * .55);      // and a thinner, fainter arch underneath
    // particles: on the pale light theme they need far more opacity (and a little more size) to read as cyan grains
    const step = phone ? 2 : 1, front = [], kp = (dark ? .8 * k : power * (phone ? .8 : 1)) * hf;
    let ci = -1;
    for (let i = 0; i < D.length; i += step) {
      const q = D[i], a = q.a + t * .5 * Math.pow(RIN / q.r, 1.5), ca = Math.cos(a), sa = Math.sin(a), beam = .5 + .5 * ca * .85 + .15;   // the side moving toward you is brighter
      const tw = still ? 1 : .85 + .15 * Math.sin(t * 2 + q.s * 40), al = (dark ? .22 + (1 - q.u) * .5 : .42 + (1 - q.u) * .5) * beam * tw * kp, r = (.5 + (1 - q.u) * .55 + (q.s > .985 ? .8 : 0)) * (dark ? 1 : 1.25);
      const x = q.r * ca, y = q.r * sa * sq + q.h;
      if (sa > 0) { front.push(x, y, r, q.ci, al); continue; }                                                       // near half: drawn last, in front of the shadow
      if (q.ci !== ci) { ci = q.ci; hctx.fillStyle = `rgb(${HOT[ci]})`; }
      dot(fx(x, y), fy(x, y), r * .9, al * .8);                                                                     // far half of the disk
      if (q.s < .45) { const rho = 1.1 + q.u * 1.5, lx = rho * ca, ly = rho * sa * .93; dot(fx(lx, ly), fy(lx, ly), r * .9, al * (1 - q.u * .55) * (dark ? 1 : .4)); }   // sparkle in the arch over the top (subtle on the light theme)
    }
    hctx.globalAlpha = 1;
    // a dense, blurred glow all the way round the hole (a tight bright halo plus a wide soft one)
    const blur = (s, a) => { const n = 3 * Rs * s; hctx.globalAlpha = a; hctx.drawImage(halo, cx - n, cy - n, n * 2, n * 2); hctx.globalAlpha = 1; };
    blur(1, (dark ? .6 : .5) * k * hf); blur(1.9, (dark ? .28 : .22) * k * hf);
    // the shadow itself, then the thin ring of light at its edge
    hctx.globalCompositeOperation = "source-over";
    // Dark theme: a solid night-black shadow. Light theme: behind the logo it matches the logo's own dark screen;
    // elsewhere it is a see-through slate lens (darker toward its edge), so dark text passing over it stays readable.
    const lo = isLogo ? on : 0;   // light theme: how far the lens turns into the logo's dark screen (other anchors stay see-through)
    if (dark) hctx.fillStyle = "#030305";
    else {
      // The see-through lens must not show the bent light drawn behind it (that showed as a pale band): clear it first.
      hctx.globalCompositeOperation = "destination-out"; hctx.globalAlpha = hf; hctx.beginPath(); hctx.arc(cx, cy, Rs, 0, TAU); hctx.fill();
      hctx.globalCompositeOperation = "source-over"; hctx.globalAlpha = 1;
      // a faint ink-teal lens, turning into the logo's own dark screen behind the logo (on = 1)
      const mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * lo)).join(","), c0 = mix([6, 38, 48], [11, 15, 18]), c1 = mix([4, 26, 34], [11, 15, 18]);
      const lp = lo + (1 - lo) * power, a0 = (.18 + .82 * lo) * lp, a1 = (.36 + .64 * lo) * lp,   // dimmed pages: a fainter lens too
        g = hctx.createRadialGradient(cx, cy, 0, cx, cy, Rs);
      g.addColorStop(0, `rgba(${c0},${a0})`); g.addColorStop(.72, `rgba(${c0},${(a0 + a1) / 2})`); g.addColorStop(1, `rgba(${c1},${a1})`); hctx.fillStyle = g; }
    hctx.globalAlpha = hf; hctx.beginPath(); hctx.arc(cx, cy, Rs, 0, TAU); hctx.fill(); hctx.globalAlpha = 1;
    // the thin ring of light at its edge (light theme: a crisp teal line, left out behind the logo, which has its own glow)
    if (dark) { hctx.save(); hctx.shadowColor = `rgb(${HOT[1]})`; hctx.shadowBlur = 6; hctx.strokeStyle = `rgba(${HOT[0]},${.42 * k * hf})`; hctx.lineWidth = 1;
      hctx.beginPath(); hctx.arc(cx, cy, Rs * 1.012, 0, TAU); hctx.stroke(); hctx.restore(); }
    else if (lo < .98) { hctx.strokeStyle = `rgba(${HOT[1]},${.85 * (1 - lo) * hf})`; hctx.lineWidth = 1.4; hctx.beginPath(); hctx.arc(cx, cy, Rs * 1.006, 0, TAU); hctx.stroke(); }
    hctx.globalCompositeOperation = dark ? "lighter" : "source-over";
    layer(sprites.near, ROUT, sq, glow);             // near half of the disk, crossing in front of the shadow
    ci = -1;
    for (let i = 0; i < front.length; i += 5) {
      if (front[i + 3] !== ci) { ci = front[i + 3]; hctx.fillStyle = `rgb(${HOT[ci]})`; }
      dot(fx(front[i], front[i + 1]), fy(front[i], front[i + 1]), front[i + 2], front[i + 4]);
    }
    hctx.globalAlpha = 1;
    hctx.globalCompositeOperation = "source-over";
  }
  function frame(now) { raf = 0; if (document.hidden) return; dtF = Math.max(0, Math.min(50, now - last)) / 1000; t += dtF; last = now; draw(); dtF = 0; raf = requestAnimationFrame(frame); }
  const start = () => { if (!raf && !still) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  addEventListener("resize", size, { passive: true });
  addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { mx = e.clientX / W - .5; my = e.clientY / H - .5; } }, { passive: true });
  if (still) addEventListener("scroll", () => { sy = scrollY; if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }, { passive: true });
  new MutationObserver(() => { readColor(); if (still) draw(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { readColor(); if (still) draw(); });
  document.addEventListener("visibilitychange", () => (document.hidden ? (cancelAnimationFrame(raf), (raf = 0)) : start()));
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
  if (still) sy = scrollY;
  readColor(); size(); start();
})();
