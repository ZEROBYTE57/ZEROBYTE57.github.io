"""Build blog/posts/index.json from the Markdown posts in blog/posts/.

Each post starts with a front-matter block:

    ---
    title: My post
    date: 2026-11-03
    tags: [linux, games]
    related: [cxb]          # optional: portfolio project ids (see blog/projects.json)
    summary: Short description for the list.
    ---

[[wikilinks]] in the body (to other posts or project ids) are collected into
"links", which the blog uses for the graph view and backlinks.
Files whose names start with "_" are drafts/templates and are skipped.
Run locally after adding a post, or let .github/workflows/build-posts.yml do it.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
POSTS = ROOT / "blog" / "posts"
WIKILINK = re.compile(r"\[\[([a-z0-9][a-z0-9-]*)(?:\|[^\]]*)?\]\]", re.I)


def as_list(val):
    if isinstance(val, list):
        return val
    return [v.strip() for v in str(val).split(",") if v.strip()] if val else []


def parse(path):
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not m:
        raise ValueError(f"{path.name}: missing front matter")
    meta = {}
    for line in m.group(1).splitlines():
        if ":" not in line:
            continue
        key, val = line.split(":", 1)
        val = val.strip()
        if val.startswith("[") and val.endswith("]"):
            val = [t.strip().strip("'\"").lower() for t in val[1:-1].split(",") if t.strip()]
        else:
            val = val.strip("'\"")
        meta[key.strip().lower()] = val
    body = m.group(2)
    for field in ("title", "date"):
        if not meta.get(field):
            raise ValueError(f"{path.name}: missing '{field}'")
    prose = re.sub(r"```.*?```", "", body, flags=re.S)
    prose = re.sub(r"<!--.*?-->", "", prose, flags=re.S)
    words = len(re.findall(r"\w+", prose))
    return {
        "slug": path.stem,
        "title": meta["title"],
        "date": meta["date"],
        "tags": as_list(meta.get("tags")),
        "related": as_list(meta.get("related")),
        "summary": meta.get("summary", ""),
        "minutes": max(1, round(words / 220)),
        "links": sorted({l.lower() for l in WIKILINK.findall(prose) if l.lower() != path.stem}),
    }


def main():
    posts = [parse(p) for p in sorted(POSTS.glob("*.md")) if not p.name.startswith("_")]
    posts.sort(key=lambda p: p["date"], reverse=True)
    (POSTS / "index.json").write_text(json.dumps(posts, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Indexed {len(posts)} post(s).")


if __name__ == "__main__":
    main()
