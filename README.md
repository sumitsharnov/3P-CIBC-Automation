# Bank QA Automation

This repo hosts two things for the CIBC AI MVP prototype:

1. The **agent pipeline tooling** — Claude Code subagents that turn a Jira
   ticket into a validated test plan for the `bank-app` demo (a separate
   repo), plus the schemas/scripts that keep handoffs between agents
   reliable.
2. The **test automation framework** itself — Playwright + TypeScript +
   `playwright-bdd`, testing `bank-app` end to end.

Stack decision (Helix vision doc, *Project Vision: CIBC AI MVP*, Revision 4):
Playwright replaces Selenium entirely, both as the test framework and as the
agent's tool for live-app inspection. Gherkin `.feature` files are retained
via `playwright-bdd` — stakeholders can still read scenarios in plain
Given/When/Then, and Research Agent already emits acceptance criteria in that
shape.

This repo is also a local Claude Code **plugin** (`.claude-plugin/plugin.json`
+ `.claude-plugin/marketplace.json`), which is how agent definitions live in a
top-level `agents/` folder instead of the more common `.claude/agents/`
project convention. To use it in a fresh Claude Code install: `/plugin` →
Marketplaces → Add → point it at this repo's absolute path → install
`bank-qa-automation-pipeline` → restart Claude Code. Agents then register
under a namespaced type, e.g. `bank-qa-automation-pipeline:research-agent`.

## Layout

```
.claude-plugin/
  plugin.json                          Plugin manifest (name, version, description)
  marketplace.json                     Local marketplace catalog listing this plugin (source: ".")

agents/
  research-agent.md                    Agent 1: ticket -> requirements baseline (discovered via the plugin, not .claude/agents/)
  design-agent.md                      Agent 2: requirements baseline -> scenario-level test plan
  code-agent.md                        Agent 3: test plan -> real .feature/step/page-object files (the pipeline's only writer)

pipeline/
  schemas/
    research-output.schema.json        Contract for *.requirements.json
    research-answers.schema.json       Contract for *.answers.json
    design-output.schema.json          Contract for *.design.json
    code-output.schema.json            Contract for *.code.json (Code Agent's success shape)
    code-output-error.schema.json      Contract for *.code.error.json (Code Agent's halt shape — a different file, never overwrites a successful run)
  fixtures/
    mock-ticket-*.json                 Hand-written mock tickets for offline testing

agent-output/
  ResearchAgent-Output/
    <TICKET>.requirements.json         Canonical, machine-readable — Design Agent consumes this
    <TICKET>.requirements.md           Human-readable rendering of the same data
    <TICKET>.answers.json              Human answers to blocking ambiguities (see below)
  DesignAgent-Output/
    <TICKET>.design.json               Canonical, machine-readable — Code Agent consumes this
    <TICKET>.design.md                 Human-readable rendering of the same data
  CodeAgent-Output/
    <TICKET>.code.json                 Canonical, machine-readable — Test Agent consumes this
    <TICKET>.code.md                   Human-readable rendering of the same data
    <TICKET>.code.error.json           Present only when Code Agent halted instead of producing output

scripts/
  validate-research-output.mjs         Schema validation for *.requirements.json, *.answers.json, and *.design.json
  validate-code-output.mjs             Schema validation for *.code.json and *.code.error.json
  render-plan.mjs                      Renders requirements/design/code JSON to their .md siblings
  check-ambiguity-gate.mjs             The blocking-ambiguity gate (see below)
  run-e2e-with-report.mjs              Runs the e2e suite, then always generates the report (see below)

features/                              Gherkin .feature files, tagged (@login, @login-broken, ...)
steps/                                 Step definitions: thin, call page objects + assert, no raw Playwright calls
pages/                                 One Page Object per screen, extends BasePage
fixtures/pages.ts                      Playwright fixtures wiring page objects into tests
reporting/                             Parses Playwright's JSON reporter output -> custom HTML/CSS dashboard
playwright.config.ts                   Projects, baseURL, reporters, trace/screenshot settings
```

Each later agent (Design, Code, Test, Smoke Test, Coverage) gets its own
`agent-output/<AgentName>-Output/` folder following the same convention as it's
built.

## Test framework — Playwright + TypeScript + playwright-bdd

### Running the suite

```
npm run test:e2e:report
```

This generates the BDD spec files (`bddgen`), runs the suite against
`baseURL` (default `http://localhost:5173` — start `bank-app`'s own dev
server first, e.g. `npm run dev` in that repo), then **always** regenerates
the custom HTML report at `test-results/qa-report/index.html`, whether tests
passed or failed. A failing run is exactly when the report is most useful, so
report generation isn't skipped on test failure.

Other scripts:
- `npm run bddgen` — just (re)generate `.features-gen/` from the `.feature` files, no test run.
- `npm run test:e2e` — `bddgen` + `playwright test`, no report.

### Why a custom report, not Playwright's built-in HTML reporter

