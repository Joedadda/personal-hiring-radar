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

test("queries name the company and people who work there", () => {
  const queries = generateLinkedInQueries({
    company: "Sarvam",
    domain: "Marketing",
    preferredRoles: "Growth, Product Marketing, Community",
  });
  assert.ok(queries.length >= 4 && queries.length <= 10);
  assert.ok(queries.some((query) => query.includes('site:linkedin.com/posts "Sarvam"')));
  assert.ok(queries.some((query) => query.includes('"at Sarvam"')));
  assert.ok(queries.some((query) => query.includes("we're hiring")));
  assert.ok(queries.some((query) => query.includes('hiring "Growth"')));
  assert.equal(queries.filter((query) => query.includes("Community")).length, 0);
  assert.equal(queries.filter((query) => query.includes("Product Marketing")).length, 0);
});

test("a product launch is not a job", () => {
  const found = classifyResult(post(), "q");
  assert.equal(found.kind, "irrelevant");
  assert.equal(found.jobTitle, null);
});

test("a hiring post without a role title stays off the desk", () => {
  const found = classifyResult(
    post({
      title: "Jane Doe, Content Lead at Neo on LinkedIn: We're hiring",
      snippet: "We're hiring! DM me if you want to hear more.",
    }),
    "q",
    { company: "Neo", domain: "Marketing" }
  );
  assert.equal(found.kind, "signal");
  assert.equal(found.jobTitle, null);
});

test("a short link that only shares a common company word is dropped", () => {
  const found = classifyResult(
    post({
      title: "Someone on LinkedIn: thoughts",
      url: "https://lnkd.in/p/gp4aEs9p",
      snippet: "Cardboard is useful. Apply today.",
    }),
    "q",
    { company: "Cardboard", domain: "Marketing" }
  );
  assert.equal(found.kind, "irrelevant");
  assert.equal(found.jobTitle, null);
});

test("a company email domain ties a filmmaker post to that company", () => {
  const found = classifyResult(
    post({
      title: "Saksham Aggarwal on LinkedIn: We're hiring a Filmmaker Intern",
      url: "https://www.linkedin.com/posts/sakshamagg27_were-hiring-a-filmmaker-intern-youll-activity-7504581030243176448-1Vko",
      snippet:
        "We're hiring a Filmmaker Intern! You'll script, shoot, and edit! Email filmmaker.intern.hiring@cardboard.ai",
    }),
    "q",
    { company: "Cardboard", domain: "Video", host: "cardboard.ai" }
  );
  assert.equal(found.kind, "job");
  assert.equal(found.jobTitle, "Filmmaker Intern");
});

test("a personal hiring post becomes a role for that company", () => {
  const found = classifyResult(
    post({
      title: "Jane Doe, Content Lead at Neo on LinkedIn: We're hiring",
      snippet: "We're hiring a marketing lead. DM me.",
      url: "https://www.linkedin.com/posts/jane-doe-activity-4",
    }),
    "q",
    { company: "Neo", domain: "Marketing" }
  );
  assert.equal(found.kind, "job");
  assert.equal(found.jobTitle, "marketing lead");
  assert.equal(found.authorName, "Jane Doe, Content Lead at Neo");
  const db = { jobs: [] as JobRecord[], linkedinSignals: [] as LinkedInSignal[] };
  absorbLinkedIn(db, "neo", [found], "2026-09-24T00:00:00.000Z");
  assert.equal(db.jobs.length, 1);
  assert.equal(db.jobs[0].origin, "linkedin");
  assert.equal(db.jobs[0].title, "marketing lead");
  assert.equal(db.jobs[0].authorName, "Jane Doe, Content Lead at Neo");
  assert.equal(db.linkedinSignals[0].status, "converted");
});

test("a hiring post about another company is dropped", () => {
  const found = classifyResult(
    post({
      title: "Jane Doe on LinkedIn: We're hiring",
      snippet: "We're hiring a marketing lead at Other Co. DM me.",
    }),
    "q",
    { company: "Neo", domain: "Marketing" }
  );
  assert.equal(found.kind, "irrelevant");
  assert.equal(found.jobTitle, null);
});

test("a clear role becomes a provisional job", () => {
  const found = classifyResult(
    post({
      title: "Jane Doe at Acme on LinkedIn: We're hiring",
      snippet: "We're looking for a Growth Intern to join our team. DM me if interested.",
    }),
    "q",
    { company: "Acme", domain: "Marketing" }
  );
  assert.equal(found.kind, "job");
  assert.equal(found.jobTitle, "Growth Intern");
  assert.equal(found.authorName, "Jane Doe at Acme");
});

test("the same post url hashes once", () => {
  const url = "https://www.linkedin.com/posts/jane-doe-activity-9";
  assert.equal(contentHash(url), contentHash(`${url}?trk=public_profile`));
  const first = classifyResult(
    post({ url, title: "Jane Doe at Acme on LinkedIn: hiring", snippet: "We're hiring a Brand Associate for the team." }),
    "q",
    { company: "Acme", domain: "Marketing" }
  );
  const second = classifyResult(
    post({ url, title: "Jane Doe at Acme on LinkedIn: hiring", snippet: "We're hiring a Brand Associate for the team. Apply." }),
    "q",
    { company: "Acme", domain: "Marketing" }
  );
  assert.equal(dedupePosts([first, second]).length, 1);
});

test("a repeated hash does not create a second job", () => {
  const found = classifyResult(
    post({
      title: "Jane Doe at Acme on LinkedIn: We're hiring",
      snippet: "We're looking for a Growth Intern to join our team.",
    }),
    "site:linkedin.com/posts",
    { company: "Acme", domain: "Marketing" }
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
    post({
      title: "Jane Doe at Acme on LinkedIn: We're hiring",
      snippet: "We're looking for a Growth Intern to join our team.",
    }),
    "q",
    { company: "Acme", domain: "Marketing" }
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
            title: "A founder at Sarvam on LinkedIn: hiring",
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
