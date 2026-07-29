package com.pillar.bankqa.reporting.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * Minimal POJO mirror of the Cucumber legacy JSON formatter output
 * (target/cucumber-report.json). Only the fields the report generator
 * actually reads are declared; everything else is ignored.
 */
public final class CucumberJsonModels {

    private CucumberJsonModels() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Feature {
        public String uri;
        public String name;
        public String description;
        public List<Tag> tags;
        public List<Element> elements;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Element {
        public String id;
        public String keyword;
        public String name;
        public String description;
        public String type;
        public List<Tag> tags;
        public List<Step> steps;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Step {
        public String keyword;
        public String name;
        public Long line;
        public Result result;
        public List<Embedding> embeddings;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Result {
        public String status;
        public Long duration;
        public String error_message;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Embedding {
        public String data;
        public String mime_type;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Tag {
        public String name;
    }
}
