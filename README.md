# Global Market Intelligence — GitHub-Only Edition

This project runs without a paid server or always-on local computer. GitHub Pages hosts the dashboard and GitHub Actions refreshes the public JSON datasets used by the browser.

## Architecture
- **GitHub Pages** hosts the public dashboard.
- **GitHub Actions** refreshes market prices, market news, NIFTY 50 constituents, events, elections, macro calendars, historical impact, and Telegram alert state.
- **Repository JSON files** are the frontend data source.
- The open browser checks all dashboard JSON files every **60 seconds** with `cache: no-store`; it does not reload the page or reset filters, tab, calendar month, or scroll position.
- No Cloudflare Worker or Cloudflare account is required for production.

## Refresh cadence
- `market-prices.yml`: target every **5 minutes**.
- `news.yml`: target every **5 minutes** and writes `news.json` plus `nifty-in-news.json`.
- `nifty50.yml`: keeps the official NSE NIFTY 50 fallback list synchronized.
- Event/election/macro workflows run on their own source-appropriate schedules.
- Historical reaction analysis runs separately because multi-year history does not need to be recomputed every few minutes.
- Telegram alerts continue on their dedicated workflow.

GitHub scheduled jobs may start later than their cron target, so a 5-minute cron is a target cadence rather than a guaranteed real-time SLA.

## Market ticker
The sticky scrolling ticker contains:

`NIFTY 50 · Bank NIFTY · Sensex · S&P 500 · Nasdaq · Gold · WTI Crude · USD/INR · Bitcoin`

GIFT Nifty is intentionally not included. Free/public quotes are labelled honestly as `Live`, `Delayed`, `Last available`, or `Unavailable` with source timestamps where available.

## News
The dashboard includes a Market News tab plus High/Very High market-moving stories on Overview. News metadata is refreshed from free/public feeds, deduplicated, categorized, and ranked for market relevance. The site stores headline/metadata and links back to the original source rather than republishing article bodies.

The India experience also includes **NIFTY 50 Stocks in News**, showing the matched stock, factual reason for the news, latest related headline, relevance, source, timestamp, and related-story count.

## Historical impact
Historical reaction analytics cover supported US, India, and global event families, including Federal Reserve events, RBI MPC, India CPI/GDP/IIP where official historical dates are available, ECB, and Bank of England. WTI crude is included as a reaction benchmark. Direction percentages are only displayed when the historical sample is at least 8 observations.

## Cost
The baseline is designed for zero recurring cost using GitHub Pages, public-repository GitHub Actions, and free/public data sources. Provider availability and free-tier policies can change, so zero cost cannot be guaranteed indefinitely.
