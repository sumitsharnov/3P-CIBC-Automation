#!/usr/bin/env node
// Validates pipeline output files against their JSON schemas:
//   *.requirements.json -> pipeline/schemas/research-output.schema.json
//   *.answers.json      -> pipeline/schemas/research-answers.schema.json
//   *.design.json       -> pipeline/schemas/design-output.schema.json, PLUS a
//                          cross-file completeness check (see below) that
//                          JSON Schema alone cannot express.
// Hard-fails (non-zero exit) on any violation, so the orchestrator (and CI,
// later) can refuse to hand bad output downstream.
//
// Usage:
//   node scripts/validate-research-output.mjs <file.json> [<file2.json> ...]
//   node scripts/validate-research-output.mjs --only=research   (requirements+answers only)
//   node scripts/validate-research-output.mjs --only=design     (design plans only)
//   node scripts/validate-research-output.mjs --strict-uniformity  (uniformity warnings become failures)
//   npm run validate:research-output   -> --only=research
//   npm run validate:design-output     -> --only=design
//
// With no arguments and no --only flag, validates every *.requirements.json/
// *.answers.json under agent-output/ResearchAgent-Output/ and every
// *.design.json under agent-output/DesignAgent-Output/ — i.e. everything.
// --only exists so the two npm scripts actually differ instead of both being
// the same full sweep under different names.
//
// Design-plan completeness checks (three axes, none expressible in JSON
// Schema alone):
//   1. Every requirements[].id in the baseline (<ticket>.requirementsFile)
//      must appear in some scenario's coversREQ or in outOfScope with
//      refType "REQ". A design plan that silently drops a requirement
//      passes the schema (schema can't see across files) but fails this.
//   2. Every scenario's artifacts[] path must resolve to an entry in the
//      plan's own top-level reuse[]/newArtifacts[] pool (schema can't
//      express "this array's values must appear as a .path in that other
//      array" either).
//   3. If scenarios.length exceeds NFR-001's typical-story threshold (6),
//      a plan-level performanceNote is required (schema can't express
//      "this string field is required only when that array is long enough").
//
// Design-plan uniformity check (heuristic, WARN by default, not a
// completeness axis): long generations are where attention dilution shows
// up — later scenarios quietly getting thinner or dropping a field the
// earlier ones have. Compares the first third of scenarios[] against the
// last third (skips the middle, and skips entirely under 9 scenarios, where
// the signal is meaningless). This is a quality heuristic, not a contract
// violation — a plan can legitimately trip it and still be correct (e.g. a
// ticket whose later scenarios really are simpler one-liners) — so by
// default it only warns. Pass --strict-uniformity to make a warning exit
// non-zero (e.g. for CI gating later).
//
// NODE VERSION NOTE: this script uses fs.globSync (node:fs), which requires
// Node 22+. Confirmed working locally on v24. If this ever runs in CI on an
// older Node image it will fail — pin the Node version (e.g. actions/setup-node
// with node-version: '22' or later) when wiring this into a workflow.

import { readFileSync, writeFileSync, existsSync, globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { renderRequirementsMarkdown, renderDesignMarkdown } from './render-plan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'pipeline', 'schemas');
const OUTPUT_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'research-output.schema.json');
const ANSWERS_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'research-answers.schema.json');
const DESIGN_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'design-output.schema.json');
const RESEARCH_OUTPUT_DIR = path.join(REPO_ROOT, 'agent-output', 'ResearchAgent-Output');
const DESIGN_OUTPUT_DIR = path.join(REPO_ROOT, 'agent-output', 'DesignAgent-Output');

const ONLY_PATTERNS = {
  research: [
    path.join(RESEARCH_OUTPUT_DIR, '*.requirements.json'),
    path.join(RESEARCH_OUTPUT_DIR, '*.answers.json'),
  ],
  design: [path.join(DESIGN_OUTPUT_DIR, '*.design.json')],
};

