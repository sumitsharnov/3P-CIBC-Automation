# CAP-15 — Test Plan: Sign-In (Login) with demo credentials

**Built from:** `agent-output/ResearchAgent-Output/CAP-15.requirements.json`
**Answers file applied:** No

**Coverage:** 12/13 requirements covered, 6/6 edge cases covered, 3 out of scope.
**Scenario count:** 9 — exceeds NFR-001's typical-story threshold (6); see Performance Note below.

## Performance Note (NFR-001)

This plan has 9 scenarios, exceeding NFR-001's 6-scenario typical-story threshold and entering the complex-story tier (<=25 minute ceiling for 7+ scenarios). All 9 scenarios are single-page (/login only, no multi-page flows beyond a single post-submit redirect check), use no heavy setup/teardown, and run parallel-safe under Playwright's default fully-parallel execution — so the realistic wall-clock cost is well under the 25-minute ceiling even though it exceeds the 15-minute typical-story target. Decision: accept the longer scenario count rather than split the ticket; do not recommend splitting CAP-15, since the extra scenarios are edge-case coverage (EC-1 through EC-6) on a single page rather than genuinely separate feature scope.

## Assumptions

- **A-1** (from Q-1) — No answers file resolved Q-1 (whether username whitespace-trimming should be verified alongside case-insensitivity). Login.jsx's handleSignOn does username.trim().toLowerCase() === 'demo', so this plan treats trim-then-succeed as an intended, testable contract (SC-2/EC-1) rather than skipping it or silently baking it into SC-1 as if undocumented. If this trim behavior is later ruled unintentional, SC-2 should be removed or converted to a negative case.
- **A-2** (from Q-2) — No answers file resolved Q-2 (whether a no-cross-navigation check between /login and /login-broken should exist). This plan adds SC-9 to positively assert /login contains no link/button to /login-broken, based on Login.jsx showing only Links to '/', '/forgot-password', and '/register'. SC-9 deliberately does not instantiate or navigate to LoginBrokenPage — it stays entirely on /login so CAP-15's suite cannot be confused with CAP-18's.
- **A-3** (new) — Locator hints in newArtifacts (e.g. getByRole('link', {name: 'Forgot password?'})) are based on the exact visible text currently in bank-app-1/src/pages/Login.jsx as of this read. These are hints only; Code Agent should re-verify against source at implementation time in case the page has changed since this plan was written.
- **A-4** (new) — SC-3's and SC-6's 'special characters' and 'very long string' / 'repeated submission' example values are left as illustrative placeholders (Code Agent to pick concrete strings, e.g. a ~300-character string and a string containing common special characters) since the baseline's EC-4/EC-6 text does not specify exact values and none are required for the assertion to be meaningful — only that the generic error path holds and no crash/duplicate-error occurs.

## Out of Scope

- **AC AC-6** — Marked testable: false in the baseline — the 'Remember this device' checkbox is decorative only with no persisted behavior to verify in this mock.
- **AC AC-7** — Marked testable: false in the baseline — the /login-broken simulated-outage page belongs to CAP-18 and must not be conflated with or exercised by this ticket's /login coverage (SC-9 only asserts absence of a link to it from /login, never navigates to or tests /login-broken itself).
- **REQ REQ-11** — Directly tied to AC-6 (testable: false). The baseline itself states no assertion is required on persisted checkbox state, so this plan leaves the 'Remember this device' checkbox untested by design rather than stretching a scenario to cover a decorative element.

## Scenarios

| ID | Title | Type | Isolation | Tags | Covers AC | Covers REQ | Covers EC |
|----|-------|------|-----------|------|-----------|------------|-----------|
| SC-1 | Successful sign-on with demo credentials (case-insensitive username) | happy-path | parallel-safe | @login @smoke | AC-1 | REQ-1, REQ-2 | — |
| SC-2 | Username with leading/trailing whitespace is trimmed and still succeeds | boundary | parallel-safe | @login @boundary | AC-1 | REQ-2 | EC-1 |
| SC-3 | Invalid credential combinations show a single generic error | negative | parallel-safe | @login @negative | AC-2 | REQ-3, REQ-4, REQ-5, REQ-6 | EC-2, EC-6 |
| SC-4 | Sign-on with empty username and password shows the same generic error | negative | parallel-safe | @login @negative | AC-3 | REQ-7 | — |
| SC-5 | Sign-on with only one of username/password populated shows the generic error | negative | parallel-safe | @login @negative | — | — | EC-3 |
| SC-6 | Repeated invalid submissions do not stack errors or break the form | boundary | parallel-safe | @login @boundary | — | — | EC-4 |
| SC-7 | Demo disclaimer is visible on the sign-on page | happy-path | parallel-safe | @login @disclaimer | AC-4 | REQ-8, REQ-13 | — |
| SC-8 | Forgot password and Register links are present and navigable | happy-path | parallel-safe | @login @navigation | AC-5 | REQ-9, REQ-10 | — |
| SC-9 | The sign-on page does not link to the broken /login-broken demo page | negative | parallel-safe | @login @negative @scope-boundary | — | REQ-12 | EC-5 |

## Scenario Details

