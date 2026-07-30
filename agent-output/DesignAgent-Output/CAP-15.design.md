# CAP-15 — Test Plan: Sign-In (Login) with demo credentials

**Built from:** `agent-output/ResearchAgent-Output/CAP-15.requirements.json`
**Answers file applied:** No

**Coverage:** 13/13 requirements covered, 6/6 edge cases covered, 2 out of scope.

## Assumptions

- **A-1** (from Q-1) — Q-1 asked whether username whitespace-trimming should be verified alongside case-insensitivity. No answers file resolved this, so Design Agent planned against the current Login.jsx implementation (which calls username.trim().toLowerCase() before comparison) as the contract to verify: SC-6 asserts that a leading/trailing-whitespace username still succeeds (EC-1), and SC-7 asserts the asymmetric behavior that password whitespace is NOT trimmed and therefore fails (EC-2). If this trim behavior is later deemed unintended, SC-6 will need to be revisited.
- **A-2** (from Q-2) — Q-2 asked whether a test should confirm /login-broken is unreachable from /login's own navigation. No answers file resolved this, so Design Agent included SC-14 to assert no link/button on /login references /login-broken, keeping the check confined to inspecting /login's DOM (never navigating to /login-broken itself), consistent with REQ-12's instruction that this ticket must not exercise the /login-broken page.
- **A-3** (new) — AC-6 ('Remember this device' checkbox) is marked testable: false and is decorative per the baseline, so it is placed in outOfScope. However REQ-11 separately requires that the checkbox can be checked/unchecked with no assertion on persisted state — this is a distinct, testable UI-interaction claim, so SC-13 covers REQ-11 at the DOM checked-property level only, without contradicting AC-6's out-of-scope status regarding persisted behavior.

## Out of Scope

- **AC AC-6** — Marked testable: false in the baseline — the 'Remember this device' checkbox is decorative only with no persisted behavior to verify. (Its checkbox-toggle UI interaction is still exercised under REQ-11 in SC-13; see A-3.)
- **AC AC-7** — Marked testable: false in the baseline — the /login-broken simulated-outage page belongs to CAP-18's scope and must not be conflated with this ticket's working /login flow. This ticket only checks, from within /login, that no link to /login-broken exists (see SC-14 / REQ-12 / EC-5); it does not test /login-broken's own behavior.

## Scenarios

| ID | Title | Type | Tags | Covers AC | Covers REQ | Covers EC |
|----|-------|------|------|-----------|------------|-----------|
| SC-1 | Successful sign-on with valid demo credentials | happy-path | @login @smoke @happy-path | AC-1 | REQ-1 | — |
| SC-2 | Sign-on fails with invalid credentials | negative | @login @negative | AC-2 | REQ-4, REQ-5, REQ-6 | — |
| SC-3 | Sign-on fails with empty credentials | boundary | @login @negative @boundary | AC-3 | REQ-7 | — |
| SC-4 | Sign-on succeeds regardless of username letter casing | happy-path | @login @happy-path | AC-1 | REQ-2 | — |
| SC-5 | Sign-on rejects a password that differs only by letter casing | negative | @login @negative | AC-1 | REQ-3 | — |
| SC-6 | Sign-on succeeds when username has leading/trailing whitespace | happy-path | @login @edge-case @happy-path | AC-1 | REQ-2 | EC-1 |
| SC-7 | Sign-on fails when password has leading/trailing whitespace | negative | @login @edge-case @negative | AC-2 | REQ-4 | EC-2 |
| SC-8 | Sign-on fails when only one of username/password is populated | boundary | @login @edge-case @boundary | — | REQ-4, REQ-5 | EC-3 |
| SC-9 | Repeated invalid sign-on attempts do not trigger lockout or duplicate error state | negative | @login @edge-case @negative | — | REQ-4, REQ-5 | EC-4 |
| SC-10 | Sign-on handles special characters and very long input without error | negative | @login @edge-case @negative | — | REQ-4, REQ-5 | EC-6 |
| SC-11 | Sign-on page displays the demo disclaimer | happy-path | @login @content | AC-4 | REQ-8, REQ-13 | — |
| SC-12 | Sign-on page exposes Forgot password and Register navigation links | happy-path | @login @navigation | AC-5 | REQ-9, REQ-10 | — |
| SC-13 | Remember this device checkbox can be checked and unchecked | happy-path | @login @ui | — | REQ-11 | — |
| SC-14 | Sign-on page contains no link or reference to the broken sign-on demo page | negative | @login @negative | — | REQ-12 | EC-5 |

