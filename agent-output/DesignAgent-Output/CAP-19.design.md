# CAP-19 — Test Plan: Financial Overview Dashboard

**Built from:** `agent-output/ResearchAgent-Output/CAP-19.requirements.json`
**Answers file applied:** Yes

**Coverage:** 12/12 requirements covered, 8/8 edge cases covered, 0 out of scope.
**Scenario count:** 18 — exceeds NFR-001's typical-story threshold (6); see Performance Note below.

## Performance Note (NFR-001)

This plan has 18 scenarios, well over NFR-001's 6-scenario typical-story threshold, placing it in the 7+ / <=25-minute-ceiling tier rather than the <=15-minute tier. Decision: accept the longer run rather than splitting the ticket. The Dashboard is genuinely one cohesive page spanning four stat tiles plus four independent chart components (cash flow, category spend, portfolio donut, performance dumbbell), each with its own happy-path and at least one first-class edge case from the baseline (EC-1 through EC-8, all of which the ticket's own rationale calls out as real regression risks, e.g. divide-by-zero guards and empty-state branches). Splitting this into multiple tickets/plans would fragment coverage of a single page and make the REQ/EC-to-scenario traceability harder to audit, not easier. Each scenario is a single Playwright test running against a local, no-network, ~250ms-simulated-latency demo app with fullyParallel:true, so wall-clock runtime is expected to stay well inside the 25-minute ceiling despite the scenario count; no ticket split is recommended.

## Assumptions