### SC-1 — Successful sign-on with demo credentials (case-insensitive username)

_Type: happy-path · Tags: @login @smoke · Isolation: parallel-safe_

- Given I am on the sign-on page
- When I sign on with username "<username>" and password "demo"
- Then I should be redirected to the accounts page
- Examples: username = demo | DEMO | Demo | dEmO (password is always exact-case "demo")

**Isolation basis:** Relies on Playwright's default per-test browser context: playwright.config.ts sets fullyParallel: true and defines no storageState under `use`, so each scenario gets a fresh browser context (fresh localStorage/cookies) with no state shared across tests. fixtures/pages.ts constructs a new LoginPage/AccountsPage per test against that test's own `page`.

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `pages/AccountsPage.ts`, `fixtures/pages.ts`, `steps/login.steps.ts`, `features/login.feature`

### SC-2 — Username with leading/trailing whitespace is trimmed and still succeeds

_Type: boundary · Tags: @login @boundary · Isolation: parallel-safe_

- Given I am on the sign-on page
- When I sign on with username " demo " (leading and trailing spaces) and password "demo"
- Then I should be redirected to the accounts page

**Isolation basis:** Same basis as SC-1: fresh per-test browser context from Playwright's default (fullyParallel: true, no storageState configured), no cross-test state dependency.

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `pages/AccountsPage.ts`, `fixtures/pages.ts`, `steps/login.steps.ts`, `features/login.feature`

### SC-3 — Invalid credential combinations show a single generic error

_Type: negative · Tags: @login @negative · Isolation: parallel-safe_

- Given I am on the sign-on page
- When I sign on with username "<username>" and password "<password>"
- Then I should see the sign-on error message "Invalid card number or password. Please try again (demo / demo)."
- And the error message has an accessible alert role
- And I remain on the sign-on page
- Examples: (demo / DEMO) [correct username, wrong-case password], (wronguser / demo) [wrong username], (demo / " demo ") [password whitespace not trimmed, unlike username], (special characters string / special characters string), (a 300-character string / a 300-character string) [very long input]

**Isolation basis:** Same basis as SC-1: each Examples row runs in its own fresh Playwright browser context (fullyParallel: true, no storageState), no shared state between rows or other scenarios.

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `fixtures/pages.ts`, `steps/login.steps.ts`, `features/login.feature`

### SC-4 — Sign-on with empty username and password shows the same generic error

_Type: negative · Tags: @login @negative · Isolation: parallel-safe_

- Given I am on the sign-on page
- When I sign on with username "" and password ""
- Then I should see the sign-on error message "Invalid card number or password. Please try again (demo / demo)."
- And no separate required-field validation message is shown

**Isolation basis:** Same basis as SC-1: fresh per-test browser context from Playwright defaults, no shared storageState or persistent context.

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `fixtures/pages.ts`, `steps/login.steps.ts`, `features/login.feature`

### SC-5 — Sign-on with only one of username/password populated shows the generic error

_Type: negative · Tags: @login @negative · Isolation: parallel-safe_

- Given I am on the sign-on page
- When I sign on with username "<username>" and password "<password>"
- Then I should see the sign-on error message
- Examples: (demo / "") [valid username, blank password], ("" / demo) [blank username, valid password]

**Isolation basis:** Same basis as SC-1: each Examples row is an independent test with its own fresh Playwright browser context; no ordering dependency between rows.

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `fixtures/pages.ts`, `steps/login.steps.ts`, `features/login.feature`

### SC-6 — Repeated invalid submissions do not stack errors or break the form

_Type: boundary · Tags: @login @boundary · Isolation: parallel-safe_

- Given I am on the sign-on page
- When I submit invalid credentials 3 times in a row without reloading the page
- Then exactly one error message is visible after each attempt, not stacked or duplicated
- And the username/password fields and Sign On button remain usable for another attempt

**Isolation basis:** All 3 submissions happen within one test's single browser context/page instance; nothing here depends on another test's state, so it stays within Playwright's default per-test isolation (fullyParallel: true, no storageState).

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `fixtures/pages.ts`, `steps/login.steps.ts`, `features/login.feature`

### SC-7 — Demo disclaimer is visible on the sign-on page

_Type: happy-path · Tags: @login @disclaimer · Isolation: parallel-safe_

- Given I am on the sign-on page
- Then I should see a visible disclaimer stating this is a demo mockup and that real credentials should not be entered

**Isolation basis:** Read-only assertion against a freshly navigated page in its own Playwright browser context (fullyParallel: true, no storageState); no state to isolate beyond the default.

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `fixtures/pages.ts`, `steps/login.steps.ts`, `features/login.feature`

### SC-8 — Forgot password and Register links are present and navigable

_Type: happy-path · Tags: @login @navigation · Isolation: parallel-safe_

