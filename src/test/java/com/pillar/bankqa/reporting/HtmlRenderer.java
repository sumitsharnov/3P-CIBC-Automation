package com.pillar.bankqa.reporting;

import com.pillar.bankqa.reporting.model.CucumberJsonModels.Element;
import com.pillar.bankqa.reporting.model.CucumberJsonModels.Embedding;
import com.pillar.bankqa.reporting.model.CucumberJsonModels.Feature;
import com.pillar.bankqa.reporting.model.CucumberJsonModels.Step;
import com.pillar.bankqa.reporting.model.CucumberJsonModels.Tag;

import java.util.List;

/**
 * Renders the parsed Cucumber JSON model into a single self-contained HTML
 * page: KPI summary, per-scenario drill-down, embedded screenshots, and a
 * plain-English diagnosis per scenario (via DiagnosisEngine).
 */
final class HtmlRenderer {

    String render(List<Feature> features) {
        int total = 0;
        int passed = 0;
        int failed = 0;
        long durationNanos = 0;

        StringBuilder scenarios = new StringBuilder();

        for (Feature feature : features) {
            if (feature.elements == null) {
                continue;
            }
            for (Element scenario : feature.elements) {
                if (!"scenario".equalsIgnoreCase(scenario.type)) {
                    continue;
                }
                total++;
                Step failedStep = firstFailedStep(scenario);
                boolean scenarioPassed = failedStep == null;
                if (scenarioPassed) {
                    passed++;
                } else {
                    failed++;
                }
                if (scenario.steps != null) {
                    for (Step step : scenario.steps) {
                        if (step.result != null && step.result.duration != null) {
                            durationNanos += step.result.duration;
                        }
                    }
                }
                scenarios.append(renderScenario(feature, scenario, failedStep, scenarioPassed));
            }
        }

        double durationSeconds = durationNanos / 1_000_000_000.0;
        return page(total, passed, failed, durationSeconds, scenarios.toString());
    }

    private Step firstFailedStep(Element scenario) {
        if (scenario.steps == null) {
            return null;
        }
        for (Step step : scenario.steps) {
            if (step.result != null && "failed".equalsIgnoreCase(step.result.status)) {
                return step;
            }
        }
        return null;
    }

    private String renderScenario(Feature feature, Element scenario, Step failedStep, boolean passed) {
        String statusClass = passed ? "passed" : "failed";
        String statusLabel = passed ? "PASSED" : "FAILED";
        String diagnosis = passed
                ? DiagnosisEngine.forPassedScenario(scenario)
                : DiagnosisEngine.forFailedScenario(scenario, failedStep);

        StringBuilder steps = new StringBuilder();
        if (scenario.steps != null) {
            for (Step step : scenario.steps) {
                String stepStatus = step.result != null ? step.result.status : "skipped";
                steps.append("<li class=\"step step-").append(escape(stepStatus)).append("\">")
                        .append("<span class=\"step-keyword\">").append(escape(step.keyword)).append("</span>")
                        .append(escape(step.name))
                        .append(" <span class=\"step-status\">").append(escape(stepStatus)).append("</span>");
                steps.append(renderEmbeddings(step.embeddings));
                steps.append("</li>");
            }
        }

        String tags = renderTags(scenario.tags != null ? scenario.tags : feature.tags);

        return "<section class=\"scenario " + statusClass + "\">"
                + "<header class=\"scenario-header\">"
                + "<span class=\"badge badge-" + statusClass + "\">" + statusLabel + "</span>"
                + "<h3>" + escape(scenario.name) + "</h3>"
                + tags
                + "<p class=\"feature-name\">" + escape(feature.name) + "</p>"
                + "</header>"
                + "<p class=\"diagnosis\">" + escape(diagnosis) + "</p>"
                + "<ul class=\"steps\">" + steps + "</ul>"
                + "</section>";
    }

