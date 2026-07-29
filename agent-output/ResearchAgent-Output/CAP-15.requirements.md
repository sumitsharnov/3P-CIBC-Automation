# CAP-15 — Sign-In (Login) with demo credentials

**Type:** story · **Source:** mock · **URL:** —

## Summary

Add/validate a working sign-on flow on the App Bank demo's `/login` page that accepts only the hardcoded username/password pair `demo`/`demo` (username matching case-insensitive, password exact) and redirects to the accounts dashboard on success, shows a single generic invalid-credentials error for any other input (including empty fields), clearly labels the page as a non-real demo, and exposes (but does not require testing of) password-reset, registration, and remember-device affordances. The separate simulated-outage page at `/login-broken` is explicitly excluded from this ticket's scope.

## Acceptance Criteria

| ID | Testable | Text |
|----|----------|------|
| AC-1 | ✅ | Username 'demo' (case-insensitive) + password 'demo' → redirected to accounts page. |
| AC-2 | ✅ | Any other username/password combo → inline error shown, stays on sign-on page. |
| AC-3 | ✅ | Empty username and password submitted → same invalid-credentials error (no separate required-field validation). |
| AC-4 | ✅ | Page displays a visible demo disclaimer. |
| AC-5 | ✅ | 'Forgot password?' and 'Register' links present and reachable (out of scope for this ticket's coverage). |
| AC-6 | ❌ | 'Remember this device' checkbox present, no persisted behavior to verify (decorative only). |
| AC-7 | ❌ | `/login-broken` (CAP-18) is a separate, out-of-scope page — must not be conflated with `/login`. _(Scope note about a different ticket's page, not an assertable behavior of this feature — see schema's `testable` definition.)_ |

## Requirements

| ID | Type | Related AC | Text |
|----|------|-----------|------|
| REQ-1 | functional | AC-1 | 'demo'/'demo' (any username casing, exact password case) navigates to /accounts. |
| REQ-2 | functional | AC-1 | Username matching is case-insensitive. |
| REQ-3 | functional | AC-1 | Password matching is exact/case-sensitive. |
| REQ-4 | functional | AC-2 | Invalid pair keeps user on sign-on page (no navigation). |
| REQ-5 | functional | AC-2 | Invalid pair shows exact error text: "Invalid card number or password. Please try again (demo / demo)." |
| REQ-6 | non-functional | AC-2 | Error message uses `role="alert"` for accessibility. |
| REQ-7 | functional | AC-3 | Both-empty submission → same error as AC-3, not a distinct required-field message. |
| REQ-8 | functional | AC-4 | Visible, non-dismissable demo disclaimer present. |
| REQ-9 | functional | AC-5 | 'Forgot password?' link present/navigable. |
| REQ-10 | functional | AC-5 | 'Register' link present/navigable. |
| REQ-11 | functional | AC-6 | 'Remember this device' checkbox checkable/uncheckable, no persistence assertion required. |
| REQ-12 | functional | AC-7 | `/login-broken` is a distinct route, not exercised by this ticket's tests. |
| REQ-13 | non-functional | — | Demo disclaimer/fictional-bank framing present independent of AC-4's exact wording. |

## Edge Cases

- **EC-1** — Username `' demo '` (whitespace-padded) + correct password. _`Login.jsx` calls `.trim().toLowerCase()` on username before comparing, so this currently succeeds — directly overlaps with open question Q-1._
- **EC-2** — Password `' demo '` (whitespace-padded). _Only username is trimmed; password is compared as-is, so this should fail — an asymmetry not called out anywhere in the ACs._
- **EC-3** — Only one of username/password populated. _AC-3 only covers both-empty; a partial submission is a distinct, untested boundary._
- **EC-4** — Repeated/rapid invalid submissions. _No lockout/throttling exists or is described; worth confirming no odd state (stacked errors, disabled button) appears._
- **EC-5** — Direct navigation to `/login-broken` vs. it being unreachable from `/login`'s own links. _`Login.jsx`'s rendered links only go to `/`, `/forgot-password`, `/register` — ties directly to open question Q-2._
- **EC-6** — Special characters / very long strings in either field. _No length/charset validation exists; should just fall into the standard invalid-credentials path._

## Open Ambiguities

- **Q-1** — 🟢 not blocking — Is username case-insensitivity the only intended leniency, or should whitespace-trimming (` demo `) also be a deliberate, verified requirement? _Impact: the code already trims — if unintended, a test could bake in an unreviewed implementation detail as if it were a real requirement._
- **Q-2** — 🟢 not blocking — Should there be an explicit test confirming `/login-broken` is NOT reachable from `/login`'s navigation? _Impact: without one, a future change could accidentally link the two pages with nothing catching the regression._

**Gate status:** 🟢 no blocking ambiguities — Design Agent may proceed.

## Target Area

**Pages:** Login

`src/pages/LoginBroken.jsx` exists and is a separate, functionally distinct simulated-503 page — relevant here only as a negative reference for EC-5/Q-2 (confirming no link from `/login` to it); actual test coverage for that page belongs to CAP-18. Verified directly against `Login.jsx` and `LoginBroken.jsx`.

---
*Generated from `CAP-15.requirements.json` — that file is the canonical machine-readable artifact consumed by the Design Agent; this file is a human-readable rendering of the same data.*
