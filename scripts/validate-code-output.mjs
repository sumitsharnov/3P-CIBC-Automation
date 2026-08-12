#!/usr/bin/env node
// Validates Code Agent's output files against their JSON schemas:
//   *.code.json       -> pipeline/schemas/code-output.schema.json (success shape),
//                        PLUS a cross-file completeness check (see below) that
//                        JSON Schema alone cannot express.
//   *.code.error.json -> pipeline/schemas/code-output-error.schema.json (halt shape),
//                        schema-only — a halt envelope has nothing to cross-check
//                        against the design plan, since no real file operations
//                        happened.
// Hard-fails (non-zero exit) on any violation, so the orchestrator (and CI,
// later) can refuse to hand bad output downstream to Test Agent.
//
// Dispatch is by FILENAME SUFFIX (.code.json vs .code.error.json), the same
// pattern validate-research-output.mjs already uses for .requirements.json
// vs .answers.json — this only works because Code Agent's success and error
// outputs deliberately live at two different paths (see code-output-error's
// schema description for why: a halt must never overwrite the last
// known-good success file).
//
// Usage:
//   node scripts/validate-code-output.mjs <file.json> [<file2.json> ...]
//   node scripts/validate-code-output.mjs --only=code   (all *.code.json + *.code.error.json)
//   npm run validate:code-output              -> --only=code
//
// With no arguments and no --only flag, validates every *.code.json and
// *.code.error.json under agent-output/CodeAgent-Output/ — and, if that
// folder has nothing yet (a fresh clone, or a repo state where research/
// design have run but no ticket has reached Code Agent), exits 0 with an
// informational message rather than failing. That's what makes
// `npm run validate:all-output` safe to run before Code Agent has ever
// produced anything. An EXPLICIT request — --only=code, or a specific path
// — finding zero matches is still a hard error (exit 2): that means you
// asked for something specific and it isn't there.
//
// Code-output completeness checks (cross-file, none expressible in JSON
// Schema alone — same reasoning as validate-research-output.mjs's
// checkDesignCompleteness):
//   1. Every fileOperations[].path must resolve to an entry in the design
//      plan's newArtifacts[] (never reuse[]-only, and never duplicated).
//   2. A "generate" run must cover every newArtifacts[] path; a "rewrite"
//      run only needs its own regenerated subset.
//   3. fileOperations[].kind/.mode must match the design plan's newArtifacts[]
//      entry for that path exactly — Code Agent must not re-derive these.
//   4. coverage.scenariosCovered must equal the union of fileOperations[]'s
//      scenarioIds; a "generate" run must additionally cover every scenario
//      in the design plan.
//   5. No page-object file operation for a scenario whose resolved
//      artifacts[] contains no page-object entry (AC #8).
//   6. compile.finalStatus === "fail" is a hard error (AC #10) — schema-valid
//      is not the same as safe to hand downstream.
//   7. runMode "rewrite" requires a present rewrite object; rewrite.budgetExceeded
//      is a hard error; rewrite.regeneratedPaths must equal fileOperations[].path.
//   8. compile.attempts/passedOnAttempt/finalStatus internal consistency.
//
// NODE VERSION NOTE: this script uses fs.globSync (node:fs), which requires
// Node 22+, same as the rest of this pipeline's scripts.

import { readFileSync, writeFileSync, existsSync, globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { renderCodeMarkdown } from './render-plan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'pipeline', 'schemas');
const CODE_SUCCESS_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'code-output.schema.json');
const CODE_ERROR_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'code-output-error.schema.json');
const CODE_OUTPUT_DIR = path.join(REPO_ROOT, 'agent-output', 'CodeAgent-Output');

const ONLY_PATTERNS = {
  code: [
    path.join(CODE_OUTPUT_DIR, '*.code.json'),
    path.join(CODE_OUTPUT_DIR, '*.code.error.json'),
  ],
};