    private String renderEmbeddings(List<Embedding> embeddings) {
        if (embeddings == null || embeddings.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (Embedding embedding : embeddings) {
            if (embedding.mime_type != null && embedding.mime_type.startsWith("image/")) {
                sb.append("<div class=\"screenshot\"><img src=\"data:")
                        .append(escape(embedding.mime_type)).append(";base64,")
                        .append(embedding.data)
                        .append("\" alt=\"Failure screenshot\"/></div>");
            }
        }
        return sb.toString();
    }

    private String renderTags(List<Tag> tags) {
        if (tags == null || tags.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder("<div class=\"tags\">");
        for (Tag tag : tags) {
            sb.append("<span class=\"tag\">").append(escape(tag.name)).append("</span>");
        }
        return sb.append("</div>").toString();
    }

    private String page(int total, int passed, int failed, double durationSeconds, String scenariosHtml) {
        double passRate = total == 0 ? 0 : (passed * 100.0 / total);
        return "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"/>"
                + "<title>CIBC AI MVP - QA Report</title>"
                + "<style>" + css() + "</style></head><body>"
                + "<div class=\"container\">"
                + "<header class=\"page-header\">"
                + "<h1>QA Automation Report</h1>"
                + "<p class=\"timestamp\">Generated " + ReportGenerator.now() + "</p>"
                + "</header>"
                + "<div class=\"kpis\">"
                + kpi("Total Scenarios", String.valueOf(total), "neutral")
                + kpi("Passed", String.valueOf(passed), "passed")
                + kpi("Failed", String.valueOf(failed), "failed")
                + kpi("Pass Rate", String.format("%.0f%%", passRate), failed == 0 ? "passed" : "neutral")
                + kpi("Duration", String.format("%.1fs", durationSeconds), "neutral")
                + "</div>"
                + "<div class=\"scenarios\">" + scenariosHtml + "</div>"
                + "</div></body></html>";
    }

    private String kpi(String label, String value, String tone) {
        return "<div class=\"kpi kpi-" + tone + "\"><div class=\"kpi-value\">" + escape(value)
                + "</div><div class=\"kpi-label\">" + escape(label) + "</div></div>";
    }

    private String escape(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private String css() {
        return "body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;color:#1c2733;}"
                + ".container{max-width:1000px;margin:0 auto;padding:32px 24px 64px;}"
                + ".page-header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:24px;}"
                + ".page-header h1{margin:0;font-size:24px;color:#0b3d91;}"
                + ".timestamp{color:#6b7684;font-size:13px;}"
                + ".kpis{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:32px;}"
                + ".kpi{flex:1;min-width:120px;background:#fff;border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center;}"
                + ".kpi-value{font-size:26px;font-weight:700;}"
                + ".kpi-label{font-size:12px;color:#6b7684;margin-top:4px;text-transform:uppercase;letter-spacing:.03em;}"
                + ".kpi-passed .kpi-value{color:#1a9e5c;}"
                + ".kpi-failed .kpi-value{color:#d13438;}"
                + ".scenarios{display:flex;flex-direction:column;gap:16px;}"
                + ".scenario{background:#fff;border-radius:10px;padding:18px 20px;box-shadow:0 1px 3px rgba(0,0,0,.08);border-left:5px solid #c8ced6;}"
                + ".scenario.passed{border-left-color:#1a9e5c;}"
                + ".scenario.failed{border-left-color:#d13438;}"
                + ".scenario-header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}"
                + ".scenario-header h3{margin:0;font-size:16px;}"
                + ".feature-name{width:100%;margin:2px 0 0;font-size:12px;color:#8a93a0;}"
                + ".badge{font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;color:#fff;}"
                + ".badge-passed{background:#1a9e5c;}"
                + ".badge-failed{background:#d13438;}"
                + ".tags{display:flex;gap:6px;}"
                + ".tag{font-size:11px;background:#eef1f5;color:#57606b;padding:2px 8px;border-radius:12px;}"
                + ".diagnosis{font-size:13.5px;color:#33404d;background:#f7f9fb;border-radius:8px;padding:10px 12px;margin:12px 0;}"
                + ".steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}"
                + ".step{font-size:13px;padding:6px 10px;border-radius:6px;background:#fbfbfc;}"
                + ".step-keyword{font-weight:700;margin-right:4px;}"
                + ".step-status{float:right;font-size:11px;color:#8a93a0;text-transform:uppercase;}"
                + ".step-failed{background:#fdecec;}"
                + ".step-passed{background:#eefaf2;}"
                + ".screenshot{margin-top:8px;}"
                + ".screenshot img{max-width:100%;border-radius:6px;border:1px solid #e0e4e9;}";
    }
}
