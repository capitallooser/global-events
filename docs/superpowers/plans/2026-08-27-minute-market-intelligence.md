# Minute Market Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-minute target-refresh market-intelligence dashboard with a scrolling live ticker, WTI crude, major market-moving news, NIFTY 50 stocks-in-news reasons, and India/Global historical-impact parity without introducing a recurring paid dependency.

**Architecture:** GitHub Pages remains the static frontend. A Cloudflare Worker with a `* * * * *` Cron Trigger becomes the minute-level live-data layer for lightweight market/news ingestion and exposes one normalized snapshot endpoint; expensive historical analysis remains in GitHub Actions and is recomputed only when source inputs change. The browser performs one 60-second refresh cycle and re-renders changed sections without resetting user state.

**Tech Stack:** Static HTML/CSS/ES modules, Node `node:test`, Python 3.12 `unittest`, Cloudflare Workers runtime, Wrangler, free/public RSS/JSON/CSV sources, existing GitHub Actions and GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-27-minute-market-intelligence-design.md`

## Global Constraints

- Zero recurring cost is mandatory under the providers' current free tiers; provider policies may change.
- GitHub Pages remains the public frontend.
- Browser refresh cadence is exactly `60000` ms.
- Backend minute scheduler uses Cloudflare Worker Cron `* * * * *`; GitHub Actions must not be used as the one-minute scheduler.
- Remove GIFT Nifty from UI, JSON requirements, parsing code, and tests.
- Market ticker order: NIFTY 50, Bank NIFTY, Sensex, S&P 500, Nasdaq Composite, Gold, WTI Crude Oil, USD/INR, Bitcoin.
- Market-source status values remain `Live`, `Delayed`, `Last available`, `Unavailable`, with source timestamps.
- Direction percentages remain hidden when historical sample size is below 8.
- News stores/displays metadata only; never republish full article bodies.
- No paid LLM/API is required for baseline operation.
- Telegram secrets and alert workflow remain untouched.

---

### Task 1: Replace GIFT Nifty with WTI Crude in the canonical quote contract

**Files:**
- Modify: `update_market_prices.py`
- Modify: `test_market_prices.py`
- Modify: `.github/workflows/market-prices.yml`
- Modify: `market-prices.json` after successful regeneration

**Interfaces:**
- Produces: market rows with keys `nifty`, `banknifty`, `sensex`, `sp500`, `nasdaq`, `gold`, `crude`, `usdinr`, `bitcoin`.
- Produces: `crude` from Yahoo symbol `CL=F`, label `WTI Crude Oil`.

- [ ] **Step 1: Write failing tests removing GIFT Nifty and requiring crude**

Replace the GIFT-specific tests in `test_market_prices.py` with:

```python
    def test_instrument_contract_has_crude_and_no_gift_nifty(self):
        self.assertIn('crude', mp.INSTRUMENTS)
        self.assertEqual(mp.INSTRUMENTS['crude'], ('WTI Crude Oil', ['CL=F']))
        self.assertNotIn('gift_nifty', mp.INSTRUMENTS)

    def test_cached_crude_falls_back_to_last_available(self):
        cached={'price':64.5,'change':1.0,'changePct':1.57,'sourceTimestamp':'2026-08-26T10:00:00Z','sourceName':'Yahoo Finance','status':'Live'}
        q=mp.unavailable_or_cached('crude','WTI Crude Oil',cached,'source failed')
        self.assertEqual(q['price'],64.5)
        self.assertEqual(q['status'],'Last available')
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `python -m unittest test_market_prices.py -v`

Expected: failure because `crude` is not yet in `INSTRUMENTS` and GIFT code still exists.

- [ ] **Step 3: Remove all NSE IX/GIFT parsing and add crude**

Delete `NSEIX_HOMES`, `_nseix_source_time`, `_nseix_status`, `parse_nseix_gift`, and the GIFT fallback branch from `main()`. Set:

```python
INSTRUMENTS={
 'nifty':('NIFTY 50',['^NSEI']),
 'banknifty':('Bank NIFTY',['^NSEBANK']),
 'sensex':('Sensex',['^BSESN']),
 'sp500':('S&P 500',['^GSPC']),
 'nasdaq':('Nasdaq Composite',['^IXIC']),
 'gold':('Gold',['GC=F']),
 'crude':('WTI Crude Oil',['CL=F']),
 'usdinr':('USD/INR',['INR=X']),
 'bitcoin':('Bitcoin',['BTC-USD'])
}
```

Update `.github/workflows/market-prices.yml` required keys to the same nine-key set and explicitly assert `gift_nifty not in keys`.

- [ ] **Step 4: Verify GREEN and regenerate JSON**

Run:

```bash
python -m unittest test_market_prices.py -v
python update_market_prices.py
python - <<'PY'
import json
x=json.load(open('market-prices.json'))
keys={r['key'] for r in x['instruments']}
assert 'crude' in keys and 'gift_nifty' not in keys
PY
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add update_market_prices.py test_market_prices.py .github/workflows/market-prices.yml market-prices.json
git commit -m "feat: replace GIFT Nifty with WTI crude"
```

---

### Task 2: Create the one-minute Cloudflare Worker snapshot shell

**Files:**
- Create: `worker/wrangler.toml`
- Create: `worker/src/index.mjs`
- Create: `worker/src/snapshot.mjs`
- Create: `test_worker_snapshot.mjs`

**Interfaces:**
- Produces: `GET /api/snapshot` JSON.
- Produces: `refreshSnapshot(fetchImpl, now)` returning `{updatedAt, market, news, niftyInNews, events, impact, surprises, alerts, sourceStatus}`.
- Scheduled handler refreshes and caches the same payload every minute.

- [ ] **Step 1: Write the failing snapshot-contract test**

Create `test_worker_snapshot.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySnapshot, REFRESH_MS} from './worker/src/snapshot.mjs';

test('worker snapshot contract covers every dashboard dataset',()=>{
  assert.equal(REFRESH_MS,60000);
  assert.deepEqual(Object.keys(emptySnapshot('2026-08-27T00:00:00Z')).sort(),
    ['alerts','events','impact','market','news','niftyInNews','sourceStatus','surprises','updatedAt'].sort());
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test_worker_snapshot.mjs`

Expected: module-not-found failure.

- [ ] **Step 3: Add Worker configuration and minimal snapshot module**

`worker/wrangler.toml`:

```toml
name = "global-events-live"
main = "src/index.mjs"
compatibility_date = "2026-08-27"

[triggers]
crons = ["* * * * *"]
```

`worker/src/snapshot.mjs`:

```js
export const REFRESH_MS=60000;
export function emptySnapshot(updatedAt=new Date().toISOString()){
  return {updatedAt,market:{instruments:[]},news:[],niftyInNews:[],events:[],impact:{eventTypes:{}},surprises:{events:{}},alerts:{sent:{}},sourceStatus:{sources:{}}};
}
```

`worker/src/index.mjs` must expose CORS only to `https://capitallooser.github.io`, cache the successful JSON response using `caches.default`, and on cache miss call `refreshSnapshot(fetch,new Date())`. The scheduled handler calls the same function and overwrites the cached `/api/snapshot` response.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test_worker_snapshot.mjs && node --check worker/src/index.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker test_worker_snapshot.mjs
git commit -m "feat: add minute snapshot worker shell"
```

---

### Task 3: Add live market collection and GitHub fallback to the Worker

**Files:**
- Create: `worker/src/market.mjs`
- Modify: `worker/src/snapshot.mjs`
- Create: `test_worker_market.mjs`

**Interfaces:**
- Consumes: Yahoo chart endpoint with `interval=5m&range=1d&includePrePost=true`.
- Fallback: `https://capitallooser.github.io/global-events/market-prices.json`.
- Produces: `collectMarket(fetchImpl, now)` returning `{updatedAt,instruments,sourceHealth}`.