- **A-1** (from Q-1) — Interpreted REQ-11's 'not a live feed' as: verify displayed dashboard figures match values computed from the known seeded dataset (e.g. SC-1 asserts the exact seeded total-balance sum). Did not add network-interception assertions (e.g. asserting zero external HTTP requests), since the ticket never asked for that and accountsApi.js is already a local-only localStorage-backed module with a simulated-latency Promise, not a real network boundary to intercept.
- **A-2** (from Q-2) — Treated all four stat tiles named in the requirements (Total balance REQ-1, Net cash flow REQ-2, Investment gain/loss REQ-3, Credit utilization REQ-4) as contractual behavior in scope for this ticket, not just the 'total balance' example AC-1 calls out by name — each gets its own scenario (SC-1 through SC-4).
- **A-3** (from Q-3) — Treated portfolio allocation (REQ-9, PortfolioDonut) and investment performance (REQ-10, PerformanceDumbbell) as two independently verifiable requirements under AC-4, each with its own happy-path and edge-case scenarios, rather than one inseparable AC-4 test — they are two distinct components in two distinct page sections.
- **A-4** (from Q-4) — Treated the account-scope filter chips as in scope for this ticket's test coverage, since the requirements baseline formally captured them as REQ-7 with an explicit related edge case (EC-8); SC-8 tests both the filtering behavior and the documented split (only cash flow/spending charts scope down, not the account-wide stat tiles).
- **A-5** (new) — src/App.jsx defines '/dashboard' with no auth guard or redirect (confirmed by direct Read of App.jsx's Routes), so all scenarios navigate DashboardPage directly to /dashboard rather than performing a full sign-on flow first. If a route guard is added to the app later, DashboardPage.goto() would need to perform login first — this assumption should be revisited then.
- **A-6** (new) — The app's default seed data (src/data.js) cannot reach several required edge-case states: a zero-transaction account (EC-1), an account whose transactions are all in excluded categories (EC-2), zero total holdings market value (EC-3), 100%+ credit utilization (EC-4), exact-zero net cash flow / investment gain (EC-5), a zero-cost-basis holding (EC-6), or no Credit Card account at all (EC-7). A new dashboardSeed fixture (fixtures/dashboardSeed.ts) writes custom state matching accountsApi.js's persisted shape into localStorage key 'app-bank-state' (version 2) via page.addInitScript, so each such scenario gets exactly the state it needs without touching the shared seed modules in src/data.js.
- **A-7** (new) — A Helix codebase_agent_query run against Dashboard.jsx returned an inconclusive/null result for its component imports (StatTile, CashFlowChart, CategorySpendChart, PortfolioDonut, PerformanceDumbbell), even though direct Read of Dashboard.jsx confirms all five are imported and rendered. Per the Helix/Read split, this plan's locators and page structure were built entirely from direct Read/Grep of Dashboard.jsx and the five chart component files, not from the Helix answer — noting this here since it's a concrete instance of the graph being stale or incomplete for this repo, not just a theoretical risk. A get_session_context_tool to confirm the ingested commit was not available in this session, so freshness could not be independently verified either way.

## Out of Scope

_None — everything in the baseline is covered by a scenario._

## Scenarios

| ID | Title | Type | Isolation | Tags | Covers AC | Covers REQ | Covers EC |
|----|-------|------|-----------|------|-----------|------------|-----------|
| SC-1 | Total balance stat tile reflects the sum of all account balances | happy-path | parallel-safe | @dashboard @stat-tile @smoke | AC-1 | REQ-1, REQ-11 | — |
| SC-2 | Net cash flow tile shows breakdown and positive styling when money in exceeds money out | happy-path | parallel-safe | @dashboard @stat-tile | AC-1 | REQ-2 | — |
| SC-3 | Investment gain/loss tile shows dollar gain and gain percentage with positive styling | happy-path | parallel-safe | @dashboard @stat-tile | AC-1 | REQ-3 | — |
| SC-4 | Credit utilization tile is displayed when the customer has a Credit Card account | happy-path | parallel-safe | @dashboard @stat-tile @credit-utilization | AC-1 | REQ-4 | — |
| SC-5 | Credit utilization tile is absent when the customer has no Credit Card account | boundary | parallel-safe | @dashboard @stat-tile @credit-utilization @edge-case | AC-1 | REQ-4 | EC-7 |
| SC-6 | Cash flow chart plots money in and money out per date as bars above/below the baseline | happy-path | parallel-safe | @dashboard @cash-flow | AC-2 | REQ-5 | — |
| SC-7 | Cash flow chart summary line shows total money in and total money out for the displayed scope | happy-path | parallel-safe | @dashboard @cash-flow | AC-2 | REQ-6 | — |
| SC-8 | Selecting an account chip filters the cash flow and spending charts without changing the account-wide stat tiles | boundary | parallel-safe | @dashboard @scope-filter @edge-case | — | REQ-7 | EC-8 |
| SC-9 | Spending-by-category chart aggregates outgoing spend, excludes non-spend categories, and sorts by amount descending | happy-path | parallel-safe | @dashboard @category-spend | AC-3 | REQ-8 | — |
| SC-10 | Cash flow chart shows its empty state when the selected account scope has zero transactions | boundary | parallel-safe | @dashboard @cash-flow @edge-case | AC-2 | REQ-5 | EC-1 |
| SC-11 | Spending-by-category chart shows its empty state when the scope's transactions are all excluded categories | boundary | parallel-safe | @dashboard @category-spend @edge-case | AC-3 | REQ-8 | EC-2 |
| SC-12 | Portfolio allocation donut renders segments sized by market value share with a matching legend | happy-path | parallel-safe | @dashboard @portfolio | AC-4 | REQ-9 | — |
| SC-13 | Portfolio donut renders without error when total holdings market value is zero | boundary | parallel-safe | @dashboard @portfolio @edge-case | AC-4 | REQ-9 | EC-3 |
| SC-14 | Investment performance chart shows cost basis vs. current market value and gain/loss percentage per holding | happy-path | parallel-safe | @dashboard @performance | AC-4 | REQ-10 | — |
| SC-15 | A zero-cost-basis holding shows 0% gain instead of Infinity/NaN or a crash | boundary | parallel-safe | @dashboard @performance @stat-tile @edge-case | AC-1, AC-4 | REQ-3, REQ-10 | EC-6 |
| SC-16 | Credit utilization tile caps at 100% and switches to the highest severity color at or over the credit limit | boundary | parallel-safe | @dashboard @credit-utilization @edge-case | AC-1 | REQ-4 | EC-4 |
| SC-17 | Net cash flow and investment gain/loss tiles render with positive styling at the exact-zero boundary | boundary | parallel-safe | @dashboard @stat-tile @edge-case | AC-1 | REQ-2, REQ-3 | EC-5 |
| SC-18 | Dashboard shows a loading state and defers rendering stat tiles and charts until data has finished loading | happy-path | parallel-safe | @dashboard @loading | — | REQ-12 | — |

## Scenario Details

### SC-1 — Total balance stat tile reflects the sum of all account balances

_Type: happy-path · Tags: @dashboard @stat-tile @smoke · Isolation: parallel-safe_

- Given the customer's accounts use the default seeded demo data (Chequing, Savings, Aventura Visa)
- When the customer opens the dashboard
- Then the "Total balance" stat tile shows the sum of all account balances, matching the known seeded total exactly
- And the "Across all accounts" sub-caption is visible under the tile

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write); Playwright's fullyParallel default gives every test a fresh, isolated browser context/localStorage, so nothing here can leak into or from another test.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-2 — Net cash flow tile shows breakdown and positive styling when money in exceeds money out

