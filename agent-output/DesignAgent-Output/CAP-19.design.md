# CAP-19 — Test Plan: Financial Overview Dashboard

**Built from:** `agent-output/ResearchAgent-Output/CAP-19.requirements.json`
**Answers file applied:** Yes

**Coverage:** 12/12 requirements covered, 8/8 edge cases covered, 0 out of scope.

## Assumptions

- **A-1** (from Q-1) — Interpreted REQ-11 ('seeded demo data, not a live feed') narrowly: verified by confirming displayed figures match the known static seed dataset (SC-1 and the other happy-path scenarios' exact-value assertions), not by adding network-interception assertions that assert the absence of external HTTP calls. The ticket never asked for transport-layer verification, and accountsApi.js already routes everything through localStorage, not fetch.
- **A-2** (from Q-2) — Treated all four stat tiles named at REQ level (Total balance, Net cash flow, Investment gain/loss, Credit utilization) as contractual and testable, not just the 'total balance' example named in AC-1 text, since the requirements baseline explicitly promoted all four to individual REQ-1..REQ-4 entries.
- **A-3** (from Q-3) — Treated the portfolio allocation donut (REQ-9) and investment performance dumbbell (REQ-10) as two independently verifiable scenarios (SC-7, SC-9) rather than one inseparable AC-4 test, since they are genuinely separate components/sections and the baseline gave them separate REQ IDs.
- **A-4** (from Q-4) — Included the account scope filter chips (REQ-7) and their split-scoping behavior (EC-8) as in-scope test coverage for this ticket, since the requirements baseline promoted this implemented behavior to REQ-7 despite the original ticket text not mentioning it.
- **A-5** (new) — None of EC-1, EC-2, EC-3, EC-4, EC-5, EC-6, or EC-7 are reachable through the shipped default seed data (src/data.js, persisted via src/api/accountsApi.js's localStorage 'app-bank-state' v2 contract) — every seeded account has non-excluded-category transactions, every holding has a positive cost basis, and utilization sits at ~24%. A new fixtures/seedData.ts is assumed necessary to inject custom state into localStorage ahead of navigation for those seven scenarios; only EC-8 (single-account filtering) is reachable with the default seed.
- **A-6** (new) — Planned all locators directly from Read/Grep against src/pages/Dashboard.jsx and src/components/charts/{StatTile,CashFlowChart,CategorySpendChart,PortfolioDonut,PerformanceDumbbell,ChartTooltip}.jsx rather than via Helix, since this ticket explicitly required opening those chart internals myself and none of them expose data-testid attributes — locators must rely on visible label text, aria-label strings, and ARIA roles (role='meter', role='img', role='group', role='tooltip') documented in the scenario steps above. Helix's graph (ingested for bank-app structure) was not queried for this plan since no cross-file relationship question was needed beyond what direct source reads already answered.

## Out of Scope

_None — everything in the baseline is covered by a scenario._

## Scenarios

| ID | Title | Type | Tags | Covers AC | Covers REQ | Covers EC |
|----|-------|------|------|-----------|------------|-----------|
| SC-1 | Dashboard shows total balance, net cash flow, and investment gain/loss stat tiles from seeded data | happy-path | @dashboard @stat-tiles | AC-1 | REQ-1, REQ-2, REQ-3, REQ-11 | — |
| SC-2 | Dashboard shows a credit utilization tile when the customer holds a Credit Card account | happy-path | @dashboard @credit-meter | AC-1 | REQ-4 | — |
| SC-3 | Cash flow chart plots money in/out per date with a totals summary for All accounts | happy-path | @dashboard @cash-flow | AC-2 | REQ-5, REQ-6 | — |
| SC-4 | Cash flow chart shows an empty state when the selected account scope has zero transactions | boundary | @dashboard @cash-flow @edge-case | — | REQ-5 | EC-1 |
| SC-5 | Spending-by-category chart aggregates outgoing transactions excluding Income, Transfer, and Payment, sorted by amount descending | happy-path | @dashboard @spend-by-category | AC-3 | REQ-8 | — |
| SC-6 | Spending-by-category chart shows an empty state when every transaction in scope is an excluded category | boundary | @dashboard @spend-by-category @edge-case | — | REQ-8 | EC-2 |
| SC-7 | Portfolio allocation donut shows each holding's share of total market value with a matching legend | happy-path | @dashboard @portfolio-donut | AC-4 | REQ-9 | — |
| SC-8 | Portfolio allocation donut degrades gracefully when total holdings market value is zero | boundary | @dashboard @portfolio-donut @edge-case | — | REQ-9 | EC-3 |
| SC-9 | Investment performance dumbbell shows cost basis vs. current value and gain/loss percentage per holding | happy-path | @dashboard @performance-dumbbell | AC-4 | REQ-10 | — |
| SC-10 | Investment gain/loss tile and performance dumbbell guard against divide-by-zero when a holding has a zero cost basis | boundary | @dashboard @performance-dumbbell @stat-tiles @edge-case | — | REQ-3, REQ-10 | EC-6 |
| SC-11 | Credit utilization meter caps at 100% and shows the highest-severity color when balance meets or exceeds the credit limit | boundary | @dashboard @credit-meter @edge-case | AC-1 | REQ-4 | EC-4 |
| SC-12 | Net cash flow and investment gain/loss tiles style exactly-zero values as positive | boundary | @dashboard @stat-tiles @edge-case | AC-1 | REQ-2, REQ-3 | EC-5 |
| SC-13 | Dashboard omits the credit utilization tile entirely when the customer has no Credit Card account | boundary | @dashboard @credit-meter @edge-case | AC-1 | REQ-4 | EC-7 |
| SC-14 | Filtering by account scope updates the cash flow and spending charts only, leaving balance-wide tiles unchanged | boundary | @dashboard @scope-filter | — | REQ-7 | EC-8 |
| SC-15 | Dashboard shows a loading state and defers rendering tiles/charts until account, transaction, and holdings data has loaded | happy-path | @dashboard @loading-state | — | REQ-12 | — |

## Scenario Details

### SC-1 — Dashboard shows total balance, net cash flow, and investment gain/loss stat tiles from seeded data

_Type: happy-path · Tags: @dashboard @stat-tiles_

- Given I am signed on as the demo customer and have navigated to the dashboard
- When the dashboard finishes loading
- Then the 'Total balance' tile shows the sum of the seeded accounts' balances with the caption 'Across all accounts'
- And the 'Net cash flow' tile shows net amount (money in minus money out) with a delta line '{moneyIn} in / {moneyOut} out' styled as positive (up-arrow) since the seeded net flow is positive
- And the 'Investment gain/loss' tile shows the dollar gain (current market value minus cost basis) and the gain percentage, styled as positive (up-arrow) since the seeded portfolio is up
- And these figures match the known seeded dataset values exactly, confirming they are not sourced from a live feed

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `pages/LoginPage.ts`, `fixtures/pages.ts`

### SC-2 — Dashboard shows a credit utilization tile when the customer holds a Credit Card account

_Type: happy-path · Tags: @dashboard @credit-meter_

- Given I am signed on as the demo customer and have navigated to the dashboard
- When the dashboard finishes loading
- Then a 'Credit utilization' tile is shown with the percentage of the seeded credit card's limit used (balance / creditLimit)
- And the tile's meter (role='meter', aria-label='Credit utilization') reports the same percentage via aria-valuenow
- And the caption reads '{used} used of {limit}' in CAD currency format
- And, since seeded utilization is below 70%, the progress bar is rendered in the low-severity ('brand') color

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-3 — Cash flow chart plots money in/out per date with a totals summary for All accounts

_Type: happy-path · Tags: @dashboard @cash-flow_

- Given I am signed on as the demo customer and have navigated to the dashboard
- And the 'All accounts' scope chip is selected by default
- When the dashboard finishes loading
- Then the cash flow chart renders one bar per distinct transaction date, above the baseline for net-positive days and below for net-negative days, each bar exposing an aria-label '{date}: {signed amount}'
- And a summary line below the chart shows total money in and total money out for all seeded transactions, matching the seeded dataset

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-4 — Cash flow chart shows an empty state when the selected account scope has zero transactions

_Type: boundary · Tags: @dashboard @cash-flow @edge-case_

- Given the seeded dataset is overridden so one account has zero associated transactions
- And I am signed on as the demo customer and have navigated to the dashboard
- When I select that account's scope chip
- Then the cash flow chart renders no SVG bars and instead shows the text 'No transactions in this view.'

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/seedData.ts`

### SC-5 — Spending-by-category chart aggregates outgoing transactions excluding Income, Transfer, and Payment, sorted by amount descending

_Type: happy-path · Tags: @dashboard @spend-by-category_

- Given I am signed on as the demo customer and have navigated to the dashboard
- When the dashboard finishes loading with the 'All accounts' scope selected
- Then the spending-by-category list contains only categories from negative-amount transactions, excluding any Income, Transfer, or Payment category
- And the categories are ordered from highest total amount to lowest
- And focusing or hovering a category row reveals its percentage of total spending, matching amount divided by total spend

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-6 — Spending-by-category chart shows an empty state when every transaction in scope is an excluded category

_Type: boundary · Tags: @dashboard @spend-by-category @edge-case_

- Given the seeded dataset is overridden so one account's transactions are all categorized as Income, Transfer, or Payment
- And I am signed on as the demo customer and have navigated to the dashboard
- When I select that account's scope chip
- Then the spending-by-category area shows no category rows and instead shows the text 'No spending in this view.'

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/seedData.ts`

### SC-7 — Portfolio allocation donut shows each holding's share of total market value with a matching legend

_Type: happy-path · Tags: @dashboard @portfolio-donut_

- Given I am signed on as the demo customer and have navigated to the dashboard
- When the dashboard finishes loading
- Then the portfolio donut renders one segment per seeded holding, each exposing an aria-label '{holding name}: {value}, {pct}%' where pct = holding value divided by total holdings value
- And the center label shows total portfolio market value
- And the legend below lists every holding's name and value, matching the segments

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-8 — Portfolio allocation donut degrades gracefully when total holdings market value is zero

_Type: boundary · Tags: @dashboard @portfolio-donut @edge-case_

- Given the seeded dataset is overridden so all holdings have a market value of 0
- And I am signed on as the demo customer and have navigated to the dashboard
- When the dashboard finishes loading
- Then every donut segment's aria-label reports 0% (not NaN% or Infinity%)
- And the center label shows $0.00 as the total market value
- And the legend still lists each holding by name with a $0.00 value

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/seedData.ts`

### SC-9 — Investment performance dumbbell shows cost basis vs. current value and gain/loss percentage per holding

_Type: happy-path · Tags: @dashboard @performance-dumbbell_

- Given I am signed on as the demo customer and have navigated to the dashboard
- When the dashboard finishes loading
- Then the investment performance section renders one row per seeded holding, each exposing an aria-label '{holding name}: cost basis {costBasis}, current value {value}, {gain|loss} {absolute gain}'
- And each row displays a gain/loss percentage matching (value - costBasis) divided by costBasis, styled positive for gains and negative for losses

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-10 — Investment gain/loss tile and performance dumbbell guard against divide-by-zero when a holding has a zero cost basis

_Type: boundary · Tags: @dashboard @performance-dumbbell @stat-tiles @edge-case_

- Given the seeded dataset is overridden so one holding has a cost basis of 0 and a positive market value
- And I am signed on as the demo customer and have navigated to the dashboard
- When the dashboard finishes loading
- Then that holding's row in the performance dumbbell shows a gain/loss percentage of 0% rather than Infinity or NaN
- And if that holding is the only one driving the overall portfolio cost basis to 0, the 'Investment gain/loss' stat tile also shows 0% rather than Infinity or NaN

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/seedData.ts`

### SC-11 — Credit utilization meter caps at 100% and shows the highest-severity color when balance meets or exceeds the credit limit

_Type: boundary · Tags: @dashboard @credit-meter @edge-case_

- Given the seeded dataset is overridden so the credit card account's outstanding balance equals or exceeds its credit limit
- And I am signed on as the demo customer and have navigated to the dashboard
- When the dashboard finishes loading
- Then the 'Credit utilization' tile displays exactly 100% (not more) even though the raw ratio exceeds 100%
- And the meter's progress bar is rendered in the highest-severity color band (>=90%)

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/seedData.ts`

### SC-12 — Net cash flow and investment gain/loss tiles style exactly-zero values as positive

_Type: boundary · Tags: @dashboard @stat-tiles @edge-case_

- Given the seeded dataset is overridden so total money in equals total money out (net cash flow = 0) and total holdings market value equals total cost basis (investment gain/loss = 0)
- And I am signed on as the demo customer and have navigated to the dashboard
- When the dashboard finishes loading
- Then the 'Net cash flow' tile shows $0.00 styled as positive (up-arrow), not negative
- And the 'Investment gain/loss' tile shows +$0.00 (0.0% overall) styled as positive (up-arrow), not negative

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/seedData.ts`

### SC-13 — Dashboard omits the credit utilization tile entirely when the customer has no Credit Card account

_Type: boundary · Tags: @dashboard @credit-meter @edge-case_

- Given the seeded dataset is overridden so no account is of type 'Credit Card'
- And I am signed on as the demo customer and have navigated to the dashboard
- When the dashboard finishes loading
- Then no 'Credit utilization' tile or meter is rendered anywhere on the page
- And the 'Total balance', 'Net cash flow', and 'Investment gain/loss' tiles are still shown

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/seedData.ts`

### SC-14 — Filtering by account scope updates the cash flow and spending charts only, leaving balance-wide tiles unchanged

_Type: boundary · Tags: @dashboard @scope-filter_

- Given I am signed on as the demo customer and have navigated to the dashboard
- And I note the current values of the 'Total balance', 'Investment gain/loss', and 'Credit utilization' tiles
- When I select a single account's scope chip (e.g. the seeded credit card account) instead of 'All accounts'
- Then the cash flow chart and spending-by-category chart update to reflect only that account's transactions
- And the 'Total balance', 'Investment gain/loss', and 'Credit utilization' tiles remain unchanged from their all-accounts values
- And the selected chip is visually marked active while 'All accounts' and the other chips are not

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-15 — Dashboard shows a loading state and defers rendering tiles/charts until account, transaction, and holdings data has loaded

_Type: happy-path · Tags: @dashboard @loading-state_

- Given I am signed on as the demo customer
- When I navigate directly to the dashboard before the simulated data fetch resolves
- Then a loading indicator ('Loading your accounts…') is shown instead of any stat tile or chart
- When the data fetch resolves
- Then the loading indicator disappears and the stat tiles and charts render with their seeded values

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

## Reuse (plan-wide)

| Path | Kind | Why |
|------|------|-----|
| `pages/BasePage.ts` | page-object | Provides the shared open(path) navigation helper and currentUrl() accessor that DashboardPage should extend, matching the convention already used by LoginPage and AccountsPage. |
| `pages/LoginPage.ts` | page-object | Every dashboard scenario needs to reach an authenticated session first; LoginPage.goto()/signOn() is the existing, working path to get there rather than duplicating sign-on logic in a new page object. |

## New Artifacts (plan-wide)

| Path | Kind | Mode | Purpose |
|------|------|------|---------|
| `pages/DashboardPage.ts` | page-object | create | Encapsulate all dashboard interactions and assertions: reading stat tile label/value/delta text (Total balance, Net cash flow, Investment gain/loss), reading the CreditMeter's percentage/aria-valuenow/caption/severity color, selecting scope chips by account name or 'All accounts', reading cash flow chart bar aria-labels and the money-in/out summary line (or its empty-state text), reading spending-by-category rows (name, amount, hover/focus-revealed percentage) or its empty-state text, reading portfolio donut segment aria-labels/legend rows/center total, reading performance dumbbell row aria-labels/gain-loss percentages, and detecting the 'Loading your accounts…' interim state. Does not exist yet — confirmed via Glob against pages/*.ts (only BasePage.ts, LoginPage.ts, LoginBrokenPage.ts, AccountsPage.ts exist). |
| `features/dashboard.feature` | feature-file | create | Gherkin scenarios for SC-1 through SC-15 covering all stat tiles, the cash flow chart, spending-by-category, portfolio donut, performance dumbbell, the account scope filter, the loading state, and every listed edge case. Does not exist yet — confirmed via Glob against features/*.feature (only login.feature and login-broken.feature exist). |
| `steps/dashboard.steps.ts` | step-definition | create | Step definitions backing features/dashboard.feature, built on DashboardPage (and LoginPage/AccountsPage fixtures for sign-on) via the playwright-bdd createBdd(test) pattern used in steps/login.steps.ts. Does not exist yet — confirmed via Glob against steps/*.ts (only login.steps.ts and login-broken.steps.ts exist). |
| `fixtures/seedData.ts` | fixture | create | Seed-data override helper that writes a custom accounts/transactions/holdings/payees payload into localStorage under the app's 'app-bank-state' key (version 2, matching src/api/accountsApi.js's freshState/loadState contract) before the dashboard is navigated to. Required because the shipped seed dataset (src/data.js) cannot reach EC-1 (zero-transaction account), EC-2 (all-excluded-category account), EC-3 (zero total holdings value), EC-4 (100%+ credit utilization), EC-5 (exact-zero net cash flow / investment gain-loss), EC-6 (zero cost-basis holding), or EC-7 (no Credit Card account) — every account in the default seed has transactions in non-excluded categories, positive utilization well under 100%, and every holding has a positive cost basis. Does not exist yet — confirmed via Glob against fixtures/*.ts (only fixtures/pages.ts exists). |
| `fixtures/pages.ts` | fixture | extend | Register a new 'dashboardPage' fixture (new DashboardPage(page)) alongside the existing loginPage/accountsPage/loginBrokenPage fixtures so steps/dashboard.steps.ts can consume it the same way steps/login.steps.ts consumes loginPage/accountsPage. This file already exists with three registered fixtures and must gain a fourth without discarding the existing ones. |

---
*Generated from `CAP-19.design.json` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact Code Agent consumes; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*
