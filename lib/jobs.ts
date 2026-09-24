import { fetchJson, fetchText } from "./http";
import { collapse, htmlToText } from "./text";
import type { JobSource } from "./types";

export type FetchedJob = {
  externalId: string;
  title: string;
  url: string;
  location: string;
  department: string;
  descriptionText: string;
  postedAt: string | null;
  dateKind: "posted" | "updated" | null;
  employmentHint: string;
};

export type FetchJobsResult = { ok: true; jobs: FetchedJob[] } | { ok: false; error: string };

function iso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const time = Date.parse(value);
    if (!Number.isNaN(time)) return new Date(time).toISOString();
  }
  return null;
}

function textField(value: unknown): string {
  return typeof value === "string" ? collapse(htmlToText(value)) : "";
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function jobsFromJsonLd(pageUrl: string, html: string): FetchedJob[] {
  const found: FetchedJob[] = [];
  const visit = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const typeValue = record["@type"];
    const types = (Array.isArray(typeValue) ? typeValue : [typeValue]).filter((type) => typeof type === "string") as string[];
    if (types.includes("JobPosting") && typeof record.title === "string") {
      const hiring = record.hiringOrganization as { name?: string } | undefined;
      const location = record.jobLocation as { address?: { addressLocality?: string } } | { address?: { addressLocality?: string } }[] | undefined;
      const locality = Array.isArray(location) ? location[0]?.address?.addressLocality : location?.address?.addressLocality;
      found.push({
        externalId: String(record.identifier || record.url || record.title),
        title: collapse(record.title),
        url: typeof record.url === "string" ? record.url : pageUrl,
        location: locality || "",
        department: hiring?.name || "",
        descriptionText: textField(record.description).slice(0, 20_000),
        postedAt: iso(record.datePosted),
        dateKind: record.datePosted ? "posted" : null,
        employmentHint: typeof record.employmentType === "string" ? record.employmentType : "",
      });
    }
    if (record["@graph"]) visit(record["@graph"]);
  };

  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(match[1]));
    } catch {
      continue;
    }
  }
  return found.slice(0, 80);
}

function unescapeListing(html: string): string {
  let text = html;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text.replace(/\\"/g, '"');
    if (next === text) break;
    text = next;
  }
  return text.replace(/\\u0026/gi, "&");
}

export function extractKulaJobs(html: string, pageUrl: string): FetchedJob[] {
  const normalized = unescapeListing(html);
  const jobs: FetchedJob[] = [];
  const seen = new Set<string>();
  let origin = pageUrl;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = pageUrl;
  }

  const marker = /"job_board_url":"(https:\/\/careers\.kula\.ai\/[a-z0-9_-]+\/(\d+))"/gi;
  for (const match of normalized.matchAll(marker)) {
    const id = match[2];
    if (!id || seen.has(id)) continue;
    const window = normalized.slice(match.index || 0, (match.index || 0) + 900);
    const title = window.match(/"title":"((?:\\u[0-9a-fA-F]{4}|[^"\\])*)"/)?.[1];
    if (!title) continue;
    seen.add(id);
    const department = decodeJs(window.match(/"department":\{"id":\d+,"name":"([^"]+)"/)?.[1] || "");
    const location = decodeJs(window.match(/"location":"([^"]*)"/)?.[1] || "");
    const employment = window.match(/"employment_type":"([^"]+)"/)?.[1] || "";
    let url = match[1];
    try {
      url = new URL(`/careers/${id}`, origin).toString();
    } catch {
      url = match[1];
    }
    jobs.push({
      externalId: id,
      title: decodeJs(title),
      url,
      location,
      department,
      descriptionText: department ? `Department: ${department}` : "",
      postedAt: null,
      dateKind: null,
      employmentHint: employment.replace(/_/g, " "),
    });
  }
  return jobs;
}