_Type: happy-path · Tags: @dashboard @stat-tile · Isolation: parallel-safe_

- Given the customer's accounts use the default seeded demo data, where total money in exceeds total money out
- When the customer opens the dashboard
- Then the "Net cash flow" stat tile shows the net amount (money in minus money out)
- And it shows a breakdown of total money in and total money out
- And the tile is styled as positive since the net is greater than zero

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write); relies on Playwright's per-test fresh browser context/localStorage for isolation.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-3 — Investment gain/loss tile shows dollar gain and gain percentage with positive styling

_Type: happy-path · Tags: @dashboard @stat-tile · Isolation: parallel-safe_

- Given the customer's holdings use the default seeded demo data, where market value exceeds cost basis
- When the customer opens the dashboard
- Then the "Investment gain/loss" stat tile shows the dollar gain (market value minus cost basis)
- And it shows the gain as a percentage
- And the tile is styled as positive since the gain is greater than zero

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write); relies on Playwright's per-test fresh browser context/localStorage for isolation.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-4 — Credit utilization tile is displayed when the customer has a Credit Card account

_Type: happy-path · Tags: @dashboard @stat-tile @credit-utilization · Isolation: parallel-safe_

- Given the customer's accounts include a Credit Card account (the default seeded Aventura Visa)
- When the customer opens the dashboard
- Then a "Credit utilization" tile is displayed showing the percentage of credit limit used
- And it shows an "amount used of limit" caption
- And it shows a severity-colored progress bar

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write); relies on Playwright's per-test fresh browser context/localStorage for isolation.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-5 — Credit utilization tile is absent when the customer has no Credit Card account

_Type: boundary · Tags: @dashboard @stat-tile @credit-utilization @edge-case · Isolation: parallel-safe_

- Given the customer's seed data is replaced, via the dashboard seed fixture, with a state that has no Credit Card type account
- When the customer opens the dashboard
- Then no "Credit utilization" tile is rendered among the stat tiles
- And the other stat tiles (Total balance, Net cash flow, Investment gain/loss) still render normally

**Isolation basis:** Seeds a custom no-credit-card state via the dashboardSeed fixture's page.addInitScript, scoped to this test's own browser context only — no shared storageState or on-disk file is used, so this cannot interfere with any other test's localStorage.

