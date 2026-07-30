# CAP-19 — Test Plan: Financial Overview Dashboard

**Built from:** `agent-output/ResearchAgent-Output/CAP-19.requirements.json`
**Answers file applied:** Yes

**Coverage:** 12/12 requirements covered, 8/8 edge cases covered, 0 out of scope.

## Assumptions

- **A-1** (from Q-1) — Interpreted REQ-11 ('figures come from seeded demo data, not a live feed') as requiring that displayed values match the known seeded dataset (SC-15), not that tests assert an absence of network calls — the app's accountsApi is already an in-memory/localStorage mock with no live network dependency to intercept, so network-interception assertions would test an implementation detail the ticket never asked for.
- **A-2** (from Q-2) — Treated all four stat tiles rendered on the dashboard (Total balance, Net cash flow, Investment gain/loss, and the conditional Credit utilization tile) as in-scope, testable behavior rather than only 'total balance' — the requirements baseline already formalizes each as its own requirement (REQ-1 through REQ-4), so SC-1/SC-2 assert all four rather than just the one AC-1 names as an example.
- **A-3** (from Q-3) — Treated portfolio allocation (PortfolioDonut, REQ-9) and investment performance (PerformanceDumbbell, REQ-10) as two independently verifiable scenarios per component (SC-10/SC-11 and SC-12/SC-13) rather than one inseparable AC-4 test, matching how the baseline's REQ-9/REQ-10 already separate them — a future change to only one chart should be traceable to only the affected scenarios.
- **A-4** (from Q-4) — Treated the account-scope filter chips as in-scope for this ticket's test coverage, per REQ-7/REQ-8/EC-8 already present in the baseline, and planned SC-7 to verify both the chip-driven filtering of the cash flow/category charts and the (otherwise undocumented) fact that the stat tiles stay unscoped regardless of chip selection.
- **A-5** (new) — None of the chart or stat-tile elements in src/components/charts/*.jsx carry data-testid attributes; DashboardPage locators are planned against role attributes (role=meter, role=img with per-mark aria-label, role=group/tooltip) and visible text/labels verified directly in source, since these are the only stable selectors available without adding test-only attributes to bank-app itself.
- **A-6** (new) — accountsApi.js persists app state under the localStorage key 'app-bank-state' (STORAGE_VERSION 2) shaped as {version, accounts, transactions, holdings, payees}, and falls back to seed data whenever that key is absent or its version mismatches. fixtures/dashboardSeedData.ts is planned to inject edge-case payloads into that exact key (matching its version) via page.addInitScript before navigation, since this is the only seam in the app for reaching data states (e.g. zero-transaction account, zero-value holdings, over-limit credit card) that the default seed data in src/data.js cannot produce.

## Out of Scope

_None — everything in the baseline is covered by a scenario._

## Scenarios

| ID | Title | Type | Tags | Covers AC | Covers REQ | Covers EC |
|----|-------|------|------|-----------|------------|-----------|
| SC-1 | Stat tiles show total balance, net cash flow, and investment gain/loss on load | happy-path | @dashboard @stat-tiles @smoke | AC-1 | REQ-1, REQ-2, REQ-3 | — |
| SC-2 | Credit utilization tile shows percentage, used-of-limit caption, and normal-severity color for a Credit Card account | happy-path | @dashboard @credit-meter | AC-1 | REQ-4 | — |
| SC-3 | Credit utilization caps at 100% and switches to highest-severity color when balance meets or exceeds the credit limit | boundary | @dashboard @credit-meter @boundary | — | REQ-4 | EC-4 |
| SC-4 | Credit utilization tile is absent when the customer has no Credit Card account | boundary | @dashboard @credit-meter @boundary | — | REQ-4 | EC-7 |
| SC-5 | Cash flow chart plots money in/out per date with a totals summary line, scoped to All accounts | happy-path | @dashboard @cash-flow | AC-2 | REQ-5, REQ-6 | — |
| SC-6 | Cash flow chart shows an empty-state message when the selected account scope has zero transactions | boundary | @dashboard @cash-flow @boundary | — | REQ-5 | EC-1 |
| SC-7 | Filtering by account scope chip updates cash flow and category charts to that account only, while stat tiles stay unscoped | happy-path | @dashboard @scope-filter | — | REQ-7 | EC-8 |
| SC-8 | Spending by category chart excludes Income/Transfer/Payment, sorts by amount descending, and shows percentage of total | happy-path | @dashboard @category-spend | AC-3 | REQ-8 | — |
| SC-9 | Spending by category chart shows an empty-state message when the scope's transactions are all excluded categories | boundary | @dashboard @category-spend @boundary | — | REQ-8 | EC-2 |
| SC-10 | Portfolio allocation donut shows each holding's percentage of total market value with a matching legend | happy-path | @dashboard @portfolio | AC-4 | REQ-9 | — |
| SC-11 | Portfolio donut guards against divide-by-zero when total holdings market value is zero | boundary | @dashboard @portfolio @boundary | — | REQ-9 | EC-3 |
| SC-12 | Investment performance dumbbell chart shows cost basis vs. current value and gain/loss percentage per holding | happy-path | @dashboard @performance | AC-4 | REQ-10 | — |
| SC-13 | A holding with zero cost basis shows 0% gain instead of Infinity/NaN, without breaking the overall investment gain/loss tile | boundary | @dashboard @performance @stat-tiles @boundary | — | REQ-3, REQ-10 | EC-6 |
| SC-14 | Net cash flow and investment gain/loss tiles style as positive when exactly at zero | boundary | @dashboard @stat-tiles @boundary | — | REQ-2, REQ-3 | EC-5 |
| SC-15 | All dashboard figures reflect the customer's seeded demo dataset values | happy-path | @dashboard @data-integrity | — | REQ-11 | — |
| SC-16 | Dashboard shows a loading state and defers stat tiles/charts until account, transaction, and holdings data has finished loading | boundary | @dashboard @loading @boundary | — | REQ-12 | — |

## Scenario Details

### SC-1 — Stat tiles show total balance, net cash flow, and investment gain/loss on load

_Type: happy-path · Tags: @dashboard @stat-tiles @smoke_

- Given I am signed in as the demo customer
- When I navigate to the dashboard
- Then the Total balance tile should show the sum of all account balances ($22,022.88) with sub-label 'Across all accounts'
- And the Net cash flow tile should show the net amount (+$3,077.97) styled as positive, with a breakdown of '$3,715.40 in / $637.43 out'
- And the Investment gain/loss tile should show the dollar gain (+$2,409.83) styled as positive, with a percentage delta (+6.2% overall)

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`

### SC-2 — Credit utilization tile shows percentage, used-of-limit caption, and normal-severity color for a Credit Card account

_Type: happy-path · Tags: @dashboard @credit-meter_

- Given I am signed in as the demo customer
- When I navigate to the dashboard
- Then the Credit utilization tile should show 24% used
- And the caption should read '$1,204.77 used of $5,000.00'
- And the progress bar should be in the normal (brand) severity color, since utilization is below 70%

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`

### SC-3 — Credit utilization caps at 100% and switches to highest-severity color when balance meets or exceeds the credit limit

_Type: boundary · Tags: @dashboard @credit-meter @boundary_

- Given I am signed in as the demo customer with seeded data where the Credit Card account's balance is at or beyond its credit limit
- When I navigate to the dashboard
- Then the Credit utilization tile should display exactly 100%, not a number above 100
- And the progress bar should be in the highest-severity (danger) color band, since utilization is at or above 90%

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`, `fixtures/dashboardSeedData.ts`

### SC-4 — Credit utilization tile is absent when the customer has no Credit Card account

_Type: boundary · Tags: @dashboard @credit-meter @boundary_

- Given I am signed in as the demo customer with seeded data containing no Credit Card type account
- When I navigate to the dashboard
- Then no Credit utilization tile should be rendered
- And the Total balance, Net cash flow, and Investment gain/loss tiles should still be displayed in the stat tile row

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`, `fixtures/dashboardSeedData.ts`

### SC-5 — Cash flow chart plots money in/out per date with a totals summary line, scoped to All accounts

_Type: happy-path · Tags: @dashboard @cash-flow_

- Given I am signed in as the demo customer
- When I navigate to the dashboard with the 'All accounts' scope selected (the default)
- Then the cash flow chart should render one bar per date, bars above the baseline for money in and below for money out
- And the chart summary line should show total money in '+$3,715.40' and total money out '-$637.43' for the currently displayed scope

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`

### SC-6 — Cash flow chart shows an empty-state message when the selected account scope has zero transactions

_Type: boundary · Tags: @dashboard @cash-flow @boundary_

- Given I am signed in as the demo customer with seeded data where one account has zero transactions
- When I navigate to the dashboard and select that account's scope chip
- Then the cash flow chart should show the message 'No transactions in this view.' instead of an empty or broken chart

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`, `fixtures/dashboardSeedData.ts`

### SC-7 — Filtering by account scope chip updates cash flow and category charts to that account only, while stat tiles stay unscoped

_Type: happy-path · Tags: @dashboard @scope-filter_

- Given I am signed in as the demo customer
- When I navigate to the dashboard
- Then I should see an 'All accounts' chip plus one chip per account in the filter group
- When I select the 'Aventura Visa' account chip
- Then the cash flow chart should only reflect the Aventura Visa account's transactions
- And the spending-by-category chart should only reflect the Aventura Visa account's transactions
- But the Total balance, Net cash flow, Investment gain/loss, and Credit utilization tiles should remain unchanged, still reflecting all accounts

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`

### SC-8 — Spending by category chart excludes Income/Transfer/Payment, sorts by amount descending, and shows percentage of total

_Type: happy-path · Tags: @dashboard @category-spend_

- Given I am signed in as the demo customer
- When I navigate to the dashboard with the 'All accounts' scope selected
- Then the spending-by-category chart should list only categories from outgoing (negative-amount) transactions, excluding Income, Transfer, and Payment
- And the categories should be sorted by amount descending
- And hovering or focusing a category row should reveal its percentage of total spending

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`

### SC-9 — Spending by category chart shows an empty-state message when the scope's transactions are all excluded categories

_Type: boundary · Tags: @dashboard @category-spend @boundary_

- Given I am signed in as the demo customer with seeded data where one account's transactions are all Income, Transfer, or Payment
- When I navigate to the dashboard and select that account's scope chip
- Then the spending-by-category chart should show the message 'No spending in this view.' rather than an empty list

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`, `fixtures/dashboardSeedData.ts`

### SC-10 — Portfolio allocation donut shows each holding's percentage of total market value with a matching legend

_Type: happy-path · Tags: @dashboard @portfolio_

- Given I am signed in as the demo customer
- When I navigate to the dashboard
- Then the portfolio allocation donut should render one segment per holding sized proportionally to its market value
- And the legend should list each holding's name and dollar value, matching the segments
- And hovering or focusing a segment should reveal its value and percentage

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`

### SC-11 — Portfolio donut guards against divide-by-zero when total holdings market value is zero

_Type: boundary · Tags: @dashboard @portfolio @boundary_

- Given I am signed in as the demo customer with seeded data where all holdings sum to zero total market value
- When I navigate to the dashboard
- Then each donut segment's percentage should default to 0%, not NaN%
- And the center label should show a market value of $0.00 without throwing or rendering a broken chart

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`, `fixtures/dashboardSeedData.ts`

### SC-12 — Investment performance dumbbell chart shows cost basis vs. current value and gain/loss percentage per holding

_Type: happy-path · Tags: @dashboard @performance_

- Given I am signed in as the demo customer
- When I navigate to the dashboard
- Then the investment performance chart should render one row per holding with a cost-basis dot and a current-value dot connected by a line
- And each row should display its gain/loss percentage, colored positive or negative to match the direction of the gain/loss
- And hovering or focusing a row should reveal its cost basis, current value, and gain/loss amount

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`

### SC-13 — A holding with zero cost basis shows 0% gain instead of Infinity/NaN, without breaking the overall investment gain/loss tile

_Type: boundary · Tags: @dashboard @performance @stat-tiles @boundary_

- Given I am signed in as the demo customer with seeded data where one holding has a cost basis of 0
- When I navigate to the dashboard
- Then that holding's row in the investment performance chart should show a gain/loss percentage of 0%, not Infinity or NaN
- And the Investment gain/loss stat tile should still compute a valid, non-NaN overall dollar gain and percentage from the remaining holdings' cost basis

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`, `fixtures/dashboardSeedData.ts`

### SC-14 — Net cash flow and investment gain/loss tiles style as positive when exactly at zero

_Type: boundary · Tags: @dashboard @stat-tiles @boundary_

- Given I am signed in as the demo customer with seeded data where total money in equals total money out, and total market value equals total cost basis
- When I navigate to the dashboard
- Then the Net cash flow tile should show $0.00 styled as positive (using the up-arrow/positive color), not negative
- And the Investment gain/loss tile should show $0.00 / 0.0% styled as positive, not negative

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`, `fixtures/dashboardSeedData.ts`

### SC-15 — All dashboard figures reflect the customer's seeded demo dataset values

_Type: happy-path · Tags: @dashboard @data-integrity_

- Given I am signed in as the demo customer
- When I navigate to the dashboard
- Then the Total balance, Net cash flow, Investment gain/loss, and Credit utilization figures should exactly match the values derivable from the known seeded accounts/transactions/holdings dataset
- And the cash flow, spending-by-category, portfolio, and performance charts should reflect that same seeded dataset with no values unaccounted for by it

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`

### SC-16 — Dashboard shows a loading state and defers stat tiles/charts until account, transaction, and holdings data has finished loading

_Type: boundary · Tags: @dashboard @loading @boundary_

- Given I am signed in as the demo customer
- When I navigate to the dashboard immediately after sign-on, before the simulated data fetch resolves
- Then I should see a loading indicator and no stat tiles or charts should be rendered yet
- When the account, transaction, and holdings data finishes loading
- Then the loading indicator should disappear and the stat tiles and charts should render

**Artifacts used:** `pages/LoginPage.ts`, `pages/DashboardPage.ts`, `features/dashboard.feature`, `steps/dashboard.steps.ts`, `fixtures/pages.ts`

## Reuse (plan-wide)

| Path | Kind | Why |
|------|------|-----|
| `pages/LoginPage.ts` | page-object | Provides the existing sign-on flow (goto + signOn with demo/demo credentials) needed to reach an authenticated session before any dashboard scenario can navigate to /dashboard. |
| `pages/BasePage.ts` | page-object | Existing abstract base class (protected open()/currentUrl()) that the new DashboardPage should extend, matching the convention already used by LoginPage and AccountsPage. |
| `fixtures/pages.ts` | fixture | Existing Playwright-BDD fixture wiring (test.extend) that constructs one Page Object instance per test; needs a new dashboardPage fixture entry added here so dashboard.steps.ts can consume it the same way login/accounts steps consume their fixtures. |

## New Artifacts (plan-wide)

| Path | Kind | Purpose |
|------|------|---------|
| `pages/DashboardPage.ts` | page-object | Encapsulates locators and intent-named assertion methods for the dashboard: stat tiles (Total balance, Net cash flow, Investment gain/loss) via getByText/getByRole text matching, the Credit utilization tile via the role=meter element and its aria-valuenow/severity class, the account scope chips via role=group aria-label 'Filter by account', the cash flow chart's bars (role=img aria-label per bar) and its money-in/money-out summary line, the spending-by-category rows (category name, amount, hover-revealed percentage) and its empty-state text, the portfolio donut's segments (role=img aria-label per segment) and legend list, the performance dumbbell's per-holding rows (role=img aria-label per row) and gain/loss text, and the loading state text ('Loading your accounts…'). No data-testid attributes exist on any of these elements today, so locators are role/aria-label/text based, verified directly against src/components/charts/*.jsx and src/pages/Dashboard.jsx. |
| `features/dashboard.feature` | feature-file | Holds all CAP-19 Financial Overview Dashboard scenarios (SC-1 through SC-16) as Gherkin, following the Background + Scenario structure already used in features/login.feature. |
| `steps/dashboard.steps.ts` | step-definition | Implements the Given/When/Then steps referenced by dashboard.feature, delegating all interaction/assertion logic to DashboardPage (and LoginPage for sign-on), following the pattern in steps/login.steps.ts. |
| `fixtures/dashboardSeedData.ts` | fixture | Provides named seed-data payloads matching the accountsApi/localStorage 'app-bank-state' (version 2) shape — accounts/transactions/holdings/payees arrays — for edge-case data states the app's default seed data (src/data.js) cannot reach on its own: an account with zero transactions (EC-1), an account whose transactions are all Income/Transfer/Payment (EC-2), holdings summing to zero total market value (EC-3), a Credit Card account at/over its credit limit (EC-4), net cash flow and investment gain/loss exactly zero (EC-5), a holding with zero cost basis (EC-6), and an accounts list with no Credit Card account at all (EC-7). Exposes a helper to inject a chosen payload into localStorage via page.addInitScript before the dashboard is navigated to, so the app's normal fetchBankData() seam picks it up unmodified. |

---
*Generated from `CAP-19.design.json` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact Code Agent consumes; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*
