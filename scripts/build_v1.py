"""Builds v1/: the classic design (the v1 branch), served next to the current one at /v1/.

The classic pages keep their own HTML, CSS and JavaScript (copied from the v1 branch), but read live
content from the main site, so they never go stale and nothing large is duplicated: stats and Steam
data (/data/), blog posts, projects and notes (/blog/), the Realm settings (/realm/config.js), images,
fonts, the favicon, the manifest and the résumé. Share links on classic articles open the classic
article (v1/blog/s/, kept in sync by build_posts.py). Search engines are asked not to index the copy.

Runs automatically on GitHub after every push to the v1 branch (.github/workflows/publish-classic.yml);
by hand:  python scripts/build_v1.py
"""
import io
import pathlib
import re
import shutil
import subprocess
import tarfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "v1"
BRANCH = "v1"   # the classic design's branch (local branch, or origin/v1 in a fresh CI checkout)
# not copied: tooling, live content read from the main site, and site-wide files
SKIP_DIRS = (".github/", "scripts/", "data/", "blog/posts/", "blog/s/", "assets/img/", "assets/fonts/")
SKIP_FILES = {".gitignore", ".nojekyll", "sw.js", "sitemap.xml", "robots.txt", "favicon.ico", "site.webmanifest",
              "blog/notes.json", "blog/projects.json", "realm/config.js"}
NOINDEX = '<meta name="robots" content="noindex" />'


def rewrite(path, text, root_files):
    pre = r"""(["'`(])(?:\.\./)*"""                                       # an opening quote or url( plus any ../
    text = re.sub(pre + r"assets/(img|fonts)/", r"\1/assets/\2/", text)    # shared images and fonts
    text = re.sub(pre + r"data/", r"\1/data/", text)                         # live stats and Steam data
    text = re.sub(pre + r"blog/posts/", r"\1/blog/posts/", text)             # live article list
    text = re.sub(pre + r"blog/(projects|notes)\.json", r"\1/blog/\2.json", text)   # live projects and notes
    for name in root_files:                                                  # favicon, manifest, résumé
        text = re.sub(pre + re.escape(name), r"\1/" + name, text)
    if path == "blog/blog.js":                                               # posts, projects and notes, read from the blog
        text = re.sub(r"""(["'`])posts/""", r"\1/blog/posts/", text)
        text = text.replace('"projects.json"', '"/blog/projects.json"').replace('"notes.json"', '"/blog/notes.json"')
    if path == "realm/index.html":
        text = text.replace('src="config.js"', 'src="/realm/config.js"')
    if path == "assets/js/konami.js":
        text = text.replace('"/realm/"', '"/v1/realm/"')
    if path.endswith(".html") and NOINDEX not in text:
        text = re.sub(r'(<meta charset="[^"]*"\s*/?>)', r"\1\n  " + NOINDEX, text, count=1)
    return text


def main():
    ref = next((r for r in (f"refs/heads/{BRANCH}", f"refs/remotes/origin/{BRANCH}")
                if subprocess.run(["git", "rev-parse", "--verify", "-q", r], cwd=ROOT, capture_output=True).returncode == 0), None)
    if not ref:
        raise SystemExit(f"branch '{BRANCH}' not found (run: git fetch origin {BRANCH})")
    data = subprocess.run(["git", "archive", "--format=tar", ref], cwd=ROOT, capture_output=True, check=True).stdout
    tar = tarfile.open(fileobj=io.BytesIO(data))
    members = [m for m in tar.getmembers() if m.isfile()]
    root_files = ["favicon.ico", "site.webmanifest"] + [m.name for m in members if "/" not in m.name and m.name.endswith(".pdf")]
    if OUT.exists():
        shutil.rmtree(OUT)
    copied = 0
    for m in members:
        name = m.name
        if name.startswith(SKIP_DIRS) or name in SKIP_FILES or ("/" not in name and name.endswith(".pdf")):
            continue
        target = OUT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        raw = tar.extractfile(m).read()
        if name.endswith((".html", ".js", ".css")):
            # LF everywhere: git archive on Windows (autocrlf) hands out CRLF, on Linux LF, and both builds must match
            target.write_text(rewrite(name, raw.decode("utf-8").replace("\r\n", "\n"), root_files), encoding="utf-8", newline="\n")
        else:
            target.write_bytes(raw.replace(b"\r\n", b"\n") if b"\0" not in raw else raw)   # text data (JSON): LF too
        copied += 1
    share = ROOT / "blog" / "s"                     # classic share pages: same pages, they open ../post.html (the classic article)
    if share.is_dir():
        (OUT / "blog" / "s").mkdir(parents=True, exist_ok=True)
        for f in share.glob("*.html"):
            (OUT / "blog" / "s" / f.name).write_bytes(f.read_bytes().replace(b"\r\n", b"\n"))
    print(f"Wrote v1/ from the '{BRANCH}' branch: {copied} files (+ share pages); live content comes from the main site.")


if __name__ == "__main__":
    main()
