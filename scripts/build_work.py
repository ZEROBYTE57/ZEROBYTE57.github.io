"""Build the project case-study pages from work/projects.json.

Writes work/index.html (all projects), work/<slug>.html (one page per project) and
work/index.json (used by the site search). Edit work/projects.json, then run:
    python scripts/build_work.py
"""
import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / "work"
SITE = "https://zerobyte57.github.io"
projects = json.loads((WORK / "projects.json").read_text(encoding="utf-8"))
try:
    posts = {p["slug"]: p for p in json.loads((ROOT / "blog/posts/index.json").read_text(encoding="utf-8"))}
except FileNotFoundError:
    posts = {}

THEME = ('<button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle dark mode">'
         '<svg class="i-sun" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
         '<svg class="i-moon" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>')


def page(title, desc, url, body, og="og-portfolio.jpg"):
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{escape(title)}</title>
  <meta name="description" content="{escape(desc)}" />
  <meta name="theme-color" content="#e4ecf4" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#0b0b0d" media="(prefers-color-scheme: dark)" />
  <link rel="canonical" href="{url}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="zerobyte57" />
  <meta property="og:url" content="{url}" />
  <meta property="og:title" content="{escape(title)}" />
  <meta property="og:description" content="{escape(desc)}" />
  <meta property="og:image" content="{SITE}/assets/img/{og}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="../favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/img/favicon-32.png" />
  <link rel="apple-touch-icon" href="../assets/img/apple-touch-icon.png" />
  <link rel="manifest" href="../site.webmanifest" />
  <link rel="preload" href="../assets/fonts/geist-normal.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="../assets/fonts/site.css" />
  <link rel="stylesheet" href="../styles.css" />
  <link rel="stylesheet" href="../assets/js/konami.css" />
  <link rel="stylesheet" href="../assets/js/depth3d.css" />
  <link rel="stylesheet" href="work.css" />
  <script>try {{ const t = localStorage.getItem("theme"); if (t) document.documentElement.dataset.theme = t; }} catch (e) {{}}</script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <div class="progress" aria-hidden="true"><span id="progress"></span></div>
  <div class="bg-fx" aria-hidden="true"></div>
  <header class="dock">
    <a class="brand" href="../">zerobyte<span>57</span></a>
    <nav aria-label="Primary">
      <ul class="nav-links">
        <li><a href="../">Portfolio</a></li>
        <li><a href="./" aria-current="page">Projects</a></li>
        <li><a href="../blog/">Blog</a></li>
        <li><a href="../realm/">Realm</a></li>
        <li><a href="../#contact">Contact</a></li>
      </ul>
    </nav>
    <div class="dock-actions">
      {THEME}
      <button class="menu-btn" id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false"><span></span></button>
    </div>
  </header>
  <main id="main" class="wrap work-main">
{body}
  </main>
  <footer class="footer">
    <div class="wrap">
      <div class="statusbar">
        <a class="sb-seg sb-brand" href="../"><span>zerobyte<b>57</b></span></a>
        <span class="sb-seg sb-loc"><i class="sb-dot" aria-hidden="true"></i>Bengaluru · <span id="clock2">--:--</span> IST</span>
        <span class="sb-seg sb-copy">© <span id="year">2026</span> Devisetty Lakshmi Srinivas</span>
        <span class="sb-fill" aria-hidden="true"></span>
        <a class="sb-seg sb-link" href="../blog/">blog ↗</a>
        <a class="sb-seg foot-prompt" href="../realm/" aria-label="Go to 404 Realm"><span class="fp-p" aria-hidden="true">$</span> <span class="fp-cmd" aria-hidden="true">cd ~/404-realm</span><span class="fp-cursor" aria-hidden="true"></span></a>
        <a class="sb-seg sb-link" href="#main">top ↑</a>
      </div>
    </div>
  </footer>
  <script defer src="work.js"></script>
  <script defer src="../assets/js/konami.js"></script>
  <script defer src="../assets/js/depth3d.js" data-reveal=".cs-card, .cs-stat, .cs-sec > *"></script>
  <script defer src="../assets/js/bg-space.js" data-intensity=".55"></script>
