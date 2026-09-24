import { detectSource } from "./detect";
import { assertPublicUrl, fetchJson, fetchText, FetchError } from "./http";
import { jobsFromDocument } from "./jobs";
import { collapse, decodeEntities, hostOf } from "./text";
import type { JobSource } from "./types";

export type Discovery = {
  name: string;
  blurb: string;
  website: string;
  careersUrl: string | null;
  source: JobSource | null;
  pageUrl: string | null;
  pageHtml: string | null;
  error: string | null;
};

const CAREER_PATHS = ["/careers", "/jobs", "/join", "/join-us", "/work-with-us", "/company/careers"];

function metaContent(html: string, key: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const found = html.match(pattern)?.[1];
    if (found) return collapse(decodeEntities(found));
  }
  return "";
}

function companyName(html: string, website: string): string {
  const site = metaContent(html, "og:site_name");
  if (site && site.length < 48 && !/career|jobs/i.test(site)) return site;
  const title = collapse(decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || ""));
  const piece = title.split(/\||—|–|-/).map((part) => part.trim()).find((part) => part && !/career|jobs|home/i.test(part));
  if (piece && piece.length < 48) return piece;
  const host = hostOf(website).split(".")[0] || "Company";
  return host.charAt(0).toUpperCase() + host.slice(1);
}

