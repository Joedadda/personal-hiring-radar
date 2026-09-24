export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedAt: string | null;
};

export type SearchOptions = {
  apiKey?: string;
  limit?: number;
  fetchImpl?: typeof fetch;
};

export type SearchOutcome =
  | { ok: true; results: SearchResult[] }
  | { ok: false; reason: "not_configured" | "failed" };

export type SearchProvider = {
  search(query: string, options?: SearchOptions): Promise<SearchOutcome>;
};
