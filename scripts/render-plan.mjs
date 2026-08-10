#!/usr/bin/env node
// Generates a human-readable .md file alongside a validated pipeline JSON
// output. The JSON stays the single source of truth and Code Agent's actual
// input — this script only ever reads JSON and writes markdown, never the
// other direction, so there is nothing for the .md to drift out of sync
// with except by re-running this generator.
//
// Usage:
//   node scripts/render-plan.mjs <file.requirements.json|file.design.json|file.code.json> [<file2> ...]
//   node scripts/render-plan.mjs --only=research   (regenerate all requirements .md)
//   node scripts/render-plan.mjs --only=design     (regenerate all design .md)
//   node scripts/render-plan.mjs --only=code       (regenerate all code .md)
//   (no args) -> regenerates every requirements.json, design.json, and code.json's .md
//
// This is also imported by validate-research-output.mjs and
// validate-code-output.mjs, which call renderRequirementsMarkdown/
// renderDesignMarkdown/renderCodeMarkdown directly after a file passes
// validation, so a stale .md can never sit next to a freshly validated
// .json — regeneration happens automatically, not as a manual second step
// someone can forget. code.error.json (Code Agent's halt envelope) has no
// markdown rendering — it's already a one-line error, not a document.

import { readFileSync, writeFileSync, existsSync, globSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const RESEARCH_OUTPUT_DIR = path.join(REPO_ROOT, 'agent-output', 'ResearchAgent-Output');
const DESIGN_OUTPUT_DIR = path.join(REPO_ROOT, 'agent-output', 'DesignAgent-Output');
const CODE_OUTPUT_DIR = path.join(REPO_ROOT, 'agent-output', 'CodeAgent-Output');

function esc(s) {
  return s == null ? '' : String(s);
}

function checkMark(bool) {
  return bool ? '✅' : '❌';
}

/**
 * Renders a <TICKET>.requirements.json baseline (and its answers file, if
 * present) to markdown. answersDoc may be null.
 */
export function renderRequirementsMarkdown(baseline, answersDoc, sourceJsonName) {
  const answersByQ = new Map((answersDoc?.answers ?? []).map((a) => [a.questionId, a]));

  const lines = [];
  lines.push(`# ${baseline.ticket.id} — ${baseline.ticket.title}`);
  lines.push('');
  lines.push(`**Type:** ${baseline.ticket.type} · **Source:** ${baseline.ticket.source} · **URL:** ${baseline.ticket.url ?? '—'}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(baseline.summary);
  lines.push('');

  lines.push('## Acceptance Criteria');
  lines.push('');
  lines.push('| ID | Testable | Text |');
  lines.push('|----|----------|------|');
  for (const ac of baseline.acceptanceCriteria ?? []) {
    lines.push(`| ${ac.id} | ${checkMark(ac.testable)} | ${esc(ac.text)} |`);
  }
  lines.push('');

  lines.push('## Requirements');
  lines.push('');
  lines.push('| ID | Type | Related AC | Text |');
  lines.push('|----|------|-----------|------|');
  for (const req of baseline.requirements ?? []) {
    const relatedAc = req.relatedAC?.length ? req.relatedAC.join(', ') : '—';
    lines.push(`| ${req.id} | ${req.type} | ${relatedAc} | ${esc(req.text)} |`);
  }
  lines.push('');

  lines.push('## Edge Cases');
  lines.push('');
  for (const ec of baseline.edgeCases ?? []) {
    const related = ec.relatedRequirement?.length ? ` → ${ec.relatedRequirement.join(', ')}` : '';
    lines.push(`- **${ec.id}** — ${esc(ec.text)}${related}`);
    lines.push(`  _Rationale: ${esc(ec.rationale)}_`);
  }
  lines.push('');

  const ambiguities = baseline.ambiguities ?? [];
  const blockingUnanswered = ambiguities.filter((a) => a.blocking !== false && !answersByQ.has(a.id));

  lines.push('## Open Ambiguities');
  lines.push('');
  for (const amb of ambiguities) {
    const answer = answersByQ.get(amb.id);
    const isBlocking = amb.blocking !== false;
    let statusTag;
    if (answer) {
      statusTag = isBlocking ? '🔵 **ANSWERED** (was blocking)' : '🔵 answered (was non-blocking)';
    } else if (isBlocking) {
      statusTag = '🔴 **BLOCKING**';
    } else {
      statusTag = '🟢 not blocking';
    }
    lines.push(`- **${amb.id}** — ${statusTag} — ${esc(amb.text)}`);
    lines.push(`  _Impact: ${esc(amb.impact)}_`);
    if (answer) {
      lines.push(`  > **Answer** (${answer.answeredBy}, ${answer.answeredAt}): ${esc(answer.answer)}`);
    }
  }
  lines.push('');
  if (blockingUnanswered.length === 0) {
    lines.push('**Gate status:** 🟢 all blocking ambiguities resolved — clear to proceed to Design Agent.');
  } else {
    lines.push(
      `**Gate status:** 🔴 blocked on ${blockingUnanswered.map((a) => a.id).join(', ')} — do not proceed to Design Agent until answered.`
    );
  }
  lines.push('');

  lines.push('## Target Area');
  lines.push('');
  lines.push(`**Pages:** ${(baseline.targetArea?.pages ?? []).join(', ') || '—'}`);
  lines.push('');
  if (baseline.targetArea?.notes) {
    lines.push(baseline.targetArea.notes);
    lines.push('');
  }

  lines.push('---');
  lines.push(
    `*Generated from \`${sourceJsonName}\` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*`
  );

  return lines.join('\n') + '\n';
}

/**
 * Renders a <TICKET>.design.json test plan to markdown.
 */
export function renderDesignMarkdown(plan, baseline, hasAnswersFile, sourceJsonName) {
  const baselineReqIds = baseline ? (baseline.requirements ?? []).map((r) => r.id) : [];
  const baselineEcIds = baseline ? (baseline.edgeCases ?? []).map((e) => e.id) : [];

  const coveredReq = new Set();
  const coveredEc = new Set();
  for (const s of plan.scenarios ?? []) {
    for (const id of s.coversREQ ?? []) coveredReq.add(id);
    for (const id of s.coversEC ?? []) coveredEc.add(id);
  }
  const outOfScopeCount = (plan.outOfScope ?? []).length;

  const lines = [];
  const title = baseline?.ticket?.title ?? '(title unavailable — could not read requirements baseline)';
  lines.push(`# ${plan.ticket.id} — Test Plan: ${title}`);
  lines.push('');
  lines.push(`**Built from:** \`${plan.ticket.requirementsFile}\``);
  lines.push(`**Answers file applied:** ${hasAnswersFile ? 'Yes' : 'No'}`);
  lines.push('');

  if (baseline) {
    lines.push(
      `**Coverage:** ${coveredReq.size}/${baselineReqIds.length} requirements covered, ${coveredEc.size}/${baselineEcIds.length} edge cases covered, ${outOfScopeCount} out of scope.`
    );
  } else {
    lines.push(`**Coverage:** could not compute — requirements baseline unreadable.`);
  }
  const scenarioCount = (plan.scenarios ?? []).length;
  lines.push(`**Scenario count:** ${scenarioCount}${scenarioCount > 6 ? ' — exceeds NFR-001\'s typical-story threshold (6); see Performance Note below.' : ' (within NFR-001\'s typical-story threshold of 6).'}`);
  lines.push('');
  if (plan.performanceNote) {
    lines.push('## Performance Note (NFR-001)');
    lines.push('');
    lines.push(esc(plan.performanceNote));
    lines.push('');
  }

  lines.push('## Assumptions');
  lines.push('');
  if ((plan.assumptions ?? []).length === 0) {
    lines.push('_None recorded._');
  } else {
    for (const a of plan.assumptions) {
      const src = a.sourceAmbiguityId ? ` (from ${a.sourceAmbiguityId})` : ' (new)';
      lines.push(`- **${a.id}**${src} — ${esc(a.text)}`);
    }
  }
  lines.push('');

  lines.push('## Out of Scope');
  lines.push('');
  if ((plan.outOfScope ?? []).length === 0) {
    lines.push('_None — everything in the baseline is covered by a scenario._');
  } else {
    for (const o of plan.outOfScope) {
      lines.push(`- **${o.refType} ${o.refId}** — ${esc(o.reason)}`);
    }
  }
  lines.push('');

  lines.push('## Scenarios');
  lines.push('');
  lines.push('| ID | Title | Type | Isolation | Tags | Covers AC | Covers REQ | Covers EC |');
  lines.push('|----|-------|------|-----------|------|-----------|------------|-----------|');
  for (const s of plan.scenarios ?? []) {
    const isolationTag = s.isolation === 'serial-required' ? '⚠️ serial-required' : 'parallel-safe';
    lines.push(
      `| ${s.id} | ${esc(s.title)} | ${s.type} | ${isolationTag} | ${s.tags.join(' ')} | ${s.coversAC.join(', ') || '—'} | ${s.coversREQ.join(', ') || '—'} | ${s.coversEC.join(', ') || '—'} |`
    );
  }
  lines.push('');

  lines.push('## Scenario Details');
  lines.push('');
  for (const s of plan.scenarios ?? []) {
    lines.push(`### ${s.id} — ${esc(s.title)}`);
    lines.push('');
    lines.push(`_Type: ${s.type} · Tags: ${s.tags.join(' ')} · Isolation: ${s.isolation}_`);
    lines.push('');
    for (const step of s.steps) {
      lines.push(`- ${esc(step)}`);
    }
    lines.push('');
    if (s.isolationNotes) {
      lines.push(`**Isolation basis:** ${esc(s.isolationNotes)}`);
      lines.push('');
    }
    if (s.artifacts.length > 0) {
      lines.push(`**Artifacts used:** ${s.artifacts.map((p) => `\`${p}\``).join(', ')}`);
      lines.push('');
    }
  }

  lines.push('## Reuse (plan-wide)');
  lines.push('');
  if ((plan.reuse ?? []).length === 0) {
    lines.push('_None — nothing in the existing framework applies to this plan._');
  } else {
    lines.push('| Path | Kind | Why |');
    lines.push('|------|------|-----|');
    for (const r of plan.reuse) {
      lines.push(`| \`${r.path}\` | ${r.kind} | ${esc(r.why)} |`);
    }
  }
  lines.push('');

  lines.push('## New Artifacts (plan-wide)');
  lines.push('');
  if ((plan.newArtifacts ?? []).length === 0) {
    lines.push('_None — this plan needs nothing beyond what already exists._');
  } else {
    lines.push('| Path | Kind | Mode | Purpose |');
    lines.push('|------|------|------|---------|');
    for (const a of plan.newArtifacts) {
      lines.push(`| \`${a.path}\` | ${a.kind} | ${a.mode} | ${esc(a.purpose)} |`);
    }
    lines.push('');
    const withLocators = plan.newArtifacts.filter((a) => (a.locators ?? []).length > 0);
    if (withLocators.length > 0) {
      lines.push('**Locator hints** (observed while reading source — hints for Code Agent, not commitments):');
      lines.push('');
      for (const a of withLocators) {
        lines.push(`- \`${a.path}\``);
        for (const loc of a.locators) {
          lines.push(`  - ${esc(loc.element)}: \`${loc.selector}\``);
        }
      }
    }
  }
  lines.push('');

  lines.push('---');
  lines.push(
    `*Generated from \`${sourceJsonName}\` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact Code Agent consumes; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*`
  );

  return lines.join('\n') + '\n';
}