</body>
</html>
"""


def badge(p):
    return '<span class="badge wip">In progress</span>' if p["status"] == "wip" else '<span class="badge done">Completed</span>'


def chips(items):
    return '<ul class="chips">' + "".join(f"<li>{escape(x)}</li>" for x in items) + "</ul>"


def project_page(i, p):
    prev_p, next_p = projects[i - 1] if i > 0 else None, projects[i + 1] if i + 1 < len(projects) else None
    links = "".join(f'<a class="btn{" primary" if k == 0 else ""}" href="{escape(u)}" target="_blank" rel="noopener">{escape(t)} <span aria-hidden="true">↗</span></a>'
                    for k, (t, u) in enumerate(p["links"]))
    glance = "".join(f'<div class="tile cs-stat"><b>{escape(v)}</b><span>{escape(l)}</span></div>' for v, l in p["glance"])
    toc = "".join(f'<li><a href="#s{k}">{escape(t)}</a></li>' for k, (t, _) in enumerate(p["sections"]))
    if p["figures"]:
        toc += '<li><a href="#figures">Figures</a></li>'
    secs = "".join(f'<section class="cs-sec" id="s{k}"><h2>{escape(t)}</h2><div class="cs-prose">{html}</div></section>' for k, (t, html) in enumerate(p["sections"]))
    figs = ""
    if p["figures"]:
        figs = '<section class="cs-sec" id="figures"><h2>Figures</h2>' + "".join(
            f'<figure class="tile cs-fig"><a href="../assets/img/work/{f}" target="_blank" rel="noopener"><img src="../assets/img/work/{f}" alt="{escape(c)}" loading="lazy" decoding="async" /></a><figcaption>{escape(c)}</figcaption></figure>'
            for f, c in p["figures"]) + "</section>"
    rel = [posts[s] for s in p.get("related_posts", []) if s in posts]
    related = ""
    if rel:
        related = '<section class="cs-sec"><h2>On the blog</h2><div class="cs-rel">' + "".join(
            f'<a class="tile cs-post" href="../blog/post.html?p={escape(x["slug"])}"><small>{escape(x["date"])} · {x["minutes"]} min read</small><b>{escape(x["title"])}</b><span>{escape(x.get("summary", ""))}</span></a>'
            for x in rel) + "</div></section>"
    nav = '<nav class="cs-nav" aria-label="More projects">'
    nav += (f'<a class="tile" href="{prev_p["slug"]}.html"><small>← Previous</small><b>{escape(prev_p["title"])}</b></a>' if prev_p else "<span></span>")
    nav += (f'<a class="tile next" href="{next_p["slug"]}.html"><small>Next →</small><b>{escape(next_p["title"])}</b></a>' if next_p else "<span></span>")
    nav += "</nav>"
    body = f"""    <a class="cs-back" href="./"><span aria-hidden="true">←</span> All projects</a>
    <header class="cs-head">
      <div class="p-top"><span class="tag">{escape(p["kind"])}</span>{badge(p)}</div>
      <h1>{escape(p["title"])}</h1>
      <p class="cs-tagline">{escape(p["tagline"])}</p>
      <p class="cs-summary">{escape(p["summary"])}</p>
      <div class="cs-links">{links}</div>
      {chips(p["stack"])}
    </header>
    <div class="cs-glance">{glance}</div>
    <div class="cs-layout">
      <article class="cs-body">{secs}{figs}{related}</article>
      <aside class="cs-side"><div class="tile cs-toc"><p class="tile-label">On this page</p><ol>{toc}</ol></div></aside>
    </div>
    {nav}"""
    return page(f'{p["title"]} · Case study · Devisetty Lakshmi Srinivas', p["summary"], f"{SITE}/work/{p['slug']}.html", body)


def index_page():
    cards = "".join(f"""
      <a class="tile cs-card" href="{p["slug"]}.html">
        <div class="p-top"><span class="tag">{escape(p["kind"])}</span>{badge(p)}</div>
        <h2>{escape(p["title"])}</h2>
        <p class="cs-tagline">{escape(p["tagline"])}</p>
        <p>{escape(p["summary"])}</p>
        <div class="cs-mini">{"".join(f'<span><b>{escape(v)}</b> {escape(l)}</span>' for v, l in p["glance"][:2])}</div>
        {chips(p["stack"][:4])}
        <span class="cs-cta">Read the case study <b aria-hidden="true">→</b></span>
      </a>""" for p in projects)
    body = f"""    <header class="sec-head cs-index-head">
      <p class="label">Case studies</p>
      <h1 class="section-title">Projects in <em>depth</em>.</h1>
      <p class="sec-lede">The problem, the approach, the numbers and the honest limits behind each project, newest first.</p>
    </header>
    <div class="cs-grid">{cards}
    </div>"""
    return page("Projects · Case studies · Devisetty Lakshmi Srinivas", "Case studies of my machine learning projects: computer vision, graph neural networks and LLMs.", f"{SITE}/work/", body)


for i, p in enumerate(projects):
    (WORK / f"{p['slug']}.html").write_text(project_page(i, p), encoding="utf-8")
(WORK / "index.html").write_text(index_page(), encoding="utf-8")
(WORK / "index.json").write_text(json.dumps([{"slug": p["slug"], "title": p["title"], "tagline": p["tagline"]} for p in projects], ensure_ascii=False, indent=1), encoding="utf-8")
print(f"Wrote {len(projects)} case studies + work/index.html")