**Artifacts used:** `pages/DashboardPage.ts`, `fixtures/dashboardSeed.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-6 — Cash flow chart plots money in and money out per date as bars above/below the baseline

_Type: happy-path · Tags: @dashboard @cash-flow · Isolation: parallel-safe_

- Given the customer's accounts use the default seeded demo data with transactions on multiple dates
- When the customer opens the dashboard with the "All accounts" scope selected
- Then the cash flow chart renders one bar per date
- And money-in days render as bars above the baseline and money-out days render as bars below the baseline

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write); relies on Playwright's per-test fresh browser context/localStorage for isolation.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-7 — Cash flow chart summary line shows total money in and total money out for the displayed scope

_Type: happy-path · Tags: @dashboard @cash-flow · Isolation: parallel-safe_

- Given the customer's accounts use the default seeded demo data
- When the customer opens the dashboard with the "All accounts" scope selected
- Then the cash flow chart's summary line shows the total money in and total money out for that scope

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write); relies on Playwright's per-test fresh browser context/localStorage for isolation.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-8 — Selecting an account chip filters the cash flow and spending charts without changing the account-wide stat tiles

_Type: boundary · Tags: @dashboard @scope-filter @edge-case · Isolation: parallel-safe_

- Given the customer's accounts use the default seeded demo data with more than one account
- And the customer has opened the dashboard with the "All accounts" scope selected
- When the customer clicks a single account's chip in the account filter
- Then the cash flow chart updates to show only that account's transactions
- And the spending-by-category chart updates to show only that account's transactions
- And the Total balance, Investment gain/loss, and Credit utilization tiles remain unchanged, still computed from all accounts

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write); relies on Playwright's per-test fresh browser context/localStorage for isolation.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-9 — Spending-by-category chart aggregates outgoing spend, excludes non-spend categories, and sorts by amount descending

_Type: happy-path · Tags: @dashboard @category-spend · Isolation: parallel-safe_

- Given the customer's transactions use the default seeded demo data, spanning multiple outgoing spend categories plus Income/Transfer/Payment entries
- When the customer opens the dashboard with the "All accounts" scope selected
- Then the spending-by-category chart lists only negative-amount transactions, excluding Income, Transfer, and Payment categories
- And the categories are sorted by amount descending
- And each category row shows its percentage of total spending

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write); relies on Playwright's per-test fresh browser context/localStorage for isolation.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-10 — Cash flow chart shows its empty state when the selected account scope has zero transactions

_Type: boundary · Tags: @dashboard @cash-flow @edge-case · Isolation: parallel-safe_

- Given the dashboard seed fixture provides an account that has zero transactions
- And the customer has opened the dashboard
- When the customer selects that account's chip in the account filter
- Then the cash flow chart shows "No transactions in this view." instead of a chart

**Isolation basis:** Seeds a custom zero-transaction-account state via the dashboardSeed fixture's page.addInitScript, scoped to this test's own browser context only — no shared storageState or on-disk file, so it cannot affect any other test.

**Artifacts used:** `pages/DashboardPage.ts`, `fixtures/dashboardSeed.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-11 — Spending-by-category chart shows its empty state when the scope's transactions are all excluded categories

_Type: boundary · Tags: @dashboard @category-spend @edge-case · Isolation: parallel-safe_

- Given the dashboard seed fixture provides an account whose transactions are all Income, Transfer, or Payment category
- And the customer has opened the dashboard
- When the customer selects that account's chip in the account filter
- Then the spending-by-category chart shows "No spending in this view." instead of a category list

**Isolation basis:** Seeds a custom all-excluded-category-transactions state via the dashboardSeed fixture's page.addInitScript, scoped to this test's own browser context only — no shared storageState or on-disk file, so it cannot affect any other test.

**Artifacts used:** `pages/DashboardPage.ts`, `fixtures/dashboardSeed.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-12 — Portfolio allocation donut renders segments sized by market value share with a matching legend

_Type: happy-path · Tags: @dashboard @portfolio · Isolation: parallel-safe_

- Given the customer's holdings use the default seeded demo data with non-zero market value
- When the customer opens the dashboard
- Then the portfolio allocation donut renders one segment per holding, each sized as that holding's percentage of total market value
- And the legend lists each holding's name and value

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write); relies on Playwright's per-test fresh browser context/localStorage for isolation.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-13 — Portfolio donut renders without error when total holdings market value is zero

_Type: boundary · Tags: @dashboard @portfolio @edge-case · Isolation: parallel-safe_

- Given the dashboard seed fixture provides holdings whose market values sum to zero total
- When the customer opens the dashboard
- Then the portfolio allocation donut renders each segment at 0% instead of NaN%
- And no broken or empty SVG is shown in place of the chart

**Isolation basis:** Seeds a custom zero-total-market-value holdings state via the dashboardSeed fixture's page.addInitScript, scoped to this test's own browser context only — no shared storageState or on-disk file, so it cannot affect any other test.

**Artifacts used:** `pages/DashboardPage.ts`, `fixtures/dashboardSeed.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-14 — Investment performance chart shows cost basis vs. current market value and gain/loss percentage per holding