function decodeJs(value: string): string {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

export function descriptionFromKulaHtml(html: string): string {
  const marker = '\\"description\\":\\"';
  const start = html.indexOf(marker);
  if (start < 0) return "";
  const rest = html.slice(start + marker.length);
  const end = rest.search(/\\"(?:,|})/);
  const raw = end >= 0 ? rest.slice(0, end) : rest.slice(0, 50_000);
  const decoded = raw
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"');
  return htmlToText(decoded).slice(0, 20_000);
}

function jobsFromAnchors(pageUrl: string, html: string): FetchedJob[] {
  const jobs: FetchedJob[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1];
    const title = collapse(htmlToText(match[2] || ""));
    if (!href || title.length < 4 || title.length > 90) continue;
    if (/^(jobs?|careers?|learn more|see open positions|view all|apply|read more|edit this page|open roles|we.?re hiring)$/i.test(title)) {
      continue;
    }
    let url = href;
    try {
      url = new URL(href, pageUrl).toString();
    } catch {
      continue;
    }
    if (!/\/(jobs?|positions|openings|careers)\/[^/?#]+/i.test(url) && !/greenhouse|lever\.co|ashbyhq/i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    jobs.push({
      externalId: url,
      title,
      url,
      location: "",
      department: "",
      descriptionText: "",
      postedAt: null,
      dateKind: null,
      employmentHint: "",
    });
    if (jobs.length >= 40) break;
  }
  return jobs;
}

function recordOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringAt(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    const nested = recordOf(value);
    if (nested && typeof nested.name === "string" && nested.name.trim()) return nested.name.trim();
  }
  return "";
}

function jobFromRecord(record: Record<string, unknown>, pageUrl: string): FetchedJob | null {
  const title = stringAt(record, ["title", "jobTitle", "job_title", "position", "positionTitle", "name", "text"]);
  if (title.length < 4 || title.length > 140) return null;
  if (/^(home|about|blog|careers?|jobs?|contact|privacy|login|apply)$/i.test(title)) return null;
  const location = stringAt(record, ["location", "office", "city"]);
  const department = stringAt(record, ["department", "team", "category"]);
  const description = textField(
    record.content || record.description || record.descriptionPlain || record.descriptionHtml || record.description_plain
  );
  let url = stringAt(record, ["absolute_url", "absoluteUrl", "hostedUrl", "jobUrl", "applyUrl", "url", "link"]);
  if (url && !/^https?:\/\//i.test(url)) {
    try {
      url = new URL(url, pageUrl).toString();
    } catch {
      url = "";
    }
  }
  const distinctUrl = Boolean(url) && url !== pageUrl;
  if (!location && !department && !description && !distinctUrl) return null;
  const externalId = String(record.id ?? record.internal_job_id ?? url ?? title);
  return {
    externalId,
    title: collapse(htmlToText(title)),
    url: url || pageUrl,
    location: collapse(htmlToText(location)),
    department: collapse(htmlToText(department)),
    descriptionText: description.slice(0, 20_000),
    postedAt: iso(record.updated_at || record.publishedAt || record.createdAt || record.datePosted || record.posted_at),
    dateKind: record.datePosted || record.createdAt || record.posted_at ? "posted" : record.updated_at || record.publishedAt ? "updated" : null,
    employmentHint: stringAt(record, ["employmentType", "employment_type", "commitment", "type"]),
  };
}

export function jobsFromUnknownJson(pageUrl: string, data: unknown): FetchedJob[] {
  const arrays: unknown[][] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 6 || node == null) return;
    if (Array.isArray(node)) {
      if (node.length >= 1 && node.length <= 200 && node.every((item) => recordOf(item))) arrays.push(node);
      for (const item of node.slice(0, 40)) visit(item, depth + 1);
      return;
    }
    const record = recordOf(node);
    if (!record) return;
    for (const value of Object.values(record)) visit(value, depth + 1);
  };
  visit(data, 0);

  let best: FetchedJob[] = [];
  for (const array of arrays) {
    const jobs: FetchedJob[] = [];
    const seen = new Set<string>();
    for (const item of array) {
      const record = recordOf(item);
      if (!record) continue;
      const job = jobFromRecord(record, pageUrl);
      if (!job || seen.has(job.externalId)) continue;
      seen.add(job.externalId);
      jobs.push(job);
      if (jobs.length >= 80) break;
    }
    if (jobs.length > best.length) best = jobs;
  }
  return best;
}

function jobsFromEmbeddedJson(pageUrl: string, html: string): FetchedJob[] {
  let best: FetchedJob[] = [];
  const blocks = [
    ...html.matchAll(/<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ...html.matchAll(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const match of blocks) {
    try {
      const jobs = jobsFromUnknownJson(pageUrl, JSON.parse(match[1]));
      if (jobs.length > best.length) best = jobs;
    } catch {
      continue;
    }
  }
  return best;
}

export function jobsFromDocument(pageUrl: string, body: string): FetchedJob[] {
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const jobs = jobsFromUnknownJson(pageUrl, JSON.parse(trimmed));
      if (jobs.length > 0) return jobs;
    } catch {
      /* The body is HTML that happens to start with a brace. */
    }
  }
  return jobsFromHtml(pageUrl, body);
}

