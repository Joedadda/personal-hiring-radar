import assert from "node:assert/strict";
import test from "node:test";
import { matchJob } from "./match";
import type { Level } from "./types";

const marketingIntern = {
  domain: "Marketing",
  preferredRoles: "",
  levels: ["internship"] as Level[],
  keywords: "",
};

test("community intern is marketing even when the title omits the word", () => {
  const result = matchJob(
    {
      title: "Community Intern",
      body: "You'll run our community programs, host discussions, and shape the brand voice across social channels. You'll also draft social media posts.",
    },
    marketingIntern
  );
  assert.equal(result.relevant, true);
  assert.equal(result.titleSaysDomain, false);
  assert.ok(result.matchedClusters.some((cluster) => /community|social|brand/i.test(cluster)));
  assert.match(result.reasons[0], /does not need the word marketing/i);
});

test("videography and seo internships stay inside marketing", () => {
  const video = matchJob(
    {
      title: "Videography Intern",
      body: "Film product launches and cut short-form video for campaigns and social distribution.",
    },
    marketingIntern
  );
  const seo = matchJob(
    {
      title: "SEO Intern",
      body: "Improve organic search performance, conduct keyword research, and brief writers.",
    },
    marketingIntern
  );
  assert.equal(video.relevant, true);
  assert.equal(seo.relevant, true);
});

test("backend intern is not treated as marketing", () => {
  const result = matchJob(
    {
      title: "Backend Engineer Intern",
      body: "Build APIs, write tests, and maintain our Postgres database. You will own backend services.",
    },
    marketingIntern
  );
  assert.equal(result.relevant, false);
});

test("preferred roles boost growth without hiding community", () => {
  const profile = { ...marketingIntern, preferredRoles: "Growth, Product Marketing" };
  const growth = matchJob(
    {
      title: "Growth Intern",
      body: "Own activation experiments, lifecycle messaging, and demand generation. Partner with email marketing for the growth team.",
    },
    profile
  );
  const community = matchJob(
    {
      title: "Community Intern",
      body: "You'll run our community programs and shape the brand voice across social channels.",
    },
    profile
  );
  assert.equal(growth.relevant, true);
  assert.equal(community.relevant, true);
  assert.ok(growth.score > community.score);
  assert.ok(growth.roleScore > 0);
  assert.equal(community.roleScore, 0);
});

test("internship search sets senior roles aside", () => {
  const result = matchJob(
    {
      title: "VP of Marketing",
      body: "Lead brand marketing, demand generation, and the communications team.",
    },
    marketingIntern
  );
  assert.equal(result.relevant, false);
  assert.equal(result.detectedLevel, "Senior");
});

test("keywords raise a role without being required", () => {
  const body = "Draft social media posts and run community programs. Experiment with AI tools for creative marketing.";
  const withKeyword = matchJob({ title: "Community Intern", body }, { ...marketingIntern, keywords: "AI, SaaS" });
  const without = matchJob({ title: "Community Intern", body }, marketingIntern);
  assert.equal(withKeyword.relevant, true);
  assert.equal(without.relevant, true);
  assert.ok(withKeyword.score > without.score);
});

test("marketing roles outside internship stay visible as the wrong level", () => {
  const result = matchJob(
    {
      title: "Creative Director",
      body: "Lead campaigns and the brand voice.",
      department: "Marketing",
    },
    marketingIntern
  );
  assert.equal(result.domainMatch, true);
  assert.equal(result.relevant, false);
  assert.match(result.reasons.join(" "), /set aside/i);
});

test("an IT lead is not marketing because asset lifecycle is not marketing", () => {
  const result = matchJob(
    {
      title: "IT Lead",
      department: "Information Technology",
      body: "Own identity, endpoints, and asset lifecycle from procurement to certified disposal. Set up infrastructure and audit evidence as the company grows.",
    },
    { ...marketingIntern, levels: ["any"] }
  );
  assert.equal(result.domainMatch, false);
});

test("a designer stays out of marketing and shows up for design", () => {
  const job = {
    title: "Brand Designer",
    department: "Design",
    body: "Design brand identities and campaign visuals in Figma, from concept through final artwork.",
  };
  const marketing = matchJob(job, { ...marketingIntern, levels: ["any"] });
  const design = matchJob(job, { domain: "Design", preferredRoles: "", levels: ["any"], keywords: "" });
  assert.equal(marketing.domainMatch, false);
  assert.equal(design.domainMatch, true);
});

test("a designer in a marketing department still belongs to design", () => {
  const job = {
    title: "Visual Designer",
    department: "Marketing",
    body: "Own brand campaigns, content, and product marketing visuals from brief through launch.",
  };
  const marketing = matchJob(job, { ...marketingIntern, levels: ["any"] });
  const design = matchJob(job, { domain: "Design", preferredRoles: "", levels: ["any"], keywords: "" });
  assert.equal(marketing.domainMatch, false);
  assert.equal(design.domainMatch, true);
});

test("finance work is not pulled into a marketing search", () => {
  const result = matchJob(
    {
      title: "FP&A Intern",
      body: "Own forecasting, variance analysis, and month-end close. Support board reporting and the general ledger.",
    },
    marketingIntern
  );
  assert.equal(result.relevant, false);
});