function careerScore(url: string, anchor: string): number {
  const blob = `${url} ${anchor}`.toLowerCase();
  let score = 0;
  if (/greenhouse|lever\.co|ashbyhq|smartrecruiters|myworkdayjobs|bamboohr|recruitee/.test(blob)) score += 10;
  if (/career/.test(blob)) score += 6;
  if (/\/jobs?\b|\/jobs?\//.test(blob)) score += 5;
  if (/work-with-us|join-us|openings|vacancies|we're hiring|we are hiring/.test(blob)) score += 4;
  if (/newsletter|login|sign-?in|privacy|cookie|account|blog|support/.test(blob)) score -= 8;
  return score;
}

function extractLinks(html: string, base: string): Array<{ url: string; text: string; score: number }> {
  const links: Array<{ url: string; text: string; score: number }> = [];
  const seen = new Set<string>();
  const absorb = (raw: string | undefined, text: string) => {
    if (!raw || /^(mailto:|tel:|javascript:)/i.test(raw)) return;
    let absolute: string;
    try {
      absolute = new URL(raw, base).toString();
      assertPublicUrl(absolute);
    } catch {
      return;
    }
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const score = careerScore(absolute, text);
    if (score > 0) links.push({ url: absolute, text, score });
  };

  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    absorb(match[1]?.trim(), collapse(decodeEntities((match[2] || "").replace(/<[^>]+>/g, " "))).slice(0, 180));
  }
  for (const match of html.matchAll(/<iframe\b[^>]*src\s*=\s*["']([^"']+)["']/gi)) {
    absorb(match[1]?.trim(), "iframe");
  }
  return links.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function boardSlug(website: string): string {
  const host = new URL(website).hostname.replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || "";
}

function clientScripts(pageUrl: string, html: string): string[] {
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    let absolute: string;
    try {
      absolute = new URL(match[1], pageUrl).toString();
      assertPublicUrl(absolute);
    } catch {
      continue;
    }
    if (new URL(absolute).origin !== origin) continue;
    if (/polyfill|webpack|cloudflare|email-decode|beacon/i.test(absolute)) continue;
    if (!/\.js(?:$|\?)/i.test(absolute)) continue;
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    found.push(absolute);
  }
  const rank = (url: string) => (/career|jobs|join/i.test(url) ? 3 : /\/app\//i.test(url) ? 2 : 1);
  return found.sort((a, b) => rank(b) - rank(a)).slice(0, 4);
}

const FEED_SKIP =
  /analytics|google|facebook|doubleclick|linkedin|twitter|cloudflare|sentry|segment|hotjar|stripe|font|image|\.css|\.woff|\.svg|\.png|\.jpe?g/i;
const FEED_HINT = /job|career|posting|opening|position|board|vacanc|greenhouse|lever|ashby|workday|recruitee|bamboohr|smartrecruiters|kula/i;

function candidateFeeds(pageUrl: string, blob: string): string[] {
  const normalized = blob.replace(/\\\//g, "/");
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    let url: URL;
    try {
      url = new URL(value, pageUrl);
      assertPublicUrl(url.toString());
    } catch {
      return;
    }
    if (url.toString() === pageUrl) return;
    const hint = `${url.hostname}${url.pathname}`;
    if (FEED_SKIP.test(hint) || !FEED_HINT.test(hint)) return;
    if (seen.has(url.toString())) return;
    seen.add(url.toString());
    found.push(url.toString());
  };

  for (const match of normalized.matchAll(/https?:\/\/[^\s"'`<>\\]{8,220}/gi)) {
    add(match[0].replace(/[,);]+$/, ""));
  }
  for (const match of normalized.matchAll(/["'](\/(?:api|jobs|careers|postings|openings)[^"'\\\s]{0,140})["']/gi)) {
    add(match[1]);
  }
  return found.slice(0, 6);
}

export async function inspectCareerDocument(pageUrl: string, html: string): Promise<JobSource | null> {
  const direct = detectSource(pageUrl, html);
  if (direct) return direct;

  const blobs = [html];
  for (const src of clientScripts(pageUrl, html)) {
    try {
      const file = await fetchText(src, 8000);
      if (file.status >= 400) continue;
      blobs.push(file.text);
      const nested = detectSource(file.url, file.text);
      if (nested) return nested;
    } catch {
      continue;
    }
  }

  for (const feedUrl of candidateFeeds(pageUrl, blobs.join("\n"))) {
    const known = detectSource(feedUrl, "");
    if (known) return known;
    try {
      const response = await fetchText(feedUrl, 8000);
      if (response.status >= 400) continue;
      const knownBody = detectSource(response.url, response.text.slice(0, 80_000));
      if (knownBody) return knownBody;
      if (jobsFromDocument(response.url, response.text).length > 0) {
        return { provider: "webpage", board: null, jobsUrl: response.url, label: "Careers feed" };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function probeKnownFeeds(website: string): Promise<JobSource | null> {
  const slug = boardSlug(website);
  if (!/^[a-z0-9-]{2,}$/i.test(slug)) return null;

  try {
    const greenhouse = await fetchJson<{ jobs?: unknown[] }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, undefined, 8000);
    if (greenhouse.status < 400 && Array.isArray(greenhouse.data.jobs)) {
      return {
        provider: "greenhouse",
        board: slug,
        jobsUrl: `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
        label: "Greenhouse",
      };
    }
  } catch {
    /* try the next public feed */
  }

  try {
    const lever = await fetchJson<unknown>(`https://api.lever.co/v0/postings/${slug}?mode=json`, undefined, 8000);
    if (lever.status < 400 && Array.isArray(lever.data)) {
      return {
        provider: "lever",
        board: slug,
        jobsUrl: `https://api.lever.co/v0/postings/${slug}?mode=json`,
        label: "Lever",
      };
    }
  } catch {
    /* try the next public feed */
  }

  try {
    const ashby = await fetchJson<{ jobs?: unknown[] }>(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
      undefined,
      8000
    );
    if (ashby.status < 400 && Array.isArray(ashby.data.jobs)) {
      return {
        provider: "ashby",
        board: slug,
        jobsUrl: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`,
        label: "Ashby",
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function discoverCompany(website: string): Promise<Discovery> {
  let home;
  try {
    home = await fetchText(website);
  } catch (error) {
    const message = error instanceof FetchError ? error.message : "The site could not be reached.";
    return {
      name: companyName("", website),
      blurb: "",
      website,
      careersUrl: null,
      source: null,
      pageUrl: null,
      pageHtml: null,
      error: message,
    };
  }

  if (home.status >= 400) {
    return {
      name: companyName(home.text, home.url),
      blurb: "",
      website: home.url,
      careersUrl: null,
      source: null,
      pageUrl: null,
      pageHtml: null,
      error: `The website answered with ${home.status}.`,
    };
  }

  const name = companyName(home.text, home.url);
  const blurb = metaContent(home.text, "description").slice(0, 240);
  const direct = detectSource(home.url, home.text);
  if (direct) {
    return {
      name,
      blurb,
      website: home.url,
      careersUrl: home.url,
      source: direct,
      pageUrl: home.url,
      pageHtml: null,
      error: null,
    };
  }

  const candidates = extractLinks(home.text, home.url);
  let bestPage: { url: string; html: string; score: number } | null = null;

  for (const candidate of candidates.slice(0, 5)) {
    try {
      const page = await fetchText(candidate.url);
      if (page.status >= 400) continue;
      const found = detectSource(page.url, page.text);
      if (found) {
        return {
          name,
          blurb,
          website: home.url,
          careersUrl: page.url,
          source: found,
          pageUrl: page.url,
          pageHtml: null,
          error: null,
        };
      }
      if (!bestPage || candidate.score > bestPage.score) {
        bestPage = { url: page.url, html: page.text, score: candidate.score };
      }
    } catch {
      continue;
    }
  }

  const origin = new URL(home.url).origin;
  for (const path of CAREER_PATHS) {
    if (bestPage && bestPage.score >= 6) break;
    try {
      const page = await fetchText(`${origin}${path}`);
      if (page.status >= 400) continue;
      const found = detectSource(page.url, page.text);
      if (found) {
        return {
          name,
          blurb,
          website: home.url,
          careersUrl: page.url,
          source: found,
          pageUrl: page.url,
          pageHtml: null,
          error: null,
        };
      }
      const score = careerScore(page.url, path);
      if (!bestPage || score > bestPage.score) bestPage = { url: page.url, html: page.text, score };
    } catch {
      continue;
    }
  }

  if (bestPage) {
    const embedded = await inspectCareerDocument(bestPage.url, bestPage.html);
    if (embedded) {
      return {
        name,
        blurb,
        website: home.url,
        careersUrl: bestPage.url,
        source: embedded,
        pageUrl: bestPage.url,
        pageHtml: null,
        error: null,
      };
    }
  }

  const probed = await probeKnownFeeds(home.url);
  const fallbackPage = bestPage || { url: home.url, html: home.text, score: 0 };
  if (probed) {
    return {
      name,
      blurb,
      website: home.url,
      careersUrl: bestPage?.url || home.url,
      source: probed,
      pageUrl: bestPage?.url || home.url,
      pageHtml: null,
      error: null,
    };
  }

  return {
    name,
    blurb,
    website: home.url,
    careersUrl: fallbackPage.url,
    source: {
      provider: "webpage",
      board: null,
      jobsUrl: fallbackPage.url,
      label: bestPage ? "Careers page" : "Website",
    },
    pageUrl: fallbackPage.url,
    pageHtml: fallbackPage.html,
    error: null,
  };
}