- [ ] **Step 1: Write failing tests for quote normalization and fallback**

Test that `normalizeQuote('crude','WTI Crude Oil',65,64,sourceTs,now)` returns change `1`, changePct `1.563`, and `Live` when source age <=45 minutes. Test that a failed live fetch retains the matching GitHub fallback row as `Last available` and never manufactures a new timestamp.

- [ ] **Step 2: Verify RED**

Run: `node --test test_worker_market.mjs`

Expected: module-not-found failure.

- [ ] **Step 3: Implement the collector**

Use this exact instrument map:

```js
export const MARKET_INSTRUMENTS={
  nifty:['NIFTY 50','^NSEI'], banknifty:['Bank NIFTY','^NSEBANK'], sensex:['Sensex','^BSESN'],
  sp500:['S&P 500','^GSPC'], nasdaq:['Nasdaq Composite','^IXIC'], gold:['Gold','GC=F'],
  crude:['WTI Crude Oil','CL=F'], usdinr:['USD/INR','INR=X'], bitcoin:['Bitcoin','BTC-USD']
};
```

Each symbol fetch failure is isolated. Live rows preserve `sourceTimestamp`; fallback rows preserve their previous timestamp and change `status` to `Last available`.

- [ ] **Step 4: Wire into `refreshSnapshot` and verify GREEN**

Run: `node --test test_worker_market.mjs test_worker_snapshot.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/src/market.mjs worker/src/snapshot.mjs test_worker_market.mjs
git commit -m "feat: collect minute market quotes"
```

---

### Task 4: Add market-news ingestion, classification, scoring, and deduplication

**Files:**
- Create: `worker/src/news.mjs`
- Create: `test_worker_news.mjs`
- Modify: `worker/src/snapshot.mjs`

**Interfaces:**
- Produces: `collectNews(fetchImpl, now)` returning `{items,sourceHealth}`.
- News item schema: `{id,title,url,source,publishedAt,region,category,relevanceScore,relevanceLevel,reason,matchedStocks,corroboration}`.

- [ ] **Step 1: Write failing parser/scoring/dedupe tests**

Fixtures should cover: Fed rate headline => `central_bank`, India/RBI headline => `IN`, oil/OPEC headline => `oil_commodities`, same canonical URL twice => one item, and a fresh official central-bank story scoring above an old generic market wrap.

Expected level mapping:

```js
export function relevanceLevel(score){
  if(score>=85)return 'very_high';
  if(score>=65)return 'high';
  if(score>=40)return 'medium';
  return 'low';
}
```

- [ ] **Step 2: Verify RED**

Run: `node --test test_worker_news.mjs`

Expected: module-not-found failure.

- [ ] **Step 3: Implement resilient feed aggregation**

Use a configured feed list containing broad, free/public market RSS queries plus official feeds that validate during implementation. At minimum include separate India, US, and Global broad-market queries so failure of one geography does not empty the other two. Parse RSS/Atom using deterministic XML text extraction only; store headline/description metadata, not article bodies.

Scoring inputs must be additive and inspectable: official/primary-source weight, financial-source weight, age decay, severity keywords, major index/commodity/currency/central-bank references, NIFTY constituent match count, and corroboration count.

Deduplicate first by canonical URL, then normalized headline key within a six-hour publication window.

- [ ] **Step 4: Verify GREEN**

Run: `node --test test_worker_news.mjs`

Expected: PASS.

- [ ] **Step 5: Wire into snapshot and commit**

```bash
git add worker/src/news.mjs worker/src/snapshot.mjs test_worker_news.mjs
git commit -m "feat: add market-moving news collector"
```

---

### Task 5: Maintain NIFTY 50 constituents and generate deterministic stocks-in-news reasons

