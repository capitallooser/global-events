# Market Intelligence V3 Design

## Goal
Upgrade the existing zero-cost GitHub Pages market-event site into a multi-tab market intelligence dashboard without introducing any recurring paid dependency.

## Hard constraints
- Recurring cost remains ₹0.
- GitHub Pages remains the public host.
- GitHub Actions performs scheduled cloud refreshes.
- No paid API keys, database, server, or required local machine.
- Free/public sources only; unavailable sources must fail visibly rather than silently switching to paid data.
- Historical market statistics are descriptive, not forecasts or guarantees.

## Navigation
Top-level tabs: Overview, Calendar, India, US, Global, Market Movers, AI Assistant, Alerts.

## Overview
Show freshness/source health, a compact market strip, Top 5 Upcoming Market Movers, and the highest-impact upcoming event list. Default event sorting is highest historical market impact, then event importance, then date.

## Calendar / heat map
Provide a month grid similar to a desktop calendar. Default to High + Very High market-relevant events. Each day shows compact event chips and a heat level derived primarily from the strongest event on that day, with event count as a secondary factor. Clicking a day opens all events for that date; clicking an event opens a detailed market-impact view. Month navigation and mobile-friendly behavior are required.

## Election coverage
Election data is first-class market-event data.

United States coverage includes presidential elections, federal general/midterm elections, congressional/senate special elections, material gubernatorial elections, runoffs, and market-relevant primaries. The 3 November 2026 U.S. federal General Election is mandatory and sourced from the Federal Election Commission.

India coverage includes Lok Sabha elections, State Assembly elections, by-elections, polling dates, and counting/result dates. Primary sources are the Election Commission of India and official state election sources where required. Election source health is tracked separately.

Major global elections can be included when an official/reliable public schedule exists and they are materially market relevant.

## Market prices
Display last available values for NIFTY 50, Bank NIFTY, Sensex, GIFT Nifty, USD/INR, S&P 500, Nasdaq, Gold, and Bitcoin. Every quote shows its source timestamp and state: Live, Delayed, Last available, or Unavailable. Free-source data must not be described as exchange-grade real time unless it truly is.

## Historical impact
Expand benchmark reaction statistics beyond NIFTY 50 and S&P 500 to Bank NIFTY, Sensex, Nasdaq, Gold, USD/INR, and Bitcoin where free history is reliably available. Preserve the minimum directional sample size of 8. Event/session alignment must account for announcement timing and market hours.

## India event intelligence
Strengthen RBI coverage and add India CPI, WPI, GDP, IIP, NSE/BSE holidays and material trading events, major government budget dates, and India election dates. Prefer RBI, MOSPI, Office of Economic Adviser/Commerce Ministry, NSE, BSE, ECI and other official government sources.

## US event intelligence
Maintain FOMC, CPI, PPI, Employment Situation/NFP, JOLTS and ECI, and add BEA GDP where a reliable public schedule is available.

## Surprise data
Where a reliable free/public source exposes it, normalize Actual, Forecast, Previous, unit, and surprise. Do not convert surprise directly into Buy/Sell. Instead show the raw surprise and, when statistically supported, historical reactions to comparable releases.

## Telegram alerts
Use GitHub Actions and GitHub Secrets only. Secrets: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID. Send Very High Impact reminders and later surprise alerts. Prevent duplicates with a committed alert-state.json keyed by event ID + alert type + event timestamp. Never commit credentials.

## AI Market Assistant
Provide an in-site Ask Market AI experience. The assistant must first answer from the site's structured data: events, market-impact statistics, market prices, surprise data and source health. It must cite the evidence it used inside the answer (sample size, historical frequencies, timestamps).

The zero-cost baseline is deterministic/local reasoning that works without an LLM. Optional free-tier LLM enhancement may be added only if it has a hard no-billing path and graceful fallback. The site must remain useful if the AI free quota is unavailable.

Examples: What can affect NIFTY tomorrow? What are the biggest risks this week? Compare NIFTY vs S&P reaction to FOMC. Which event this month has the highest impact? What historically happens when CPI surprises higher?

## Failure isolation
Each source is independent. Preserve the last successful cached output when safe, mark stale sources clearly, and never replace a useful dataset with an empty one.

## Success criteria
- Working tabs and responsive layout.
- Full monthly calendar with click-through day/event details.
- 3 Nov 2026 U.S. federal election appears.
- Indian election coverage is present as a core category.
- Top 5 movers and default impact sorting work.
- Market strip supports all requested instruments or clearly shows unavailable state.
- Expanded benchmark analytics are generated where data is available.
- India CPI/WPI/GDP/IIP and election sources are represented.
- Telegram alerts are zero-cost and deduplicated.
- AI assistant works from local structured data even without an external LLM.
- Existing site functionality and historical NIFTY/S&P analysis remain intact.