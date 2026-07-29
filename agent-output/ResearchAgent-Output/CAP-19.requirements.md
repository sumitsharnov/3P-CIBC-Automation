# CAP-19 — Financial Overview Dashboard

**Type:** story · **Source:** jira · **URL:** https://3pillarglobal.atlassian.net/browse/CAP-19

## Summary

After logging in, a customer should land on a dashboard that summarizes their overall financial position at a glance, combining headline numbers (like total balance) with visual breakdowns of how money is flowing in and out, where it's being spent by category, and how their investment portfolio is allocated and performing — all without needing to open individual accounts. The ticket notes this is an existing, already-built feature being documented, and that all displayed figures come from the customer's seeded demo data rather than a live financial feed.

## Acceptance Criteria

| ID | Testable | Text |
|----|----------|------|
| AC-1 | ✅ | Dashboard displays key stat tiles (e.g. total balance across accounts). |
| AC-2 | ✅ | Cash flow trend over time is shown as a chart. |
| AC-3 | ✅ | Spending by category is visualized. |
| AC-4 | ✅ | Portfolio allocation and investment performance are visualized. |

## Requirements

| ID | Type | Related AC | Text |
|----|------|-----------|------|
| REQ-1 | functional | AC-1 | 'Total balance' stat tile = sum across all accounts. |
| REQ-2 | functional | AC-1 | 'Net cash flow' tile = money in − money out, with in/out breakdown, styled positive/negative. |
| REQ-3 | functional | AC-1 | 'Investment gain/loss' tile = market value − cost basis, plus % gain, styled positive/negative. |
| REQ-4 | functional | AC-1 | Credit utilization meter tile (when a Credit Card account exists): % used, amount-of-limit caption, severity-colored bar. |
| REQ-5 | functional | AC-2 | Cash flow chart: money in/out per date, bars above/below baseline, scoped to selected account filter. |
| REQ-6 | functional | AC-2 | Cash flow chart shows a summary line with total in/out for the current scope. |
| REQ-7 | functional | — | Account-scope filter chips ('All accounts' + per-account) re-scope both the cash flow and category-spend charts. |
| REQ-8 | functional | AC-3 | Spend-by-category aggregates only outgoing transactions (excludes Income/Transfer/Payment), sorted descending, with % of total per category. |
| REQ-9 | functional | AC-4 | Portfolio allocation donut: each holding's market value as % of total, with a legend. |
| REQ-10 | functional | AC-4 | Investment performance dumbbell chart: cost basis vs. market value per holding, plus gain %. |
| REQ-11 | non-functional | — | All figures come from seeded demo data, never a live/external feed. |
| REQ-12 | functional | — | Dashboard shows a loading state until account/transaction/holdings data resolves, before rendering tiles/charts. |

## Edge Cases

- **EC-1** — Selected account scope has zero transactions. _`CashFlowChart` has an explicit "No transactions in this view." empty-state branch the ticket never mentions._ → REQ-5
- **EC-2** — Scope has transactions, but all fall into excluded categories (Income/Transfer/Payment). _`CategorySpendChart` has its own distinct empty-state, different from EC-1's — easy to conflate the two._ → REQ-8
- **EC-3** — Holdings sum to zero total market value. _`PortfolioDonut` guards divide-by-zero by defaulting to 0%; untested, this guard could silently regress into NaN%._ → REQ-9
- **EC-4** — Credit card balance at/over its limit (100%+ utilization). _Display caps at 100% and switches to the highest severity color band at ≥90%._ → REQ-4
- **EC-5** — Net cash flow or investment gain exactly zero. _Both tiles use a `>= 0` check for "positive" styling — the exact zero boundary is where an off-by-one sign error would first show, and the ticket gives no guidance on break-even styling._ → REQ-2, REQ-3
- **EC-6** — A holding has cost basis of 0 (e.g. gifted position). _Both the stat tile and the dumbbell chart guard this divide-by-zero by defaulting to 0% — if the guard regresses, expect a thrown error or NaN/Infinity._ → REQ-3, REQ-10
- **EC-7** — No Credit Card account at all. _The credit tile is conditionally rendered; the ticket never mentions it, so there's no explicit contract for the stat-tile row's layout without it._ → REQ-4
- **EC-8** — Customer filters to a single account. _Filtering only affects the cash-flow/spend charts — total balance, investment gain, and credit tiles stay computed from ALL accounts regardless of the chip selected. This split isn't documented anywhere and could surprise a tester expecting the whole page to scope down._ → REQ-7

## Open Ambiguities

- **Q-1** — 🟢 not blocking — Does "seeded demo data, not a live feed" need to be verified as an absence of live network calls, or just that displayed values match the known mock dataset? _Impact: could lead to either under-testing (no dependency check at all) or over-testing (network-interception assertions nobody asked for)._
- **Q-2** — 🟢 not blocking — AC-1 only names "total balance" as an example tile, but the page also renders Net cash flow, Investment gain/loss, and a conditional Credit tile. Which of these are contractual vs. incidental? _Impact: Design Agent may under- or over-assert on tiles the ticket never explicitly committed to._
- **Q-3** — 🟢 not blocking — AC-4 bundles portfolio allocation + investment performance into one criterion, but they're two separate chart components in two separate sections. One combined test or two independent ones? _Impact: affects whether a regression in just one chart should count as breaking this AC._
- **Q-4** — 🟢 not blocking — The account-scope filter chips aren't mentioned anywhere in the ticket, despite being core implemented behavior. In scope for this ticket's coverage, or a separate untracked feature? _Impact: could leave real interactive behavior completely untested, or test something the ticket never asked for._
- **Q-5** — 🔴 **BLOCKING** — The ticket is labeled "documentation" and implies the dashboard is an existing, already-shipped feature — but `Dashboard.test.jsx` today only covers the heading and the three always-rendered stat-tile labels, with zero coverage of any chart, the credit meter, or the scope filter. Is this ticket meant to close that coverage gap with new automated tests (REQ-1 through REQ-12 and the edge cases above), or is it purely a retroactive-documentation exercise with no expectation that new test code gets written at all? _Impact: determines the entire scope of what Design/Code Agents should build — guessed wrong, the pipeline either spends significant effort on unwanted work, or the ticket closes with its actual coverage gap still wide open._

**Gate status:** 🔴 blocked on Q-5 — do not proceed to Design Agent until answered.

## Target Area

**Pages:** Dashboard

Verified directly against `Dashboard.jsx`, `Dashboard.test.jsx`, and every chart component it imports under `src/components/charts/`: `StatTile`, `CashFlowChart`, `CategorySpendChart`, `PortfolioDonut`, `PerformanceDumbbell`, `ChartTooltip`. Confirmed via `AccountsContext.jsx` and `data.js` that all figures derive from an in-app seeded dataset via a mock `accountsApi`, matching the ticket's "not a live feed" note. Existing `Dashboard.test.jsx` coverage: heading + the three always-rendered stat-tile labels only — no coverage of charts, credit meter, scope filter, or any edge case above.

---
*Generated from `CAP-19.requirements.json` — that file is the canonical machine-readable artifact consumed by the Design Agent; this file is a human-readable rendering of the same data. This is a clean, schema-validated agent run (re-run after the schema fix) — no hand-editing of content, only the cosmetic fix of one `&gt;=` → `>=` HTML-entity leak in EC-5's text.*