**Files:**
- Create: `sync_nifty50.py`
- Create: `nifty50.json`
- Create: `test_nifty50.py`
- Create: `worker/src/nifty.mjs`
- Create: `test_worker_nifty.mjs`
- Modify: `worker/src/news.mjs`
- Modify: `worker/src/snapshot.mjs`

**Interfaces:**
- Official constituent source: `https://archives.nseindia.com/content/indices/ind_nifty50list.csv`.
- Produces: `nifty50.json` `{updatedAt,source,constituents:[{symbol,company,industry,aliases}]}`.
- Produces: `buildNiftyInNews(news,constituents)`.

- [ ] **Step 1: Write failing Python CSV-normalization test**

Test a CSV row like `Reliance Industries Ltd.,Energy,RELIANCE,...` becomes `{symbol:'RELIANCE', company:'Reliance Industries Ltd.', aliases:[...]}` and output contains no duplicate symbols.

- [ ] **Step 2: Verify RED**

Run: `python -m unittest test_nifty50.py -v`

- [ ] **Step 3: Implement `sync_nifty50.py` and generate the committed fallback**

The script fetches the official CSV, creates aliases from symbol plus normalized company name, removes legal suffixes (`Ltd`, `Limited`), writes `nifty50.json` atomically, and keeps source URL/timestamp.

Run: `python sync_nifty50.py`.

- [ ] **Step 4: Write failing JS matching/reason tests**

Cases:
- `Reliance Industries wins...` matches `RELIANCE`.
- symbol match requires a token boundary so `ITC` does not match arbitrary words.
- `reports quarterly profit/guidance` => `Earnings / guidance`.
- `RBI imposes restrictions on HDFC Bank` => `RBI / regulatory action`.
- `wins large contract/order` => `Contract / order win`.
- unmatched mixed headlines => `Multiple related developments` only when multiple stories are grouped without one dominant reason.

- [ ] **Step 5: Implement `worker/src/nifty.mjs`**

