import assert from "node:assert/strict";
import test from "node:test";
import { absorbLinkedIn, classifyResult, contentHash, dedupePosts, discoverLinkedInPosts } from "./linkedin";
import { generateLinkedInQueries } from "./search/queries";
import { createSearchProvider } from "./search/provider";
import type { SearchResult } from "./search/types";
import type { JobRecord, LinkedInSignal } from "./types";

const post = (over: Partial<SearchResult> = {}): SearchResult => ({
  title: "Jane Doe on LinkedIn: Launch day",
  url: "https://www.linkedin.com/posts/jane-doe-activity-1",
  snippet: "We just launched our new product!",
  publishedAt: null,
  ...over,
});

test("queries stay within six and name the company", () => {
  const queries = generateLinkedInQueries({
    company: "Sarvam",
    domain: "Marketing",
    preferredRoles: "Growth, Product Marketing, Community",
  });
  assert.ok(queries.length >= 4 && queries.length <= 6);
  assert.ok(queries.every((query) => query.includes('site:linkedin.com/posts "Sarvam"')));
  assert.ok(queries.some((query) => query.includes("we're hiring")));
  assert.ok(queries.some((query) => query.includes("hiring \"Growth\"")));
  assert.equal(queries.filter((query) => query.includes("Community")).length, 0);
});

test("a product launch is not a job", () => {
  const found = classifyResult(post(), "q");
  assert.equal(found.kind, "irrelevant");
  assert.equal(found.jobTitle, null);
});

test("a hiring post without a title stays a signal", () => {
  const found = classifyResult(
    post({
      title: "Jane Doe on LinkedIn: We're hiring",
      snippet: "We're hiring! DM me if you want to hear more.",
    }),
    "q"
  );
  assert.equal(found.kind, "signal");
  assert.equal(found.authorName, "Jane Doe");
  assert.equal(found.jobTitle, null);
});

test("a clear role becomes a provisional job", () => {
  const found = classifyResult(
    post({
      title: "Jane Doe on LinkedIn: We're hiring",
      snippet: "We're looking for a Growth Intern to join our team. DM me if interested.",
    }),
    "q"
  );
  assert.equal(found.kind, "job");
  assert.equal(found.jobTitle, "Growth Intern");
  assert.equal(found.authorName, "Jane Doe");
});

test("the same post url hashes once", () => {
  const url = "https://www.linkedin.com/posts/jane-doe-activity-9";
  assert.equal(contentHash(url), contentHash(`${url}?trk=public_profile`));
  const first = classifyResult(
    post({ url, title: "Jane Doe on LinkedIn: hiring", snippet: "We're hiring a Brand Associate for the team." }),
    "q"
  );
  const second = classifyResult(post({ url, snippet: "We're hiring a Brand Associate for the team. Apply." }), "q");
  assert.equal(dedupePosts([first, second]).length, 1);
});

test("a repeated hash does not create a second job", () => {
  const found = classifyResult(
    post({ snippet: "We're looking for a Growth Intern to join our team." }),
    "site:linkedin.com/posts"
  );
  const db = { jobs: [] as JobRecord[], linkedinSignals: [] as LinkedInSignal[] };
  absorbLinkedIn(db, "co", [found], "2026-09-24T00:00:00.000Z");
  absorbLinkedIn(db, "co", [found], "2026-09-25T00:00:00.000Z");
  assert.equal(db.jobs.length, 1);
  assert.equal(db.linkedinSignals.length, 1);
  assert.equal(db.jobs[0].origin, "linkedin");
  assert.equal(db.jobs[0].unverified, true);
  assert.equal(db.jobs[0].seenCount, 2);
  assert.equal(db.jobs[0].url, found.url);
});

test("the same title merges onto the careers job", () => {
  const careers: JobRecord = {
    id: "co:gh-1",
    companyId: "co",
    externalId: "gh-1",
    title: "Growth Intern",
    url: "https://boards.greenhouse.io/acme/jobs/1",
    location: "Remote",
    department: "",
    descriptionText: "Growth intern on the marketing team.",
    postedAt: null,
    dateKind: null,
    employmentHint: "",
    firstSeenAt: "2026-09-01T00:00:00.000Z",
    lastSeenAt: "2026-09-01T00:00:00.000Z",
    seenCount: 2,
    active: true,
    origin: "careers",
  };
  const found = classifyResult(
    post({ snippet: "We're looking for a Growth Intern to join our team." }),
    "q"
  );
  const db = { jobs: [careers], linkedinSignals: [] as LinkedInSignal[] };
  absorbLinkedIn(db, "co", [found], "2026-09-24T00:00:00.000Z");
  assert.equal(db.jobs.length, 1);
  assert.equal(db.jobs[0].origin, "both");
  assert.equal(db.jobs[0].url, careers.url);
  assert.equal(db.linkedinSignals[0].status, "converted");
  assert.equal(db.linkedinSignals[0].jobId, careers.id);
});

test("tavily reports a missing key and keeps linkedin post hits", async () => {
  const missing = await createSearchProvider().search("site:linkedin.com/posts hiring");
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.reason, "not_configured");

  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            title: "A founder on LinkedIn: hiring",
            url: "https://www.linkedin.com/posts/founder-activity-3",
            content: "We're hiring a Community Intern to join the team.",
            published_date: "2026-09-20",
          },
          {
            title: "Careers",
            url: "https://example.com/careers",
            content: "We're hiring a Community Intern.",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  const found = await discoverLinkedInPosts({
    company: "Sarvam",
    domain: "Marketing",
    search: {
      async search() {
        const { searchTavily } = await import("./search/tavily");
        return searchTavily("q", { apiKey: "test-key", fetchImpl });
      },
    },
  });
  assert.equal(found.status, "ok");
  assert.equal(found.posts.length, 1);
  assert.equal(found.posts[0].kind, "job");
  assert.equal(found.posts[0].jobTitle, "Community Intern");
  assert.equal(found.posts[0].publishedAt, "2026-09-20");
});
