"""Fetch Steam stats into data/gaming.json.

With a Steam Web API key (STEAM_API_KEY: GitHub repo -> Settings -> Secrets and variables -> Actions)
everything comes live from the Steam Web API every run: profile, level, the full library with hours
per game and per platform (Linux share), hours in the last two weeks and achievement progress.
Without a key (or if the API call fails) it falls back to the public profile plus the library
exported from the Steam client by scripts/steam_local.py, so the job never breaks.
Needs your SteamID64 or custom profile name in data/profiles.json -> "steam", and Steam Privacy
settings "My profile" and "Game details" set to Public.

Discord data is fetched live in the browser, so it is not handled here.
"""
import json
import os
import pathlib
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROFILES = json.loads((ROOT / "data" / "profiles.json").read_text(encoding="utf-8"))
OUT = ROOT / "data" / "gaming.json"
API = "https://api.steampowered.com"


def get(path, timeout=30, **params):
    url = f"{API}/{path}/?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "portfolio-stats"}), timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def achievements(key, sid, games, budget=90):
    """Achievement progress for the played games that have community stats.
    Returns per-game [unlocked, total] and a summary (unlocked, total, perfect games, latest unlock)."""
    per, latest, unlocked, total, perfect, start = {}, None, 0, 0, 0, time.monotonic()
    for g in sorted(games, key=lambda g: -g.get("playtime_forever", 0))[:40]:
        if time.monotonic() - start > budget:
            break
        try:
            ps = get("ISteamUserStats/GetPlayerAchievements/v1", timeout=15, key=key, steamid=sid, appid=g["appid"], l="english")["playerstats"]
        except Exception:
            continue                                   # games without achievements answer with an error
        got_all = ps.get("achievements") or []
        if not got_all:
            continue
        got = [x for x in got_all if x.get("achieved")]
        per[g["appid"]] = [len(got), len(got_all)]
        unlocked, total, perfect = unlocked + len(got), total + len(got_all), perfect + (len(got) == len(got_all))
        for x in got:
            if x.get("unlocktime") and (not latest or x["unlocktime"] > latest["time"]):
                latest = {"name": x.get("name") or x.get("apiname"), "game": (g.get("name") or "").strip(), "appid": g["appid"], "time": x["unlocktime"]}
    summary = {"unlocked": unlocked, "total": total, "perfect": perfect, "games": len(per), "latest": latest} if per else None
    return per, summary


def steam(key, ident):
    sid = ident
    if not ident.isdigit():  # custom URL name -> SteamID64
        res = get("ISteamUser/ResolveVanityURL/v1", key=key, vanityurl=ident)["response"]
        if res.get("success") != 1:
            raise ValueError(f"could not resolve Steam name '{ident}'")
        sid = res["steamid"]
    p = (get("ISteamUser/GetPlayerSummaries/v2", key=key, steamids=sid)["response"].get("players") or [{}])[0]
    owned = get("IPlayerService/GetOwnedGames/v1", key=key, steamid=sid, include_appinfo=1, include_played_free_games=1)["response"]
    games = owned.get("games") or []
    if not games:
        raise ValueError("no games returned (set Steam Privacy -> Game details to Public)")
    recent = get("IPlayerService/GetRecentlyPlayedGames/v1", key=key, steamid=sid, count=10)["response"].get("games") or []
    level = get("IPlayerService/GetSteamLevel/v1", key=key, steamid=sid)["response"].get("player_level")
    hrs = lambda m: round((m or 0) / 60, 1)
    name = lambda g: (g.get("name") or "").strip()
    per, ach = achievements(key, sid, [g for g in games if g.get("playtime_forever", 0) > 0 and g.get("has_community_visible_stats")])
    by_id = {g["appid"]: g for g in games}

    def item(g, **extra):
        x = {"appid": g["appid"], "name": name(g) or name(by_id.get(g["appid"], {})), "hours": hrs(g.get("playtime_forever")),
             "last": g.get("rtime_last_played") or by_id.get(g["appid"], {}).get("rtime_last_played") or None, **extra}
        if g["appid"] in per:
            x["ach"] = per[g["appid"]]
        return x

    library = sorted((item(g) for g in games if name(g)), key=lambda x: -x["hours"])
    return {
        "name": p.get("personaname"),
        "avatar": p.get("avatarfull"),
        "url": p.get("profileurl"),
        "state": p.get("personastate", 0),          # 0 offline, 1 online, 2 busy, 3 away, 4 snooze ...
        "playing": p.get("gameextrainfo"),           # set when in-game at fetch time
        "level": level,
        "since": datetime.fromtimestamp(p["timecreated"], timezone.utc).year if p.get("timecreated") else None,
        "gameCount": owned.get("game_count", len(games)),
        "totalHours": hrs(sum(g.get("playtime_forever", 0) for g in games)),
        "linuxHours": hrs(sum(g.get("playtime_linux_forever", 0) for g in games)),
        "recentHours": hrs(sum(g.get("playtime_2weeks", 0) for g in recent)),
        "recent": [item(g, hours2w=hrs(g.get("playtime_2weeks"))) for g in recent if name(g)],
        "top": [x for x in library if x["hours"] > 0][:8],
        "library": library,
        "achievements": ach,
        "source": "steam-api",
    }