Fetch the official CSV with a long cache TTL; if it fails, load `https://capitallooser.github.io/global-events/nifty50.json`. Group matching news by symbol, newest first, and emit latest headline, reason, relevance, related-story count, publication timestamp, unique sources, and original URL.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
python -m unittest test_nifty50.py -v
node --test test_worker_nifty.mjs test_worker_news.mjs
```

Then commit the six files plus `nifty50.json`.

---

### Task 6: Replace snapshot cards with the continuous sticky ticker and unify browser refresh to 60 seconds

**Files:**
- Modify: `core.mjs`
- Modify: `test_filters.mjs`
- Modify: `test_ui_contract.mjs`
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `filters.css` only if layout interaction requires it

**Interfaces:**
- `LIVE_REFRESH_MS` becomes numeric `60000`.
- Frontend uses a single `refreshEverything()` interval.
- Live endpoint base is read from `live-config.json`; empty base falls back to same-origin repository JSON.

- [ ] **Step 1: Update tests first**

Change the refresh test to:

```js
test('all dashboard data refreshes every minute',async()=>{
 const core=await import('./core.mjs');
 assert.equal(core.LIVE_REFRESH_MS,60000);
});
```

Update `test_ui_contract.mjs` to require:
- `id="marketTicker"`
- `id="tickerTrack"`
- `data-tab="news"`
- no `giftNiftyLive`, `tv-single-ticker`, `NSEIX:NIFTY1!`, or TradingView script
- `setInterval(refreshEverything,LIVE_REFRESH_MS)`
- no `location.reload`
- existing event filter IDs still present.

- [ ] **Step 2: Verify RED**

Run: `node --test test_filters.mjs test_ui_contract.mjs`

Expected: failures for old intervals and old market snapshot/GIFT UI.

- [ ] **Step 3: Implement the ticker shell**

Replace `marketStripSection` with a sticky ticker immediately below the tab bar/update bar. Render the nine instruments twice inside the same CSS track for a seamless loop. Only replace text values inside existing ticker item nodes on refresh so the CSS animation does not restart.

Ticker item tooltip/title must include `status · source · timestamp`.

- [ ] **Step 4: Implement one global refresh function**

`refreshEverything()` captures `window.scrollY`, active tab, filter DOM values, `calendarYear`, `calendarMonth`, and current dialog event ID; fetches the Worker snapshot plus same-origin fallbacks with `cache:'no-store'`; updates data variables; calls renderers; then restores scroll with `requestAnimationFrame`.

Use one interval only:

```js
setInterval(refreshEverything,LIVE_REFRESH_MS);
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
node --test test_filters.mjs test_ui_contract.mjs
node --check app.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core.mjs test_filters.mjs test_ui_contract.mjs index.html app.js styles.css filters.css
git commit -m "feat: add one-minute scrolling market ticker"
```

---

### Task 7: Add News tab, Overview market-moving news, and NIFTY 50 stocks-in-news UI

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Create: `news-ui.mjs`
- Create: `test_news_ui.mjs`
- Modify: `test_ui_contract.mjs`

**Interfaces:**
- Produces: `filterNews(items,filters)` and `groupNiftyNews(rows)` rendering inputs.
- News filters: region, relevance, category, source, NIFTY-only, query.

- [ ] **Step 1: Write failing UI/filter tests**

Require Overview IDs `marketMovingNews` and `niftyInNews`, News panel ID `newsPanel`, and filter IDs `newsRegion`, `newsRelevance`, `newsCategory`, `newsSource`, `newsNiftyOnly`, `newsQuery`.

Test `filterNews` defaults Overview to only `high`/`very_high` while News tab can show all levels.

- [ ] **Step 2: Verify RED**

Run: `node --test test_news_ui.mjs test_ui_contract.mjs`

- [ ] **Step 3: Implement News markup and renderer**

News cards show headline, factual `reason`, region/category/relevance badges, source, publication time, and original-source link. Do not display scraped article body text.

NIFTY card shows symbol, company, relevance, reason, latest headline, related count, timestamp, source list, and original link.

- [ ] **Step 4: Add India-tab NIFTY section**

Render the same data in a dedicated India-panel section without duplicating data fetches.

- [ ] **Step 5: Verify GREEN and commit**

Run: `node --test test_news_ui.mjs test_ui_contract.mjs && node --check app.js`

Commit the UI files.

---

### Task 8: Add explicit historical-history absence state before expanding analytics

**Files:**
- Modify: `app.js`
- Modify: `test_ui_contract.mjs`

**Interfaces:**
- `impactPanel(null, event)` returns an explicit unavailable message only for event families expected to have analytics; generic low-value events may omit the panel.

- [ ] **Step 1: Write failing contract test**

Assert `app.js` contains the exact user-facing copy `Historical sample not available yet`.

- [ ] **Step 2: Verify RED**

Run: `node --test test_ui_contract.mjs`

- [ ] **Step 3: Implement parity behavior**

For India macro/central-bank and supported Global central-bank events, render a neutral impact box with `Historical sample not available yet` until `market-impact.json` contains a row. This makes missing history explicit instead of appearing to be a broken India/Global renderer.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test test_ui_contract.mjs && node --check app.js`

---

### Task 9: Expand historical event families and benchmarks

**Files:**
- Create: `historical_event_dates.py`
- Create: `historical-event-dates.json`
- Create: `test_historical_event_dates.py`
- Modify: `analyze_market_impact.py`
- Modify: `test_market_impact.py`
- Modify: `.github/workflows/market-impact.yml`

**Interfaces:**
- Event keys: `rbi_mpc`, `india_cpi`, `india_gdp`, `india_iip`, `india_wpi`, `ecb_mpc`, `boe_mpc` plus existing US keys.
- Adds benchmark `crude` with Yahoo `CL=F` and Stooq fallback `cl.f` only if validated; otherwise Yahoo-only with truthful unavailable handling.
- Produces provenance in `historical-event-dates.json` for every event family.

