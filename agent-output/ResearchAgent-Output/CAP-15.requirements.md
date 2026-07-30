# CAP-15 — Sign-In (Login) with demo credentials

**Type:** story · **Source:** mock · **URL:** —

## Summary

Add/validate a working sign-on flow on the App Bank demo's /login page that accepts only the hardcoded username/password pair 'demo'/'demo' (username matching case-insensitive, password exact) and redirects to the accounts dashboard on success, shows a single generic invalid-credentials error for any other input (including empty fields), clearly labels the page as a non-real demo, and exposes (but does not require testing of) password-reset, registration, and remember-device affordances. The separate simulated-outage page at /login-broken is explicitly excluded from this ticket's scope.

## Acceptance Criteria

| ID | Testable | Text |
|----|----------|------|
| AC-1 | ✅ | Given a user is on the sign-on page, when they enter username 'demo' (case-insensitive) and password 'demo', then they are redirected to the accounts page. |
| AC-2 | ✅ | Given a user enters any username/password combination that isn't the demo/demo pair, when they submit, then an inline error message is shown: 'Invalid card number or password. Please try again (demo / demo).' and they remain on the sign-on page. |
| AC-3 | ✅ | Given a user submits the sign-on form with empty username and password fields, when they click Sign On, then the same invalid-credentials error is shown (no separate 'required field' validation exists). |
| AC-4 | ✅ | The sign-on page must display a visible disclaimer that this is a demo mockup and real credentials should not be entered. |
| AC-5 | ✅ | The page provides navigation links to 'Forgot password?' and 'Register' flows, which must be reachable but are out of scope for this ticket's test coverage. |
| AC-6 | ❌ | A 'Remember this device' checkbox is present but has no persisted behavior to verify (decorative only in this mock). |
| AC-7 | ❌ | Separately, there exists a broken sign-on demo page (/login-broken, tracked in CAP-18) that simulates a persistent 503-style failure even with correct credentials — that page is explicitly out of scope for this ticket and must not be conflated with the working /login flow. |

## Requirements

| ID | Type | Related AC | Text |
|----|------|-----------|------|
| REQ-1 | functional | AC-1 | Submitting the sign-on form with username 'demo' (any letter casing) and password 'demo' (exact case) navigates the user to /accounts. |
| REQ-2 | functional | AC-1 | Username matching for the demo account is case-insensitive (e.g. 'DEMO', 'Demo', 'dEmO' all succeed when paired with password 'demo'). |
| REQ-3 | functional | AC-1 | Password matching for the demo account is exact/case-sensitive — a password of 'DEMO' or 'Demo' with username 'demo' does not succeed. |
| REQ-4 | functional | AC-2 | Submitting any username/password pair other than the valid demo/demo combination keeps the user on the sign-on page (no navigation occurs). |
| REQ-5 | functional | AC-2 | Submitting any invalid username/password pair displays the inline error text 'Invalid card number or password. Please try again (demo / demo).'. |
| REQ-6 | non-functional | AC-2 | The inline error message is rendered with an accessible alert role (role="alert") so it is announced to assistive technology. |
| REQ-7 | functional | AC-3 | Submitting the form with both username and password fields empty produces the same invalid-credentials error as AC-3, not a distinct 'required field' message. |
| REQ-8 | functional | AC-4 | The sign-on page displays a visible, non-dismissable disclaimer stating this is a demo mockup and that real credentials should not be entered. |
| REQ-9 | functional | AC-5 | The sign-on page renders a 'Forgot password?' link that is present and clickable/navigable (target flow behavior out of scope). |
| REQ-10 | functional | AC-5 | The sign-on page renders a 'Register' link that is present and clickable/navigable (target flow behavior out of scope). |
| REQ-11 | functional | AC-6 | The sign-on page renders a 'Remember this device' checkbox that can be checked/unchecked, with no assertion required on any persisted state. |
| REQ-12 | functional | AC-7 | The /login-broken page (CAP-18 scope) is a distinct route/component from /login and must not be exercised by this ticket's test coverage. |
| REQ-13 | non-functional | — | The demo disclaimer text and the page's framing as a fictional, non-backed banking demo (per description) must be present on /login independent of the specific wording of AC-4. |

