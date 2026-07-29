// Turns a raw pass/fail + error message into a plain-English sentence a
// non-technical stakeholder can read without opening a stack trace.

export function diagnosePassed(scenarioTitle) {
  return `Verified that "${scenarioTitle}" behaves as expected.`;
}

export function diagnoseFailed(scenarioTitle, errorMessage) {
  const reason = classifyError(errorMessage);
  return `"${scenarioTitle}" failed — ${reason}`;
}

function classifyError(message) {
  if (!message) {
    return 'no error detail was captured; check the screenshot for visual state at failure.';
  }
  const lower = message.toLowerCase();
  if (lower.includes('timeout') && lower.includes('waiting for')) {
    return 'the page did not reach the expected state within the wait timeout — an element never appeared, or was never in the expected state (Playwright auto-waits, so this usually means the app behaved differently than expected, not a flaky test).';
  }
  if (lower.includes('tobevisible') || lower.includes('tohavetext') || lower.includes('tohaveurl') || lower.includes('expect(')) {
    return "an assertion failed — the app's actual behavior did not match the expected outcome (this may indicate a real product defect).";
  }
  if (lower.includes('strict mode violation')) {
    return 'the locator matched more than one element on the page — the selector needs to be more specific.';
  }
  const firstLine = message.split('\n')[0];
  return `unhandled error: ${firstLine}`;
}