function resolveTargets(argv) {
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  const pathArgs = argv.filter((a) => !a.startsWith('--only=') && a !== '--strict-uniformity');

  if (pathArgs.length > 0) {
    return pathArgs.map((p) => path.resolve(p));
  }

  let patterns;
  let describeScope;
  if (onlyArg) {
    const kind = onlyArg.slice('--only='.length);
    if (!ONLY_PATTERNS[kind]) {
      console.error(`Unknown --only value "${kind}" — expected "research" or "design".`);
      process.exit(2);
    }
    patterns = ONLY_PATTERNS[kind];
    describeScope = `--only=${kind}`;
  } else {
    patterns = [...ONLY_PATTERNS.research, ...ONLY_PATTERNS.design];
    describeScope = 'the full sweep (research + design)';
  }

  const matches = patterns.flatMap((pattern) => globSync(pattern.replace(/\\/g, '/')));
  if (matches.length === 0) {
    console.error(`No files found for ${describeScope}.`);
    process.exit(2);
  }
  return matches;
}

function schemaFor(target) {
  if (target.endsWith('.answers.json')) return 'answers';
  if (target.endsWith('.requirements.json')) return 'output';
  if (target.endsWith('.design.json')) return 'design';
  return null;
}

/**
 * Cross-file check the schema can't express: every requirement in the
 * baseline this plan claims to be built from must be covered by some
 * scenario or explicitly excluded. Returns an array of error strings (empty
 * = passed).
 */
function checkDesignCompleteness(plan, designFilePath) {
  const errors = [];
  const reqFileRelative = plan.ticket?.requirementsFile;
  if (!reqFileRelative) {
    // Schema already requires ticket.requirementsFile; ajv will have failed
    // this before we get here in practice, but guard anyway.
    return errors;
  }

  const reqFilePath = path.resolve(REPO_ROOT, reqFileRelative);
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(reqFilePath, 'utf-8'));
  } catch (err) {
    errors.push(
      `ticket.requirementsFile "${reqFileRelative}" could not be read/parsed (${err.message}) — cannot verify requirement coverage.`
    );
    return errors;
  }

  const baselineReqIds = (baseline.requirements ?? []).map((r) => r.id);
  const baselineAcIds = (baseline.acceptanceCriteria ?? []).map((a) => a.id);
  const baselineEcIds = (baseline.edgeCases ?? []).map((e) => e.id);

  const coveredReq = new Set();
  const referencedAc = new Set();
  const referencedEc = new Set();
  for (const scenario of plan.scenarios ?? []) {
    for (const id of scenario.coversREQ ?? []) coveredReq.add(id);
    for (const id of scenario.coversAC ?? []) referencedAc.add(id);
    for (const id of scenario.coversEC ?? []) referencedEc.add(id);
  }
  const outOfScopeReq = new Set(
    (plan.outOfScope ?? []).filter((o) => o.refType === 'REQ').map((o) => o.refId)
  );
  const outOfScopeAc = new Set(
    (plan.outOfScope ?? []).filter((o) => o.refType === 'AC').map((o) => o.refId)
  );
  const outOfScopeEc = new Set(
    (plan.outOfScope ?? []).filter((o) => o.refType === 'EC').map((o) => o.refId)
  );

  // The hard requirement: every REQ must be covered or explicitly excluded.
  for (const reqId of baselineReqIds) {
    if (!coveredReq.has(reqId) && !outOfScopeReq.has(reqId)) {
      errors.push(
        `Requirement ${reqId} from ${reqFileRelative} is neither covered by any scenario's coversREQ nor listed in outOfScope. Every requirement must appear in one or the other.`
      );
    }
  }

  // Hygiene: referenced IDs should actually exist in the baseline — catches
  // typos and copy-paste errors from a wrong ticket's IDs.
  for (const acId of referencedAc) {
    if (!baselineAcIds.includes(acId)) {
      errors.push(`Scenario references coversAC "${acId}", which does not exist in ${reqFileRelative}.`);
    }
  }
  for (const ecId of referencedEc) {
    if (!baselineEcIds.includes(ecId)) {
      errors.push(`Scenario references coversEC "${ecId}", which does not exist in ${reqFileRelative}.`);
    }
  }
  for (const entry of plan.outOfScope ?? []) {
    const exists =
      (entry.refType === 'AC' && baselineAcIds.includes(entry.refId)) ||
      (entry.refType === 'REQ' && baselineReqIds.includes(entry.refId)) ||
      (entry.refType === 'EC' && baselineEcIds.includes(entry.refId));
    if (!exists) {
      errors.push(`outOfScope entry references ${entry.refType} "${entry.refId}", which does not exist in ${reqFileRelative}.`);
    }
  }

  // Second completeness axis: every scenario must be implementable from the
  // plan-wide reuse[]/newArtifacts[] pool. A scenario listing an artifacts[]
  // path that isn't in either pool means the plan references something it
  // never actually proposed reusing or creating — exactly the "Code Agent
  // has no signal" gap this check exists to catch.
  const poolPaths = new Set([
    ...(plan.reuse ?? []).map((r) => r.path),
    ...(plan.newArtifacts ?? []).map((a) => a.path),
  ]);
  for (const scenario of plan.scenarios ?? []) {
    for (const artifactPath of scenario.artifacts ?? []) {
      if (!poolPaths.has(artifactPath)) {
        errors.push(
          `Scenario ${scenario.id} lists artifact "${artifactPath}" in its artifacts[], but that path does not appear in the plan's top-level reuse[] or newArtifacts[]. Every scenario artifact must resolve to something the plan actually proposes reusing or creating.`
        );
      }
    }
  }

  // Third completeness axis: NFR-001 (Helix PRD doc 2580) defines a tiered
  // pipeline-runtime target — <=15 min for a typical story (<=6 scenarios),
  // <=25 min ceiling for a complex story (7+ scenarios). A plan can legitimately
  // cross that line, but it must be a stated decision, not a silent surprise
  // Test Agent or a human discovers only once the run is already slow.
  const NFR_001_TYPICAL_THRESHOLD = 6;
  const scenarioCount = (plan.scenarios ?? []).length;
  if (scenarioCount > NFR_001_TYPICAL_THRESHOLD && !plan.performanceNote?.trim()) {
    errors.push(
      `This plan has ${scenarioCount} scenarios, exceeding NFR-001's typical-story threshold of ${NFR_001_TYPICAL_THRESHOLD} (tiered target: <=15 min for <=6 scenarios, <=25 min ceiling for 7+). A plan-level "performanceNote" is required once that threshold is crossed, stating the decision (accept the longer run, or split the ticket) — it is currently missing or empty.`
    );
  }

  return errors;
}

