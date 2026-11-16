// Site-wide 3D layer (plain CSS transforms, no libraries). Used on the portfolio, blog, case studies and 404 Realm.
//  1. Cards tilt in 3D toward the cursor (mouse and trackpad only).
//  2. Cards swing up into place in 3D as they scroll into view.
// Options go on the script tag: data-reveal (selector to animate in), data-tilt (selector).
// Still for reduced motion.
(() => {
  const opt = (document.currentScript && document.currentScript.dataset) || {};
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

  // ---------------- 1. 3D tilt on cards ----------------
  const TILT = opt.tilt || ".tile, .card, .pcard";
  const skip = (el) => el.closest(".art, .blog-net, .graph-tile, .cs-fig, .hero-arena") || el.querySelector("canvas, input, textarea");
  if (fine && !still) {
    let cur = null;
    const reset = (el) => { el.style.transform = ""; el.classList.remove("d3-on"); };
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest?.(TILT);
      if (cur && cur !== el) { reset(cur); cur = null; }
      if (!el || skip(el)) return;
      const r = el.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
      const max = 7 * Math.min(1, 420 / r.width) + 1.5 * Math.min(1, 300 / r.height);
      cur = el; el.classList.add("d3-on");
      el.style.transform = `perspective(900px) rotateX(${(-ny * max).toFixed(2)}deg) rotateY(${(nx * max).toFixed(2)}deg) translateZ(6px)`;
      el.style.setProperty("--gx", `${(nx + .5) * 100}%`); el.style.setProperty("--gy", `${(ny + .5) * 100}%`);
    }, { passive: true });
    document.addEventListener("pointerleave", () => { if (cur) { reset(cur); cur = null; } });
    addEventListener("blur", () => { if (cur) { reset(cur); cur = null; } });
  }

  // ---------------- 2. 3D scroll entrances (pages without their own) ----------------
  if (opt.reveal && !still && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("d3-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
    const scan = () => document.querySelectorAll(opt.reveal).forEach((n) => {
      if (n.classList.contains("d3-rev") || n.classList.contains("reveal") || n.classList.contains("rv")) return;
      const i = [...n.parentElement.children].indexOf(n);
      n.style.setProperty("--d3d", `${Math.min(i, 5) * .06}s`); n.classList.add("d3-rev"); io.observe(n);
    });
    scan();
    let q = 0; new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; scan(); }); }).observe(document.body, { childList: true, subtree: true });
  }
})();
