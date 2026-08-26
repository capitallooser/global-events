# Minute Market Intelligence Design

## Goal

Upgrade Global Events into a continuously updating, zero-recurring-cost market-intelligence dashboard with a one-minute target refresh cadence, a scrolling market ticker, major market-moving news, NIFTY 50 stocks-in-news analysis, and richer India/Global historical event impact coverage.

## Product constraints

- Zero recurring cost is mandatory under the providers' current free tiers; provider policies may change.
- GitHub Pages remains the public frontend.
- A minute-level cloud refresh layer is required because GitHub Actions cron cannot provide a true one-minute schedule.
- The browser refreshes all dashboard datasets every 60 seconds without full-page reloads.
- User state must survive refresh: active tab, event filters, search, calendar month, dialog state where practical, and scroll position.
- Free/public market data must remain honestly labelled as Live, Delayed, Last available, or Unavailable with timestamps.
- Historical statistics are descriptive, not forecasts. Direction percentages appear only when sample size is at least 8.
- News must link to original sources and must not republish full copyrighted articles.
- No paid LLM or paid API is required for the baseline.

## Architecture

### Frontend

GitHub Pages continues serving static HTML/CSS/JavaScript. The existing card-based market snapshot is removed and replaced by a slim sticky market ticker that scrolls right-to-left continuously. The frontend fetches the latest JSON/API payload every 60 seconds and re-renders only changed data regions.

### Minute-level data layer

Use a Cloudflare Worker with a Cron Trigger targeting every minute. The Worker performs lightweight ingestion and normalization, exposing public JSON endpoints for the frontend. Durable state should use the smallest free-tier mechanism needed; Cloudflare KV/D1 is acceptable if required, but the baseline should prefer compact cached JSON/state and avoid unnecessary writes.

The Worker should run independent collectors with failure isolation so one failed provider never blanks the rest of the dashboard. Each collector records source name, source timestamp, fetch timestamp, status, and last successful value.

### GitHub Actions

GitHub Actions remains responsible for slower or compute-heavy work such as regression tests, static validation, deployment, and historical-impact recalculation when source inputs change. It must not be used as the one-minute scheduler.

## Market ticker

Remove GIFT Nifty entirely from the UI and live feed.

The sticky ticker must continuously display, in this order unless responsive layout requires otherwise:

1. NIFTY 50
2. Bank NIFTY
3. Sensex
4. S&P 500
5. Nasdaq Composite
6. Gold
7. WTI Crude Oil
8. USD/INR
9. Bitcoin

Each ticker item shows label, latest price, percentage change, and up/down visual state. Hover/tap exposes data status, source, and timestamp. Animation continues smoothly while values update and must not visibly restart each minute.

## Unified refresh contract

The frontend has one global 60-second refresh timer. Every cycle it re-fetches:

- market prices
- events
- elections and macro calendar data
- market news
- NIFTY 50 stocks-in-news data
- source health
- historical impact summaries
- surprise data
- alert state/status

The backend minute scheduler checks all lightweight live sources every minute. Expensive historical calculations are not recomputed every minute; they are recalculated only when relevant event-history inputs or benchmark-history inputs change, while the frontend still checks for new output each minute.

A visible freshness indicator should report the newest successful dataset timestamp and identify stale/unavailable sources without hiding other healthy data.

## Market news

Add a dedicated `News` tab and an Overview section named `Market-moving news`.

Overview defaults to High and Very High market relevance only. The News tab supports filtering by:

- India / US / Global
- High / Very High / Medium / Low relevance
- category
- source
- NIFTY 50 only
- search text

Initial market-news categories:

- Central banks / rates
- Inflation / macro data
- Geopolitics
- Government / regulation
- Oil / commodities
- Earnings / guidance
- Corporate actions / M&A
- Banking / credit
- Technology
- Crypto
- Other market-moving

News ingestion aggregates multiple reputable free/public RSS, Atom, JSON, or official feeds where technically accessible. The system stores and displays only metadata needed for discovery: headline, source, URL, publication timestamp, short factual reason/summary, region/category tags, matched instruments/stocks, and relevance score.

