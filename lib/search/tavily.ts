import type { SearchOptions, SearchOutcome, SearchResult } from "./types";

const RESULT_CAP = 5;

type TavilyHit = {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
};

export async function searchTavily(query: string, options: SearchOptions = {}): Promise<SearchOutcome> {
  const apiKey = options.apiKey ?? process.env.SEARCH_API_KEY ?? "";
  if (!apiKey) return { ok: false, reason: "not_configured" };
  const limit = Math.min(options.limit ?? RESULT_CAP, RESULT_CAP);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: limit,
        search_depth: "basic",
        include_domains: ["linkedin.com"],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return { ok: false, reason: "failed" };
    const body = (await response.json()) as { results?: TavilyHit[] };
    const results: SearchResult[] = [];
    for (const hit of body.results ?? []) {
      const url = hit.url || "";
      if (/lnkd\.in/i.test(url) || !/https?:\/\/([a-z0-9-]+\.)?linkedin\.com\/(posts|feed)\//i.test(url)) continue;
      results.push({
        title: (hit.title || "").trim(),
        url,
        snippet: (hit.content || "").trim(),
        publishedAt: hit.published_date?.trim() || null,
      });
      if (results.length >= limit) break;
    }
    return { ok: true, results };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
