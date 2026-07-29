#!/usr/bin/env node
// Runs the e2e suite, then always generates the custom report regardless of
// whether tests passed or failed (a failing run is exactly when the report
// is most useful). Deliberately not shell chaining (`;`/`&&`) in package.json
// — npm invokes scripts via cmd.exe on Windows, which doesn't support `;` as
// a command separator the way bash does, so that syntax silently breaks
// cross-platform. This wrapper is shell-agnostic.

import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

const testExitCode = run('npx', ['bddgen']) || run('npx', ['playwright', 'test']);
run('node', ['reporting/generate-report.mjs']);

process.exit(testExitCode);
