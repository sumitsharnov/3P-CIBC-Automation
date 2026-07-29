#!/usr/bin/env node
// Validates Research Agent output files against their JSON schemas:
//   *.requirements.json -> pipeline/schemas/research-output.schema.json
//   *.answers.json      -> pipeline/schemas/research-answers.schema.json
// Hard-fails (non-zero exit) on any violation, so the orchestrator (and CI,
// later) can refuse to hand a bad baseline or a malformed answers file
// downstream.
//
// Usage:
//   node scripts/validate-research-output.mjs <file.json> [<file2.json> ...]
//   npm run validate:research-output -- agent-output/ResearchAgent-Output/CAP-19.requirements.json
//
// With no arguments, validates every *.requirements.json and *.answers.json
// file found under agent-output/ResearchAgent-Output/.
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
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'agent-output', 'ResearchAgent-Output');

function resolveTargets(argv) {
  if (argv.length > 0) {
    return argv.map((p) => path.resolve(p));
  }
  const patterns = ['*.requirements.json', '*.answers.json'].map((p) =>
    path.join(DEFAULT_OUTPUT_DIR, p).replace(/\\/g, '/')
  );
  const matches = patterns.flatMap((pattern) => globSync(pattern));
  if (matches.length === 0) {
    console.error(`No *.requirements.json or *.answers.json files found under ${DEFAULT_OUTPUT_DIR}`);
    process.exit(2);
  }
  return matches;
}

function schemaFor(target) {
  if (target.endsWith('.answers.json')) return 'answers';
  if (target.endsWith('.requirements.json')) return 'output';
  return null;
}

function main() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);

  const outputSchema = JSON.parse(readFileSync(OUTPUT_SCHEMA_PATH, 'utf-8'));
  const answersSchema = JSON.parse(readFileSync(ANSWERS_SCHEMA_PATH, 'utf-8'));
  const validators = {
    output: ajv.compile(outputSchema),
    answers: ajv.compile(answersSchema),
  };

  const targets = resolveTargets(process.argv.slice(2));
  let anyFailed = false;

  for (const target of targets) {
    const relPath = path.relative(REPO_ROOT, target);
    const kind = schemaFor(target);
    if (!kind) {
      console.error(`FAIL  ${relPath}\n  Unrecognized file — expected *.requirements.json or *.answers.json`);
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
    if (valid) {
      console.log(`PASS  ${relPath}  (${kind})`);
    } else {
      anyFailed = true;
      console.error(`FAIL  ${relPath}  (${kind})`);
      for (const err of validate.errors) {
        const loc = err.instancePath || '(root)';
        console.error(`  ${loc} ${err.message} ${JSON.stringify(err.params)}`);
      }
    }
  }

  if (anyFailed) {
    console.error('\nValidation failed — do not hand this output downstream.');
    process.exit(1);
  }
  console.log('\nAll files valid.');
}

main();
