import assert from "node:assert/strict";
import test from "node:test";
import { detectSource } from "./detect";
import { jobsFromDocument, jobsFromUnknownJson } from "./jobs";
import { htmlToText } from "./text";

test("detects greenhouse, lever, and ashby boards from public urls", () => {
  assert.equal(detectSource("https://boards.greenhouse.io/airbnb", "")?.board, "airbnb");
  assert.equal(detectSource("https://job-boards.greenhouse.io/stripe", "")?.provider, "greenhouse");
  assert.equal(detectSource("https://jobs.lever.co/spotify", "")?.board, "spotify");
  assert.equal(detectSource("https://jobs.ashbyhq.com/notion/7c1f", "")?.board, "notion");
  assert.equal(detectSource("https://jobs.smartrecruiters.com/Visa", "")?.provider, "smartrecruiters");
});

test("detects a greenhouse api board used by a client-rendered careers page", () => {
  const found = detectSource(
    "https://skild.ai/_next/static/chunks/app/career/page.js",
    `fetch("https://boards-api.greenhouse.io/v1/boards/skildai-careers/jobs/")`
  );
  assert.equal(found?.provider, "greenhouse");
  assert.equal(found?.board, "skildai-careers");
  assert.match(found?.jobsUrl || "", /boards\/skildai-careers\/jobs\?content=true/);
});

test("decodes greenhouse html before stripping tags", () => {
  const text = htmlToText("&lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;At Skild AI&lt;/p&gt;&lt;/div&gt;");
  assert.equal(text.includes("<"), false);
  assert.match(text, /At Skild AI/);
});

test("detects an embedded greenhouse board in page html", () => {
  const found = detectSource(
    "https://example.com/careers",
    `<a href="https://boards.greenhouse.io/figma">Open roles</a>`
  );
  assert.equal(found?.provider, "greenhouse");
  assert.equal(found?.board, "figma");
  assert.match(found?.jobsUrl || "", /boards-api\.greenhouse\.io\/v1\/boards\/figma/);
});

test("detects a kula board embedded on a careers page", () => {
  const found = detectSource(
    "https://neo.work/careers",
    `<a href="https://careers.kula.ai/neo/50936">Senior Manager - Product Marketing</a>`
  );
  assert.equal(found?.provider, "kula");
  assert.equal(found?.board, "neo");
  assert.equal(found?.jobsUrl, "https://neo.work/careers");
});

test("reads a job list from any json feed with titles and locations", () => {
  const jobs = jobsFromUnknownJson("https://example.com/api/openings", {
    openings: [
      { id: "1", title: "Robotics Engineer", location: "San Mateo", url: "https://example.com/jobs/1" },
      { id: "2", name: "Firmware Engineer", office: "Bengaluru", link: "/jobs/2" },
    ],
  });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, "Robotics Engineer");
  assert.equal(jobs[1].url, "https://example.com/jobs/2");
});

test("does not treat a navigation list as jobs", () => {
  const jobs = jobsFromUnknownJson("https://example.com", {
    links: [{ name: "About" }, { name: "Blog" }, { name: "Careers" }],
  });
  assert.equal(jobs.length, 0);
});

test("reads a json job document as text", () => {
  const jobs = jobsFromDocument(
    "https://example.com/api/jobs",
    JSON.stringify({ jobs: [{ title: "Data Annotator", location: "Remote", absolute_url: "https://example.com/jobs/9" }] })
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].location, "Remote");
});

test("detects workday sites", () => {
  const found = detectSource(
    "https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite",
    ""
  );
  assert.equal(found?.provider, "workday");
  assert.equal(found?.board, "NVIDIAExternalCareerSite");
});