/**
 * Renders a <TICKET>.code.json output (Code Agent's success shape) to
 * markdown, alongside the design plan it implements. designPlan may be null
 * if that file couldn't be read — coverage/context sections degrade
 * gracefully rather than throwing.
 */
export function renderCodeMarkdown(output, designPlan, sourceJsonName) {
  const newArtifactsTotal = designPlan ? (designPlan.newArtifacts ?? []).length : null;
  const scenariosTotal = designPlan ? (designPlan.scenarios ?? []).length : null;

  const lines = [];
  lines.push(`# ${output.ticket.id} — Generated Code`);
  lines.push('');
  lines.push(`**Built from:** \`${output.ticket.designFile}\``);
  lines.push(`**Run mode:** ${output.runMode}`);
  lines.push('');

  if (designPlan) {
    lines.push(
      `**Coverage:** ${output.coverage.newArtifactsFulfilled.length}/${newArtifactsTotal} newArtifacts fulfilled, ${output.coverage.scenariosCovered.length}/${scenariosTotal} scenarios covered.`
    );
  } else {
    lines.push(`**Coverage:** ${output.coverage.newArtifactsFulfilled.length} newArtifacts fulfilled, ${output.coverage.scenariosCovered.length} scenarios covered (design plan unreadable — totals unavailable).`);
  }
  lines.push('');

  lines.push('## Compile');
  lines.push('');
  lines.push(`**Final status:** ${checkMark(output.compile.finalStatus === 'pass')} ${output.compile.finalStatus}${output.compile.passedOnAttempt ? ` (passed on attempt ${output.compile.passedOnAttempt})` : ''}`);
  lines.push('');
  lines.push('| Attempt | Command | Exit code | Diagnostics |');
  lines.push('|---------|---------|-----------|-------------|');
  for (const a of output.compile.attempts) {
    lines.push(`| ${a.attempt} | \`${esc(a.command)}\` | ${a.exitCode} | ${a.diagnostics.length} |`);
  }
  lines.push('');
  for (const a of output.compile.attempts) {
    if (a.diagnostics.length === 0) continue;
    lines.push(`**Attempt ${a.attempt} diagnostics:**`);
    lines.push('');
    for (const d of a.diagnostics) {
      const loc = d.line != null ? `${d.file}:${d.line}${d.column != null ? `:${d.column}` : ''}` : d.file;
      lines.push(`- ${d.code ? `\`${d.code}\` ` : ''}${loc} — ${esc(d.message)}`);
    }
    lines.push('');
  }

  lines.push('## File Operations');
  lines.push('');
  lines.push('| Path | Kind | Mode | Scenarios |');
  lines.push('|------|------|------|-----------|');
  for (const op of output.fileOperations) {
    lines.push(`| \`${op.path}\` | ${op.kind} | ${op.mode} | ${op.scenarioIds.join(', ') || '—'} |`);
  }
  lines.push('');

  if (output.runMode === 'rewrite' && output.rewrite) {
    lines.push('## Rewrite');
    lines.push('');
    lines.push(`**Round-trip:** ${output.rewrite.roundTrip}/3`);
    lines.push(`**Budget exceeded (this round-trip's own view):** ${checkMark(!output.rewrite.budgetExceeded)} ${output.rewrite.budgetExceeded ? 'YES — halt further round-trips' : 'no'}`);
    lines.push('');
    lines.push('**Triggering failures:**');
    lines.push('');
    lines.push('| Test case | Feature file | Step file | Error type |');
    lines.push('|-----------|--------------|-----------|------------|');
    for (const f of output.rewrite.triggeringFailures) {
      lines.push(`| ${esc(f.test_case_name)} | \`${f.source_feature_file}\` | \`${f.source_step_file}\` | ${esc(f.error_type)} |`);
    }
    lines.push('');
    lines.push(`**Regenerated paths:** ${output.rewrite.regeneratedPaths.map((p) => `\`${p}\``).join(', ')}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(
    `*Generated from \`${sourceJsonName}\` by scripts/render-plan.mjs — that file is the canonical machine-readable artifact Test Agent consumes; this file is a generated human-readable rendering. Do not hand-edit; re-run the renderer instead.*`
  );

  return lines.join('\n') + '\n';
}