## Scenario Details

### SC-1 — Successful sign-on with valid demo credentials

_Type: happy-path · Tags: @login @smoke @happy-path_

- Given the user is on the sign-on page
- When the user signs on with username "demo" and password "demo"
- Then the user is redirected to the accounts page

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/AccountsPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-2 — Sign-on fails with invalid credentials

_Type: negative · Tags: @login @negative_

- Given the user is on the sign-on page
- When the user signs on with username "demo" and password "wrongpassword"
- Then the inline error message "Invalid card number or password. Please try again (demo / demo)." is shown with role="alert"
- And the user remains on the sign-on page

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-3 — Sign-on fails with empty credentials

_Type: boundary · Tags: @login @negative @boundary_

- Given the user is on the sign-on page
- When the user submits the sign-on form with an empty username and an empty password
- Then the same generic invalid-credentials error message is shown (no distinct required-field message)

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-4 — Sign-on succeeds regardless of username letter casing

_Type: happy-path · Tags: @login @happy-path_

- Given the user is on the sign-on page
- When the user signs on with username "DEMO" and password "demo"
- Then the user is redirected to the accounts page
- When the user signs on again with username "Demo" and password "demo"
- Then the user is redirected to the accounts page
- When the user signs on again with username "dEmO" and password "demo"
- Then the user is redirected to the accounts page

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/AccountsPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-5 — Sign-on rejects a password that differs only by letter casing

_Type: negative · Tags: @login @negative_

- Given the user is on the sign-on page
- When the user signs on with username "demo" and password "DEMO"
- Then the inline invalid-credentials error message is shown
- And the user remains on the sign-on page

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-6 — Sign-on succeeds when username has leading/trailing whitespace

_Type: happy-path · Tags: @login @edge-case @happy-path_

- Given the user is on the sign-on page
- When the user signs on with username " demo " (leading and trailing spaces) and password "demo"
- Then the user is redirected to the accounts page

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/AccountsPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-7 — Sign-on fails when password has leading/trailing whitespace

_Type: negative · Tags: @login @edge-case @negative_

- Given the user is on the sign-on page
- When the user signs on with username "demo" and password " demo " (leading and trailing spaces)
- Then the inline invalid-credentials error message is shown
- And no navigation to the accounts page occurs

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-8 — Sign-on fails when only one of username/password is populated

_Type: boundary · Tags: @login @edge-case @boundary_

- Given the user is on the sign-on page
- When the user submits the sign-on form with username "demo" and an empty password
- Then the generic invalid-credentials error message is shown
- When the user submits the sign-on form with an empty username and password "demo"
- Then the generic invalid-credentials error message is shown

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-9 — Repeated invalid sign-on attempts do not trigger lockout or duplicate error state

_Type: negative · Tags: @login @edge-case @negative_

- Given the user is on the sign-on page
- When the user submits invalid credentials three times in a row
- Then a single generic invalid-credentials error message is shown after each attempt
- And the Sign On button remains enabled and no additional/stacked error messages appear

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-10 — Sign-on handles special characters and very long input without error

_Type: negative · Tags: @login @edge-case @negative_

- Given the user is on the sign-on page
- When the user signs on with a username/password containing special characters (e.g. "<script>'\"; DROP TABLE") and a very long string
- Then the generic invalid-credentials error message is shown
- And no page crash or unhandled exception occurs

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-11 — Sign-on page displays the demo disclaimer

_Type: happy-path · Tags: @login @content_