- Given I am on the sign-on page
- Then I should see a "Forgot password?" link
- And I should see a "Register" link
- When I click the "Forgot password?" link
- Then I am navigated away from the sign-on page (the destination flow's own behavior is out of scope for this ticket)

**Isolation basis:** Fresh per-test browser context from Playwright's default (fullyParallel: true, no storageState); the click-away navigation only affects this test's own context.

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `fixtures/pages.ts`, `steps/login.steps.ts`, `features/login.feature`

### SC-9 — The sign-on page does not link to the broken /login-broken demo page

_Type: negative · Tags: @login @negative @scope-boundary · Isolation: parallel-safe_

- Given I am on the sign-on page
- Then there is no visible or hidden link/button on the page pointing to "/login-broken"

**Isolation basis:** Read-only structural assertion (absence of a link) against a fresh per-test browser context (fullyParallel: true, no storageState); does not touch /login-broken or LoginBrokenPage at all, keeping this ticket's suite fully separate from CAP-18's.

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `fixtures/pages.ts`, `steps/login.steps.ts`, `features/login.feature`

## Reuse (plan-wide)

| Path | Kind | Why |
|------|------|-----|
| `pages/BasePage.ts` | page-object | Provides the shared open(path) navigation helper and currentUrl() that LoginPage/AccountsPage extend; no new base navigation logic is needed for this plan. |
| `pages/LoginPage.ts` | page-object | Already implements goto(), signOn(username, password), expectErrorVisible(), and expectErrorText() against the real /login DOM (getByLabel('Card number or username'), getByLabel('Password', exact), getByRole('button', {name:'Sign On'}), getByRole('alert')) — the exact interactions SC-1 through SC-6 need; extended (not replaced) for disclaimer/link/no-cross-nav checks. |
| `pages/AccountsPage.ts` | page-object | expectDisplayed() asserts the post-login URL matches /accounts, which SC-1 and SC-2 need for the happy-path redirect check. |
| `fixtures/pages.ts` | fixture | Supplies the loginPage/accountsPage fixtures (fresh instance per test against that test's own page) that every scenario's step definitions consume; this is also the mechanism confirming parallel-safety since it creates no shared/persistent state. |
| `steps/login.steps.ts` | step-definition | Already implements 'I am on the sign-on page', 'I sign on with username {string} and password {string}', 'I should be redirected to the accounts page', and 'I should see the sign-on error message' — reused as-is by SC-1 through SC-6; new steps for disclaimer/links/no-cross-nav are added here via extend, not a new file. |
| `features/login.feature` | step-definition | Existing feature already contains 3 scenarios (successful sign-on, invalid credentials, empty credentials) that overlap with SC-1/SC-3/SC-4's baseline cases; extended with Scenario Outlines and new scenarios rather than overwritten. |

## New Artifacts (plan-wide)

| Path | Kind | Mode | Purpose |
|------|------|------|---------|
| `features/login.feature` | feature-file | extend | Extend the existing 3-scenario feature with: a Scenario Outline for case-insensitive username success (SC-1), whitespace-trim success (SC-2), a consolidated invalid-credentials Scenario Outline covering password case-mismatch/wrong user/whitespace-padded password/special chars/long strings (SC-3), the existing empty-credentials scenario retained and reused (SC-4), partial-empty Scenario Outline (SC-5), repeated-submission scenario (SC-6), disclaimer scenario (SC-7), forgot-password/register link scenario (SC-8), and no-link-to-/login-broken scenario (SC-9). |
| `steps/login.steps.ts` | step-definition | extend | Add new step definitions: asserting exact error text (not just visibility) with role=alert, asserting the demo disclaimer text is visible, asserting presence and click-navigation of the 'Forgot password?' and 'Register' links, asserting no link/button on the page targets /login-broken, and driving/asserting 3 repeated invalid submissions without a reload. |
| `pages/LoginPage.ts` | page-object | extend | Add methods: expectErrorText already exists for exact-text assertions; add expectDisclaimerVisible(), forgotPasswordLink()/registerLink() locators plus clickForgotPassword()/clickRegister(), and expectNoLoginBrokenLink() for SC-9. Keep existing goto()/signOn()/expectErrorVisible()/expectErrorText() untouched. |

**Locator hints** (observed while reading source — hints for Code Agent, not commitments):

- `pages/LoginPage.ts`
  - Username/card-number field: `getByLabel('Card number or username') — already used in LoginPage.signOn()`
  - Password field: `getByLabel('Password', { exact: true }) — already used in LoginPage.signOn()`
  - Sign On submit button: `getByRole('button', { name: 'Sign On' })`
  - Inline error message: `getByRole('alert') — rendered only when error state is true, text 'Invalid card number or password. Please try again (demo / demo).'`
  - Demo disclaimer banner: `getByText('Demo mockup — not a real bank. Do not enter real credentials.')`
  - Forgot password link: `getByRole('link', { name: 'Forgot password?' }) — Link to="/forgot-password"`
  - Register link: `getByRole('link', { name: 'Register' }) — Link to="/register"`
  - Remember this device checkbox (decorative, out of scope for assertions per REQ-11/AC-6): `getByRole('checkbox') — no id/name/label association beyond wrapping <label> text 'Remember this device'`
  - Any link to the broken demo page (expected absent): `locator('a[href="/login-broken"]') — expected count 0; Login.jsx's only Links go to /forgot-password and /register`

---
*Generated from `CAP-15.design.json` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact Code Agent consumes; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*