Same reasoning as the discarded Java framework's report: we want a
stakeholder-facing, single-file dashboard with a plain-English diagnosis per
scenario (what it verified, or a classified reason for failure — timeout,
assertion mismatch, strict-mode locator collision, etc.), not just a
pass/fail list. `playwright.config.ts` configures the `json` reporter
(`test-results/results.json`); `reporting/generate-report.mjs` parses that
and renders the dashboard, embedding failure screenshots as base64 so the
report is a single self-contained HTML file.

### Playwright-bdd version note

`playwright-bdd` v9 requires an explicit generation step (`bddgen`) before
`playwright test` — unlike some older major versions, `defineBddConfig()` in
`playwright.config.ts` no longer generates spec files as a side effect of
loading the config. `npm run test:e2e` and `test:e2e:report` already do this
for you; if invoking `playwright test` directly, run `npx bddgen` first or
you'll get `Error: No tests found`.

Also note: any file that a step-definition file imports its custom `test`
fixture from (here, `fixtures/pages.ts`) must be included in
`defineBddConfig`'s `steps` glob, not just the step files themselves —
otherwise `bddgen` can't statically determine which fixture-extended `test`
instance is in use and fails with *"Can't guess test instance"*.

### Playwright conventions used here (don't port Selenium habits)

- No explicit waits or `sleep` — Playwright auto-waits on locators. Anything
  that needs waiting for is expressed as a locator assertion
  (`await expect(locator).toBeVisible()`), not a manual wait.
- Semantic locators over CSS/XPath: `getByLabel`, `getByRole`. The app's
  error messages use `role="alert"`, which is why `LoginPage`/`LoginBrokenPage`
  select errors via `getByRole('alert')` rather than a CSS class.
  `bank-app`'s labels are properly associated via `<label htmlFor>`/`id`, so
  `getByLabel` works directly against the real markup.
  Test framework depends on this convention — if a form label ever loses its
  `htmlFor`/`id` association, tests will fail to find the field, not
  silently pass with the wrong element.
- Screenshots for the custom report come from Playwright's own
  `screenshot: 'only-on-failure'` config (an attachment on the JSON result),
  not a custom after-step hook — Playwright already captures this natively;
  `generate-report.mjs` just reads the attachment file and embeds it.

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
`pipeline/schemas/research-answers.schema.json`), any blocking
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
node scripts/validate-code-output.mjs
npm run validate:all-output          # both, in one sweep
```

With no arguments, `validate-research-output.mjs` validates every
`*.requirements.json`/`*.answers.json` file under
`agent-output/ResearchAgent-Output/` and every `*.design.json` under
`agent-output/DesignAgent-Output/`. `validate-code-output.mjs` validates
every `*.code.json`/`*.code.error.json` under
`agent-output/CodeAgent-Output/`. Pass a specific path to validate just one
file. Exits non-zero on any schema violation — this is a hard contract, not
documentation; nothing should be handed to the next agent without passing
this first.

Code Agent's two output shapes (`*.code.json` success, `*.code.error.json`
halt) dispatch by **filename suffix**, same as `.requirements.json` vs
`.answers.json` — not by inspecting file content — because they deliberately
live at different paths (a halt must never overwrite the last known-good
success file).

**Node version:** both scripts require Node **22+** (they use `fs.globSync`).
This works locally (tested on v24) but isn't yet pinned anywhere for CI — when
wiring this into a GitHub Actions workflow, pin the Node version explicitly
(e.g. `actions/setup-node` with `node-version: '22'` or later).

## For Design Agent (build later, recorded now)

Design Agent's prompt must require reading `<TICKET>.answers.json` if it
exists, and treat those answers as **authoritative** — overriding its own
independent reading of the ticket or the code wherever they conflict.

## For Test Agent (build later, recorded now)

Test Agent's structured failure feedback — the thing that drives Code
Agent's rewrite loop — must be shaped exactly as:

```json
{ "test_case_name": "...", "source_feature_file": "...", "source_step_file": "...",
  "error_type": "...", "failing_assertion": "...", "stack_trace": "..." }
```

one entry per failing test. Code Agent's `rewrite.triggeringFailures[]` in
`<TICKET>.code.json` expects this shape literally — changing it on Test
Agent's side breaks the rewrite loop silently, since Ajv only validates each
agent's own output, not the shape crossing the boundary between two agents.

Test Agent should read `compile.finalStatus` in `<TICKET>.code.json` before
running anything — `"fail"` means Code Agent never produced a compiling
suite and there is nothing to execute.

The Code↔Test rewrite loop is capped at 3 round-trips OR 18 minutes
cumulative wall-clock, whichever hits first. Code Agent reports only its own
round-trip's timing (`rewrite.startedAt`/`completedAt`); summing elapsed time
across round-trips and refusing to invoke a 4th is the **orchestrator's**
job — neither agent tracks the cumulative total itself across separate
invocations.
