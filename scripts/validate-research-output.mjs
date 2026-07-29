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
//   npm run validate:research-output -- agent-output/ResearchAgent-Output/CAP-19.requirements.json
//   npm run validate:design-output -- agent-output/DesignAgent-Output/CAP-19.design.json
//
// With no arguments, validates every *.requirements.json/*.answers.json under
// agent-output/ResearchAgent-Output/ and every *.design.json under
// agent-output/DesignAgent-Output/.
//
// Design-plan completeness check: every requirements[].id in the baseline
// (<ticket>.requirementsFile) must appear in some scenario's coversREQ or in
// outOfScope with refType "REQ". A design plan that silently drops a
// requirement passes the schema (schema can't see across files) but fails
// this script — that's the point of doing this here instead of only in the
// prompt.
//
// NODE VERSION NOTE: this script uses fs.globSync (node:fs), which requires
// Node 22+. Confirmed working locally on v24. If this ever runs in CI on an
// older Node image it will fail — pin the Node version (e.g. actions/setup-node
// with node-version: '22' or later) when wiring this into a workflow.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { globSync } from 'node:fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'pipeline', 'schemas');
const OUTPUT_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'research-output.schema.json');
const ANSWERS_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'research-answers.schema.json');
const DESIGN_SCHEMA_PATH = path.join(SCHEMAS_DIR, 'design-output.schema.json');
const RESEARCH_OUTPUT_DIR = path.join(REPO_ROOT, 'agent-output', 'ResearchAgent-Output');
const DESIGN_OUTPUT_DIR = path.join(REPO_ROOT, 'agent-output', 'DesignAgent-Output');

function resolveTargets(argv) {
  if (argv.length > 0) {
    return argv.map((p) => path.resolve(p));
  }
  const patterns = [
    path.join(RESEARCH_OUTPUT_DIR, '*.requirements.json'),
    path.join(RESEARCH_OUTPUT_DIR, '*.answers.json'),
    path.join(DESIGN_OUTPUT_DIR, '*.design.json'),
  ].map((p) => p.replace(/\\/g, '/'));
  const matches = patterns.flatMap((pattern) => globSync(pattern));
  if (matches.length === 0) {
    console.error(
      `No *.requirements.json/*.answers.json under ${RESEARCH_OUTPUT_DIR} and no *.design.json under ${DESIGN_OUTPUT_DIR}`
    );
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

  return errors;
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

  const targets = resolveTargets(process.argv.slice(2));
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

    if (kind === 'design') {
      const completenessErrors = checkDesignCompleteness(data, target);
      if (completenessErrors.length > 0) {
        anyFailed = true;
        console.error(`FAIL  ${relPath}  (${kind}) — schema valid, but requirement-coverage check failed:`);
        for (const err of completenessErrors) {
          console.error(`  ${err}`);
        }
        continue;
      }
    }

    console.log(`PASS  ${relPath}  (${kind})`);
  }

  if (anyFailed) {
    console.error('\nValidation failed — do not hand this output downstream.');
    process.exit(1);
  }
  console.log('\nAll files valid.');
}

main();
