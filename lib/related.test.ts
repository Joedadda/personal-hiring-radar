import assert from "node:assert/strict";
import test from "node:test";
import { matchJob } from "./match";
import { applyRelatedFit, judgeRelated } from "./related";

const stopMotion = { domain: "Stop motion", preferredRoles: "", levels: ["any"] as const, keywords: "" };

function geminiReply(titles: string[]) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ titles }) }] } }] }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

test("a model yes keeps a title the lists do not name", async () => {
  const job = {
    title: "Filmmaker Intern",
    body: "You'll script, shoot, and edit.",
  };
  const missed = matchJob(job, stopMotion);
  assert.equal(missed.domainMatch, false);

  let calls = 0;
  const accepted = await judgeRelated({
    domain: "Stop motion",
    roles: [{ title: job.title, excerpt: job.body }],
    apiKey: "test-key",
    fetchImpl: async () => {
      calls += 1;
      return geminiReply(["Filmmaker Intern"]);
    },
  });
  assert.equal(calls, 1);
  assert.ok(accepted?.has("filmmaker intern"));
  const kept = applyRelatedFit(missed, "Stop motion", job.title);
  assert.equal(kept.domainMatch, true);
  assert.equal(kept.relevant, true);
  assert.match(kept.reasons[0], /Related to Stop motion/i);
});

test("a model no keeps Backend Intern off a Video desk", async () => {
  const job = { title: "Backend Intern", body: "Build APIs and services." };
  const missed = matchJob(job, { domain: "Video", preferredRoles: "", levels: ["any"], keywords: "" });
  assert.equal(missed.domainMatch, false);
  const accepted = await judgeRelated({
    domain: "Video",
    roles: [{ title: job.title, excerpt: job.body }],
    apiKey: "test-key",
    fetchImpl: async () => geminiReply([]),
  });
  assert.equal(accepted?.size, 0);
  assert.equal(missed.domainMatch, false);
  assert.equal(missed.relevant, false);
});

test("a missing match key skips the judge", async () => {
  const previous = process.env.MATCH_API_KEY;
  delete process.env.MATCH_API_KEY;
  let calls = 0;
  const accepted = await judgeRelated({
    domain: "Video",
    roles: [{ title: "Filmmaker Intern", excerpt: "Shoot and edit." }],
    fetchImpl: async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    },
  });
  if (previous === undefined) delete process.env.MATCH_API_KEY;
  else process.env.MATCH_API_KEY = previous;
  assert.equal(accepted, null);
  assert.equal(calls, 0);
});
