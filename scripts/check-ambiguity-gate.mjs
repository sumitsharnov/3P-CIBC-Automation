#!/usr/bin/env node
// The blocking-ambiguity gate. Run this after Research Agent produces
// <TICKET>.requirements.json, before handing anything to Design Agent.
//
// For each ambiguity where `blocking !== false` (a missing `blocking` field
// counts as blocking — fail-safe), checks whether a matching answer exists in
// <TICKET>.answers.json. If any blocking ambiguity remains unanswered, prints
// exactly what needs answering and exits non-zero. Otherwise exits 0.
//
// Usage:
//   node scripts/check-ambiguity-gate.mjs <path-to-requirements.json> [<path-to-answers.json>]
//
// If the answers path is omitted, it's inferred by replacing
// ".requirements.json" with ".answers.json" in the same directory; if that
// file doesn't exist, every blocking ambiguity is treated as unanswered.
//
// NODE VERSION NOTE: same Node >=22 requirement as validate-research-output.mjs
// (no globSync usage here, but keep the engines constraint consistent).

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

function usageError(message) {
  console.error(message);
  console.error('\nUsage: node scripts/check-ambiguity-gate.mjs <requirements.json> [<answers.json>]');
  process.exit(2);
}

function loadJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    usageError(`Could not read/parse ${label} at ${filePath}: ${err.message}`);
  }
}

function main() {
  const [reqPathArg, answersPathArg] = process.argv.slice(2);
  if (!reqPathArg) {
    usageError('Missing required argument: path to <TICKET>.requirements.json');
  }

  const reqPath = path.resolve(reqPathArg);
  if (!existsSync(reqPath)) {
    usageError(`Requirements file not found: ${reqPath}`);
  }

  const answersPath = answersPathArg
    ? path.resolve(answersPathArg)
    : reqPath.replace(/\.requirements\.json$/, '.answers.json');

  const requirements = loadJson(reqPath, 'requirements file');
  const ambiguities = requirements.ambiguities || [];

  const blocking = ambiguities.filter((a) => a.blocking !== false);

  let answered = new Set();
  let answersFileUsed = null;
  if (existsSync(answersPath)) {
    const answersDoc = loadJson(answersPath, 'answers file');
    if (answersDoc.ticket && requirements.ticket && answersDoc.ticket !== requirements.ticket.id) {
      usageError(
        `Answers file ticket "${answersDoc.ticket}" does not match requirements file ticket "${requirements.ticket.id}" — refusing to apply mismatched answers.`
      );
    }
    answered = new Set((answersDoc.answers || []).map((a) => a.questionId));
    answersFileUsed = answersPath;
  }

  const unresolved = blocking.filter((a) => !answered.has(a.id));

  const ticketId = requirements.ticket?.id ?? '(unknown ticket)';
  console.log(`Ambiguity gate — ${ticketId}`);
  console.log(`  ${ambiguities.length} total ambiguity(ies), ${blocking.length} blocking, ${answered.size} answered in ${answersFileUsed ?? '(no answers file found)'}`);

  if (unresolved.length === 0) {
    console.log(`\nGate PASSED — no unresolved blocking ambiguities. Safe to proceed to Design Agent.`);
    process.exit(0);
  }

  console.error(`\nGate FAILED — ${unresolved.length} blocking ambiguity(ies) unresolved for ${ticketId}:\n`);
  for (const a of unresolved) {
    console.error(`  ${a.id}: ${a.text}`);
    console.error(`    Impact: ${a.impact}\n`);
  }
  console.error(
    `Do NOT proceed to Design Agent. Answer these in ${path.relative(process.cwd(), answersPath)} ` +
    `(create it if it doesn't exist, per pipeline/schemas/research-answers.schema.json) and re-run this gate.`
  );
  process.exit(1);
}

main();