# ---------------- Steam without an API key ----------------
# Reads the public profile (XML + page) for name, avatar, status, level, games count and
# recently played games. Full per-game playtime comes from data/steam_library.json,
# exported from the Steam client by scripts/steam_local.py.
def fetch_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (portfolio stats)", "Accept-Language": "en-US"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def steam_public(sid):
    import html as _html
    import re as _re
    base = f"https://steamcommunity.com/profiles/{sid}"
    nc = int(datetime.now(timezone.utc).timestamp())  # cache-buster: Steam serves stale privacy states otherwise
    xml = fetch_text(f"{base}/?xml=1&l=english&nc={nc}")
    tag = lambda t: (_re.search(rf"<{t}>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{t}>", xml, _re.S) or [None, None])[1]
    if tag("privacyState") != "public":
        raise ValueError("profile is not public")
    page = fetch_text(f"{base}/?l=english&nc={nc}")
    level = _re.search(r'friendPlayerLevelNum">(\d+)', page)
    games = _re.search(r'count_link_label">Games</span>\s*(?:&nbsp;)?\s*<span class="profile_count_link_total">\s*([\d,]+)', page)
    recent = []
    for m in _re.finditer(r'game_info_details">\s*([\d.,]+) hrs on record.*?class="game_name"><a[^>]*href="https://steamcommunity.com/app/(\d+)"[^>]*>([^<]*)</a>', page, _re.S):
        recent.append({"appid": int(m.group(2)), "name": _html.unescape(m.group(3)).strip(), "hours": float(m.group(1).replace(",", ""))})
    state_msg = tag("stateMessage") or ""
    playing = _re.sub(r"<[^>]+>", " ", state_msg).replace("In-Game", "").strip() if "In-Game" in state_msg else None
    out = {
        "name": tag("steamID"), "avatar": tag("avatarFull"), "url": base,
        "state": {"online": 1, "in-game": 1, "offline": 0}.get((tag("onlineState") or "").lower(), 0),
        "playing": playing or None,
        "level": int(level.group(1)) if level else None,
        "gameCount": int(games.group(1).replace(",", "")) if games else None,
        "recentHours": float(tag("hoursPlayed2Wk") or 0) or float((_re.search(r"([\d.]+)\s*hours past 2 weeks", page) or [0, 0])[1]),
        "recent": recent,
        "source": "public-profile",
    }
    lib_file = ROOT / "data" / "steam_library.json"
    if lib_file.exists():
        lib = json.loads(lib_file.read_text(encoding="utf-8"))
        named = [dict(g, name=g["name"].strip()) for g in lib.get("games", []) if not g["name"].startswith("App ")]
        # the library is a snapshot from the Steam client; the profile's recent hours are fresher
        fresh, gain = {g["appid"]: g["hours"] for g in recent}, 0.0
        for g in named:
            if fresh.get(g["appid"], 0) > g["hours"]:
                gain += fresh[g["appid"]] - g["hours"]; g["hours"] = fresh[g["appid"]]
        named.sort(key=lambda g: -g["hours"])
        out["totalHours"] = round((lib.get("totalHours") or 0) + gain, 1) if lib.get("totalHours") is not None else None
        if out["gameCount"] is None or out["gameCount"] < len(named):
            out["gameCount"] = len(named)
        out["top"] = [{"appid": g["appid"], "name": g["name"], "hours": g["hours"], "last": g.get("lastPlayed")} for g in named[:8]]
        out["library"] = [{"appid": g["appid"], "name": g["name"], "hours": g["hours"], "last": g.get("lastPlayed")} for g in named]
        out["librarySynced"] = lib.get("updated")
    else:
        out["totalHours"] = round(sum(g["hours"] for g in recent), 1)
        out["top"] = recent
    return out