- [ ] **Step 1: Write failing tests for new keys, crude, and sample rule**

Extend `test_market_impact.py`:

```python
  def test_india_and_global_event_families_present(self):
    self.assertTrue({'rbi_mpc','india_cpi','india_gdp','india_iip','india_wpi','ecb_mpc','boe_mpc'} <= set(impact.EVENT_TYPES))

  def test_crude_benchmark_present(self):
    self.assertIn('crude', impact.BENCHMARKS)
    self.assertEqual(impact.BENCHMARKS['crude']['yahoo'],'CL=F')
```

Keep the existing `directionReady` under-eight test unchanged.

- [ ] **Step 2: Verify RED**

Run: `python -m unittest test_market_impact.py -v`

- [ ] **Step 3: Build official-date harvesting with provenance**

`historical_event_dates.py` writes rows shaped:

```json
{"key":"rbi_mpc","date":"2026-08-06","sourceName":"Reserve Bank of India","sourceUrl":"https://www.rbi.org.in/"}
```

Harvest only dates that can be tied to an official source. Use RBI official monetary-policy archives for `rbi_mpc`, MoSPI/OEA release archives for India CPI/GDP/IIP/WPI, ECB official monetary-policy-decision archive for `ecb_mpc`, and Bank of England monetary-policy-summary/minutes archive for `boe_mpc`. If a parser cannot prove a date, omit it rather than infer it.

Tests use fixed HTML/text fixtures embedded in `test_historical_event_dates.py`, not live network calls.

- [ ] **Step 4: Extend analyzer session rules**

Add event metadata field `reactionRule`. Use:
- `rbi_mpc`: Indian event-day close as first reaction session when the policy event occurs during Indian market hours.
- `india_cpi`, `india_gdp`, `india_iip`: first Indian session after release date as conservative post-close handling.
- `india_wpi`: event-day Indian close unless source metadata indicates post-close.
- `ecb_mpc`, `boe_mpc`: event-day Europe/US/global reaction; for Indian benchmarks, first Indian session after the decision when the decision occurs after India close.

Do not display bullish/bearish percentages until `sample >= 8`.

- [ ] **Step 5: Regenerate and validate**

Run:

```bash
python historical_event_dates.py
python -m unittest test_historical_event_dates.py test_market_impact.py -v
python analyze_market_impact.py
```

Validate that any missing official history yields `no_history`/absent event type rather than fabricated observations.

- [ ] **Step 6: Update workflow validation and commit**

Require `crude` in benchmark metadata and validate new event-type rows only when `historicalEvents > 0`.

Commit analyzer, dates file, tests, and workflow.

---

### Task 10: Feed static events/status/impact into the minute Worker without recomputing heavy jobs

**Files:**
- Modify: `worker/src/snapshot.mjs`
- Create: `worker/src/static-data.mjs`
- Create: `test_worker_static_data.mjs`

**Interfaces:**
- Static base: `https://capitallooser.github.io/global-events/`.
- Fetches each minute: `events.json`, `source-status.json`, `market-impact.json`, `surprises.json`, `alert-state.json` with `cache:'no-store'` semantics at Worker fetch level.

- [ ] **Step 1: Write failing partial-failure test**

Simulate `events.json` succeeding, `market-impact.json` failing, and assert the snapshot still returns events plus `impact:{eventTypes:{}}` and a source-health error entry.

- [ ] **Step 2: Verify RED**

Run: `node --test test_worker_static_data.mjs`

- [ ] **Step 3: Implement `collectStaticData`**