Deduplication uses canonical URL when available, then normalized headline similarity and publication-time proximity.

## Market relevance score

Use a transparent rule-based score rather than an opaque prediction model. Inputs can include:

- official/primary-source weight
- reputable financial-source weight
- recency
- topic severity
- whether a major index, commodity, currency, central bank, election, or NIFTY 50 constituent is affected
- number of corroborating reputable sources

Map the score to Very High / High / Medium / Low. Do not infer guaranteed market direction.

## NIFTY 50 stocks in news

Add a prominent `NIFTY 50 Stocks in News` section on Overview and India, plus a `NIFTY 50 only` filter inside News.

Maintain an up-to-date NIFTY 50 constituent and alias map from an official/public NSE-derived source when technically accessible, with a version timestamp and safe fallback to the most recently successful list.

For each matched NIFTY 50 company show:

- ticker / company name
- relevance level
- concise factual reason it is in the news
- latest headline
- related-story count
- publication timestamp
- source(s)
- link to original story

Reason generation is deterministic and evidence-based from headline/description/category patterns, for example contract win, earnings/guidance, RBI/regulatory action, order/approval, merger/acquisition, management change, litigation, commodity exposure, capex, stake sale/buy, fundraising, rating action, or sector-wide policy event. If the reason is ambiguous, show `Multiple related developments` instead of inventing a cause.

## Historical impact expansion

Expand `market-impact.json` beyond the existing US-only event families.

Priority India families:

- RBI MPC / policy decision
- India CPI
- India GDP
- India IIP
- India WPI

Priority Global families where reliable historical official dates can be sourced:

- ECB monetary-policy decisions
- Bank of England MPC decisions

For each event family calculate available reactions against relevant benchmarks from:

- NIFTY 50
- Bank NIFTY
- Sensex
- S&P 500
- Nasdaq Composite
- Gold
- WTI Crude Oil where meaningful
- USD/INR
- Bitcoin where meaningful

Event-session alignment must account for market timezone and whether a release occurs before or after the relevant cash-market close. Directional percentages require sample >= 8. Smaller samples may show sample count and average/max absolute movement but not bullish/bearish percentages.

If reliable historical dates cannot be obtained for a family, the UI shows `Historical sample not available yet` rather than fabricating results.

## India / Global detail parity

India and Global event cards use the same historical-impact component already visible on supported US event cards whenever a corresponding event-family history exists. The absence of history must be explicit and must not look like a rendering bug.

## Source health and failure handling

Every live collector returns one of:

- Live
- Delayed
- Last available
- Unavailable

If a source fails, preserve the last successful value with its original timestamp and mark it `Last available` when appropriate. Do not silently substitute unrelated data.

News-source failures are isolated by source. The feed remains available from healthy sources and the source-health panel reports failures.

## Security and privacy

- No API tokens are committed to the public repository.
- Cloudflare secrets, if any are needed, are stored as Worker secrets.
- The public frontend receives only non-secret normalized data.
- Telegram secrets remain in GitHub Actions secrets and are unaffected by this design.

## Testing

Required automated coverage:

- ticker data normalization including WTI Crude and absence of GIFT Nifty
- one-minute frontend refresh interval
- state preservation across refresh
- news parsing, dedupe, region/category classification, relevance scoring, stale-source behavior
- NIFTY 50 constituent matching and reason extraction
- India/Global historical event-family mapping and sample-size rules
- source-health fallback behavior
- frontend contract tests confirming News tab, NIFTY-in-news section, scrolling ticker, and all prior event filters remain present
- full existing Python/JavaScript regression suites

## Deployment

1. Merge frontend and worker code only after all repository tests pass.
2. Deploy GitHub Pages from `main` as today.
3. Deploy/configure the Cloudflare Worker and its one-minute Cron Trigger.
4. Point the frontend live-data base URL to the Worker endpoint through a non-secret configuration constant.
5. Verify end-to-end minute refresh, stale-provider fallback, News filtering, NIFTY stock matching, crude ticker, and India/Global event details.

The design is complete only when the live dashboard can remain open without manual refresh and visibly consume newly available normalized data on the next one-minute browser cycle.