export function jobsFromHtml(pageUrl: string, html: string): FetchedJob[] {
  const kula = extractKulaJobs(html, pageUrl);
  if (kula.length > 0) return kula;
  const structured = jobsFromJsonLd(pageUrl, html);
  if (structured.length > 0) return structured;
  const embedded = jobsFromEmbeddedJson(pageUrl, html);
  if (embedded.length > 0) return embedded;
  return jobsFromAnchors(pageUrl, html);
}

async function fetchGreenhouse(source: JobSource): Promise<FetchJobsResult> {
  if (!source.jobsUrl || !source.board) return { ok: false, error: "Greenhouse board id was missing." };
  try {
    const response = await fetchJson<{
      jobs?: Array<{
        id: number;
        title: string;
        absolute_url: string;
        updated_at?: string;
        location?: { name?: string };
        content?: string;
        departments?: Array<{ name?: string }>;
        metadata?: Array<{ name?: string; value?: string | null }>;
      }>;
    }>(source.jobsUrl, undefined, 25_000);
    if (response.status >= 400 || !Array.isArray(response.data.jobs)) {
      return { ok: false, error: `Greenhouse did not list jobs for ${source.board}.` };
    }
    return {
      ok: true,
      jobs: response.data.jobs.map((job) => ({
        externalId: String(job.id),
        title: job.title || "Untitled role",
        url: job.absolute_url,
        location: job.location?.name || "",
        department: job.departments?.find((item) => item.name)?.name || "",
        descriptionText: textField(job.content).slice(0, 20_000),
        postedAt: iso(job.updated_at),
        dateKind: job.updated_at ? "updated" : null,
        employmentHint: job.metadata?.map((item) => item.value || "").join(" ") || "",
      })),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Greenhouse could not be read." };
  }
}

async function fetchLever(source: JobSource): Promise<FetchJobsResult> {
  if (!source.jobsUrl) return { ok: false, error: "Lever board was missing." };
  try {
    const response = await fetchJson<
      Array<{
        id: string;
        text: string;
        hostedUrl: string;
        createdAt?: number;
        descriptionPlain?: string;
        description?: string;
        categories?: { commitment?: string; location?: string; team?: string };
        lists?: Array<{ text?: string; content?: string }>;
      }>
    >(source.jobsUrl);
    if (response.status >= 400 || !Array.isArray(response.data)) {
      return { ok: false, error: `Lever did not list jobs for ${source.board}.` };
    }
    return {
      ok: true,
      jobs: response.data.map((job) => {
        const lists = (job.lists || []).map((list) => `${list.text || ""}\n${textField(list.content)}`).join("\n");
        return {
          externalId: job.id,
          title: job.text || "Untitled role",
          url: job.hostedUrl,
          location: job.categories?.location || "",
          department: job.categories?.team || "",
          descriptionText: collapse(`${job.descriptionPlain || textField(job.description)}\n${lists}`).slice(0, 20_000),
          postedAt: iso(job.createdAt),
          dateKind: job.createdAt ? "posted" : null,
          employmentHint: job.categories?.commitment || "",
        };
      }),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Lever could not be read." };
  }
}

async function fetchAshby(source: JobSource): Promise<FetchJobsResult> {
  if (!source.jobsUrl) return { ok: false, error: "Ashby board was missing." };
  try {
    const response = await fetchJson<{
      jobs?: Array<{
        id?: string;
        title?: string;
        jobUrl?: string;
        location?: string;
        department?: string;
        team?: string;
        publishedAt?: string;
        descriptionPlain?: string;
        descriptionHtml?: string;
        employmentType?: string;
        isListed?: boolean;
      }>;
    }>(source.jobsUrl);
    const data = response.data as {
      jobs?: Array<{
        id?: string;
        title?: string;
        jobUrl?: string;
        location?: string;
        department?: string;
        team?: string;
        publishedAt?: string;
        descriptionPlain?: string;
        descriptionHtml?: string;
        employmentType?: string;
        isListed?: boolean;
      }>;
    };
    const jobs = (data.jobs || []).filter((job) => job.isListed !== false);
    if (response.status >= 400) return { ok: false, error: `Ashby did not list jobs for ${source.board}.` };
    return {
      ok: true,
      jobs: jobs.map((job) => ({
        externalId: String(job.id || job.jobUrl || job.title),
        title: job.title || "Untitled role",
        url: job.jobUrl || source.jobsUrl || "",
        location: job.location || "",
        department: job.department || job.team || "",
        descriptionText: collapse(job.descriptionPlain || textField(job.descriptionHtml)).slice(0, 20_000),
        postedAt: iso(job.publishedAt),
        dateKind: job.publishedAt ? "posted" : null,
        employmentHint: job.employmentType || "",
      })),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Ashby could not be read." };
  }
}

async function fetchSmartRecruiters(source: JobSource): Promise<FetchJobsResult> {
  if (!source.jobsUrl || !source.board) return { ok: false, error: "SmartRecruiters company was missing." };
  try {
    const response = await fetchJson<{
      content?: Array<{
        id: string;
        name: string;
        releasedDate?: string;
        location?: { city?: string; region?: string; country?: string };
        department?: { label?: string };
        typeOfEmployment?: { label?: string };
        ref?: string;
      }>;
    }>(source.jobsUrl);
    const postings = (response.data.content || []).slice(0, 25);
    if (response.status >= 400) return { ok: false, error: `SmartRecruiters did not list jobs for ${source.board}.` };
    const detailed = await mapPool(postings, 4, async (posting) => {
      let description = "";
      try {
        const detail = await fetchJson<{
          jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
        }>(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(source.board || "")}/postings/${posting.id}`);
        description = Object.values(detail.data.jobAd?.sections || {})
          .map((section) => `${section.title || ""}\n${textField(section.text)}`)
          .join("\n");
      } catch {
        description = "";
      }
      const location = [posting.location?.city, posting.location?.region, posting.location?.country].filter(Boolean).join(", ");
      return {
        externalId: posting.id,
        title: posting.name || "Untitled role",
        url: posting.ref || `https://jobs.smartrecruiters.com/${source.board}/${posting.id}`,
        location,
        department: posting.department?.label || "",
        descriptionText: collapse(description).slice(0, 20_000),
        postedAt: iso(posting.releasedDate),
        dateKind: posting.releasedDate ? "posted" : null,
        employmentHint: posting.typeOfEmployment?.label || "",
      } satisfies FetchedJob;
    });
    return { ok: true, jobs: detailed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "SmartRecruiters could not be read." };
  }
}

async function fetchWorkday(source: JobSource): Promise<FetchJobsResult> {
  if (!source.jobsUrl) return { ok: false, error: "Workday feed was missing." };
  try {
    const response = await fetchJson<{
      jobPostings?: Array<{ title?: string; externalPath?: string; locationsText?: string; postedOn?: string }>;
    }>(source.jobsUrl, { method: "POST", body: { appliedFacets: {}, limit: 20, offset: 0, searchText: "" } });
    const postings = response.data.jobPostings || [];
    if (response.status >= 400) return { ok: false, error: "Workday did not return a public job list." };
    const base = source.jobsUrl.replace(/\/jobs$/, "");
    const host = new URL(source.jobsUrl).origin;
    const detailed = await mapPool(postings, 3, async (posting) => {
      const path = posting.externalPath || "";
      let description = "";
      if (path) {
        try {
          const detail = await fetchJson<{ jobPostingInfo?: { jobDescription?: string; location?: string } }>(`${base}${path}`);
          description = textField(detail.data.jobPostingInfo?.jobDescription);
        } catch {
          description = "";
        }
      }
      return {
        externalId: path || posting.title || "workday-job",
        title: posting.title || "Untitled role",
        url: path ? `${host}${path}` : host,
        location: posting.locationsText || "",
        department: "",
        descriptionText: description.slice(0, 20_000),
        postedAt: null,
        dateKind: null,
        employmentHint: posting.postedOn || "",
      } satisfies FetchedJob;
    });
    return { ok: true, jobs: detailed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Workday could not be read." };
  }
}

async function fetchBamboo(source: JobSource): Promise<FetchJobsResult> {
  if (!source.jobsUrl || !source.board) return { ok: false, error: "BambooHR board was missing." };
  try {
    const response = await fetchJson<{ result?: Array<Record<string, string>> } | Array<Record<string, string>>>(source.jobsUrl);
    const rows = Array.isArray(response.data) ? response.data : response.data.result || [];
    if (response.status >= 400) return { ok: false, error: "BambooHR did not list jobs." };
    const detailed = await mapPool(rows.slice(0, 20), 3, async (row) => {
      const id = String(row.id || row.jobOpeningName);
      const url = `https://${source.board}.bamboohr.com/careers/${id}`;
      let description = "";
      try {
        const page = await fetchText(url);
        description = htmlToText(page.text).slice(0, 12_000);
      } catch {
        description = "";
      }
      return {
        externalId: id,
        title: row.jobOpeningName || "Untitled role",
        url,
        location: row.locationLabel || "",
        department: row.departmentLabel || "",
        descriptionText: description,
        postedAt: null,
        dateKind: null,
        employmentHint: row.employmentStatusLabel || "",
      } satisfies FetchedJob;
    });
    return { ok: true, jobs: detailed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "BambooHR could not be read." };
  }
}

async function fetchRecruitee(source: JobSource): Promise<FetchJobsResult> {
  if (!source.jobsUrl) return { ok: false, error: "Recruitee board was missing." };
  try {
    const response = await fetchJson<{
      offers?: Array<{
        id?: number;
        title?: string;
        description?: string;
        careers_url?: string;
        city?: string;
        department?: string;
        published_at?: string;
        employment_type_code?: string;
      }>;
    }>(source.jobsUrl);
    if (response.status >= 400) return { ok: false, error: "Recruitee did not list jobs." };
    return {
      ok: true,
      jobs: (response.data.offers || []).map((offer) => ({
        externalId: String(offer.id || offer.careers_url || offer.title),
        title: offer.title || "Untitled role",
        url: offer.careers_url || source.jobsUrl || "",
        location: offer.city || "",
        department: offer.department || "",
        descriptionText: textField(offer.description).slice(0, 20_000),
        postedAt: iso(offer.published_at),
        dateKind: offer.published_at ? "posted" : null,
        employmentHint: offer.employment_type_code || "",
      })),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Recruitee could not be read." };
  }
}

async function fetchKula(source: JobSource, pageHtml?: string | null, pageUrl?: string | null): Promise<FetchJobsResult> {
  try {
    let html = pageHtml || "";
    let url = pageUrl || source.jobsUrl || "";
    if (!html && url) {
      const page = await fetchText(url);
      html = page.text;
      url = page.url;
    }
    const listed = extractKulaJobs(html, url);
    if (listed.length === 0) return { ok: true, jobs: [] };
    const jobs = await mapPool(listed, 4, async (job) => {
      try {
        const detail = await fetchText(`https://careers.kula.ai/${source.board}/${job.externalId}`);
        const description = descriptionFromKulaHtml(detail.text);
        return {
          ...job,
          descriptionText: collapse(`${job.descriptionText}\n${description}`).slice(0, 20_000),
        };
      } catch {
        return job;
      }
    });
    return { ok: true, jobs };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Kula could not be read." };
  }
}

export async function fetchJobs(source: JobSource, pageHtml?: string | null, pageUrl?: string | null): Promise<FetchJobsResult> {
  switch (source.provider) {
    case "greenhouse":
      return fetchGreenhouse(source);
    case "lever":
      return fetchLever(source);
    case "ashby":
      return fetchAshby(source);
    case "smartrecruiters":
      return fetchSmartRecruiters(source);
    case "workday":
      return fetchWorkday(source);
    case "bamboohr":
      return fetchBamboo(source);
    case "recruitee":
      return fetchRecruitee(source);
    case "kula":
      return fetchKula(source, pageHtml, pageUrl);
    case "webpage": {
      let html = pageHtml || "";
      let url = pageUrl || source.jobsUrl || "";
      if (!html && source.jobsUrl) {
        try {
          const response = await fetchText(source.jobsUrl);
          if (response.status >= 400) return { ok: false, error: `The careers feed answered with ${response.status}.` };
          html = response.text;
          url = response.url;
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "The careers feed could not be read." };
        }
      }
      if (!html || !url) return { ok: true, jobs: [] };
      return { ok: true, jobs: jobsFromDocument(url, html) };
    }
    default:
      return { ok: false, error: "Unknown job source." };
  }
}