Use `Promise.allSettled`; never reject the whole snapshot because one static dataset is unavailable. Keep separate source-health entries for each file.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node --test test_worker_static_data.mjs test_worker_snapshot.mjs`

---

### Task 11: Update CI and deployment documentation

**Files:**
- Modify: `.github/workflows/verify-v3.yml`
- Create: `.github/workflows/deploy-worker.yml`
- Modify: `README.md`
- Create: `live-config.json`

**Interfaces:**
- CI must run `node --test test_*.mjs` including Worker pure-module tests.
- Worker deployment uses GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` only; no value is committed.

- [ ] **Step 1: Add failing static contract check**

Add to `test_ui_contract.mjs` an assertion that `live-config.json` exists and contains a string `liveDataBase` property.

- [ ] **Step 2: Verify RED**

Run: `node --test test_ui_contract.mjs`

- [ ] **Step 3: Create `live-config.json` with safe fallback**

Initial committed content:

```json
{"liveDataBase":""}
```

An empty value means same-origin GitHub JSON fallback. After the Worker is deployed, replace this with the exact `https://global-events-live.<account-subdomain>.workers.dev` URL returned by Wrangler; the deployment step must never guess the subdomain.

- [ ] **Step 4: Add Worker deployment workflow**

Create `deploy-worker.yml` triggered by `workflow_dispatch` and push to `main` when files under `worker/**` change. Use `cloudflare/wrangler-action@v3` with the two GitHub secrets and `workingDirectory: worker`.

- [ ] **Step 5: Update README**

Document: GitHub Pages frontend, Cloudflare Worker minute cron, one-time Cloudflare secret setup, exact nine ticker instruments, News/NIFTY-in-news behavior, fallback semantics, and that free-tier policies can change.

- [ ] **Step 6: Verify GREEN**

Run full validation:

```bash
python -m unittest discover -p "test_*.py" -v
node --test test_*.mjs
node --check app.js
node --check worker/src/index.mjs
python -m py_compile *.py
```

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/verify-v3.yml .github/workflows/deploy-worker.yml README.md live-config.json test_ui_contract.mjs
git commit -m "ci: deploy minute market worker"
```

---

### Task 12: End-to-end verification and production integration

**Files:**
- No production code unless verification exposes a failing requirement.

**Interfaces:**
- Final merge target: `main`.
- Public frontend: `https://capitallooser.github.io/global-events/`.

- [ ] **Step 1: Run the complete suite from a clean branch head**

```bash
python -m unittest discover -p "test_*.py" -v
node --test test_*.mjs
node --check app.js
node --check worker/src/index.mjs
python -m py_compile *.py
```

Expected: all PASS with no syntax errors.

- [ ] **Step 2: Verify UI contract statically**

Confirm:
- no GIFT Nifty or TradingView code remains;
- ticker contains all nine required instruments including WTI crude;
- News tab and NIFTY 50 sections exist;
- all existing event filters still exist;
- refresh interval is `60000` only.

- [ ] **Step 3: Push feature branch and require green GitHub Actions**

Do not merge on a failing run. Inspect failed step logs rather than guessing.

- [ ] **Step 4: Deploy Worker and capture its exact URL**

Deploy through `deploy-worker.yml` after the user has added `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, or run `npx wrangler deploy` from `worker/` while authenticated. Capture the exact returned workers.dev URL.

- [ ] **Step 5: Write that exact Worker URL into `live-config.json`**

Commit the configuration change, rerun the full verification workflow, then merge to `main`.

- [ ] **Step 6: Verify live GitHub Pages and Worker behavior**

Check two consecutive snapshots at least 60 seconds apart. Verify the Worker `updatedAt` advances, browser content changes without full-page reload, scroll/tab/filter/calendar state remains intact, source failures are isolated, crude appears, no GIFT Nifty appears, and News/NIFTY-in-news populate when qualifying stories exist.

- [ ] **Step 7: Verify historical parity**

Open at least one supported US event, one India event family with available history, and one ECB/BoE event family with available history. Confirm the same historical-impact component renders. For any family lacking enough official history, confirm the UI states `Historical sample not available yet` rather than showing invented statistics.
