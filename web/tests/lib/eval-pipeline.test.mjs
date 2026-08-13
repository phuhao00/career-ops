// Tests for the Evaluate page's six-step auto-pipeline mapper.
// Run:  node --test tests/lib/eval-pipeline.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STAGES,
  classifyLabel,
  classifyInput,
  looksLikeJobUrl,
  extractReportNum,
  derivePipeline,
} from "../../src/lib/eval-pipeline.mjs";

test("STAGES: six docs steps in auto-pipeline order", () => {
  assert.deepEqual(
    STAGES.map((s) => s.id),
    ["jd", "cv", "score", "report", "tracker", "pdf"],
  );
});

test("classifyLabel: tool names from the evaluate worker", () => {
  assert.equal(classifyLabel("WebFetch"), "jd");
  assert.equal(classifyLabel("Read"), "cv");
  assert.equal(classifyLabel("Write"), "report");
  assert.equal(classifyLabel("Bash"), "tracker");
  assert.equal(classifyLabel("TodoWrite"), null);
  assert.equal(classifyLabel("Starting…"), null);
  assert.equal(classifyLabel("Reading the posting"), "jd");
  assert.equal(classifyLabel("Saving to your tracker"), "tracker");
});

test("classifyInput: URL vs pasted JD vs too-short", () => {
  assert.equal(classifyInput("").ok, false);
  assert.equal(classifyInput("https://jobs.example.com/senior-engineer-ai").mode, "url");
  assert.equal(classifyInput("not a url").ok, false);
  const jd = classifyInput("We're looking for a senior engineer.\n\nResponsibilities:\n- Ship AI features\nRequirements:\n- 5 years experience in applied ML");
  assert.equal(jd.ok, true);
  assert.equal(jd.mode, "jd");
});

test("looksLikeJobUrl and extractReportNum", () => {
  assert.equal(looksLikeJobUrl("https://jobs.example.com/x"), true);
  assert.equal(looksLikeJobUrl("jobs.example.com/x"), false);
  assert.equal(extractReportNum("wrote reports/042-acme-2026-08-13.md"), "042");
  assert.equal(extractReportNum("no report here"), null);
});

test("derivePipeline: idle job is all pending", () => {
  const { stages, activeIndex } = derivePipeline(null, null);
  assert.equal(activeIndex, -1);
  assert.ok(stages.every((s) => s.status === "pending"));
});

test("derivePipeline: starting evaluate lights Read the posting", () => {
  const { stages, activeIndex } = derivePipeline(
    { status: "running", steps: [{ label: "Starting…" }], text: "" },
    null,
  );
  assert.equal(stages[0].id, "jd");
  assert.equal(stages[0].status, "active");
  assert.equal(activeIndex, 0);
});

test("derivePipeline: tool sequence marks earlier stages done", () => {
  const { stages } = derivePipeline(
    {
      status: "running",
      steps: [{ label: "WebFetch" }, { label: "Read" }, { label: "Write" }],
      text: "",
    },
    null,
  );
  assert.equal(stages.find((s) => s.id === "jd").status, "done");
  assert.equal(stages.find((s) => s.id === "cv").status, "done");
  assert.equal(stages.find((s) => s.id === "report").status, "active");
  assert.equal(stages.find((s) => s.id === "tracker").status, "pending");
  assert.equal(stages.find((s) => s.id === "pdf").status, "pending");
});

test("derivePipeline: VERDICT completes the score stage", () => {
  const { stages } = derivePipeline(
    {
      status: "running",
      steps: [{ label: "Read" }],
      text: "VERDICT: 4.2/5 — Strong applied-AI fit",
      result: { score: 4.2 },
    },
    null,
  );
  assert.equal(stages.find((s) => s.id === "score").status, "done");
});

test("derivePipeline: evaluate done leaves PDF ready, not done", () => {
  const { stages } = derivePipeline(
    { status: "done", steps: [{ label: "Bash" }], text: "VERDICT: 4.1/5 — Fit", result: { score: 4.1 } },
    null,
  );
  assert.equal(stages.find((s) => s.id === "tracker").status, "done");
  assert.equal(stages.find((s) => s.id === "report").status, "done");
  assert.equal(stages.find((s) => s.id === "pdf").status, "ready");
});

test("derivePipeline: pdf worker drives the last stage", () => {
  const evaluate = { status: "done", steps: [], text: "VERDICT: 4/5 — x", result: { score: 4 } };
  const running = derivePipeline(evaluate, { status: "running" });
  assert.equal(running.stages.find((s) => s.id === "pdf").status, "active");
  const done = derivePipeline(evaluate, { status: "done" });
  assert.equal(done.stages.find((s) => s.id === "pdf").status, "done");
});

test("derivePipeline: error marks the last reached stage", () => {
  const { stages } = derivePipeline(
    { status: "error", steps: [{ label: "WebFetch" }, { label: "Read" }], text: "" },
    null,
  );
  assert.equal(stages.find((s) => s.id === "cv").status, "error");
  assert.equal(stages.find((s) => s.id === "jd").status, "done");
});
