# Test fixtures — not agent output

Files here are synthetic inputs for testing the pipeline's validation
scripts. They are deliberately malformed/drifted in ways a real agent
output should never be, purely to exercise a specific check. **Never treat
anything in this folder as a real Research/Design Agent artifact** — that's
why they live outside `agent-output/` entirely, under a name that says what
they are.

## `UNIFORMITY-TEST-FIXTURE-drifted.design.json`

**Must stay at 15 scenarios or more.** `validate-research-output.mjs`
skips the uniformity check entirely below `UNIFORMITY_MIN_SCENARIOS` (15 —
raised from an original 9 after CAP-15's real 9-scenario plan proved that
3-per-side is small enough for a single atypical scenario to swing the
average past a threshold on pure noise). This fixture currently has 18,
comfortably above the floor. If you ever trim it down, check the new count
against that constant first — dropping below 15 doesn't make the fixture
fail loudly, it makes the check silently skip and stop testing anything at
all, which is worse than deleting the fixture outright because it *looks*
like coverage that isn't there.

A copy of `agent-output/DesignAgent-Output/CAP-19.design.json` with the last
third of its scenarios deliberately degraded to simulate attention dilution
in a long generation:
- `steps[]` halved in length
- `title` collapsed to ~40% of its original length
- `isolationNotes` emptied (kept as `""`, which is schema-valid, so the file
  still passes schema + the REQ-coverage/artifact-pool completeness checks
  and actually reaches the uniformity heuristic — that's the point)

Used to confirm `scripts/validate-research-output.mjs`'s uniformity check
(and `--strict-uniformity`) actually fires on real drift, not just on the
two genuine plans where it happens not to fire. Regenerate with:

```
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('agent-output/DesignAgent-Output/CAP-19.design.json','utf-8'));
const n = d.scenarios.length;
const thirdSize = Math.floor(n/3);
d.scenarios.forEach((s, i) => {
  if (i >= n - thirdSize) {
    s.steps = s.steps.slice(0, Math.max(1, Math.ceil(s.steps.length / 2)));
    s.title = s.title.slice(0, Math.ceil(s.title.length * 0.4));
    s.isolationNotes = '';
    s.coversEC = [];
  }
});
fs.writeFileSync('scripts/test-fixtures/UNIFORMITY-TEST-FIXTURE-drifted.design.json', JSON.stringify(d, null, 2) + '\n');
"
```

Verify it's caught:
```
node scripts/validate-research-output.mjs scripts/test-fixtures/UNIFORMITY-TEST-FIXTURE-drifted.design.json --strict-uniformity
# expect: WARN with 3 tripped rules, exit 1
```

## `CODE-OUTPUT-TEST-FIXTURE-valid.code.json`

A schema-valid, completeness-valid Code Agent "generate" output referencing
the real `agent-output/DesignAgent-Output/CAP-15.design.json` — one
`fileOperations[]` entry per each of that plan's 3 `newArtifacts[]` (all
`mode: extend`), scenario coverage spanning all 9 scenarios, `tsc` passing on
attempt 1. `content` fields are placeholder snippets, not real generated
code — this fixture exercises `validate-code-output.mjs`, not Code Agent
itself.

```
node scripts/validate-code-output.mjs scripts/test-fixtures/CODE-OUTPUT-TEST-FIXTURE-valid.code.json
# expect: PASS, exit 0, .code.md rendered alongside it
```

## `CODE-OUTPUT-TEST-FIXTURE-broken.code.json`

Deliberately fails `checkCodeCompleteness()` on two axes at once: a
`fileOperations[]` entry (`pages/RandomUnplannedPage.ts`) that doesn't
appear anywhere in CAP-15's `newArtifacts[]` (axis 1), and missing coverage
for the plan's other two real `newArtifacts[]` entries in a `"generate"` run
(axis 2 — `steps/login.steps.ts` and `pages/LoginPage.ts` have no
corresponding file operation).

```
node scripts/validate-code-output.mjs scripts/test-fixtures/CODE-OUTPUT-TEST-FIXTURE-broken.code.json
# expect: FAIL (schema passes; completeness check reports 3 errors), exit 1
```

## `CODE-OUTPUT-TEST-FIXTURE-rewrite.code.json`

A `"rewrite"`-mode output: one targeted `fileOperations[]` entry
(`steps/login.steps.ts` only), a failed-then-passed `compile.attempts[]`
(exercises the self-correction-retry consistency checks), and a populated
`rewrite` object (`roundTrip: 1`, one `triggeringFailures[]` entry in Test
Agent's exact feedback shape, `regeneratedPaths` matching `fileOperations[]`
exactly). Exists to prove the rewrite-specific validator branches actually
run, not just the "generate" path.

```
node scripts/validate-code-output.mjs scripts/test-fixtures/CODE-OUTPUT-TEST-FIXTURE-rewrite.code.json
# expect: PASS, exit 0
```

## `CODE-OUTPUT-TEST-FIXTURE-halt.code.error.json`

A schema-valid halt envelope (`status: "error"`) — confirms
`validate-code-output.mjs` dispatches `.code.error.json` files to
`code-output-error.schema.json` by filename suffix and applies no
completeness check (a halt has no real file operations to cross-check).

```
node scripts/validate-code-output.mjs scripts/test-fixtures/CODE-OUTPUT-TEST-FIXTURE-halt.code.error.json
# expect: PASS, exit 0, no .md rendered
```
