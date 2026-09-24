import type { SearchOptions, SearchOutcome, SearchProvider } from "./types";
import { searchTavily } from "./tavily";

export function createSearchProvider(apiKey?: string): SearchProvider {
  return {
    search(query: string, options?: SearchOptions): Promise<SearchOutcome> {
      return searchTavily(query, { ...options, apiKey: options?.apiKey ?? apiKey });
    },
  };
}
