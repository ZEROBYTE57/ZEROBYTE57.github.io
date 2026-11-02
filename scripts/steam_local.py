"""Export your Steam playtime from the Steam client's local files, no API key needed.

Reads <Steam>/userdata/<account id>/config/localconfig.vdf (the same playtime the
Steam library shows), looks up game names on the public Steam store, and writes
data/steam_library.json for the 404 Realm page.

Run it on a machine where you are signed in to Steam (Windows or Linux):
    python scripts/steam_local.py
Then commit data/steam_library.json. Re-run whenever you want fresher playtime.
Your SteamID64 comes from data/profiles.json -> "steam".
"""
import json
import os
import pathlib
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROFILES = json.loads((ROOT / "data" / "profiles.json").read_text(encoding="utf-8"))
OUT = ROOT / "data" / "steam_library.json"
STEAMID64_BASE = 76561197960265728
SKIP_TYPES = {"tool", "application", "demo", "advertising", "music", "video", "series", "episode", "hardware", "mod", "config"}


def steam_dirs():
    cands = []
    if sys.platform.startswith("win"):
        try:
            import winreg
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam") as k:
                cands.append(winreg.QueryValueEx(k, "SteamPath")[0])
        except OSError:
            pass
        cands += [r"C:\Program Files (x86)\Steam", r"C:\Program Files\Steam"]
    home = pathlib.Path.home()
    cands += [home / ".steam/steam", home / ".local/share/Steam",
              home / ".var/app/com.valvesoftware.Steam/.local/share/Steam"]   # Flatpak
    return [pathlib.Path(c) for c in cands if pathlib.Path(c).exists()]


def parse_vdf(text):
    """Minimal parser for Valve's KeyValues text format."""
    tokens = re.findall(r'"((?:\\.|[^"\\])*)"|([{}])', text)
    pos = 0

    def block():
        nonlocal pos
        out = {}
        while pos < len(tokens):
            s, brace = tokens[pos]
            pos += 1
            if brace == "}":
                return out
            key = s
            s2, brace2 = tokens[pos]
            pos += 1
            out[key.lower()] = block() if brace2 == "{" else s2
        return out

    return block()


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (portfolio steam export)", "Accept-Language": "en-US"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", "replace")


def lookup(appid, cache):
    if str(appid) in cache:
        return cache[str(appid)]
    info = {"name": None, "type": None}
    try:
        d = json.loads(get(f"https://store.steampowered.com/api/appdetails?appids={appid}&filters=basic"))[str(appid)]
        if d.get("success"):
            info = {"name": d["data"].get("name"), "type": d["data"].get("type")}
    except Exception:
        pass
    if not info["name"]:  # delisted or rate-limited: fall back to the community page title
        try:
            m = re.search(r"<title>Steam Community :: (.*?)</title>", get(f"https://steamcommunity.com/app/{appid}"))
            if m and m.group(1).strip() not in ("Error", ""):
                info["name"] = m.group(1).strip()
        except Exception:
            pass
    time.sleep(0.4)  # be gentle with the store API
    return info


def main():
    sid = str(PROFILES.get("steam", "")).strip()
    if not sid.isdigit():
        sys.exit('Set your SteamID64 in data/profiles.json -> "steam" first.')
    account = int(sid) - STEAMID64_BASE
    cfg = next((d / "userdata" / str(account) / "config" / "localconfig.vdf" for d in steam_dirs()
                if (d / "userdata" / str(account) / "config" / "localconfig.vdf").exists()), None)
    if not cfg:
        sys.exit(f"Could not find localconfig.vdf for account {account}. Is Steam installed and signed in here?")
    root = parse_vdf(cfg.read_text(encoding="utf-8", errors="replace"))
    apps = root.get("userlocalconfigstore", {}).get("software", {}).get("valve", {}).get("steam", {}).get("apps", {})

    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    cache = {str(g["appid"]): {"name": g["name"], "type": g.get("type")} for g in old.get("games", [])}
    games = []
    for appid, data in apps.items():
        if not isinstance(data, dict) or not appid.isdigit():
            continue
        minutes = int(data.get("playtime", 0) or 0)
        if minutes <= 0:
            continue
        info = lookup(appid, cache)
        if info.get("type") in SKIP_TYPES:
            continue
        games.append({
            "appid": int(appid),
            "name": info.get("name") or f"App {appid}",
            "type": info.get("type"),
            "minutes": minutes,
            "hours": round(minutes / 60, 1),
            "hours2w": round(int(data.get("playtime2wks", 0) or 0) / 60, 1),
            "lastPlayed": int(data.get("lastplayed", 0) or 0) or None,
        })
    games.sort(key=lambda g: g["minutes"], reverse=True)
    out = {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "steam-client-local",
        "totalHours": round(sum(g["minutes"] for g in games) / 60, 1),
        "games": games,
    }
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Exported {len(games)} games, {out['totalHours']} h total -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
