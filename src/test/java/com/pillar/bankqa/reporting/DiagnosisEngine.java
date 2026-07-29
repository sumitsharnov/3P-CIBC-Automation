package com.pillar.bankqa.reporting;

import com.pillar.bankqa.reporting.model.CucumberJsonModels.Element;
import com.pillar.bankqa.reporting.model.CucumberJsonModels.Step;

/**
 * Turns a raw pass/fail + stack trace into a plain-English sentence a
 * non-technical stakeholder can read without opening a log file.
 */
final class DiagnosisEngine {

    private DiagnosisEngine() {
    }

    static String forPassedScenario(Element scenario) {
        String action = scenario.steps.stream()
                .filter(s -> "When".equalsIgnoreCase(firstWord(s.keyword)))
                .findFirst()
                .map(s -> s.name)
                .orElse("the scenario's action");
        return "Verified that " + lowerFirst(scenario.name) + " behaves as expected when " + lowerFirst(action) + ".";
    }

    static String forFailedScenario(Element scenario, Step failedStep) {
        if (failedStep == null || failedStep.result == null) {
            return "The scenario did not complete; no failing step was captured.";
        }
        String error = failedStep.result.error_message;
        String reason = classifyError(error);
        return "Failed at step \"" + failedStep.keyword.trim() + " " + failedStep.name + "\" — " + reason;
    }

    private static String classifyError(String error) {
        if (error == null || error.isBlank()) {
            return "no error detail was captured; check screenshot for visual state at failure.";
        }
        String lower = error.toLowerCase();
        if (lower.contains("nosuchelementexception")) {
            return "an expected element was not found on the page — locator may be wrong, or the page didn't render as expected.";
        }
        if (lower.contains("timeoutexception")) {
            return "the page did not reach the expected state within the wait timeout — likely a slow load or the element never appeared.";
        }
        if (lower.contains("assertionerror") || lower.contains("assert")) {
            return "an assertion failed — the app's actual behavior did not match the expected outcome (this may indicate a real product defect).";
        }
        if (lower.contains("staleelementreferenceexception")) {
            return "the page re-rendered mid-interaction and the element reference went stale.";
        }
        int firstLine = error.indexOf('\n');
        return "unhandled error: " + (firstLine > 0 ? error.substring(0, firstLine) : error);
    }

    private static String firstWord(String keyword) {
        return keyword == null ? "" : keyword.trim().split("\\s+")[0];
    }

    private static String lowerFirst(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        return Character.toLowerCase(s.charAt(0)) + s.substring(1);
    }
}
