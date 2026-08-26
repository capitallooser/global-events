# Global Events Dashboard — GitHub Cloud Edition

After one-time upload, hosting and daily refresh run online in GitHub.

## One-time setup
1. Create a public GitHub repository named `global-events`.
2. Upload the contents of this package to the repository root.
3. Go to **Settings → Pages**.
4. Set **Source** to **GitHub Actions**.
5. Open **Actions** and enable workflows if prompted.
6. Run **Refresh event data** once.
7. Run **Deploy GitHub Pages** once if it has not run automatically.

Expected public URL:
`https://YOUR-USERNAME.github.io/global-events/`

## What runs online
- `docs/` = website hosted by GitHub Pages
- `.github/workflows/refresh-events.yml` = daily cloud refresh
- `scripts/update_events.py` = event collector
- `data/manual_events.json` = curated major events
- free public holiday data for India and the US is fetched automatically

## Cost
No paid API key, server, database, or always-on local computer is required.
Third-party free-tier policies can change in the future, so no provider can
be guaranteed free forever.