function resolveTargets(argv) {
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  const pathArgs = argv.filter((a) => !a.startsWith('--only='));

  if (pathArgs.length > 0) {
    return pathArgs.map((p) => path.resolve(p));
  }

  // An explicit request (a specific --only=<kind>, or a specific path
  // above) that finds nothing IS an error — you asked for something and
  // it's not there. The implicit default sweep (no args at all, as run by
  // `npm run validate:all-output`) finding nothing is NOT an error: before
  // any ticket has reached Code Agent (a fresh clone, or research/design
  // are the only stages that have run so far), agent-output/CodeAgent-Output/
  // is legitimately empty, and that must not fail CI for a stage that
  // simply hasn't run yet.
  const isExplicitRequest = Boolean(onlyArg);

  let patterns;
  let describeScope;
  if (onlyArg) {
    const kind = onlyArg.slice('--only='.length);
    if (!ONLY_PATTERNS[kind]) {
      console.error(`Unknown --only value "${kind}" — expected "code".`);
      process.exit(2);
    }
    patterns = ONLY_PATTERNS[kind];
    describeScope = `--only=${kind}`;
  } else {
    patterns = ONLY_PATTERNS.code;
    describeScope = 'the full sweep (code)';
  }

  const matches = patterns.flatMap((pattern) => globSync(pattern.replace(/\\/g, '/')));
  if (matches.length === 0) {
    if (isExplicitRequest) {
      console.error(`No files found for ${describeScope}.`);
      process.exit(2);
    }
    return [];
  }
  return matches;
}

// Filename-suffix dispatch — note .code.error.json does NOT match
// endsWith('.code.json'), so order here doesn't matter, but error is
// checked first anyway for clarity.
function schemaFor(target) {
  if (target.endsWith('.code.error.json')) return 'code-error';
  if (target.endsWith('.code.json')) return 'code-success';
  return null;
}

/**
 * Cross-file checks the schema can't express: every fileOperations[] entry
 * must trace back to the design plan's newArtifacts[] with matching
 * kind/mode, coverage must be internally consistent, and a few gates
 * (compile.finalStatus, rewrite.budgetExceeded) that are schema-valid but
 * unsafe to hand downstream. Returns an array of error strings (empty =
 * passed).
 */