- Given the user is on the sign-on page
- Then the visible disclaimer "Demo mockup — not a real bank. Do not enter real credentials." is displayed on the form
- And the page footer text framing the site as a fictional, non-real bank for demonstration purposes is displayed

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-12 — Sign-on page exposes Forgot password and Register navigation links

_Type: happy-path · Tags: @login @navigation_

- Given the user is on the sign-on page
- Then a "Forgot password?" link is visible and points to the forgot-password route
- And a "Register" link is visible and points to the register route

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-13 — Remember this device checkbox can be checked and unchecked

_Type: happy-path · Tags: @login @ui_

- Given the user is on the sign-on page
- When the user checks the "Remember this device" checkbox
- Then the checkbox reflects a checked state
- When the user unchecks the "Remember this device" checkbox
- Then the checkbox reflects an unchecked state

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

### SC-14 — Sign-on page contains no link or reference to the broken sign-on demo page

_Type: negative · Tags: @login @negative_

- Given the user is on the sign-on page
- Then no link, button, or reference to the "/login-broken" route is present anywhere on the page
- And the user never navigates away from /login as a result of this check

**Artifacts used:** `features/login.feature`, `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`

## Reuse (plan-wide)

| Path | Kind | Why |
|------|------|-----|
| `pages/BasePage.ts` | page-object | Provides the shared open()/currentUrl() navigation helper that LoginPage.goto() and AccountsPage build on; every scenario's page objects depend on it. |
| `pages/LoginPage.ts` | page-object | Already implements goto(), signOn(username, password), expectErrorVisible(), and expectErrorText() — covers navigation to /login, submitting credentials, and asserting the role=alert error for the 3 existing scenarios and most new invalid-credential scenarios without modification. |
| `pages/AccountsPage.ts` | page-object | expectDisplayed() asserts the /accounts URL after a successful sign-on; reused by every happy-path scenario (SC-1, SC-4, SC-6). |
| `steps/login.steps.ts` | step-definition | Already wires 'I am on the sign-on page', 'I sign on with username {string} and password {string}', 'I should be redirected to the accounts page', and 'I should see the sign-on error message' — directly reusable by the 3 existing scenarios and as building blocks for several new ones. |
| `fixtures/pages.ts` | fixture | Supplies the loginPage and accountsPage Playwright fixtures every step definition (existing and new) depends on to construct page objects against the current test's page. |

## New Artifacts (plan-wide)

| Path | Kind | Mode | Purpose |
|------|------|------|---------|
| `features/login.feature` | feature-file | extend | Add 11 new scenarios (username case-insensitivity, password case-sensitivity, username/password whitespace edge cases, partial-empty submission, repeated invalid attempts, special-character/long-input handling, demo disclaimer visibility, Forgot password/Register link presence, Remember-this-device checkbox toggling, and no-link-to-/login-broken) to the existing file without discarding its current 3 scenarios (successful sign-on, invalid credentials, empty credentials). |
| `pages/LoginPage.ts` | page-object | extend | Add new methods needed by the new scenarios: expectDisclaimerVisible() and expectFooterFramingVisible() (AC-4/REQ-8/REQ-13), expectForgotPasswordLinkVisible() and expectRegisterLinkVisible() (AC-5/REQ-9/REQ-10), toggleRememberDeviceCheckbox()/expectRememberDeviceCheckboxState(checked) (REQ-11), and expectNoLoginBrokenLinkPresent() (REQ-12/EC-5). Existing goto()/signOn()/expectErrorVisible()/expectErrorText() are reused as-is (see reuse[]) — this entry only covers the additive methods. |
| `steps/login.steps.ts` | step-definition | extend | Add Given/When/Then steps binding to the new LoginPage methods: disclaimer/footer text assertions, Forgot password/Register link assertions, Remember-this-device check/uncheck steps, a repeated-invalid-submission step (loops signOn N times), a special-character/long-string sign-on step, and a no-link-to-/login-broken assertion step. Existing steps are reused as-is (see reuse[]) for scenarios that only need username/password submission and error/redirect assertions. |

---
*Generated from `CAP-15.design.json` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact Code Agent consumes; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*
