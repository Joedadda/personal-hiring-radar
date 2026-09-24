import { createHash } from "node:crypto";
import { generateLinkedInQueries } from "./search/queries";
import type { SearchProvider, SearchResult } from "./search/types";
import { collapse } from "./text";
import type { JobRecord, LinkedInSignal } from "./types";

const HIRING =
  /\b(hiring|we'?re hiring|we are hiring|looking for|looking to hire|join our team|join the team|open roles?|team is growing|building our team|come work with us|applications open|apply|dm me|reach out)\b/i;

export type ClassifiedPost = {
  kind: "irrelevant" | "signal" | "job";
  url: string;
  title: string;
  snippet: string;
  publishedAt: string | null;
  query: string;
  contentHash: string;
  authorName: string | null;
  jobTitle: string | null;
};

export function contentHash(url: string): string {
  const canonical = url.split("?")[0].replace(/\/$/, "").toLowerCase();
  return createHash("sha256").update(canonical).digest("hex").slice(0, 20);
}

export function classifyResult(result: SearchResult, query: string): ClassifiedPost {
  const snippet = collapse(result.snippet || "");
  const headline = collapse(result.title.replace(/^.{0,80}?\s+on LinkedIn:\s*/i, ""));
  const spoken = /^(we'?re hiring|we are hiring|hiring)[.!]?$/i.test(headline) ? "" : headline;
  const blob = collapse(`${spoken} ${snippet}`);
  const authorName = authorFrom(result.title);
  const base = {
    url: result.url,
    title: collapse(result.title),
    snippet,
    publishedAt: result.publishedAt,
    query,
    contentHash: contentHash(result.url || snippet),
    authorName,
  };
  if (!/linkedin\.com\/(posts|feed)\//i.test(result.url) || !HIRING.test(blob)) {
    return { ...base, kind: "irrelevant", jobTitle: null };
  }
  const jobTitle = extractTitle(blob);
  if (!jobTitle) return { ...base, kind: "signal", jobTitle: null };
  return { ...base, kind: "job", jobTitle };
}

export function dedupePosts(posts: ClassifiedPost[]): ClassifiedPost[] {
  const seen = new Set<string>();
  const unique: ClassifiedPost[] = [];
  for (const post of posts) {
    if (seen.has(post.contentHash)) continue;
    seen.add(post.contentHash);
    unique.push(post);
  }
  return unique;
}

export async function discoverLinkedInPosts(input: {
  company: string;
  domain: string;
  preferredRoles?: string;
  search: SearchProvider;
}): Promise<{ posts: ClassifiedPost[]; status: "ok" | "off" | "failed" }> {
  const queries = generateLinkedInQueries(input);
  const posts: ClassifiedPost[] = [];
  let sawResult = false;
  let sawFailure = false;
  for (const query of queries) {
    const outcome = await input.search.search(query, { limit: 5 });
    if (!outcome.ok && outcome.reason === "not_configured") return { posts: [], status: "off" };
    if (!outcome.ok) {
      sawFailure = true;
      continue;
    }
    sawResult = true;
    for (const result of outcome.results) posts.push(classifyResult(result, query));
  }
  if (!sawResult && sawFailure) return { posts: [], status: "failed" };
  return { posts: dedupePosts(posts), status: "ok" };
}

export function absorbLinkedIn(
  db: { jobs: JobRecord[]; linkedinSignals: LinkedInSignal[] },
  companyId: string,
  posts: ClassifiedPost[],
  now: string
) {
  const preexisting = new Set(
    db.jobs.filter((job) => job.companyId === companyId && job.origin === "linkedin").map((job) => job.id)
  );
  for (const post of dedupePosts(posts)) {
    let signal = db.linkedinSignals.find((item) => item.companyId === companyId && item.contentHash === post.contentHash);
    if (!signal) {
      signal = {
        id: `${companyId}:${post.contentHash}`,
        companyId,
        jobId: null,
        url: post.url,
        authorName: post.authorName,
        snippet: post.snippet,
        publishedAt: post.publishedAt,
        discoveredAt: now,
        searchQuery: post.query,
        contentHash: post.contentHash,
        status: post.kind === "job" ? "converted" : post.kind === "signal" ? "candidate" : "irrelevant",
      };
      db.linkedinSignals.push(signal);
    }
    if (post.kind !== "job" || !post.jobTitle) continue;
    const careers = db.jobs.find(
      (job) =>
        job.companyId === companyId &&
        job.active &&
        job.origin !== "linkedin" &&
        normalizeTitle(job.title) === normalizeTitle(post.jobTitle || "")
    );
    if (careers) {
      careers.origin = "both";
      if (!careers.authorName && post.authorName) careers.authorName = post.authorName;
      signal.status = "converted";
      signal.jobId = careers.id;
      const twin = db.jobs.find(
        (job) => job.companyId === companyId && job.origin === "linkedin" && job.externalId === `linkedin:${post.contentHash}`
      );
      if (twin && twin.id !== careers.id) twin.active = false;
      continue;
    }
    const existing = db.jobs.find(
      (job) => job.companyId === companyId && job.externalId === `linkedin:${post.contentHash}`
    );
    if (existing) {
      signal.status = "converted";
      signal.jobId = existing.id;
      existing.active = true;
      continue;
    }
    const id = `${companyId}:linkedin:${post.contentHash}`;
    db.jobs.push({
      id,
      companyId,
      externalId: `linkedin:${post.contentHash}`,
      title: post.jobTitle,
      url: post.url,
      location: "",
      department: "",
      descriptionText: post.snippet,
      postedAt: post.publishedAt,
      dateKind: post.publishedAt ? "posted" : null,
      employmentHint: "",
      firstSeenAt: now,
      lastSeenAt: now,
      seenCount: 1,
      active: true,
      origin: "linkedin",
      authorName: post.authorName,
      unverified: true,
    });
    signal.status = "converted";
    signal.jobId = id;
  }
  for (const job of db.jobs) {
    if (!preexisting.has(job.id) || !job.active || job.origin !== "linkedin") continue;
    job.seenCount += 1;
    job.lastSeenAt = now;
  }
}

function authorFrom(title: string): string | null {
  const match = title.match(/^(.{2,80}?)\s+on LinkedIn:/i);
  const name = match?.[1]?.trim();
  if (!name || /linkedin/i.test(name)) return null;
  return name;
}

function extractTitle(blob: string): string | null {
  const patterns = [
    /\blooking for\s+(?:an?\s+)?([A-Za-z][A-Za-z0-9/+&,'’ -]{2,70}?)(?=\s+(?:to|who|for|at)\b|[.!?|]|$)/i,
    /\bwe'?re hiring\s+(?:an?\s+)?([A-Za-z][A-Za-z0-9/+&,'’ -]{2,70}?)(?=\s+(?:to|who|for|at)\b|[.!?|]|$)/i,
    /\bwe are hiring\s+(?:an?\s+)?([A-Za-z][A-Za-z0-9/+&,'’ -]{2,70}?)(?=\s+(?:to|who|for|at)\b|[.!?|]|$)/i,
    /\bhiring\s+(?:an?\s+)?([A-Za-z][A-Za-z0-9/+&,'’ -]{2,70}?)(?=\s+(?:to|who|for|at)\b|[.!?|]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = blob.match(pattern);
    const title = cleanupTitle(match?.[1] || "");
    if (title) return title;
  }
  return null;
}

function cleanupTitle(value: string): string | null {
  const title = collapse(value).replace(/[,:; -]+$/g, "");
  if (title.length < 3 || /^(our team|someone|you|people|candidates?)$/i.test(title)) return null;
  if (/\b(hiring|looking)\b/i.test(title)) return null;
  return title;
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
