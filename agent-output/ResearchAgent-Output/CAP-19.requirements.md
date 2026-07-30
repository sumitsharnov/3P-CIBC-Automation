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
| REQ-1 | functional | AC-1 | The dashboard displays a 'Total balance' stat tile showing the sum of balances across all of the customer's accounts. |
| REQ-2 | functional | AC-1 | The dashboard displays a 'Net cash flow' stat tile showing net amount (money in minus money out) along with a breakdown of total money in and total money out, styled as positive or negative. |
| REQ-3 | functional | AC-1 | The dashboard displays an 'Investment gain/loss' stat tile showing the dollar gain/loss (current market value minus cost basis across holdings) and the gain/loss as a percentage, styled as positive or negative. |
| REQ-4 | functional | AC-1 | When the customer has a Credit Card type account, the dashboard displays a credit utilization meter tile showing percentage of credit limit used, an amount-used-of-limit caption, and a severity-colored progress bar. |
| REQ-5 | functional | AC-2 | The dashboard displays a cash flow chart plotting money in and money out per date, using bars above/below a baseline, scoped to the currently selected account filter. |
| REQ-6 | functional | AC-2 | The cash flow chart displays a summary line with total money in and total money out for the currently displayed date range/scope. |
| REQ-7 | functional | — | The customer can filter the cash flow and spending-by-category data by account using an 'All accounts' chip plus one chip per account, and the charts update to reflect only the selected account's transactions. |
| REQ-8 | functional | AC-3 | The spending-by-category visualization aggregates only outgoing (negative-amount) transactions, excluding Income, Transfer, and Payment categories, and sorts categories by amount descending with a percentage-of-total shown per category. |
| REQ-9 | functional | AC-4 | The dashboard displays a portfolio allocation donut chart showing each holding's market value as a percentage of total portfolio market value, with a legend listing each holding's name and value. |
| REQ-10 | functional | AC-4 | The dashboard displays an investment performance chart (dumbbell-style) showing, per holding, cost basis versus current market value and the resulting gain/loss percentage. |
| REQ-11 | non-functional | — | All figures shown on the dashboard (balances, cash flow, spending, portfolio, performance) are computed from the customer's seeded demo dataset rather than a live/external data feed. |
| REQ-12 | functional | — | The dashboard does not render its stat tiles or charts until the customer's account, transaction, and holdings data has finished loading, showing a loading state in the interim. |

## Edge Cases

- **EC-1** — Selected account scope has zero transactions in it. → REQ-5
  _Rationale: CashFlowChart has an explicit empty-state branch ('No transactions in this view.') that the ticket never calls out; if untested, a regression could silently break the empty case (e.g. render a broken/empty SVG instead)._
- **EC-2** — Selected account scope has transactions, but all of them fall into excluded categories (Income, Transfer, Payment), leaving zero spend to visualize. → REQ-8
  _Rationale: CategorySpendChart has a distinct empty-state branch ('No spending in this view.') driven by the exclusion filter; this is easy to miss since it differs from the raw 'zero transactions' case in EC-1._
- **EC-3** — Customer holdings sum to zero total market value. → REQ-9
  _Rationale: PortfolioDonut guards division-by-zero by defaulting segment percentage to 0, but this path (all segments 0%, empty-looking donut) is not exercised by any stated AC and could silently render NaN% if the guard regresses._
- **EC-4** — Credit card balance is at or exceeds the credit limit (100%+ utilization). → REQ-4
  _Rationale: CreditMeter explicitly caps the displayed percentage at 100 and switches to the highest severity color band at 90%+; without a test at/over the boundary, the cap or color threshold could silently break._
- **EC-5** — Net cash flow or investment gain/loss is exactly zero. → REQ-2, REQ-3
  _Rationale: Both stat tiles decide 'positive' styling using a >= 0 comparison; the zero boundary is where an off-by-one sign error (e.g. treating 0 as negative) would first surface, and the ticket gives no guidance on how a break-even state should look._
- **EC-6** — A holding has a cost basis of 0 (e.g. gifted or newly transferred position). → REQ-3, REQ-10
  _Rationale: Both the dashboard's investment gain percentage calculation and PerformanceDumbbell's per-holding gain percentage guard against division by zero by defaulting to 0%; if that guard is removed the page would throw or show Infinity/NaN._
- **EC-7** — Customer has no Credit Card type account at all. → REQ-4
  _Rationale: The credit utilization tile is conditionally rendered only when a Credit Card account exists; the ticket doesn't mention this tile at all, so there's no explicit contract for what the stat-tile row should look like without it (fewer tiles vs. reflowed grid)._