_Type: happy-path · Tags: @dashboard @performance · Isolation: parallel-safe_

- Given the customer's holdings use the default seeded demo data with distinct cost basis and market values
- When the customer opens the dashboard
- Then the investment performance chart shows, per holding, a cost-basis point and a current-market-value point
- And it shows the resulting gain/loss percentage per holding

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write); relies on Playwright's per-test fresh browser context/localStorage for isolation.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-15 — A zero-cost-basis holding shows 0% gain instead of Infinity/NaN or a crash

_Type: boundary · Tags: @dashboard @performance @stat-tile @edge-case · Isolation: parallel-safe_

- Given the dashboard seed fixture provides a holding with a cost basis of 0
- When the customer opens the dashboard
- Then the Investment gain/loss stat tile shows a defined percentage (0% contribution from that holding) instead of Infinity or NaN
- And the investment performance chart shows 0% gain for that holding instead of throwing or displaying Infinity/NaN

**Isolation basis:** Seeds a custom zero-cost-basis holding state via the dashboardSeed fixture's page.addInitScript, scoped to this test's own browser context only — no shared storageState or on-disk file, so it cannot affect any other test.

**Artifacts used:** `pages/DashboardPage.ts`, `fixtures/dashboardSeed.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-16 — Credit utilization tile caps at 100% and switches to the highest severity color at or over the credit limit

_Type: boundary · Tags: @dashboard @credit-utilization @edge-case · Isolation: parallel-safe_

- Given the dashboard seed fixture provides a Credit Card account whose balance is at or exceeds its credit limit
- When the customer opens the dashboard
- Then the Credit utilization tile displays a percentage capped at 100%
- And the progress bar renders in the highest-severity color band

**Isolation basis:** Seeds a custom over-limit Credit Card state via the dashboardSeed fixture's page.addInitScript, scoped to this test's own browser context only — no shared storageState or on-disk file, so it cannot affect any other test.

**Artifacts used:** `pages/DashboardPage.ts`, `fixtures/dashboardSeed.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-17 — Net cash flow and investment gain/loss tiles render with positive styling at the exact-zero boundary

_Type: boundary · Tags: @dashboard @stat-tile @edge-case · Isolation: parallel-safe_

- Given the dashboard seed fixture provides transactions and holdings that produce a net cash flow of exactly 0 and an investment gain/loss of exactly 0
- When the customer opens the dashboard
- Then the Net cash flow tile renders with positive styling at the zero boundary
- And the Investment gain/loss tile renders with positive styling at the zero boundary

**Isolation basis:** Seeds a custom exact-zero net-cash-flow/gain-loss state via the dashboardSeed fixture's page.addInitScript, scoped to this test's own browser context only — no shared storageState or on-disk file, so it cannot affect any other test.

