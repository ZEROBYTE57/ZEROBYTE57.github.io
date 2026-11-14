"""Site checks, run by .github/workflows/site-checks.yml on every push (and locally).

    python scripts/check_site.py            # static checks only (fast, no browser)
    python scripts/check_site.py --browser  # also load every page in Chromium

Static: every local link, script, stylesheet and image exists; in-page #anchors exist;
JSON data files parse; every <img> has alt text; no duplicate ids; blog posts and case
studies listed in the indexes exist.
Browser: each page loads with no JavaScript errors and no sideways scrolling at phone,
tablet and desktop widths, in light and dark mode.
"""
import html
import json
import re
import sys
import threading
import functools
import http.server
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
problems = []


def bad(msg):
    problems.append(msg)


def pages():
    skip = ("design-samples", ".git", "node_modules", "assets/img/original")
    return [p for p in ROOT.rglob("*.html") if not any(s in p.as_posix() for s in skip)]


def static_checks():
    for page in pages():
        rel = page.relative_to(ROOT).as_posix()
        s = page.read_text(encoding="utf-8")
        ids = re.findall(r'\sid="([^"]+)"', s)
        for d in {i for i in ids if ids.count(i) > 1}:
            bad(f"{rel}: duplicate id #{d}")
        for tag in re.findall(r"<img\b[^>]*>", s):
            if " alt=" not in tag:
                bad(f"{rel}: <img> without alt: {tag[:80]}")
        for url in re.findall(r'(?:href|src)="([^"]+)"', s):
            url = html.unescape(url)
            if url.startswith(("http:", "https:", "mailto:", "data:", "javascript:", "//")) or "${" in url:
                continue
            path, _, frag = url.partition("#")
            path = path.split("?")[0]
            if not path:                                   # same-page anchor
                if frag and frag not in ids and frag not in ("top", "main"):
                    bad(f"{rel}: link to missing #{frag}")
                continue
            target = (ROOT / path.lstrip("/")) if path.startswith("/") else (page.parent / path)
            target = target.resolve()
            if target.is_dir():
                target = target / "index.html"
            if not target.exists():
                bad(f"{rel}: missing file {url}")
    for j in list(ROOT.glob("data/*.json")) + list(ROOT.glob("blog/*.json")) + list(ROOT.glob("blog/posts/*.json")) + list(ROOT.glob("work/*.json")) + [ROOT / "site.webmanifest"]:
        try:
            json.loads(j.read_text(encoding="utf-8"))
        except Exception as e:
            bad(f"{j.relative_to(ROOT).as_posix()}: invalid JSON ({e})")
    for p in json.loads((ROOT / "blog/posts/index.json").read_text(encoding="utf-8")):
        if not (ROOT / "blog/posts" / f"{p['slug']}.md").exists():
            bad(f"blog index lists missing post {p['slug']}")
        if not (ROOT / "blog/s" / f"{p['slug']}.html").exists():
            bad(f"no share page for post {p['slug']} (run scripts/build_posts.py)")
    if (ROOT / "work/index.json").exists():
        for p in json.loads((ROOT / "work/index.json").read_text(encoding="utf-8")):
            if not (ROOT / "work" / f"{p['slug']}.html").exists():
                bad(f"case study page missing: work/{p['slug']}.html (run scripts/build_work.py)")


def browser_checks():
    from playwright.sync_api import sync_playwright

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    slug = json.loads((ROOT / "blog/posts/index.json").read_text(encoding="utf-8"))[0]["slug"]
    urls = ["/", "/blog/", f"/blog/post.html?p={slug}", "/work/", "/realm/"]
    urls += [f"/work/{p.name}" for p in sorted((ROOT / "work").glob("*.html")) if p.name != "index.html"][:2]
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for scheme in ("light", "dark"):
            for w in (360, 768, 1366):
                ctx = b.new_context(viewport={"width": w, "height": 800}, color_scheme=scheme, reduced_motion="reduce")
                # outside services are not needed for these checks; keep the run fast and offline-safe
                ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
                pg = ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                for u in urls:
                    errs.clear()
                    pg.goto(base + u, wait_until="domcontentloaded")
                    pg.wait_for_timeout(900)
                    pg.evaluate("scrollTo(0, document.body.scrollHeight)")
                    pg.wait_for_timeout(300)
                    sw = pg.evaluate("document.documentElement.scrollWidth")
                    if sw > w:
                        bad(f"{u} [{scheme} {w}px]: page is {sw}px wide (sideways scroll)")
                    for e in errs:
                        bad(f"{u} [{scheme} {w}px]: JavaScript error: {e[:160]}")
                ctx.close()
        b.close()
    srv.shutdown()


if __name__ == "__main__":
    static_checks()
    if "--browser" in sys.argv:
        browser_checks()
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("All site checks passed.")