# ---------------- Tracker Network (tracker.gg) ----------------
# Needs a TRN_API_KEY secret (free app at https://tracker.gg/developers) and entries in
# data/profiles.json -> "tracker": [{"game": "apex", "platform": "origin", "handle": "Name", "label": "Apex Legends"}].
# The public API covers a limited set of games (e.g. Apex Legends, CS:GO, The Division 2, Splitgate).
# Entries for other games (e.g. Valorant) still show on the page as profile links.
TRN = "https://public-api.tracker.gg/v2"
PREFERRED = ["rankScore", "rating", "level", "kd", "kills", "wins", "winLoss", "matchesPlayed",
             "damage", "headshotPct", "headshots", "score", "timePlayed"]


def tracker_profile(key, e):
    url = f"{TRN}/{e['game']}/standard/profile/{e['platform']}/{urllib.parse.quote(e['handle'], safe='')}"
    req = urllib.request.Request(url, headers={"TRN-Api-Key": key, "Accept": "application/json", "User-Agent": "portfolio-stats"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode("utf-8"))["data"]
    overview = next((s for s in data.get("segments", []) if s.get("type") == "overview"), {})
    stats = overview.get("stats", {})
    keys = [k for k in PREFERRED if k in stats] + [k for k in stats if k not in PREFERRED]
    rank = None
    for k in ("rankScore", "rating", "rank"):
        meta = (stats.get(k) or {}).get("metadata") or {}
        if meta.get("tierName") or meta.get("rankName"):
            rank = {"name": meta.get("tierName") or meta.get("rankName"), "icon": meta.get("iconUrl"), "value": stats[k].get("displayValue")}
            break
    return {
        "handle": data.get("platformInfo", {}).get("platformUserHandle") or e["handle"],
        "avatar": data.get("platformInfo", {}).get("avatarUrl"),
        "rank": rank,
        "stats": [{"key": k, "name": stats[k].get("displayName", k), "value": stats[k].get("displayValue"),
                   "percentile": stats[k].get("percentile")} for k in keys[:6] if stats[k].get("displayValue") is not None],
    }


def tracker(old):
    entries = [e for e in PROFILES.get("tracker", []) if e.get("handle") and e.get("game") and e.get("platform")]
    key = os.environ.get("TRN_API_KEY", "").strip()
    prev = {f"{x['game']}|{x['platform']}|{x['handle_in']}": x for x in old.get("tracker", []) if "handle_in" in x}
    out = []
    for e in entries:
        item = {"game": e["game"], "platform": e["platform"], "handle_in": e["handle"], "label": e.get("label", e["game"])}
        if key:
            try:
                item.update(tracker_profile(key, e))
                print(f"ok   tracker {e['game']}")
            except Exception as err:
                print(f"fail tracker {e['game']}: {err}")
                item.update({k: v for k, v in prev.get(f"{e['game']}|{e['platform']}|{e['handle']}", {}).items() if k not in item})
        out.append(item)
    if entries and not key:
        print("skip tracker stats (set TRN_API_KEY secret); profile links still published")
    return out


def main():
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    out = {"updated": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    key, ident = os.environ.get("STEAM_API_KEY", "").strip(), str(PROFILES.get("steam", "")).strip()
    if key and ident:
        try:
            out["steam"] = steam(key, ident)
            print("ok   steam (Web API)")
        except Exception as e:
            print(f"fail steam Web API: {e}")
            if ident.isdigit():                       # fall back to the public profile + exported library
                try:
                    out["steam"] = steam_public(ident)
                    print("ok   steam (public profile fallback)")
                except Exception as e2:
                    print(f"fail steam public: {e2}")
            if "steam" not in out and "steam" in old:
                out["steam"] = old["steam"]
    elif ident.isdigit():
        try:
            out["steam"] = steam_public(ident)
            print("ok   steam (public profile, no API key)")
        except Exception as e:
            print(f"fail steam public: {e}")
            if "steam" in old:
                out["steam"] = old["steam"]
    else:
        print("skip steam (set data/profiles.json -> steam to your SteamID64)")
        if "steam" in old:
            out["steam"] = old["steam"]
    out["tracker"] = tracker(old)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
