#!/usr/bin/env node
// Reads Playwright's JSON reporter output (test-results/results.json) and
// renders a bespoke, demo-facing HTML/CSS dashboard: KPI summary,
// per-scenario drill-down with embedded failure screenshots, and a
// plain-English diagnosis per scenario. Deliberately not Playwright's
// built-in HTML reporter — same reasoning as the discarded Java framework's
// custom report: we want the diagnosis text and styling under our own
// control, and a single self-contained file to hand to stakeholders.
//
// Usage: node reporting/generate-report.mjs
// Reads:  test-results/results.json
// Writes: test-results/qa-report/index.html

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnosePassed, diagnoseFailed } from './diagnosis.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const RESULTS_PATH = path.join(REPO_ROOT, 'test-results', 'results.json');
const OUTPUT_DIR = path.join(REPO_ROOT, 'test-results', 'qa-report');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'index.html');

function collectScenarios(suites) {
  // playwright-bdd nests suites as: file-level suite (named after the
  // generated *.spec.js path) -> Gherkin Feature suite -> specs (scenarios).
  // The feature name we want for the report is whichever suite directly
  // contains the specs — not the outer file-level suite.
  const scenarios = [];
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const result = test.results?.[test.results.length - 1];
        if (!result) continue;
        scenarios.push({
          feature: suite.title,
          title: spec.title,
          status: result.status,
          duration: result.duration ?? 0,
          errorMessage: result.errors?.[0]?.message ?? result.error?.message ?? null,
          attachments: (result.attachments ?? []).filter((a) => a.contentType?.startsWith('image/')),
        });
      }
    }
    if (suite.suites?.length) {
      scenarios.push(...collectScenarios(suite.suites));
    }
  }
  return scenarios;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attachmentToDataUri(attachment) {
  try {
    const filePath = attachment.path;
    if (!filePath || !existsSync(filePath)) return null;
    const buf = readFileSync(filePath);
    return `data:${attachment.contentType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function renderScenario(scenario) {
  const passed = scenario.status === 'passed';
  const statusClass = passed ? 'passed' : scenario.status === 'skipped' ? 'skipped' : 'failed';
  const statusLabel = scenario.status.toUpperCase();
  const diagnosis = passed
    ? diagnosePassed(scenario.title)
    : scenario.status === 'skipped'
      ? `Skipped — not executed this run.`
      : diagnoseFailed(scenario.title, scenario.errorMessage);

  const screenshotsHtml = scenario.attachments
    .map((a) => attachmentToDataUri(a))
    .filter(Boolean)
    .map((uri) => `<img class="screenshot" src="${uri}" alt="Failure screenshot"/>`)
    .join('');

  return `<div class="scenario-card ${statusClass}">
    <div class="scenario-header">
      <span class="badge badge-${statusClass}">${statusLabel}</span>
      <span class="scenario-title">${escapeHtml(scenario.feature)} — ${escapeHtml(scenario.title)}</span>
      <span class="scenario-duration">${(scenario.duration / 1000).toFixed(2)}s</span>
    </div>
    <p class="diagnosis">${escapeHtml(diagnosis)}</p>
    ${screenshotsHtml}
  </div>`;
}

function main() {
  if (!existsSync(RESULTS_PATH)) {
    console.log(`[generate-report] No results.json found at ${RESULTS_PATH} — run tests first (npm run test:e2e).`);
    return;
  }

  const results = JSON.parse(readFileSync(RESULTS_PATH, 'utf-8'));
  const scenarios = collectScenarios(results.suites);

  const total = scenarios.length;
  const passed = scenarios.filter((s) => s.status === 'passed').length;
  const failed = scenarios.filter((s) => s.status !== 'passed' && s.status !== 'skipped').length;
  const skipped = scenarios.filter((s) => s.status === 'skipped').length;
  const passRate = total === 0 ? 0 : (passed * 100) / total;
  const totalDurationSeconds = scenarios.reduce((sum, s) => sum + s.duration, 0) / 1000;

  const scenariosHtml = scenarios.map(renderScenario).join('\n');

  const html = HTML_TEMPLATE
    .replace('{{GENERATED_AT}}', new Date().toISOString().replace('T', ' ').slice(0, 19))
    .replace('{{TOTAL}}', String(total))
    .replace('{{PASSED}}', String(passed))
    .replace('{{FAILED}}', String(failed))
    .replace('{{SKIPPED}}', String(skipped))
    .replace('{{PASS_RATE}}', passRate.toFixed(1))
    .replace('{{DURATION}}', totalDurationSeconds.toFixed(2))
    .replace('{{SCENARIOS}}', scenariosHtml);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, html, 'utf-8');
  console.log(`[generate-report] Report written to ${OUTPUT_FILE}`);
}

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>QA Automation Report — bank-app</title>
<style>
  :root {
    --brand: #7c3aed;
    --pass: #16a34a;
    --fail: #dc2626;
    --skip: #9ca3af;
    --bg: #f8f7fc;
    --card-bg: #ffffff;
    --text: #1f2430;
    --muted: #6b7280;
    --border: #e5e2f0;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); }
  header { background: linear-gradient(135deg, var(--brand), #4c1d95); color: white; padding: 28px 36px; }
  header h1 { margin: 0 0 4px 0; font-size: 22px; }
  header p { margin: 0; opacity: 0.85; font-size: 13px; }
  .kpi-row { display: flex; gap: 16px; padding: 24px 36px; flex-wrap: wrap; }
  .kpi-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px 22px; min-width: 140px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .kpi-card .value { font-size: 26px; font-weight: 700; }
  .kpi-card .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .kpi-card.pass .value { color: var(--pass); }
  .kpi-card.fail .value { color: var(--fail); }
  main { padding: 0 36px 36px; }
  .scenario-card { background: var(--card-bg); border: 1px solid var(--border); border-left: 5px solid var(--muted); border-radius: 10px; padding: 18px 22px; margin-bottom: 16px; }
  .scenario-card.passed { border-left-color: var(--pass); }
  .scenario-card.failed { border-left-color: var(--fail); }
  .scenario-card.skipped { border-left-color: var(--skip); }
  .scenario-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .scenario-title { font-weight: 600; font-size: 15px; flex: 1; }
  .scenario-duration { font-size: 12px; color: var(--muted); }
  .badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; color: white; }
  .badge-passed { background: var(--pass); }
  .badge-failed { background: var(--fail); }
  .badge-skipped { background: var(--skip); }
  .diagnosis { font-size: 13.5px; color: var(--text); background: #f4f2fb; border-radius: 8px; padding: 10px 14px; margin: 8px 0 12px; }
  .screenshot { max-width: 100%; border-radius: 8px; border: 1px solid var(--border); margin-top: 10px; }
  footer { text-align: center; color: var(--muted); font-size: 12px; padding: 20px; }
</style>
</head>
<body>
  <header>
    <h1>QA Automation Report — bank-app</h1>
    <p>Generated {{GENERATED_AT}} · Playwright + TypeScript + playwright-bdd</p>
  </header>
  <div class="kpi-row">
    <div class="kpi-card"><div class="value">{{TOTAL}}</div><div class="label">Scenarios</div></div>
    <div class="kpi-card pass"><div class="value">{{PASSED}}</div><div class="label">Passed</div></div>
    <div class="kpi-card fail"><div class="value">{{FAILED}}</div><div class="label">Failed</div></div>
    <div class="kpi-card"><div class="value">{{SKIPPED}}</div><div class="label">Skipped</div></div>
    <div class="kpi-card"><div class="value">{{PASS_RATE}}%</div><div class="label">Pass rate</div></div>
    <div class="kpi-card"><div class="value">{{DURATION}}s</div><div class="label">Duration</div></div>
  </div>
  <main>
    {{SCENARIOS}}
  </main>
  <footer>Internal 3Pillar prototype — dummy bank-app data only, not production CIBC data.</footer>
</body>
</html>
`;

main();
