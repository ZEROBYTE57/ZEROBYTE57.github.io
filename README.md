# ZEROBYTE57 · Portfolio

Personal portfolio of **Devisetty Lakshmi Srinivas**, AI Engineer / Data Scientist (M.Tech AI & ML, Amrita, Dec 2026).

Plain HTML, CSS and JavaScript with no build step, served by GitHub Pages.

| File | What it holds |
|---|---|
| `index.html` | All page content (about, projects, skills, notes, contact) |
| `styles.css` | Layout, colors, light/dark theme |
| `script.js` | Theme toggle, live IST clock, nav pill, glitch and text-decode effects |
| `live.js` | Live coding-activity section (GitHub, LeetCode, GfG, Codeforces, HackerRank) |
| `data/profiles.json` | **Your platform usernames**. Leave one empty to hide that card |
| `data/stats.json` | Stats snapshot, refreshed every 6 h by `.github/workflows/update-stats.yml` |
| `scripts/fetch_stats.py` | The script the workflow runs (also runnable locally) |

## Preview locally

```sh
python -m http.server 8000
# open http://localhost:8000
```

## Editing

- **Add a technical interest:** copy one `<article class="interest">` block in the Interests section.
- **Refresh stats now:** run `python scripts/fetch_stats.py`, or use *Run workflow* on the Actions tab.
- **Add a project:** copy one `<article class="card">` block in the Projects section of `index.html`.
- **Update the resume:** replace `Devisetty_Lakshmi_Srinivas_M.Tech.pdf` (keep the name, or update both links in `index.html`).
- **Change the accent color:** edit `--accent` and `--accent-ink` at the top of `styles.css` (light block, then the two dark blocks).
