"""Fetch Steam stats into data/gaming.json.

Needs two things (both optional; the script skips Steam cleanly without them):
  * a Steam Web API key in the STEAM_API_KEY environment variable
    (GitHub repo -> Settings -> Secrets and variables -> Actions -> STEAM_API_KEY)
  * your SteamID64 or custom profile name in data/profiles.json -> "steam"
Your Steam profile and "Game details" must be set to Public.

Discord data is fetched live in the browser, so it is not handled here.
"""
import json
import os
import pathlib
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROFILES = json.loads((ROOT / "data" / "profiles.json").read_text(encoding="utf-8"))
OUT = ROOT / "data" / "gaming.json"
API = "https://api.steampowered.com"


def get(path, **params):
    url = f"{API}/{path}/?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "portfolio-stats"}), timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def steam(key, ident):
    sid = ident
    if not ident.isdigit():  # custom URL name -> SteamID64
        res = get("ISteamUser/ResolveVanityURL/v1", key=key, vanityurl=ident)["response"]
        if res.get("success") != 1:
            raise ValueError(f"could not resolve Steam name '{ident}'")
        sid = res["steamid"]
    p = get("ISteamUser/GetPlayerSummaries/v2", key=key, steamids=sid)["response"]["players"][0]
    owned = get("IPlayerService/GetOwnedGames/v1", key=key, steamid=sid, include_appinfo=1, include_played_free_games=1)["response"]
    recent = get("IPlayerService/GetRecentlyPlayedGames/v1", key=key, steamid=sid, count=6)["response"]
    level = get("IPlayerService/GetSteamLevel/v1", key=key, steamid=sid)["response"].get("player_level")
    games = owned.get("games", [])
    hrs = lambda m: round(m / 60, 1)
    top = sorted(games, key=lambda g: g.get("playtime_forever", 0), reverse=True)[:8]
    return {
        "name": p.get("personaname"),
        "avatar": p.get("avatarfull"),
        "url": p.get("profileurl"),
        "state": p.get("personastate", 0),          # 0 offline, 1 online, 2 busy, 3 away, 4 snooze ...
        "playing": p.get("gameextrainfo"),           # set when in-game at fetch time
        "level": level,
        "gameCount": owned.get("game_count", len(games)),
        "totalHours": hrs(sum(g.get("playtime_forever", 0) for g in games)),
        "recentHours": hrs(sum(g.get("playtime_2weeks", 0) for g in recent.get("games", []))),
        "recent": [{"appid": g["appid"], "name": g["name"], "hours2w": hrs(g.get("playtime_2weeks", 0)),
                    "hours": hrs(g.get("playtime_forever", 0))} for g in recent.get("games", [])],
        "top": [{"appid": g["appid"], "name": g.get("name", str(g["appid"])), "hours": hrs(g.get("playtime_forever", 0)),
                 "last": g.get("rtime_last_played")} for g in top if g.get("playtime_forever", 0) > 0],
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
        "recentHours": float(tag("hoursPlayed2Wk") or 0),
        "recent": recent,
        "source": "public-profile",
    }
    lib_file = ROOT / "data" / "steam_library.json"
    if lib_file.exists():
        lib = json.loads(lib_file.read_text(encoding="utf-8"))
        named = [g for g in lib.get("games", []) if not g["name"].startswith("App ")]
        out["totalHours"] = lib.get("totalHours")
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
            print("ok   steam")
        except Exception as e:
            print(f"fail steam: {e}")
            if "steam" in old:
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
