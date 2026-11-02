"""Fetch coding-profile stats into data/stats.json.

Run by .github/workflows/update-stats.yml every 6 hours. GeeksforGeeks and
HackerRank block browser requests, so the site reads them from this file.
The other platforms are also stored here as a fallback for the live fetch.
Leave a handle empty in data/profiles.json to skip that platform.
"""
import json
import pathlib
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROFILES = json.loads((ROOT / "data" / "profiles.json").read_text(encoding="utf-8"))
OUT = ROOT / "data" / "stats.json"
UA = {"User-Agent": "Mozilla/5.0 (portfolio stats bot)"}


def get(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def github(h):
    u = get(f"https://api.github.com/users/{h}")
    repos = get(f"https://api.github.com/users/{h}/repos?per_page=100&sort=pushed")
    own = [r for r in repos if not r["fork"]]
    contrib = get(f"https://github-contributions-api.jogruber.de/v4/{h}?y=last")
    return {
        "repos": u["public_repos"],
        "followers": u["followers"],
        "stars": sum(r["stargazers_count"] for r in own),
        "contributions": contrib["total"]["lastYear"],
        "calendar": [[d["date"], d["level"]] for d in contrib["contributions"]],
        "recent": [
            {"name": r["name"], "url": r["html_url"], "language": r["language"],
             "description": r["description"], "pushed": r["pushed_at"]}
            for r in own if r["description"] and r["name"].lower() != f"{h}.github.io".lower()
        ][:3],
    }


def leetcode(h):
    q = {"query": "query($u:String!){matchedUser(username:$u){profile{ranking} "
                  "submitStatsGlobal{acSubmissionNum{difficulty count}}}"
                  "allQuestionsCount{difficulty count}}", "variables": {"u": h}}
    d = get("https://leetcode.com/graphql", json.dumps(q).encode(),
            {"Content-Type": "application/json", "Referer": "https://leetcode.com"})["data"]
    solved = {x["difficulty"]: x["count"] for x in d["matchedUser"]["submitStatsGlobal"]["acSubmissionNum"]}
    total = {x["difficulty"]: x["count"] for x in d["allQuestionsCount"]}
    return {"solved": solved["All"], "easy": solved["Easy"], "medium": solved["Medium"], "hard": solved["Hard"],
            "totalEasy": total["Easy"], "totalMedium": total["Medium"], "totalHard": total["Hard"],
            "ranking": d["matchedUser"]["profile"]["ranking"]}


def gfg(h):
    d = get(f"https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle={h}&article_count=false&redirect=true")["data"]
    return {"solved": d["total_problems_solved"], "score": d["score"],
            "longestStreak": d["pod_solved_longest_streak"], "institute": d.get("institute_name")}


def codeforces(h):
    d = get(f"https://codeforces.com/api/user.info?handles={h}")["result"][0]
    return {"rating": d.get("rating"), "maxRating": d.get("maxRating"), "rank": d.get("rank"), "maxRank": d.get("maxRank")}


def hackerrank(h):
    d = get(f"https://www.hackerrank.com/rest/hackers/{h}/badges")["models"]
    return {"badges": [{"name": b["badge_name"], "stars": b["stars"], "solved": b["solved"]}
                       for b in d if b.get("stars", 0) > 0 or b.get("solved", 0) > 0]}


def main():
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    out = {"updated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "profiles": PROFILES}
    for name, fn in [("github", github), ("leetcode", leetcode), ("gfg", gfg),
                     ("codeforces", codeforces), ("hackerrank", hackerrank)]:
        handle = PROFILES.get(name)
        if not handle:
            continue
        try:
            out[name] = fn(handle)
            print(f"ok   {name}")
        except Exception as e:  # keep the last good data if a site is down
            print(f"fail {name}: {e}")
            if name in old:
                out[name] = old[name]
    OUT.write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
