# Mock tickets — offline copies of real Jira tickets

Files here are offline copies of **real** Jira tickets, named
`<TICKET-ID>.mock.json` (e.g. `CAP-15.mock.json`) so the filename can never
be mistaken for a live Jira pull. Raw Jira REST response shape
(`{ key, fields: {...} }`) — the inner `key` stays the real ticket ID.

Fabricated tickets with no Jira counterpart don't belong here — see
`pipeline/fixtures/README.md` for that convention and why the two are kept
separate.