- **EC-8** — Customer filters to a single account via the scope chips. → REQ-7
  _Rationale: Filtering only affects the cash flow and spending-by-category charts (scopedTransactions); the total balance, investment gain/loss, and credit utilization tiles remain computed from all accounts regardless of the chip selected. This split behavior isn't documented anywhere and could confuse a tester expecting the whole dashboard to scope down._

## Open Ambiguities

- **Q-1** — 🟢 not blocking — The ticket's note says figures are computed from 'seeded demo data, not a live feed,' but doesn't say whether this needs to be verified as an absence of live network calls (e.g. asserting no external API requests are made) or simply that displayed values match the known mock dataset.
  _Impact: Downstream test design could either under-test (never confirming there's no live dependency) or over-test (adding network-interception assertions the ticket never asked for) depending on which interpretation is chosen._
- **Q-2** — 🟢 not blocking — AC-1 only names 'total balance' as an example stat tile, but the implementation also renders Net cash flow, Investment gain/loss, and a conditional Credit utilization tile. The ticket doesn't state which of these are required contractual behavior for this feature versus incidental implementation choices.
  _Impact: The Design Agent won't know whether to write test cases asserting all four tiles are present and correct, or only total balance, risking either gaps in coverage or brittle tests tied to details the ticket never committed to._
- **Q-3** — 🟢 not blocking — AC-4 bundles 'portfolio allocation' and 'investment performance' into a single criterion, but they are two separate chart components (PortfolioDonut, PerformanceDumbbell) in two separate page sections. It's unclear whether the ticket intends these as one inseparable acceptance test or two independently verifiable ones.
  _Impact: Affects whether a future change to just one of the two charts should be treated as breaking this ticket's AC or as an unrelated, independently-testable change._
- **Q-4** — 🟢 not blocking — The account-scope filter chips ('All accounts' plus per-account chips) that affect the cash flow and spending charts are not mentioned anywhere in the ticket's description or ACs, despite being a core piece of implemented dashboard behavior.
  _Impact: Without clarification, it's ambiguous whether this filtering behavior is in scope for this ticket's test coverage (and should get its own requirements/tests) or belongs to a separate, not-yet-written ticket and should be left untested here._
- **Q-5** — 🔵 **ANSWERED** (was blocking) — The ticket is labeled 'documentation' and its own text implies the dashboard is an existing, already-shipped feature — but Dashboard.test.jsx today only covers the heading and the three always-rendered stat-tile labels, with zero coverage of any chart, the credit meter, or the scope filter. Is this ticket meant to close that coverage gap by having new automated tests written (REQ-1 through REQ-12, and the edge cases above), or is it purely a retroactive-documentation exercise with no expectation that new test code gets written at all?
  _Impact: This determines the entire scope of what the Design/Code Agents should build. Guessed wrong in one direction, the pipeline spends significant effort writing a full test suite nobody asked for; guessed wrong in the other, the ticket closes with the exact coverage gap it may have been opened to fix still wide open._
  > **Answer** (Sumit Kumar1, 2026-07-29): Yes — this ticket is meant to close the coverage gap. Write new automated tests for REQ-1 through REQ-12 and the edge cases identified (EC-1 through EC-8). The 'documentation' label reflects that the Financial Overview Dashboard feature itself is already built and stable, not that no new test work is wanted — the reason this ticket exists in the pipeline at all is to add missing automated coverage for an existing, currently under-tested feature. Design Agent should treat the full requirements baseline as in scope for new test authoring, not just a documentation pass.

**Gate status:** 🟢 all blocking ambiguities resolved — clear to proceed to Design Agent.

## Target Area

**Pages:** Dashboard

Verified directly against C:\Users\sumit.kumar1\Documents\bank-app-1\src\pages\Dashboard.jsx, src\pages\Dashboard.test.jsx, and the chart components it imports under src\components\charts\: StatTile, CashFlowChart, CategorySpendChart, PortfolioDonut, PerformanceDumbbell, ChartTooltip. Confirmed via src\context\AccountsContext.jsx and src\data.js that all figures derive from an in-app seeded dataset (accounts/transactions/holdings arrays) fetched through a mock accountsApi, matching the ticket's 'not a live feed' note. The existing Dashboard.test.jsx only asserts the heading and the three always-rendered stat tiles' labels; it does not cover the charts, the credit meter, the scope filter, or any of the edge cases listed above.

---
*Generated from `CAP-19.requirements.json` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*