const UNIFORMITY_MIN_SCENARIOS = 9;
const STEP_COUNT_DROP_THRESHOLD_PCT = 30;
const TITLE_LENGTH_DROP_THRESHOLD_PCT = 40;
// Fields whose "presence" isn't already fully covered by the numeric checks
// (steps -> step-count check, title -> title-length check) and isn't
// trivially always-true by schema construction (id/tags/type). Only
// meaningful for array/string fields where "present" can mean "empty".
const UNIFORMITY_EXCLUDED_FIELDS = new Set(['id', 'title', 'steps', 'tags', 'type']);

function average(nums) {
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function isFieldPresent(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value != null;
}

/**
 * Heuristic drift detector, not a completeness axis — see the header
 * comment for the full rationale. Returns { skipped, stats, warnings }.
 * warnings is an array of { rule, message } — empty means clean.
 */
function checkUniformity(scenarios) {
  const n = scenarios.length;
  if (n < UNIFORMITY_MIN_SCENARIOS) {
    return { skipped: true, n, warnings: [] };
  }

  const thirdSize = Math.floor(n / 3);
  const firstThird = scenarios.slice(0, thirdSize);
  const lastThird = scenarios.slice(n - thirdSize);
  const warnings = [];

  // 1. Step-count thinning.
  const firstStepsAvg = average(firstThird.map((s) => (s.steps ?? []).length));
  const lastStepsAvg = average(lastThird.map((s) => (s.steps ?? []).length));
  const stepDropPct = firstStepsAvg === 0 ? 0 : ((firstStepsAvg - lastStepsAvg) / firstStepsAvg) * 100;
  if (stepDropPct > STEP_COUNT_DROP_THRESHOLD_PCT) {
    warnings.push({
      rule: 'step-count-thinning',
      message: `steps avg ${lastStepsAvg.toFixed(1)} (last ${thirdSize}) vs ${firstStepsAvg.toFixed(1)} (first ${thirdSize}), -${stepDropPct.toFixed(0)}% (threshold: -${STEP_COUNT_DROP_THRESHOLD_PCT}%)`,
    });
  }

  // 3. Title-length collapse.
  const firstTitleAvg = average(firstThird.map((s) => (s.title ?? '').length));
  const lastTitleAvg = average(lastThird.map((s) => (s.title ?? '').length));
  const titleDropPct = firstTitleAvg === 0 ? 0 : ((firstTitleAvg - lastTitleAvg) / firstTitleAvg) * 100;
  if (titleDropPct > TITLE_LENGTH_DROP_THRESHOLD_PCT) {
    warnings.push({
      rule: 'title-length-collapse',
      message: `title length avg ${lastTitleAvg.toFixed(1)} (last ${thirdSize}) vs ${firstTitleAvg.toFixed(1)} (first ${thirdSize}), -${titleDropPct.toFixed(0)}% (threshold: -${TITLE_LENGTH_DROP_THRESHOLD_PCT}%)`,
    });
  }

  // 2. Field-presence regression. Field list is derived from whatever keys
  // actually appear on scenarios, not hard-coded, so a future schema
  // addition is covered automatically without touching this script.
  const allFields = new Set();
  for (const s of scenarios) {
    for (const key of Object.keys(s)) allFields.add(key);
  }
  for (const field of allFields) {
    if (UNIFORMITY_EXCLUDED_FIELDS.has(field)) continue;
    const firstPresentCount = firstThird.filter((s) => isFieldPresent(s[field])).length;
    const firstPresentRatio = firstPresentCount / firstThird.length;
    // Only a field that was actually the norm early on counts as a basis for
    // comparison — a field that was already sparse in the first third (like
    // coversAC legitimately can be, e.g. an edge case with no direct AC)
    // isn't drift regardless of what the last third looks like.
    if (firstPresentRatio <= 0.5) continue;
    const lastPresentCount = lastThird.filter((s) => isFieldPresent(s[field])).length;
    const lastPresentRatio = lastPresentCount / lastThird.length;
    // The regression that matters is a RATE flip (majority-present ->
    // majority-absent), not "any single scenario happens to not need this
    // field" — coversAC/coversEC are legitimately empty on individual
    // scenarios whose content just doesn't call for them (e.g. CAP-19's
    // SC-18 has no direct AC), which is normal content variation, not
    // dilution. One absence out of many that stays majority-present is not
    // a regression; a field that was the norm becoming the exception is.
    if (lastPresentRatio <= 0.5) {
      const missingInLast = lastThird.filter((s) => !isFieldPresent(s[field]));
      warnings.push({
        rule: 'field-presence-regression',
        message: `field "${field}" present in ${firstPresentCount}/${firstThird.length} (${(firstPresentRatio * 100).toFixed(0)}%) first-third scenarios but only ${lastPresentCount}/${lastThird.length} (${(lastPresentRatio * 100).toFixed(0)}%) last-third scenarios — majority flipped from present to absent (e.g. missing on ${missingInLast[0].id})`,
      });
    }
  }

  return {
    skipped: false,
    n,
    thirdSize,
    stats: { firstStepsAvg, lastStepsAvg, stepDropPct, firstTitleAvg, lastTitleAvg, titleDropPct },
    warnings,
  };
}

function main() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);

  const outputSchema = JSON.parse(readFileSync(OUTPUT_SCHEMA_PATH, 'utf-8'));
  const answersSchema = JSON.parse(readFileSync(ANSWERS_SCHEMA_PATH, 'utf-8'));
  const designSchema = JSON.parse(readFileSync(DESIGN_SCHEMA_PATH, 'utf-8'));
  const validators = {
    output: ajv.compile(outputSchema),
    answers: ajv.compile(answersSchema),
    design: ajv.compile(designSchema),
  };

  const argv = process.argv.slice(2);
  const strictUniformity = argv.includes('--strict-uniformity');
  const targets = resolveTargets(argv);
  let anyFailed = false;

  for (const target of targets) {
    const relPath = path.relative(REPO_ROOT, target);
    const kind = schemaFor(target);
    if (!kind) {
      console.error(`FAIL  ${relPath}\n  Unrecognized file — expected *.requirements.json, *.answers.json, or *.design.json`);
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

    let uniformityNote = '';
    let hasUniformityWarnings = false;
    if (kind === 'design') {
      const completenessErrors = checkDesignCompleteness(data, target);
      if (completenessErrors.length > 0) {
        anyFailed = true;
        console.error(`FAIL  ${relPath}  (${kind}) — schema valid, but completeness check failed:`);
        for (const err of completenessErrors) {
          console.error(`  ${err}`);
        }
        continue;
      }

      const uniformity = checkUniformity(data.scenarios ?? []);
      if (uniformity.skipped) {
        uniformityNote = `\n  uniformity: skipped (${uniformity.n} scenarios, below the ${UNIFORMITY_MIN_SCENARIOS}-scenario threshold where the signal is meaningful)`;
      } else {
        const { firstStepsAvg, lastStepsAvg, stepDropPct, firstTitleAvg, lastTitleAvg, titleDropPct } = uniformity.stats;
        uniformityNote =
          `\n  uniformity: ${uniformity.n} scenarios (first/last ${uniformity.thirdSize}) — ` +
          `steps ${firstStepsAvg.toFixed(1)}->${lastStepsAvg.toFixed(1)} (${stepDropPct >= 0 ? '-' : '+'}${Math.abs(stepDropPct).toFixed(0)}%), ` +
          `titles ${firstTitleAvg.toFixed(1)}->${lastTitleAvg.toFixed(1)} (${titleDropPct >= 0 ? '-' : '+'}${Math.abs(titleDropPct).toFixed(0)}%)`;
        if (uniformity.warnings.length > 0) {
          hasUniformityWarnings = true;
          for (const w of uniformity.warnings) {
            uniformityNote += `\n  UNIFORM?  [${w.rule}] ${w.message}`;
          }
          if (strictUniformity) {
            anyFailed = true;
          }
        }
      }
    }

    // Regenerate the sibling .md immediately on a pass — a stale rendering
    // next to a freshly validated JSON is exactly the drift this exists to
    // prevent. answers kind has no markdown rendering (see render-plan.mjs).
    let mdNote = '';
    try {
      if (kind === 'output') {
        const answersPath = target.replace(/\.requirements\.json$/, '.answers.json');
        const answersDoc = existsSync(answersPath) ? JSON.parse(readFileSync(answersPath, 'utf-8')) : null;
        const md = renderRequirementsMarkdown(data, answersDoc, path.basename(target));
        const mdPath = target.replace(/\.requirements\.json$/, '.requirements.md');
        writeFileSync(mdPath, md, 'utf-8');
        mdNote = `  -> ${path.relative(REPO_ROOT, mdPath)}`;
      } else if (kind === 'design') {
        const baselinePath = path.resolve(REPO_ROOT, data.ticket.requirementsFile);
        const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf-8')) : null;
        const answersPath = baselinePath.replace(/\.requirements\.json$/, '.answers.json');
        const hasAnswersFile = existsSync(answersPath);
        const md = renderDesignMarkdown(data, baseline, hasAnswersFile, path.basename(target));
        const mdPath = target.replace(/\.design\.json$/, '.design.md');
        writeFileSync(mdPath, md, 'utf-8');
        mdNote = `  -> ${path.relative(REPO_ROOT, mdPath)}`;
      }
    } catch (err) {
      // Rendering failure doesn't invalidate the JSON — it's still the
      // canonical artifact — but flag it loudly rather than silently
      // leaving a stale/missing .md.
      mdNote = `  -> MARKDOWN RENDER FAILED: ${err.message}`;
    }

    const statusLabel = hasUniformityWarnings ? 'WARN' : 'PASS';
    console.log(`${statusLabel}  ${relPath}  (${kind})${mdNote}${uniformityNote}`);
  }

  if (anyFailed) {
    console.error(
      strictUniformity
        ? '\nValidation failed — do not hand this output downstream. (--strict-uniformity: warnings above counted as failures.)'
        : '\nValidation failed — do not hand this output downstream.'
    );
    process.exit(1);
  }
  console.log('\nAll files valid.');
}

main();
