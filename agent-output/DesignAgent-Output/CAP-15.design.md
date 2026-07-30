# CAP-15 — Test Plan: Sign-In (Login) with demo credentials

**Built from:** `agent-output/ResearchAgent-Output/CAP-15.requirements.json`
**Answers file applied:** No

**Coverage:** 13/13 requirements covered, 6/6 edge cases covered, 2 out of scope.

## Assumptions

- **A-1** (from Q-1) — Ambiguity Q-1 (whether username whitespace-trimming is an intended, verifiable contract) is non-blocking and unresolved by any answers file. Per targetArea.notes, Login.jsx does call username.trim().toLowerCase() before comparing, so SC-2 verifies this as the actual current behavior (an edge case worth catching regressions on), but it is treated as an implementation detail being characterized, not a hardened requirement — it is not folded into REQ-1/REQ-2's coversREQ mapping.
- **A-2** (from Q-2) — Ambiguity Q-2 (whether a no-cross-navigation check between /login and /login-broken is needed) is non-blocking and unresolved by any answers file. Design Agent proceeded conservatively by including SC-13, which asserts /login's rendered links are limited to home/Forgot-password/Register and never /login-broken, directly per EC-5's rationale and targetArea.notes confirming this against Login.jsx's actual link set.
- **A-3** (new) — The 'Remember this device' checkbox in Login.jsx has no id/htmlFor pairing but is wrapped by its <label> element (text 'Remember this device'), so it is assumed locatable via an accessible-name query (e.g. getByLabel/getByRole('checkbox', { name: ... })) without needing a new data-testid; if Code Agent finds this unreliable in practice, a testid should be requested rather than silently switching to a brittle CSS selector.

## Out of Scope

- **AC AC-6** — Marked testable: false in the baseline — the Remember-this-device checkbox has no persisted behavior to verify in this mock; only its toggle interaction (REQ-11) is covered, not any storage/session effect.
- **AC AC-7** — Marked testable: false in the baseline — the simulated-503 /login-broken page belongs to CAP-18 and must not be conflated with this ticket's /login coverage. This plan only asserts /login does not link to it (REQ-12/EC-5 via SC-13); it does not exercise /login-broken's own behavior.

## Scenarios

| ID | Title | Type | Tags | Covers AC | Covers REQ | Covers EC |
|----|-------|------|------|-----------|------------|-----------|
| SC-1 | Successful sign-on with demo credentials regardless of username casing | happy-path | @login @smoke | AC-1 | REQ-1, REQ-2 | — |
| SC-2 | Sign-on succeeds when username has leading/trailing whitespace | boundary | @login @boundary | AC-1 | — | EC-1 |
| SC-3 | Sign-on fails when password casing does not exactly match | negative | @login | AC-1 | REQ-3 | — |
| SC-4 | Sign-on fails when password has leading/trailing whitespace | boundary | @login @boundary | AC-1 | REQ-3 | EC-2 |
| SC-5 | Sign-on fails with a generic, accessible error for any invalid credential pair | negative | @login | AC-2 | REQ-4, REQ-5, REQ-6 | — |
| SC-6 | Sign-on with both username and password empty shows the same generic error | boundary | @login @boundary | AC-3 | REQ-7 | — |
| SC-7 | Sign-on with only one of username/password populated shows the same generic error | boundary | @login @boundary | — | — | EC-3 |
| SC-8 | Repeated invalid sign-on attempts show no unexpected accumulation or lockout state | boundary | @login @boundary | — | — | EC-4 |
| SC-9 | Sign-on with special characters or very long input strings degrades gracefully to the generic error | boundary | @login @boundary | — | — | EC-6 |
| SC-10 | Sign-on page clearly discloses it is a non-real demo | happy-path | @login | AC-4 | REQ-8, REQ-13 | — |
| SC-11 | Sign-on page exposes Forgot password and Register navigation links | happy-path | @login | AC-5 | REQ-9, REQ-10 | — |
| SC-12 | Remember this device checkbox can be toggled | happy-path | @login | — | REQ-11 | — |
| SC-13 | Sign-on page contains no navigation link to the simulated-outage /login-broken page | negative | @login | — | REQ-12 | EC-5 |

## Scenario Details

### SC-1 — Successful sign-on with demo credentials regardless of username casing

_Type: happy-path · Tags: @login @smoke_

- Given the user is on the sign-on page
- When they sign on with username "demo" and password "demo"
- Then they are redirected to the accounts page
- When they sign on with username "DEMO" and password "demo" (repeat for "Demo" and "dEmO")
- Then they are redirected to the accounts page for each casing variant

**Artifacts used:** `pages/LoginPage.ts`, `pages/AccountsPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-2 — Sign-on succeeds when username has leading/trailing whitespace

_Type: boundary · Tags: @login @boundary_

- Given the user is on the sign-on page
- When they sign on with username " demo " (leading/trailing spaces) and password "demo"
- Then they are redirected to the accounts page, reflecting the implementation's trim-before-compare behavior

**Artifacts used:** `pages/LoginPage.ts`, `pages/AccountsPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-3 — Sign-on fails when password casing does not exactly match

_Type: negative · Tags: @login_

- Given the user is on the sign-on page
- When they sign on with username "demo" and password "DEMO"
- Then they remain on the sign-on page and see the generic invalid-credentials error

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-4 — Sign-on fails when password has leading/trailing whitespace

_Type: boundary · Tags: @login @boundary_