function renderAndWriteRequirements(jsonPath) {
  const baseline = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const answersPath = jsonPath.replace(/\.requirements\.json$/, '.answers.json');
  const answersDoc = existsSync(answersPath) ? JSON.parse(readFileSync(answersPath, 'utf-8')) : null;
  const md = renderRequirementsMarkdown(baseline, answersDoc, path.basename(jsonPath));
  const mdPath = jsonPath.replace(/\.requirements\.json$/, '.requirements.md');
  writeFileSync(mdPath, md, 'utf-8');
  return mdPath;
}

function renderAndWriteDesign(jsonPath) {
  const plan = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const baselinePath = path.resolve(REPO_ROOT, plan.ticket.requirementsFile);
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf-8')) : null;
  const answersPath = baselinePath.replace(/\.requirements\.json$/, '.answers.json');
  const hasAnswersFile = existsSync(answersPath);
  const md = renderDesignMarkdown(plan, baseline, hasAnswersFile, path.basename(jsonPath));
  const mdPath = jsonPath.replace(/\.design\.json$/, '.design.md');
  writeFileSync(mdPath, md, 'utf-8');
  return mdPath;
}

function renderAndWriteCode(jsonPath) {
  const output = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const designPath = path.resolve(REPO_ROOT, output.ticket.designFile);
  const designPlan = existsSync(designPath) ? JSON.parse(readFileSync(designPath, 'utf-8')) : null;
  const md = renderCodeMarkdown(output, designPlan, path.basename(jsonPath));
  const mdPath = jsonPath.replace(/\.code\.json$/, '.code.md');
  writeFileSync(mdPath, md, 'utf-8');
  return mdPath;
}

