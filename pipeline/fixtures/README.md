# Pipeline fixtures — fabricated tickets only

Files here are **fabricated** tickets: hand-authored JSON with no corresponding
Jira issue. They exist to exercise pipeline paths a real ticket doesn't
happen to cover (e.g. a ticket that should trip the blocking-ambiguity gate).

## Naming

`FIXTURE-NNN.json`, allocated sequentially. The inner `id` field must match
the filename exactly (`FIXTURE-001.json` → `"id": "FIXTURE-001"`).

Never reuse a `CAP-*`-shaped ID here. This directory is not where offline
copies of real Jira tickets live — that's `mock-tickets/`, and the two are
kept apart on purpose (see below). If you can't cross-reference a fixture
against a real Jira issue, it belongs here as `FIXTURE-NNN`; if you can,
it belongs in `mock-tickets/` instead.

## Why this differs from `mock-tickets/`

The two directories hold different things and use different JSON shapes:

- `mock-tickets/<TICKET-ID>.mock.json` — an **offline copy of a real Jira
  ticket**, in the raw Jira REST response shape (`{ key, fields: {...} }`).
  The real ticket ID stays in the filename so it can be cross-referenced
  against Jira.
- `pipeline/fixtures/FIXTURE-NNN.json` — a **fabricated** ticket with no
  Jira counterpart, in a hand-authored shape (`{ id, title, type, url,
  reporter, description, acceptanceCriteria[], comments[] }`).

Merging these into one folder/convention would put two incompatible JSON
shapes behind one naming rule, and would make it impossible to tell "this
came from a real ticket" from "this was invented for testing" without
opening the file. Keep them separate.

## History

`FIXTURE-001` was previously named `mock-ticket-CAP-2044.json` with inner
`id: "CAP-2044"`. CAP-2044 was never a real Jira ticket — the old name
collided with real `CAP-*` ticket IDs and, under ADR-005's
`agent-output/{ticket-id}/` layout, would have produced an
`agent-output/CAP-2044/` directory nobody could look up in Jira. Renamed
per CAP-50. If you find `CAP-2044` referenced in git history or an older
document, it's this fixture.