function checkCodeCompleteness(output) {
  const errors = [];
  const designFileRelative = output.ticket?.designFile;
  if (!designFileRelative) {
    // Schema already requires ticket.designFile; ajv will have failed this
    // before we get here in practice, but guard anyway.
    return errors;
  }

  const designFilePath = path.resolve(REPO_ROOT, designFileRelative);
  let designPlan;
  try {
    designPlan = JSON.parse(readFileSync(designFilePath, 'utf-8'));
  } catch (err) {
    errors.push(
      `ticket.designFile "${designFileRelative}" could not be read/parsed (${err.message}) — cannot verify completeness.`
    );
    return errors;
  }

  const newArtifactsByPath = new Map((designPlan.newArtifacts ?? []).map((a) => [a.path, a]));
  const reusePaths = new Set((designPlan.reuse ?? []).map((r) => r.path));

  // Axis 1: no duplicate fileOperations for the same path.
  const seenPaths = new Set();
  for (const op of output.fileOperations ?? []) {
    if (seenPaths.has(op.path)) {
      errors.push(
        `Duplicate fileOperations entry for path "${op.path}" — exactly one file operation per path is required.`
      );
    }
    seenPaths.add(op.path);
  }

  // Axis 1b / 3: every fileOperations path must resolve to newArtifacts[],
  // never to reuse[]-only, and kind/mode must match exactly.
  for (const op of output.fileOperations ?? []) {
    const designEntry = newArtifactsByPath.get(op.path);
    if (!designEntry) {
      if (reusePaths.has(op.path)) {
        errors.push(
          `fileOperations path "${op.path}" is only in the design plan's reuse[], not newArtifacts[] — reuse entries must be consumed as-is, never written to.`
        );
      } else {
        errors.push(
          `fileOperations path "${op.path}" does not appear in ${designFileRelative}'s newArtifacts[] — Code Agent must not write files the design plan never called for.`
        );
      }
      continue;
    }
    if (op.kind !== designEntry.kind) {
      errors.push(
        `fileOperations "${op.path}" has kind "${op.kind}" but the design plan's newArtifacts[] entry says kind "${designEntry.kind}" — Code Agent must copy kind verbatim, not re-derive it.`
      );
    }
    if (op.mode !== designEntry.mode) {
      errors.push(
        `fileOperations "${op.path}" has mode "${op.mode}" but the design plan's newArtifacts[] entry says mode "${designEntry.mode}" — Code Agent must copy mode verbatim, not re-derive it.`
      );
    }
  }

  // Axis 2: a "generate" run must cover every newArtifacts[] path; a
  // "rewrite" run only needs its own regenerated subset (checked separately
  // via rewrite.regeneratedPaths below).
  if (output.runMode === 'generate') {
    for (const entry of designPlan.newArtifacts ?? []) {
      if (!seenPaths.has(entry.path)) {
        errors.push(
          `newArtifacts entry "${entry.path}" has no corresponding fileOperations entry in this "generate" run — silently dropped.`
        );
      }
    }
  }

  // Axis 4: coverage.scenariosCovered must equal the union of
  // fileOperations[].scenarioIds; a "generate" run must additionally cover
  // every scenario in the design plan.
  const unionScenarioIds = new Set();
  for (const op of output.fileOperations ?? []) {
    for (const id of op.scenarioIds ?? []) unionScenarioIds.add(id);
  }
  const reportedCovered = new Set(output.coverage?.scenariosCovered ?? []);
  const unionMismatch =
    unionScenarioIds.size !== reportedCovered.size ||
    [...unionScenarioIds].some((id) => !reportedCovered.has(id));
  if (unionMismatch) {
    errors.push(
      `coverage.scenariosCovered [${[...reportedCovered].join(', ')}] does not match the union of fileOperations[].scenarioIds [${[...unionScenarioIds].join(', ')}].`
    );
  }
  if (output.runMode === 'generate') {
    for (const scenario of designPlan.scenarios ?? []) {
      if (!unionScenarioIds.has(scenario.id)) {
        errors.push(
          `Scenario ${scenario.id} in the design plan has no fileOperations coverage in this "generate" run.`
        );
      }
    }
  }

  // Axis 4b: coverage.newArtifactsFulfilled should equal the set of paths
  // actually present in fileOperations[].
  const reportedFulfilled = new Set(output.coverage?.newArtifactsFulfilled ?? []);
  const fulfilledMismatch =
    reportedFulfilled.size !== seenPaths.size || [...seenPaths].some((p) => !reportedFulfilled.has(p));
  if (fulfilledMismatch) {
    errors.push(
      `coverage.newArtifactsFulfilled [${[...reportedFulfilled].join(', ')}] does not match the set of paths actually present in fileOperations[] [${[...seenPaths].join(', ')}].`
    );
  }

  // Axis 5: no page-object file operation for a scenario whose resolved
  // artifacts[] contains no page-object entry (AC #8 — API-only scenarios).
  const artifactKindByPath = new Map([
    ...(designPlan.reuse ?? []).map((r) => [r.path, r.kind]),
    ...(designPlan.newArtifacts ?? []).map((a) => [a.path, a.kind]),
  ]);
  const scenariosById = new Map((designPlan.scenarios ?? []).map((s) => [s.id, s]));
  for (const op of output.fileOperations ?? []) {
    if (op.kind !== 'page-object') continue;
    for (const scenarioId of op.scenarioIds ?? []) {
      const scenario = scenariosById.get(scenarioId);
      if (!scenario) continue;
      const hasPageObjectArtifact = (scenario.artifacts ?? []).some(
        (p) => artifactKindByPath.get(p) === 'page-object'
      );
      if (!hasPageObjectArtifact) {
        errors.push(
          `fileOperations "${op.path}" (kind: page-object) is attributed to scenario ${scenarioId}, but that scenario's design-plan artifacts[] contains no page-object entry — API-only scenarios must not generate a page-object dependency.`
        );
      }
    }
  }

  // Axis 6: compile.finalStatus === "fail" is a hard error — schema-valid
  // is not the same as safe to hand to Test Agent (AC #10).
  if (output.compile?.finalStatus === 'fail') {
    errors.push(
      `compile.finalStatus is "fail" — this run's tsc compile never passed after both attempts. Do not hand this output to Test Agent; halt and notify the QA Engineer with the diagnostics in compile.attempts[].`
    );
  }

  // Axis 7: compile.attempts/passedOnAttempt/finalStatus internal
  // consistency.
  const attempts = output.compile?.attempts ?? [];
  const passingAttempt = attempts.find((a) => a.exitCode === 0);
  if (passingAttempt && output.compile.passedOnAttempt !== passingAttempt.attempt) {
    errors.push(
      `compile.passedOnAttempt is ${output.compile.passedOnAttempt}, but attempt ${passingAttempt.attempt} is the one with exitCode 0.`
    );
  }
  if (!passingAttempt && output.compile?.passedOnAttempt !== null) {
    errors.push(
      `compile.passedOnAttempt is ${output.compile?.passedOnAttempt}, but no attempt has exitCode 0 — expected null.`
    );
  }
  if (!passingAttempt && output.compile?.finalStatus !== 'fail') {
    errors.push(
      `No compile attempt has exitCode 0, but compile.finalStatus is "${output.compile?.finalStatus}" instead of "fail".`
    );
  }

  // Axis 8: rewrite-run-specific gates.
  if (output.runMode === 'rewrite') {
    if (!output.rewrite) {
      errors.push(`runMode is "rewrite" but no rewrite object is present.`);
    } else {
      if (output.rewrite.budgetExceeded) {
        errors.push(
          `rewrite.budgetExceeded is true — the 18-minute/3-round-trip Code<->Test rewrite budget was hit. The pipeline must halt further round-trips.`
        );
      }
      const regenerated = new Set(output.rewrite.regeneratedPaths ?? []);
      const regeneratedMismatch =
        regenerated.size !== seenPaths.size || [...seenPaths].some((p) => !regenerated.has(p));
      if (regeneratedMismatch) {
        errors.push(
          `rewrite.regeneratedPaths [${[...regenerated].join(', ')}] does not match fileOperations[].path [${[...seenPaths].join(', ')}] — a rewrite must touch only the failing artifacts.`
        );
      }
    }
  } else if (output.rewrite != null) {
    errors.push(`runMode is "${output.runMode}" but a rewrite object is present — it must be null unless runMode is "rewrite".`);
  }

  return errors;
}