**Artifacts used:** `pages/DashboardPage.ts`, `fixtures/dashboardSeed.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

### SC-18 — Dashboard shows a loading state and defers rendering stat tiles and charts until data has finished loading

_Type: happy-path · Tags: @dashboard @loading · Isolation: parallel-safe_

- Given the customer's account, transaction, and holdings data has not yet finished its simulated fetch
- When the customer navigates to the dashboard
- Then a loading indicator is shown and no stat tiles or charts are rendered
- When the data finishes loading
- Then the stat tiles and charts render normally

**Isolation basis:** Uses only the app's default seed data (no custom localStorage write) and observes the existing ~250ms simulated-latency loading window in AccountsContext; relies on Playwright's per-test fresh browser context/localStorage for isolation.

**Artifacts used:** `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`

## Reuse (plan-wide)

| Path | Kind | Why |
|------|------|-----|
| `pages/BasePage.ts` | page-object | Provides the shared open(path) navigation helper and currentUrl(); DashboardPage extends this rather than duplicating navigation logic, matching LoginPage/AccountsPage's existing pattern. |

## New Artifacts (plan-wide)

| Path | Kind | Mode | Purpose |
|------|------|------|---------|
| `pages/DashboardPage.ts` | page-object | create | Encapsulates navigation to /dashboard and intent-named accessors/assertions for the stat tiles, credit meter, account-scope chips, cash flow chart, spending-by-category chart, portfolio donut, and performance dumbbell, so step definitions never touch raw Playwright locators directly. |
| `fixtures/dashboardSeed.ts` | fixture | create | Provides named preset writers (e.g. noCreditCard, zeroTxAccount, allExcludedCategoryAccount, zeroTotalHoldings, zeroCostBasisHolding, overLimitCreditCard, exactZeroCashFlowAndGain) that build a full accounts/transactions/holdings/payees state object matching accountsApi.js's persisted shape ({ version: 2, accounts, transactions, holdings, payees }) and write it into localStorage under key 'app-bank-state' via page.addInitScript before the dashboard is opened, so the app's own loadState() picks it up on first render instead of falling back to src/data.js's default seed. |
| `fixtures/pages.ts` | fixture | extend | Add a dashboardPage: DashboardPage entry to the existing PageFixtures type and test.extend(...) block, following the loginPage/accountsPage construction pattern already present, without removing the existing loginPage/accountsPage/loginBrokenPage fixtures. |
| `features/dashboard.feature` | feature-file | create | Holds the Gherkin scenarios for SC-1 through SC-18 covering the Financial Overview Dashboard's stat tiles, cash flow chart, spending-by-category chart, portfolio donut, investment performance chart, scope filtering, and loading state, tagged @dashboard. |
| `steps/dashboard.steps.ts` | step-definition | create | Step definitions binding dashboard.feature's Given/When/Then text to DashboardPage methods and the dashboardSeed fixture presets, following the createBdd/test pattern used in steps/login.steps.ts. |

**Locator hints** (observed while reading source — hints for Code Agent, not commitments):

- `pages/DashboardPage.ts`
  - Total balance / Net cash flow / Investment gain/loss stat tile: `StatTile renders label in a <p> then value in the next <p>; locate via container filtered by label text, e.g. locator('.shadow-card').filter({ hasText: 'Total balance' })`
  - Credit utilization meter: `getByRole('meter', { name: 'Credit utilization' }) — CreditMeter sets role="meter" and aria-label={label} on the progress-bar div`
  - Credit utilization percentage/caption text: `Within the meter's tile container: percentage is the bold <p>{pct}%</p>; caption is the following <p> text '{used} used of {limit}'`
  - Account filter chip group: `getByRole('group', { name: 'Filter by account' }) — chips are getByRole('button', { name: 'All accounts | account name' }) inside it`
  - Cash flow chart bar: `getByRole('img', { name: /date: [+-]?\$?/ }) — each <rect> has role="img" and aria-label `${date}: ${amount}``
  - Cash flow chart empty state: `getByText('No transactions in this view.')`
  - Cash flow chart summary totals: `Text nodes 'Money in' / 'Money out' followed by bold spans with the formatted totals, in the div.flex.justify-between below the chart`
  - Spending-by-category row: `li elements in the ul; category name in the first span, amount in the second span, percentage text 'pct% of total spending' revealed on hover/focus within the li`
  - Spending-by-category empty state: `getByText('No spending in this view.')`
  - Portfolio donut segment: `getByRole('img', { name: /holding name: .*%/ }) — each <circle> has role="img" and aria-label `${name}: ${value}, ${pct}%``
  - Portfolio donut legend row: `li elements under 'ul.mt-4'; holding name in the first span, value in the second span`
  - Portfolio donut center total label: `getByText('Market value') for the caption, sibling div for the formatted total`
  - Investment performance dumbbell row: `getByRole('img', { name: /holding name: cost basis .* current value .*/ }) — each <g> has role="img" and the full aria-label described in PerformanceDumbbell.jsx`
  - Loading indicator: `getByText('Loading your accounts…') — rendered by AccountsContext while loading is true`

---
*Generated from `CAP-19.design.json` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact Code Agent consumes; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*
