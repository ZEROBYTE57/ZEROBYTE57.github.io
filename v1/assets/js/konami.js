// Konami easter egg (↑ ↑ ↓ ↓ ← → ← → B A): "access granted", then a warp to 404 Realm.
// Used on the portfolio, blog and case studies. 404 Realm has its own easter egg.
(() => {
  const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
  let pos = 0;
  addEventListener("keydown", (e) => {
    if (/^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable) return;
    const k = e.key.toLowerCase();
    pos = k === KONAMI[pos] ? pos + 1 : k === KONAMI[0] ? 1 : 0;
    if (pos < KONAMI.length) return;
    pos = 0;
    const fx = document.createElement("div");
    fx.className = "konami";
    fx.innerHTML = '<div class="konami-box"><small>Cheat code accepted</small><b>ACCESS GRANTED</b><span>Warping to 404 Realm…</span></div>';
    document.body.append(fx);
    requestAnimationFrame(() => fx.classList.add("on"));
    setTimeout(() => { location.href = "/v1/realm/"; }, 1600);
  });
})();