function main() {
  const argv = process.argv.slice(2);
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  const pathArgs = argv.filter((a) => !a.startsWith('--only='));

  let targets;
  if (pathArgs.length > 0) {
    targets = pathArgs.map((p) => path.resolve(p));
  } else {
    const only = onlyArg ? onlyArg.slice('--only='.length) : null;
    const patterns = [];
    if (!only || only === 'research') patterns.push(path.join(RESEARCH_OUTPUT_DIR, '*.requirements.json'));
    if (!only || only === 'design') patterns.push(path.join(DESIGN_OUTPUT_DIR, '*.design.json'));
    if (!only || only === 'code') patterns.push(path.join(CODE_OUTPUT_DIR, '*.code.json'));
    targets = patterns.flatMap((p) => globSync(p.replace(/\\/g, '/')));
  }

  if (targets.length === 0) {
    console.error('No matching files found to render.');
    process.exit(2);
  }

  for (const target of targets) {
    let mdPath;
    if (target.endsWith('.requirements.json')) {
      mdPath = renderAndWriteRequirements(target);
    } else if (target.endsWith('.design.json')) {
      mdPath = renderAndWriteDesign(target);
    } else if (target.endsWith('.code.json')) {
      mdPath = renderAndWriteCode(target);
    } else {
      console.error(`Skipping ${target} — not a *.requirements.json, *.design.json, or *.code.json file.`);
      continue;
    }
    console.log(`Rendered ${path.relative(REPO_ROOT, mdPath)}`);
  }
}

// Windows-safe "is this the entry script" check — a plain
// `file://${process.argv[1]}` string comparison fails on Windows because
// argv[1] uses backslashes and lacks the extra leading slash file:// URLs
// need for a drive letter (file:///C:/...), so it silently never matched
// and this script did nothing when run directly. pathToFileURL normalizes
// both sides the same way.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main();
}
