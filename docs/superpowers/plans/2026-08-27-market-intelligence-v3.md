# Market Intelligence V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add zero-cost tabs, monthly heat-map calendar, election coverage, live/near-live market strip, expanded historical benchmarks, India/US event intelligence, Telegram alerts, and an in-site market assistant to the existing GitHub Pages dashboard.

**Architecture:** Keep the site static. Scheduled GitHub Actions generate JSON artifacts from free/public sources. Frontend modules read those artifacts and render tabs, calendar, market cards, market movers, alerts guidance, and deterministic AI answers. Optional AI enhancement must always fall back to local structured-data reasoning.

**Tech Stack:** HTML, CSS, vanilla ES modules, Python 3.12, GitHub Pages, GitHub Actions, public HTTP/JSON/HTML sources, Telegram Bot API.

**Spec:** `docs/superpowers/specs/2026-08-27-market-intelligence-v3-design.md`

## Global Constraints
- Recurring cost remains ₹0.
- No paid API keys, database, hosting, server, or required local machine.
- Keep `main` untouched until branch verification succeeds.
- Preserve current event feed and current NIFTY/S&P historical analysis.
- Do not describe delayed/free data as exchange-grade real time.
- Directional historical percentages require at least 8 observations.
- Never commit Telegram credentials.

---

### Task 1: Frontend navigation, ranking and calendar

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Create: `calendar.mjs`
- Create: `test_calendar.mjs`

**Interfaces:**
- Produces `buildMonthModel(events, year, month, impactLookup)` and `rankEvents(events, impactLookup)`.
- Frontend consumes existing `events.json`, `market-impact.json`, and `source-status.json`.

- [ ] Write failing tests for month-grid construction, highest-impact day heat, Top 5 ranking, and impact-first sort.
- [ ] Run `node --test test_calendar.mjs` and verify RED.
- [ ] Implement `calendar.mjs` minimally.
- [ ] Re-run tests and verify GREEN.
- [ ] Replace list/calendar toggle with top-level tabs and full month calendar.
- [ ] Make Overview Top 5 movers and event list default to highest impact.
- [ ] Add responsive day-detail drawer and event detail behavior.
- [ ] Run `node --check app.js` and `node --test test_calendar.mjs`.
- [ ] Commit frontend foundation.

### Task 2: Election coverage and category-aware source health

**Files:**
- Create: `political_events.json`
- Create: `update_political_events.py`
- Create: `test_political_events.py`
- Modify: `.github/workflows/refresh-events.yml`

**Interfaces:**
- `update_political_events.py` produces normalized election events and source statuses.
- Event schema remains compatible with `events.json`, adding optional `eventType`, `electionType`, and `importanceScore`.

- [ ] Write failing tests asserting the 2026-11-03 U.S. federal General Election and India election normalization.
- [ ] Run `python -m unittest test_political_events.py -v` and verify RED.
- [ ] Implement normalization and official-source seed/fetch logic.
- [ ] Verify tests GREEN.
- [ ] Integrate political events into the scheduled refresh without allowing a political-source failure to empty the event feed.
- [ ] Add separate `elections` source status.
- [ ] Validate generated event schema.
- [ ] Commit election coverage.

### Task 3: Zero-cost market price pipeline

**Files:**
- Create: `update_market_prices.py`
- Create: `test_market_prices.py`
- Create: `market-prices.json`
- Create: `.github/workflows/market-prices.yml`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- `market-prices.json` contains `updatedAt`, `instruments`, `sourceHealth`.
- Each instrument includes `key`, `label`, `price`, `change`, `changePct`, `sourceTimestamp`, `sourceName`, `status`.

- [ ] Write failing tests for quote normalization, status/staleness, and unavailable fallback.
- [ ] Verify RED.
- [ ] Implement free-source fetch with per-instrument isolation and cached-value preservation.
- [ ] Verify GREEN.
- [ ] Add scheduled workflow at existing six IST refresh times.
- [ ] Render India/US/Overview market strips with source timestamps.
- [ ] Verify JSON schema and frontend syntax.
- [ ] Commit price pipeline.

### Task 4: Expanded historical benchmark analytics