- Given the user is on the sign-on page
- When they sign on with username "demo" and password " demo " (leading/trailing spaces)
- Then they remain on the sign-on page and see the generic invalid-credentials error, since password is compared as-is with no trim

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-5 — Sign-on fails with a generic, accessible error for any invalid credential pair

_Type: negative · Tags: @login_

- Given the user is on the sign-on page
- When they sign on with username "demo" and password "wrongpassword"
- Then they remain on the sign-on page (no navigation occurs)
- And an inline error with text "Invalid card number or password. Please try again (demo / demo)." is shown
- And that error element has role="alert"

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-6 — Sign-on with both username and password empty shows the same generic error

_Type: boundary · Tags: @login @boundary_

- Given the user is on the sign-on page
- When they submit the sign-on form with username "" and password ""
- Then the same generic invalid-credentials error is shown (no distinct 'required field' message appears)

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-7 — Sign-on with only one of username/password populated shows the same generic error

_Type: boundary · Tags: @login @boundary_

- Given the user is on the sign-on page
- When they submit the sign-on form with username "demo" and password ""
- Then the generic invalid-credentials error is shown
- When they submit the sign-on form with username "" and password "demo"
- Then the generic invalid-credentials error is shown

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-8 — Repeated invalid sign-on attempts show no unexpected accumulation or lockout state

_Type: boundary · Tags: @login @boundary_

- Given the user is on the sign-on page
- When they submit invalid credentials multiple times in a row (e.g. 3 consecutive failed attempts)
- Then a single generic invalid-credentials error is shown after each attempt, with no stacked/duplicated error messages
- And the Sign On button remains enabled and clickable (no lockout or throttling behavior)

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-9 — Sign-on with special characters or very long input strings degrades gracefully to the generic error

_Type: boundary · Tags: @login @boundary_

- Given the user is on the sign-on page
- When they sign on with a username/password containing special characters (e.g. "<script>", "' OR 1=1")
- Then the generic invalid-credentials error is shown with no rendering or JavaScript error
- When they sign on with a very long username/password string (e.g. 500+ characters)
- Then the generic invalid-credentials error is shown with no rendering or JavaScript error

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-10 — Sign-on page clearly discloses it is a non-real demo

_Type: happy-path · Tags: @login_

- Given the user is on the sign-on page
- Then a visible disclaimer reading "Demo mockup — not a real bank. Do not enter real credentials." is shown near the form
- And the page footer reads "© 2026 App Bank (fictional). For demonstration purposes only.", framing the whole page as a fictional, non-backed banking demo

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-11 — Sign-on page exposes Forgot password and Register navigation links

_Type: happy-path · Tags: @login_

- Given the user is on the sign-on page
- Then a "Forgot password?" link is visible and navigable (target flow behavior not asserted)
- And a "Register" link is visible and navigable (target flow behavior not asserted)

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-12 — Remember this device checkbox can be toggled

_Type: happy-path · Tags: @login_

- Given the user is on the sign-on page
- When they check the "Remember this device" checkbox
- Then the checkbox reflects a checked state
- When they uncheck the "Remember this device" checkbox
- Then the checkbox reflects an unchecked state (no persisted-state assertion is made)

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

### SC-13 — Sign-on page contains no navigation link to the simulated-outage /login-broken page

_Type: negative · Tags: @login_

- Given the user is on the sign-on page
- Then no link or button on the page navigates to "/login-broken"
- And the only navigable links present are the logo/home link, "Forgot password?", and "Register"

**Artifacts used:** `pages/LoginPage.ts`, `pages/BasePage.ts`, `steps/login.steps.ts`, `fixtures/pages.ts`, `features/login.feature`

## Reuse (plan-wide)

| Path | Kind | Why |
|------|------|-----|
| `pages/LoginPage.ts` | page-object | Already implements goto(), signOn(), expectErrorVisible()/expectErrorText() for the core sign-on flow this plan builds on. Code Agent extends it with new methods for the disclaimer/footer text, the Forgot password/Register links, the Remember-this-device checkbox toggle, and the no-cross-navigation-to-/login-broken check. |
| `pages/AccountsPage.ts` | page-object | expectDisplayed() already asserts redirect to /accounts, needed by the happy-path sign-on scenarios (SC-1, SC-2). |
| `pages/BasePage.ts` | page-object | Shared open()/currentUrl() helper that LoginPage.goto() relies on for every scenario's background navigation step. |
| `steps/login.steps.ts` | step-definition | Already wires 'I am on the sign-on page', 'I sign on with username/password', 'redirected to accounts page', and 'sign-on error message' steps. Code Agent extends it with new step defs for casing/whitespace variants, disclaimer/footer text, link presence, checkbox toggling, repeated-submission, special-character/long-string input, and no-cross-navigation assertions. |
| `fixtures/pages.ts` | fixture | Provides the loginPage and accountsPage fixture instances every scenario's step definitions depend on. |

## New Artifacts (plan-wide)

| Path | Kind | Purpose |
|------|------|---------|
| `features/login.feature` | feature-file | Existing file already covers a basic happy/invalid/empty-credentials trio; extend it with the additional CAP-15 scenarios (casing/whitespace variants, exact-match password negatives, partial-empty and repeated-submission boundaries, special-character/long-string input, disclaimer/footer text, Forgot-password/Register link presence, Remember-device checkbox toggling, and the no-link-to-/login-broken check) so every REQ/EC in this plan is actually exercised. |

---
*Generated from `CAP-15.design.json` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact Code Agent consumes; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*