function main() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);

  const successSchema = JSON.parse(readFileSync(CODE_SUCCESS_SCHEMA_PATH, 'utf-8'));
  const errorSchema = JSON.parse(readFileSync(CODE_ERROR_SCHEMA_PATH, 'utf-8'));
  const validators = {
    'code-success': ajv.compile(successSchema),
    'code-error': ajv.compile(errorSchema),
  };

  const argv = process.argv.slice(2);
  const targets = resolveTargets(argv);
  if (targets.length === 0) {
    // Only reachable from the implicit default sweep (see resolveTargets) —
    // an explicit --only=code or explicit path with zero matches already
    // exited 2 above. Nothing to validate yet is not a failure.
    console.log('No CodeAgent-Output files yet — nothing to validate. (Not a failure: this stage has not run yet.)');
    return;
  }
  let anyFailed = false;

  for (const target of targets) {
    const relPath = path.relative(REPO_ROOT, target);
    const kind = schemaFor(target);
    if (!kind) {
      console.error(`FAIL  ${relPath}\n  Unrecognized file — expected *.code.json or *.code.error.json`);
      anyFailed = true;
      continue;
    }

    let data;
    try {
      data = JSON.parse(readFileSync(target, 'utf-8'));
    } catch (err) {
      console.error(`FAIL  ${relPath}\n  Could not read/parse JSON: ${err.message}`);
      anyFailed = true;
      continue;
    }

    const validate = validators[kind];
    const valid = validate(data);
    if (!valid) {
      anyFailed = true;
      console.error(`FAIL  ${relPath}  (${kind})`);
      for (const err of validate.errors) {
        const loc = err.instancePath || '(root)';
        console.error(`  ${loc} ${err.message} ${JSON.stringify(err.params)}`);
      }
      continue;
    }

    let mdNote = '';
    if (kind === 'code-success') {
      const completenessErrors = checkCodeCompleteness(data);
      if (completenessErrors.length > 0) {
        anyFailed = true;
        console.error(`FAIL  ${relPath}  (${kind}) — schema valid, but completeness check failed:`);
        for (const err of completenessErrors) {
          console.error(`  ${err}`);
        }
        continue;
      }

      // Regenerate the sibling .md immediately on a pass — same reasoning
      // as validate-research-output.mjs: a stale rendering next to a
      // freshly validated JSON is exactly the drift this exists to prevent.
      try {
        const designPath = path.resolve(REPO_ROOT, data.ticket.designFile);
        const designPlan = existsSync(designPath) ? JSON.parse(readFileSync(designPath, 'utf-8')) : null;
        const md = renderCodeMarkdown(data, designPlan, path.basename(target));
        const mdPath = target.replace(/\.code\.json$/, '.code.md');
        writeFileSync(mdPath, md, 'utf-8');
        mdNote = `  -> ${path.relative(REPO_ROOT, mdPath)}`;
      } catch (err) {
        mdNote = `  -> MARKDOWN RENDER FAILED: ${err.message}`;
      }
    }
    // code-error kind: schema-valid is the whole check — no completeness
    // axis applies (no real file operations to cross-check) and no markdown
    // rendering (it's already a one-line error, not a document).

    console.log(`PASS  ${relPath}  (${kind})${mdNote}`);
  }

  if (anyFailed) {
    console.error('\nValidation failed — do not hand this output downstream.');
    process.exit(1);
  }
  console.log('\nAll files valid.');
}

main();
