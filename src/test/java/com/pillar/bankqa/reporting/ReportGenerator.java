package com.pillar.bankqa.reporting;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pillar.bankqa.reporting.model.CucumberJsonModels.Element;
import com.pillar.bankqa.reporting.model.CucumberJsonModels.Embedding;
import com.pillar.bankqa.reporting.model.CucumberJsonModels.Feature;
import com.pillar.bankqa.reporting.model.CucumberJsonModels.Step;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Reads target/cucumber-report.json (Cucumber's native JSON output) and
 * renders a bespoke, demo-facing HTML/CSS dashboard: KPI summary, per-scenario
 * drill-down with embedded screenshots, and a plain-English diagnosis per
 * scenario. Deliberately not Extent Reports / Allure — custom because we
 * want the diagnosis text and styling under our own control.
 */
public class ReportGenerator {

    private static final String INPUT_JSON = "target/cucumber-report.json";
    private static final String OUTPUT_DIR = "target/qa-report";
    private static final String OUTPUT_FILE = OUTPUT_DIR + "/index.html";

    public static void main(String[] args) throws IOException {
        Path input = Path.of(INPUT_JSON);
        if (!Files.exists(input)) {
            System.out.println("[ReportGenerator] No cucumber-report.json found at " + input.toAbsolutePath()
                    + " — skipping report generation (run tests first).");
            return;
        }

        ObjectMapper mapper = new ObjectMapper();
        List<Feature> features = mapper.readValue(input.toFile(),
                mapper.getTypeFactory().constructCollectionType(List.class, Feature.class));

        Files.createDirectories(Path.of(OUTPUT_DIR));
        String html = new HtmlRenderer().render(features);
        Files.writeString(Path.of(OUTPUT_FILE), html, StandardCharsets.UTF_8);

        System.out.println("[ReportGenerator] Report written to " + new File(OUTPUT_FILE).getAbsolutePath());
    }

    /** Timestamp helper shared with HtmlRenderer, kept here to avoid a Date/Instant dependency at class-load time. */
    static String now() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }
}