**Files:**
- Modify: `analyze_market_impact.py`
- Modify: `test_market_impact.py`
- Modify: `.github/workflows/market-impact.yml`

**Interfaces:**
- Preserve existing `market-impact.json` contract while adding `banknifty`, `sensex`, `nasdaq`, `gold`, `usdinr`, and `bitcoin` markets when history is available.

- [ ] Add failing tests for expanded benchmark config, session alignment and minimum sample behavior.
- [ ] Verify RED.
- [ ] Add free historical sources/fallbacks for requested benchmarks.
- [ ] Keep raw price history transient; publish derived statistics only.
- [ ] Verify GREEN and validate generated output.
- [ ] Commit expanded analytics.

### Task 5: Stronger India and US macro event coverage

**Files:**
- Create: `macro_sources.py`
- Create: `test_macro_sources.py`
- Modify: `.github/workflows/refresh-events.yml`

**Interfaces:**
- Normalized events include stable `eventKey` values such as `india_cpi`, `india_wpi`, `india_gdp`, `india_iip`, `us_gdp`.

- [ ] Write failing normalization/parser tests using official-source fixture snippets.
- [ ] Verify RED.
- [ ] Implement RBI/MOSPI/OEA/BEA source adapters with independent failure isolation.
- [ ] Integrate NSE/BSE trading-event and holiday sources where public pages are stable.
- [ ] Verify GREEN and no-empty-feed safeguards.
- [ ] Commit macro-source expansion.

### Task 6: Surprise data model

**Files:**
- Create: `surprises.mjs`
- Create: `test_surprises.mjs`
- Create: `surprises.json`
- Modify: `app.js`

**Interfaces:**
- `calculateSurprise(actual, forecast)` returns absolute and percentage surprise when numeric.
- Event cards consume optional Actual/Forecast/Previous fields.

- [ ] Write failing tests for surprise calculations and nonnumeric/unavailable fields.
- [ ] Verify RED.
- [ ] Implement model and UI.
- [ ] Keep source unavailable state explicit; never infer missing forecasts.
- [ ] Verify GREEN.
- [ ] Commit surprise support.

### Task 7: Deterministic AI Market Assistant

**Files:**
- Create: `market-assistant.mjs`
- Create: `test_market_assistant.mjs`
- Modify: `app.js`
- Modify: `styles.css`

**Interfaces:**
- `answerMarketQuestion(question, context)` returns `{answer, evidence, disclaimer}` from loaded site data.
- Context includes events, market impact, market prices, and surprise data.

- [ ] Write failing tests for tomorrow-risk, weekly-risk, event-impact and benchmark-comparison questions.
- [ ] Verify RED.
- [ ] Implement deterministic intent parsing and evidence-backed answers.
- [ ] Add AI Assistant tab and contextual `Ask AI` buttons on event details.
- [ ] Verify GREEN and ensure answers never claim guaranteed direction.
- [ ] Commit assistant.

### Task 8: Telegram alert engine

**Files:**
- Create: `send_alerts.py`
- Create: `test_alerts.py`
- Create: `alert-state.json`
- Create: `.github/workflows/telegram-alerts.yml`
- Modify: `index.html`
- Modify: `app.js`

**Interfaces:**
- Secrets read only from environment: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- Alert state key = event ID + alert type + event timestamp.

- [ ] Write failing tests for Very High qualification and duplicate suppression.
- [ ] Verify RED.
- [ ] Implement alert selection and state update.
- [ ] Add Telegram send call only when both secrets exist; otherwise workflow exits cleanly with setup guidance.
- [ ] Verify GREEN.
- [ ] Render Alerts tab setup/status guidance without exposing secrets.
- [ ] Commit alert engine.

### Task 9: Full verification and release preparation

**Files:**
- All changed files.

- [ ] Run Python unit tests.
- [ ] Run Node tests and syntax checks.
- [ ] Parse all GitHub Actions YAML.
- [ ] Validate JSON files.
- [ ] Search repository text for accidental Telegram secrets/tokens.
- [ ] Verify the 3 Nov 2026 U.S. election is in the generated/seed political feed.
- [ ] Verify calendar month view, India/US filters, Top 5 ranking, AI fallback, and market unavailable states.
- [ ] Review branch diff before merging to `main`.