# Bank QA Automation — Agent Pipeline Tooling

This repo hosts the CIBC AI MVP agent pipeline: Claude Code subagents that
turn a Jira ticket into validated Java test automation for the `bank-app`
demo (a separate repo). This README documents the pipeline's validation and
gating tooling — the Java/Selenium/Cucumber/TestNG test framework itself
lives alongside this in the repo root.

## Layout

```
.claude/agents/
  research-agent.md                    Agent 1: ticket -> requirements baseline
  schemas/
    research-output.schema.json        Contract for *.requirements.json
    research-answers.schema.json       Contract for *.answers.json
  fixtures/
    mock-ticket-*.json                 Hand-written mock tickets for offline testing

agent-output/
  ResearchAgent-Output/
    <TICKET>.requirements.json         Canonical, machine-readable — Design Agent consumes this
    <TICKET>.requirements.md           Human-readable rendering of the same data
    <TICKET>.answers.json              Human answers to blocking ambiguities (see below)

scripts/
  validate-research-output.mjs         Schema validation for *.requirements.json and *.answers.json
  check-ambiguity-gate.mjs             The blocking-ambiguity gate (see below)
```

Each later agent (Design, Code, Test, Smoke Test, Coverage) gets its own
`agent-output/<AgentName>-Output/` folder following the same convention as it's
built.

## The blocking-ambiguity gate

Research Agent doesn't just extract requirements — it also flags open
questions (`ambiguities[]`) it can't resolve on its own, each marked
`blocking: true` or `blocking: false`.

- `blocking: false` means guessing wrong is cheap: downstream can proceed
  under a stated assumption without corrupting the test suite's meaning.
- `blocking: true` means guessing wrong would make a later agent **write a
  test that certifies the wrong behavior as correct** — a green test that
  locks in a bug or an unintended scope, which is worse than no test at all.
  If `blocking` is omitted entirely, it's treated as `true` (fail-safe).

Agents cannot prompt a human interactively — Claude Code subagents don't have
that capability. So the flow is: Research Agent **reports** blocking
questions in its structured output; the **orchestrator** (a human, or CI)
decides whether to halt.

### Running the gate

```
node scripts/check-ambiguity-gate.mjs agent-output/ResearchAgent-Output/<TICKET>.requirements.json
```

- Exit code `0` — no unresolved blocking ambiguities. Safe to proceed to
  Design Agent.
- Exit code `1` — one or more blocking ambiguities are unresolved. The gate
  prints each one's ID, question, and impact. **Do not proceed.**

If a matching `<TICKET>.answers.json` exists (see schema at
`.claude/agents/schemas/research-answers.schema.json`), any blocking
ambiguity whose ID appears in `answers[].questionId` counts as resolved. A
human writes this file after reading the questions and deciding; there is no
automated way to satisfy the gate.

### Headless / CI behavior — deliberate design decision

When this pipeline eventually runs non-interactively (e.g. `claude -p` from a
GitHub Actions job, no human present to ask), an unanswered blocking
ambiguity **must fail the run**, loudly, listing exactly what needs
answering. It must **not** proceed on an assumption just because no one was
around to ask.

This is deliberate, not a missing feature to smooth over later: the entire
point of the `blocking` field is that guessing wrong here produces a passing
test that certifies incorrect behavior — the worst possible outcome for a
test suite, because it looks like coverage while actively hiding a real
problem. A CI job that silently assumes its way past a blocking ambiguity
defeats the reason the gate exists. Failing loudly and stopping is strictly
better than proceeding on a guess, even though it means a human has to go
answer the question before the pipeline can continue.

## Schema validation

```
node scripts/validate-research-output.mjs
```

With no arguments, validates every `*.requirements.json` and `*.answers.json`
file under `agent-output/ResearchAgent-Output/`. Pass a specific path to
validate just one file. Exits non-zero on any schema violation — this is a
hard contract, not documentation; nothing should be handed to Design Agent
without passing this first.

**Node version:** both scripts require Node **22+** (they use `fs.globSync`).
This works locally (tested on v24) but isn't yet pinned anywhere for CI — when
wiring this into a GitHub Actions workflow, pin the Node version explicitly
(e.g. `actions/setup-node` with `node-version: '22'` or later).

## For Design Agent (build later, recorded now)

Design Agent's prompt must require reading `<TICKET>.answers.json` if it
exists, and treat those answers as **authoritative** — overriding its own
independent reading of the ticket or the code wherever they conflict.