## Edge Cases

- **EC-1** — Username 'demo' with leading/trailing whitespace (e.g. ' demo ') paired with correct password.
  _Rationale: Login.jsx source calls username.trim().toLowerCase() before comparison, so trimmed whitespace currently succeeds — this directly overlaps with the ticket's first open question and should be verified either way the ambiguity is resolved, so the actual implemented behavior isn't left untested._
- **EC-2** — Password 'demo' with leading/trailing whitespace (e.g. ' demo ').
  _Rationale: Only username is trimmed in the current implementation; password is compared as-is, so a whitespace-padded password should fail. This asymmetry isn't called out in the AC text and would be easy for a test author to assume works the same as username._
- **EC-3** — Submitting with only one of username/password populated (e.g. valid username 'demo' with blank password, or blank username with valid password 'demo').
  _Rationale: AC-3 only covers the both-empty case; a partially-empty submission is a distinct boundary not explicitly listed and should still resolve to the same generic invalid-credentials error given there's no field-level validation in the component._
- **EC-4** — Repeated/rapid submission of invalid credentials (multiple failed attempts in a row).
  _Rationale: There is no lockout, throttling, or attempt-count behavior described or implemented; worth confirming no unexpected state (e.g. stacking error messages, disabled button) appears after multiple failures, since the ticket doesn't say the form is stateless across submissions._
- **EC-5** — Direct navigation to /login-broken versus /login-broken being unreachable via any link/button on the /login page itself.
  _Rationale: Login.jsx's rendered links only go to '/', '/forgot-password', and '/register' — there is no visible or hidden link to /login-broken from the working login page, which is exactly what the ticket's second open question is asking to confirm; flagging this as an edge case ties the code reality to the open ambiguity rather than assuming it's already verified._
- **EC-6** — Special characters or very long strings entered into username/password fields.
  _Rationale: The component performs no length limit or character-set validation before comparison, so arbitrary input should simply fall into the standard invalid-credentials path rather than causing a rendering or JS error._

## Open Ambiguities

- **Q-1** — 🟢 not blocking — Is username matching intended to be case-insensitive only for 'demo', or should whitespace-trimming also be verified (e.g. ' demo ' with leading/trailing spaces)?
  _Impact: The current Login.jsx implementation already trims username whitespace before lowercasing, so if this is unintended behavior, the Design Agent could write a test asserting the wrong (undocumented) contract; if left unresolved, downstream may either skip testing this trim behavior entirely or bake an unreviewed implementation detail into the accepted spec as if it were a deliberate requirement._
- **Q-2** — 🟢 not blocking — Should there be a distinct test path confirming the broken /login-broken page is NOT reachable from the main /login page's navigation (to avoid QA accidentally testing the wrong page)?
  _Impact: Without a decision, the Design Agent may omit a no-cross-navigation check entirely, leaving open the risk that a future change accidentally links /login to /login-broken (or vice versa) with no regression test catching it, and CAP-15/CAP-18 test suites could end up silently covering (or missing) each other's page._

**Gate status:** 🟢 all blocking ambiguities resolved — clear to proceed to Design Agent.

## Target Area

**Pages:** Login

src/pages/LoginBroken.jsx exists in the bank-app-1 repo and renders a visually similar but functionally distinct simulated-503 sign-on page; it is in scope only as a negative reference for edge case EC-5 / ambiguity Q-2 (confirming /login does not link to it), not as a target page for this ticket's own test coverage — that page belongs to CAP-18. Verified directly against C:\Users\sumit.kumar1\Documents\bank-app-1\src\pages\Login.jsx and LoginBroken.jsx.

---
*Generated from `CAP-15.requirements.json` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*
